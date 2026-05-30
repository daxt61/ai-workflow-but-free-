import { ChatMessage, ToolDefinition } from '@shared/types'
import { LLMClient } from '../services/LLMClient'
import { OpenRouterClient } from '../services/OpenRouterClient'
import { GroqClient } from '../services/GroqClient'
import { GeminiClient } from '../services/GeminiClient'
import { CancellationToken } from './CancellationToken'
import { LogEntry } from '@shared/types'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface AIWorker {
  id: string
  modelId: string
  client: LLMClient
  status: 'idle' | 'working' | 'thinking' | 'failed'
  lastAction: string
}

export class AIManager {
  private workers: AIWorker[] = []
  private taskBoardPath: string = ''
  private projectFolder: string = ''

  constructor(
    private getOpenRouterKey: () => string | null,
    private getGroqKey: () => string | null,
    private getGeminiKey: () => string | null,
    private onLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void
  ) {}

  setProjectFolder(folder: string) {
    this.projectFolder = folder
    this.taskBoardPath = path.join(folder, '.slowburn_tasks.md')
  }

  async initTaskBoard(taskDescription: string) {
    if (!this.projectFolder) return
    const initialContent = `# SlowBurn Task Board\n\n## Main Task\n${taskDescription}\n\n## Sub-tasks\n- [ ] Research the task requirements\n- [ ] Create a detailed plan\n\n## AI Worker Status\n(initialized)\n`
    await fs.writeFile(this.taskBoardPath, initialContent)
  }

  async updateTaskBoard(content: string) {
    if (!this.taskBoardPath) return
    await fs.writeFile(this.taskBoardPath, content)
  }

  async readTaskBoard(): Promise<string> {
    if (!this.taskBoardPath) return ''
    try {
      return await fs.readFile(this.taskBoardPath, 'utf8')
    } catch {
      return ''
    }
  }

  setupWorkers(modelPool: string[], primaryModelId: string) {
    const allModels = [...new Set([primaryModelId, ...modelPool])]
    this.workers = allModels.map((modelId, index) => {
      let client: LLMClient
      const groqKey = this.getGroqKey()
      const geminiKey = this.getGeminiKey()

      // Only use direct clients if API keys are provided AND it matches the specific provider
      if (geminiKey && (modelId.includes('gemini') || modelId.includes('gemma')) && !modelId.includes(':')) {
        client = new GeminiClient(this.getGeminiKey, modelId)
      } else if (groqKey && (modelId.includes('llama') || modelId.includes('mixtral')) && !modelId.includes(':')) {
        client = new GroqClient(this.getGroqKey, modelId)
      } else {
        client = new OpenRouterClient(this.getOpenRouterKey, modelId)
      }

      return {
        id: `worker-${index + 1}`,
        modelId,
        client,
        status: 'idle',
        lastAction: 'Initialized'
      }
    })
  }

  async runWithFallback(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    cancellationToken?: CancellationToken
  ): Promise<ChatMessage> {
    let lastError: Error | null = null

    for (const worker of this.workers) {
      worker.status = 'working'
      try {
        const response = await worker.client.chatCompletion(messages, tools, cancellationToken?.signal)
        worker.status = 'idle'
        worker.lastAction = 'Completed turn'
        return response
      } catch (err) {
        console.error(`Worker ${worker.id} (${worker.modelId}) failed:`, err)
        worker.status = 'failed'
        worker.lastAction = `Error: ${err instanceof Error ? err.message : String(err)}`
        lastError = err instanceof Error ? err : new Error(String(err))
        this.onLog({
          type: 'error',
          phase: 'implementation',
          content: `Worker ${worker.id} failed, falling back to next model...`
        })
        continue
      }
    }
    throw lastError ?? new Error('All workers failed')
  }

  async runParallel(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    cancellationToken?: CancellationToken
  ): Promise<ChatMessage[]> {
    if (this.workers.length === 0) {
      throw new Error('No workers configured in the pool')
    }

    this.onLog({
      type: 'phase_progress',
      phase: 'implementation',
      content: `Manager: Coordinating ${this.workers.length} workers in parallel...`
    })

    const board = await this.readTaskBoard()
    const results = await Promise.allSettled(
      this.workers.map(async (worker, index) => {
        worker.status = 'working'
        const workerSpecificMessages = [
          ...messages,
          {
            role: 'system' as const,
            content: `You are worker ${worker.id}. The current task board is:\n${board}\n\nChoose a sub-task that isn't being worked on, or help with an existing one. If you are worker 1, you are the Lead and should focus on high-level coordination and final reviews.`
          }
        ]
        try {
          const response = await worker.client.chatCompletion(workerSpecificMessages, tools, cancellationToken?.signal)
          worker.status = 'idle'
          worker.lastAction = 'Completed parallel task'
          return response
        } catch (err) {
          worker.status = 'failed'
          worker.lastAction = `Error: ${err instanceof Error ? err.message : String(err)}`
          throw err
        }
      })
    )

    return results
      .filter((r): r is PromiseFulfilledResult<ChatMessage> => r.status === 'fulfilled')
      .map((r) => r.value)
  }

  getWorkers() {
    return this.workers
  }
}
