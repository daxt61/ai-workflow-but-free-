export interface StartTaskParams {
  description: string
  modelId: string
  projectFolder: string
}

export interface AppSettings {
  projectFolder: string
  selectedModelId: string
  /** Optional Brave Search API key; if empty, free SearXNG + DuckDuckGo are used. */
  searchProviderKey: string
  /** Optional custom SearXNG instance URL (free, no key). */
  searxInstanceUrl: string
  hasApiKey: boolean
  apiKeyLast4: string
  groqApiKey?: string
  geminiApiKey?: string
  modelPool: string[]
}

export interface OpenRouterModel {
  id: string
  name: string
  contextLength: number
  pricing: { prompt: string; completion: string }
  /** USD per 1M prompt tokens */
  promptPricePerMillion: number
  /** USD per 1M completion tokens */
  completionPricePerMillion: number
  /** prompt + completion $/1M (rough blended cost) */
  blendedPricePerMillion: number
  supportsTools: boolean
  modality: string
  description: string
}

export type ModelSortKey =
  | 'name'
  | 'price_asc'
  | 'price_desc'
  | 'context_desc'
  | 'speed'
  | 'tools_first'

export type AgentPhase =
  | 'research'
  | 'planning'
  | 'implementation'
  | 'bug_detection'
  | 'code_review'
  | 're_coding'
  | 'optimization'
  | 'final_validation'

export const AGENT_PHASES: AgentPhase[] = [
  'research',
  'planning',
  'implementation',
  'bug_detection',
  'code_review',
  're_coding',
  'optimization',
  'final_validation'
]

export const PHASE_LABELS: Record<AgentPhase, string> = {
  research: 'Research',
  planning: 'Planning',
  implementation: 'Implementation',
  bug_detection: 'Bug Detection',
  code_review: 'Code Review',
  re_coding: 'Re-Coding',
  optimization: 'Optimization',
  final_validation: 'Final Validation'
}

export interface PhaseUpdate {
  phase: AgentPhase
  phaseIndex: number
  totalPhases: 8
  status: 'active' | 'complete' | 'failed'
}

export type LogEntryType =
  | 'phase_header'
  | 'phase_progress'
  | 'side_task'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'reasoning'
  | 'error'
  | 'cancelled'

export interface LogEntry {
  id: string
  timestamp: number
  type: LogEntryType
  phase: AgentPhase
  content: string
  metadata?: Record<string, unknown>
}

export interface FileDiff {
  relativePath: string
  originalContent: string
  modifiedContent: string
  status: 'created' | 'modified' | 'deleted'
}

export interface SubTask {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done' | 'failed'
  assignedTo?: string
}

export interface TaskBoardState {
  mainTask: string
  subTasks: SubTask[]
}

export interface WorkerStatus {
  id: string
  modelId: string
  status: 'idle' | 'working' | 'thinking' | 'failed'
  lastAction: string
  currentTask?: string
}

export interface TaskResult {
  success: boolean
  diffs: FileDiff[]
}

export interface ApplyResult {
  success: boolean
  failedFiles: string[]
}

export interface TaskError {
  message: string
}

export interface ShellResult {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  /** Extended thinking from reasoning-capable models (OpenRouter). */
  reasoning?: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface DirectoryEntry {
  name: string
  isDirectory: boolean
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export interface WindowBounds {
  width: number
  height: number
  x: number
  y: number
}

export interface SlowBurnAPI {
  startTask(params: StartTaskParams): Promise<void>
  cancelTask(): Promise<void>
  applyDiff(): Promise<ApplyResult>
  discardDiff(): Promise<void>
  getSettings(): Promise<AppSettings>
  saveSettings(settings: Partial<AppSettings> & { apiKey?: string }): Promise<void>
  listModels(): Promise<OpenRouterModel[]>
  selectFolder(): Promise<string | null>
  onLogEntry(callback: (entry: LogEntry) => void): () => void
  onPhaseChange(callback: (update: PhaseUpdate) => void): () => void
  onTaskComplete(callback: (result: TaskResult) => void): () => void
  onTaskError(callback: (error: TaskError) => void): () => void
  onDiffReady(callback: (diffs: FileDiff[]) => void): () => void
  onTaskBoardUpdate(callback: (state: TaskBoardState) => void): () => void
  onWorkerStatusUpdate(callback: (statuses: WorkerStatus[]) => void): () => void
  workerCommand(workerId: string, command: 'stop' | 'restart' | 'reprompt', payload?: string): Promise<void>
  buildRelease(): Promise<void>
}
