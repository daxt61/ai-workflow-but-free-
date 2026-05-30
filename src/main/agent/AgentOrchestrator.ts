import {
  AGENT_PHASES,
  type AgentPhase,
  type ChatMessage,
  type FileDiff,
  type LogEntry,
  type PhaseUpdate,
  type StartTaskParams,
  type TaskResult
} from '@shared/types'
import type { DiffTracker } from '../services/DiffTracker'
import type { FileService } from '../services/FileService'
import type { OpenRouterClient } from '../services/OpenRouterClient'
import type { SearchService } from '../services/SearchService'
import type { ShellService } from '../services/ShellService'
import { CancellationError, CancellationToken } from './CancellationToken'
import { PhaseRunner, createLogEntry } from './PhaseRunner'
import { ToolExecutor } from './ToolExecutor'
import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import { TARGET_TASK_MIN_MS, TARGET_TASK_MAX_MS } from '@shared/agentConfig'

export interface OrchestratorEvents {
  onLog: (entry: LogEntry) => void
  onPhaseChange: (update: PhaseUpdate) => void
  onTaskComplete: (result: TaskResult) => void
  onTaskError: (message: string) => void
  onDiffReady: (diffs: FileDiff[]) => void
}

export class AgentOrchestrator {
  private cancellationToken = new CancellationToken()
  private running = false
  private currentPhase: AgentPhase = 'research'
  private getWindow: () => BrowserWindow | null

  constructor(
    private fileService: FileService,
    private shellService: ShellService,
    private searchService: SearchService,
    private openRouterClient: OpenRouterClient,
    private diffTracker: DiffTracker,
    getWindow: () => BrowserWindow | null
  ) {
    this.getWindow = getWindow
  }

  isRunning(): boolean {
    return this.running
  }

  private emit(channel: string, payload: unknown): void {
    const win = this.getWindow()
    win?.webContents.send(channel, payload)
  }

  private log(partial: Omit<LogEntry, 'id' | 'timestamp'>): void {
    const entry = createLogEntry(partial)
    this.emit(IPC.LOG_ENTRY, entry)
  }

  async runTask(params: StartTaskParams): Promise<void> {
    if (this.running) throw new Error('A task is already running')

    this.running = true
    this.cancellationToken.reset()
    this.diffTracker.reset()
    this.currentPhase = 'research'

    this.fileService.setProjectFolder(params.projectFolder)
    this.shellService.setProjectFolder(params.projectFolder)
    this.openRouterClient.setModelId(params.modelId)

    let messageHistory: ChatMessage[] = [
      {
        role: 'user',
        content: params.description
      }
    ]

    const phaseRunner = new PhaseRunner()
    const toolExecutor = new ToolExecutor(
      this.fileService,
      this.shellService,
      this.searchService,
      this.diffTracker,
      (entry) => this.log(entry),
      () => this.currentPhase
    )

    const taskStart = Date.now()

    this.log({
      type: 'phase_header',
      phase: 'research',
      content: `SlowBurn task started — deep thinking mode (target ${Math.round(TARGET_TASK_MIN_MS / 60000)}–${Math.round(TARGET_TASK_MAX_MS / 60000)} min total)`
    })

    try {
      for (let i = 0; i < AGENT_PHASES.length; i++) {
        const phase = AGENT_PHASES[i]
        this.currentPhase = phase

        const phaseUpdate: PhaseUpdate = {
          phase,
          phaseIndex: i + 1,
          totalPhases: 8,
          status: 'active'
        }
        this.emit(IPC.PHASE_CHANGE, phaseUpdate)

        messageHistory = await phaseRunner.run(
          phase,
          params.description,
          messageHistory,
          this.openRouterClient,
          toolExecutor,
          this.cancellationToken,
          (entry) => this.log(entry)
        )

        this.cancellationToken.throwIfCancelled()
      }

      const totalMs = Date.now() - taskStart
      const totalMin = (totalMs / 60000).toFixed(1)
      this.log({
        type: 'phase_progress',
        phase: 'final_validation',
        content: `✓ Task finished in ${totalMin} minutes of deliberate work`
      })

      const diffs = await this.diffTracker.computeDiffs(this.fileService)
      this.emit(IPC.DIFF_READY, diffs)
      this.emit(IPC.TASK_COMPLETE, { success: true, diffs } satisfies TaskResult)
    } catch (err) {
      if (err instanceof CancellationError) {
        await this.diffTracker.discardAll(this.fileService)
        this.log({
          type: 'cancelled',
          phase: this.currentPhase,
          content: 'Task cancelled by user'
        })
        this.emit(IPC.TASK_COMPLETE, { success: false, diffs: [] })
      } else {
        const message = err instanceof Error ? err.message : String(err)
        this.log({ type: 'error', phase: this.currentPhase, content: message })
        this.emit(IPC.TASK_ERROR, { message })
        await this.diffTracker.discardAll(this.fileService)
      }
    } finally {
      this.running = false
      this.openRouterClient.abort()
    }
  }

  cancel(): void {
    this.cancellationToken.cancel()
    this.openRouterClient.abort()
  }
}
