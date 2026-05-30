import { create } from 'zustand'
import type {
  AgentPhase,
  AppSettings,
  FileDiff,
  LogEntry,
  OpenRouterModel,
  PhaseUpdate,
  TaskBoardState,
  WorkerStatus
} from '@shared/types'

export type TaskStatus = 'idle' | 'running' | 'complete' | 'failed' | 'cancelled'

interface AppState {
  taskStatus: TaskStatus
  currentPhase: AgentPhase | null
  phaseIndex: number
  logEntries: LogEntry[]
  diffs: FileDiff[]
  settings: AppSettings | null
  models: OpenRouterModel[]
  activeTaskDescription: string
  modelsError: string | null
  taskBoard: TaskBoardState | null
  workerStatuses: WorkerStatus[]
  setTaskStatus: (status: TaskStatus) => void
  setPhase: (update: PhaseUpdate) => void
  appendLogEntry: (entry: LogEntry) => void
  setDiffs: (diffs: FileDiff[]) => void
  setSettings: (settings: AppSettings) => void
  setModels: (models: OpenRouterModel[]) => void
  setModelsError: (error: string | null) => void
  setActiveTaskDescription: (description: string) => void
  setTaskBoard: (board: TaskBoardState) => void
  setWorkerStatuses: (statuses: WorkerStatus[]) => void
  resetTask: () => void
}

export const useAppStore = create<AppState>((set) => ({
  taskStatus: 'idle',
  currentPhase: null,
  phaseIndex: 0,
  logEntries: [],
  diffs: [],
  settings: null,
  models: [],
  activeTaskDescription: '',
  modelsError: null,
  taskBoard: null,
  workerStatuses: [],
  setTaskStatus: (taskStatus) => set({ taskStatus }),
  setPhase: (update) =>
    set({
      currentPhase: update.phase,
      phaseIndex: update.phaseIndex
    }),
  appendLogEntry: (entry) =>
    set((state) => ({ logEntries: [...state.logEntries, entry] })),
  setDiffs: (diffs) => set({ diffs }),
  setSettings: (settings) => set({ settings }),
  setModels: (models) => set({ models, modelsError: null }),
  setModelsError: (modelsError) => set({ modelsError }),
  setActiveTaskDescription: (activeTaskDescription) => set({ activeTaskDescription }),
  setTaskBoard: (taskBoard) => set({ taskBoard }),
  setWorkerStatuses: (workerStatuses) => set({ workerStatuses }),
  resetTask: () =>
    set({
      logEntries: [],
      diffs: [],
      currentPhase: null,
      phaseIndex: 0,
      activeTaskDescription: '',
      taskBoard: null,
      workerStatuses: []
    })
}))
