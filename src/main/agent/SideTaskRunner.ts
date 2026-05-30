import { AGENT_TOOLS } from '@shared/tools'
import { MAX_SIDE_TOOL_CALLS, SIDE_BEAT_BREATHE_MS } from '@shared/agentConfig'
import type { AgentPhase, ChatMessage, LogEntry } from '@shared/types'
import type { OpenRouterClient } from '../services/OpenRouterClient'
import type { CancellationToken } from './CancellationToken'
import type { ToolExecutor } from './ToolExecutor'
import { buildPhaseSystemPrompt } from './phasePrompts'
import { pickSideTask, SIDE_TASK_SYSTEM } from './sideTaskPrompts'

async function briefPause(ms: number, token: CancellationToken): Promise<void> {
  const step = 300
  let elapsed = 0
  while (elapsed < ms) {
    token.throwIfCancelled()
    await new Promise((r) => setTimeout(r, Math.min(step, ms - elapsed)))
    elapsed += step
  }
}

export class SideTaskRunner {
  private beatCounters = new Map<AgentPhase, number>()

  async runBeat(
    phase: AgentPhase,
    taskDescription: string,
    history: ChatMessage[],
    openRouterClient: OpenRouterClient,
    toolExecutor: ToolExecutor,
    cancellationToken: CancellationToken,
    onLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void,
    toolsEnabled: boolean
  ): Promise<void> {
    const beatIndex = this.beatCounters.get(phase) ?? 0
    this.beatCounters.set(phase, beatIndex + 1)
    const task = pickSideTask(phase, beatIndex)

    onLog({
      type: 'side_task',
      phase,
      content: `⚡ Side task: ${task}`,
      metadata: { beatIndex }
    })

    history.push({
      role: 'user',
      content: `[SIDE-TASK BEAT — quick, focused]\n${task}\n\nKeep it short. Think, then act if useful.`
    })

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${buildPhaseSystemPrompt(phase, taskDescription)}\n\n---\n${SIDE_TASK_SYSTEM}`
      },
      ...history
    ]

    const assistantMessage = await openRouterClient.chatCompletion(
      messages,
      toolsEnabled ? AGENT_TOOLS : undefined
    )

    cancellationToken.throwIfCancelled()
    history.push(assistantMessage)

    if (assistantMessage.reasoning?.trim()) {
      onLog({
        type: 'thinking',
        phase,
        content: assistantMessage.reasoning,
        metadata: { beatIndex, sideTask: true }
      })
    }

    if (assistantMessage.content?.trim()) {
      onLog({
        type: 'reasoning',
        phase,
        content: assistantMessage.content,
        metadata: { beatIndex, sideTask: true }
      })
    }

    const toolCalls = assistantMessage.tool_calls ?? []
    let executed = 0

    for (const call of toolCalls) {
      if (executed >= MAX_SIDE_TOOL_CALLS) {
        onLog({
          type: 'phase_progress',
          phase,
          content: `Side task: tool limit (${MAX_SIDE_TOOL_CALLS}) reached — continuing main loop`
        })
        break
      }

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
      executed++
    }

    await briefPause(SIDE_BEAT_BREATHE_MS, cancellationToken)
  }

  reset(): void {
    this.beatCounters.clear()
  }
}
