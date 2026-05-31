import { ChatMessage, ToolDefinition, TaskBoardState, WorkerStatus } from '@shared/types'
import { LLMClient } from '../services/LLMClient'
import { OpenRouterClient } from '../services/OpenRouterClient'
import { GroqClient } from '../services/GroqClient'
import { GeminiClient } from '../services/GeminiClient'
import { LLM7Client } from '../services/LLM7Client'
import { CancellationToken } from './CancellationToken'
import { LogEntry } from '@shared/types'
import * as fs from 'fs/promises'
import * as path from 'path'
import { IPC } from '@shared/ipc'
import { BrowserWindow } from 'electron'

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
  private memoryPath: string = ''
  private projectFolder: string = ''
  private boardState: TaskBoardState = { mainTask: '', subTasks: [] }

  constructor(
    private getOpenRouterKey: () => string | null,
    private getGroqKey: () => string | null,
    private getGeminiKey: () => string | null,
    private getLLM7Key: () => string | null,
    private onLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void,
    private getWindow: () => BrowserWindow | null
  ) {}

  setProjectFolder(folder: string) {
    this.projectFolder = folder
    this.taskBoardPath = path.join(folder, '.slowburn_tasks.md')
    this.memoryPath = path.join(folder, '.slowburn_memory.json')
  }

  private emit(channel: string, payload: unknown): void {
    const win = this.getWindow()
    win?.webContents.send(channel, payload)
  }

  private updateWorkerStatus() {
    const statuses: WorkerStatus[] = this.workers.map((w) => ({
      id: w.id,
      modelId: w.modelId,
      status: w.status,
      lastAction: w.lastAction
    }))
    this.emit(IPC.WORKER_STATUS_UPDATE, statuses)
  }

  async initTaskBoard(taskDescription: string) {
    if (!this.projectFolder) return
    this.boardState = {
      mainTask: taskDescription,
      subTasks: [
        { id: 't1', title: 'Research task requirements', description: 'Analyze the codebase and requirements', status: 'todo' },
        { id: 't2', title: 'Create detailed plan', description: 'Draft a step-by-step implementation plan', status: 'todo' }
      ]
    }
    await this.saveBoard()
    this.updateWorkerStatus()
  }

  private async saveBoard() {
    const content = `# SlowBurn Task Board\n\n## Main Task\n${this.boardState.mainTask}\n\n## Sub-tasks\n${this.boardState.subTasks
      .map((t) => `- [${t.status === 'done' ? 'x' : ' '}] **${t.title}** (${t.id}): ${t.description}${t.assignedTo ? ` [Assigned to ${t.assignedTo}]` : ''}`)
      .join('\n')}\n`
    await fs.writeFile(this.taskBoardPath, content)
    this.emit(IPC.TASK_BOARD_UPDATE, this.boardState)
  }

  async updateTaskBoard(content: string) {
    if (!this.taskBoardPath) return
    // Enhanced heuristic to sync markdown back to boardState
    const subTasks: any[] = []
    const lines = content.split('\n')
    for (const line of lines) {
      // More flexible match for task entries
      const match = line.match(/- \[( |x|X)\]\s*(?:\*\*)?(.*?)(?:\*\*)?\s*(?:\((.*?)\))?:\s*(.*)/)
      if (match) {
        const id = match[3] || `t${subTasks.length + 1}`
        subTasks.push({
          id,
          title: match[2].trim(),
          description: match[4].split(' [Assigned to')[0].trim(),
          status: (match[1].toLowerCase() === 'x') ? 'done' : 'todo'
        })
      }
    }
    if (subTasks.length > 0) this.boardState.subTasks = subTasks
    await fs.writeFile(this.taskBoardPath, content)
    this.emit(IPC.TASK_BOARD_UPDATE, this.boardState)
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
      const llm7Key = this.getLLM7Key()

      // Only use direct clients if API keys are provided AND it matches the specific provider
      if (geminiKey && (modelId.includes('gemini') || modelId.includes('gemma')) && !modelId.includes(':')) {
        client = new GeminiClient(this.getGeminiKey, modelId)
      } else if (groqKey && (modelId.includes('llama') || modelId.includes('mixtral')) && !modelId.includes(':')) {
        client = new GroqClient(this.getGroqKey, modelId)
      } else if (llm7Key && modelId.startsWith('llm7:')) {
        client = new LLM7Client(this.getLLM7Key, modelId.replace('llm7:', ''))
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
      this.updateWorkerStatus()
      try {
        const response = await worker.client.chatCompletion(messages, tools, cancellationToken?.signal)
        worker.status = 'idle'
        worker.lastAction = 'Completed turn'
        this.updateWorkerStatus()
        return response
      } catch (err) {
        console.error(`Worker ${worker.id} (${worker.modelId}) failed:`, err)

        const isRateLimit =
          err instanceof Error &&
          (err.message.includes('429') || err.message.toLowerCase().includes('rate limit'))

        if (isRateLimit) {
          this.onLog({
            type: 'error',
            phase: 'implementation',
            content: `Worker ${worker.id} rate limited. Attempting fallback to free model...`
          })
          try {
            return await this.retryWithFreeModel(messages, tools, cancellationToken)
          } catch (fallbackErr) {
            console.error('Free model fallback failed:', fallbackErr)
          }
        }

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

  private async retryWithFreeModel(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    cancellationToken?: CancellationToken
  ): Promise<ChatMessage> {
    // Priority: Gemini Flash (if key), Groq (if key), OpenRouter free models
    const geminiKey = this.getGeminiKey()
    const groqKey = this.getGroqKey()

    if (geminiKey) {
      const client = new GeminiClient(this.getGeminiKey, 'gemini-1.5-flash')
      this.onLog({ type: 'phase_progress', phase: 'implementation', content: 'Fallback: Using Gemini Flash' })
      return client.chatCompletion(messages, tools, cancellationToken?.signal)
    }

    if (groqKey) {
      const client = new GroqClient(this.getGroqKey, 'llama3-8b-8192')
      this.onLog({ type: 'phase_progress', phase: 'implementation', content: 'Fallback: Using Groq Llama 3 8B' })
      return client.chatCompletion(messages, tools, cancellationToken?.signal)
    }

    // Fallback to OpenRouter free models
    const openRouterClient = new OpenRouterClient(this.getOpenRouterKey, 'google/gemma-2-9b-it:free')
    this.onLog({ type: 'phase_progress', phase: 'implementation', content: 'Fallback: Using OpenRouter Free (Gemma 2)' })
    return openRouterClient.chatCompletion(messages, tools, cancellationToken?.signal)
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
      this.workers.map(async (worker) => {
        worker.status = 'working'
        this.updateWorkerStatus()
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
          this.updateWorkerStatus()
          return response
        } catch (err) {
          const isRateLimit =
            err instanceof Error &&
            (err.message.includes('429') || err.message.toLowerCase().includes('rate limit'))

          if (isRateLimit) {
            this.onLog({
              type: 'error',
              phase: 'implementation',
              content: `Worker ${worker.id} rate limited in parallel mode. Retrying with free model...`
            })
            try {
              return await this.retryWithFreeModel(workerSpecificMessages, tools, cancellationToken)
            } catch {}
          }

          worker.status = 'failed'
          worker.lastAction = `Error: ${err instanceof Error ? err.message : String(err)}`
          this.updateWorkerStatus()
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

  async handleWorkerCommand(workerId: string, command: 'stop' | 'restart' | 'reprompt', payload?: string) {
    const worker = this.workers.find(w => w.id === workerId)
    if (!worker) return

    if (command === 'stop') {
      worker.client.abort()
      worker.status = 'failed'
      worker.lastAction = 'Stopped by user'
    } else if (command === 'restart') {
      worker.status = 'idle'
      worker.lastAction = 'Restarted by user'
    } else if (command === 'reprompt') {
      worker.lastAction = `Reprompted: ${payload}`
    }
    this.updateWorkerStatus()
  }

  async saveMemory(data: any) {
    if (!this.memoryPath) return
    let current = {}
    try {
      current = JSON.parse(await fs.readFile(this.memoryPath, 'utf8'))
    } catch {}
    const updated = { ...current, ...data }
    await fs.writeFile(this.memoryPath, JSON.stringify(updated, null, 2))
  }

  async getMemory() {
    if (!this.memoryPath) return {}
    try {
      return JSON.parse(await fs.readFile(this.memoryPath, 'utf8'))
    } catch {
      return {}
    }
  }
}
