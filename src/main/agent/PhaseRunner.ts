import { AGENT_TOOLS } from '@shared/tools'
import {
  MAX_TURNS_PER_PHASE,
  MIN_PHASE_MS,
  MIN_REASONING_CHARS,
  MIN_TURNS_PER_PHASE,
  PHASES_WITHOUT_TOOLS
} from '@shared/agentConfig'
import type { AgentPhase, ChatMessage, LogEntry } from '@shared/types'
import type { OpenRouterClient } from '../services/OpenRouterClient'
import type { CancellationToken } from './CancellationToken'
import type { ToolExecutor } from './ToolExecutor'
import { AIManager } from './AIManager'
import { SideTaskRunner } from './SideTaskRunner'
import { buildPhaseSystemPrompt, CONTINUE_THINKING } from './phasePrompts'
import { randomUUID } from 'crypto'

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000)
  const min = Math.floor(sec / 60)
  const remSec = sec % 60
  return min > 0 ? `${min}m ${remSec}s` : `${sec}s`
}

export class PhaseRunner {
  private sideTaskRunner = new SideTaskRunner()

  async run(
    phase: AgentPhase,
    taskDescription: string,
    messageHistory: ChatMessage[],
    openRouterClient: OpenRouterClient,
    toolExecutor: ToolExecutor,
    cancellationToken: CancellationToken,
    onLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void,
    aiManager?: AIManager
  ): Promise<ChatMessage[]> {
    const history = [...messageHistory]
    const phaseStart = Date.now()
    const minPhaseMs = MIN_PHASE_MS[phase]
    const minTurns = MIN_TURNS_PER_PHASE[phase]
    const maxTurns = MAX_TURNS_PER_PHASE[phase]
    const minChars = MIN_REASONING_CHARS[phase]
    const toolsEnabled = !PHASES_WITHOUT_TOOLS.includes(phase)
    this.sideTaskRunner.reset()

    onLog({
      type: 'phase_header',
      phase,
      content: `▶ ${phase.replace(/_/g, ' ').toUpperCase()} — target ≥${formatDuration(minPhaseMs)}, ${minTurns}+ turns · side-task beats between turns`
    })

    let turn = 0

    const runSideBeat = async (): Promise<void> => {
      await this.sideTaskRunner.runBeat(
        phase,
        taskDescription,
        history,
        openRouterClient,
        toolExecutor,
        cancellationToken,
        onLog,
        toolsEnabled
      )
    }

    while (turn < maxTurns) {
      turn++
      cancellationToken.throwIfCancelled()

      const elapsed = Date.now() - phaseStart
      onLog({
        type: 'phase_progress',
        phase,
        content: `Turn ${turn}/${maxTurns} · phase time ${formatDuration(elapsed)}`,
        metadata: { turn, elapsedMs: elapsed }
      })

      const messages: ChatMessage[] = [
        { role: 'system', content: buildPhaseSystemPrompt(phase, taskDescription) },
        ...history
      ]

      let assistantMessage: ChatMessage

      if (aiManager) {
        if (aiManager.getWorkers().length > 1 && (phase === 'implementation' || phase === 'research')) {
          const results = await aiManager.runParallel(messages, toolsEnabled ? AGENT_TOOLS : undefined, cancellationToken)
          if (results.length > 0) {
            // Use the Lead worker (worker 1) as the primary history keeper
            assistantMessage = results[0]
            history.push(assistantMessage)

            // Execute tool calls for the lead worker
            const leadTc = assistantMessage.tool_calls
            if (leadTc && leadTc.length > 0) {
              for (const call of leadTc) {
                cancellationToken.throwIfCancelled()
                let args: Record<string, string> = {}
                try { args = JSON.parse(call.function.arguments) } catch {}
                const result = await toolExecutor.execute(call.function.name, args)
                history.push({
                  role: 'tool',
                  tool_call_id: call.id,
                  name: call.function.name,
                  content: result
                })
              }
            }

            // For other workers, execute their tools and log results but don't pollute the main history
            // except for updates to the task board which we want to persist.
            for (const res of results.slice(1)) {
              const tc = res.tool_calls
              if (tc && tc.length > 0) {
                for (const call of tc) {
                  cancellationToken.throwIfCancelled()
                  let args: Record<string, string> = {}
                  try { args = JSON.parse(call.function.arguments) } catch {}
                  // If it's a task board update, we execute it to keep workers synced
                  await toolExecutor.execute(call.function.name, args)
                  if (call.function.name === 'write_file' && args.path?.endsWith('.slowburn_tasks.md')) {
                    onLog({
                      type: 'phase_progress',
                      phase,
                      content: `Worker ${results.indexOf(res) + 1} updated the task board.`
                    })
                  }
                }
              }
            }

            // Log other worker results
            results.slice(1).forEach((res, idx) => {
              onLog({
                type: 'reasoning',
                phase,
                content: `Worker ${idx + 2} (${aiManager.getWorkers()[idx + 1].modelId}):\n${res.content}`,
                metadata: { turn, worker: idx + 2 }
              })
            })
          } else {
            // If all parallel workers failed, try with fallback logic
            assistantMessage = await aiManager.runWithFallback(messages, toolsEnabled ? AGENT_TOOLS : undefined, cancellationToken)
          }
        } else {
          // Use sequential fallback for phases that don't support parallel swarm
          assistantMessage = await aiManager.runWithFallback(messages, toolsEnabled ? AGENT_TOOLS : undefined, cancellationToken)
        }
      } else {
        assistantMessage = await openRouterClient.chatCompletion(
          messages,
          toolsEnabled ? AGENT_TOOLS : undefined
        )
      }

      cancellationToken.throwIfCancelled()
      if (!aiManager || aiManager.getWorkers().length <= 1 || (phase !== 'implementation' && phase !== 'research')) {
        history.push(assistantMessage)
      }

      const reasoningText = assistantMessage.reasoning?.trim() ?? ''
      const contentText = assistantMessage.content?.trim() ?? ''

      if (reasoningText) {
        onLog({
          type: 'thinking',
          phase,
          content: reasoningText,
          metadata: { turn, kind: 'model_reasoning' }
        })
      }

      if (contentText) {
        onLog({
          type: 'reasoning',
          phase,
          content: contentText,
          metadata: { turn }
        })
      }

      const toolCalls = assistantMessage.tool_calls
      const hasTools = Boolean(toolCalls?.length)
      const combinedLength = reasoningText.length + contentText.length
      const phaseElapsed = Date.now() - phaseStart
      const meetsTurnCount = turn >= minTurns
      const meetsTime = phaseElapsed >= minPhaseMs
      const meetsDepth = combinedLength >= minChars || hasTools

      if (!hasTools && meetsTurnCount && meetsTime && meetsDepth) {
        onLog({
          type: 'phase_progress',
          phase,
          content: `Phase complete after ${turn} turns (${formatDuration(phaseElapsed)})`
        })
        break
      }

      if (!hasTools && turn < minTurns) {
        history.push({ role: 'user', content: CONTINUE_THINKING[phase] })
        await runSideBeat()
        continue
      }

      if (!hasTools && !meetsDepth) {
        history.push({
          role: 'user',
          content: `${CONTINUE_THINKING[phase]}\n\nYour last reply was too short (${combinedLength} chars). Write a much longer thinking block (target ≥${minChars} chars) before ending this turn.`
        })
        await runSideBeat()
        continue
      }

      if (!hasTools && !meetsTime) {
        const remaining = minPhaseMs - phaseElapsed
        history.push({
          role: 'user',
          content: `${CONTINUE_THINKING[phase]}\n\nContinue working — this phase should run ~${formatDuration(minPhaseMs)} total (~${formatDuration(remaining)} remaining). Go deeper.`
        })
        await runSideBeat()
        continue
      }

      if (!hasTools) {
        break
      }

      for (const call of toolCalls!) {
        cancellationToken.throwIfCancelled()
        let args: Record<string, string> = {}
        try {
          args = JSON.parse(call.function.arguments) as Record<string, string>
        } catch {
          args = {}
        }

        const result = await toolExecutor.execute(call.function.name, args)
        history.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content: result
        })
      }

      // Productive gap: quick side task (clarity, debug, lint, re-read) instead of idle wait
      await runSideBeat()
    }

    if (turn >= maxTurns) {
      onLog({
        type: 'phase_progress',
        phase,
        content: `Phase reached max turns (${maxTurns}) — advancing`
      })
    }

    return history
  }
}

export function createLogEntry(
  partial: Omit<LogEntry, 'id' | 'timestamp'>
): LogEntry {
  return { ...partial, id: randomUUID(), timestamp: Date.now() }
}
