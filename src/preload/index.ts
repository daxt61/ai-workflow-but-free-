import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AppSettings,
  ApplyResult,
  FileDiff,
  LogEntry,
  OpenRouterModel,
  PhaseUpdate,
  SlowBurnAPI,
  StartTaskParams,
  TaskError,
  TaskResult
} from '@shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const slowburn: SlowBurnAPI = {
  startTask: (params: StartTaskParams) => ipcRenderer.invoke(IPC.TASK_START, params),
  cancelTask: () => ipcRenderer.invoke(IPC.TASK_CANCEL),
  applyDiff: (): Promise<ApplyResult> => ipcRenderer.invoke(IPC.TASK_APPLY_DIFF),
  discardDiff: () => ipcRenderer.invoke(IPC.TASK_DISCARD_DIFF),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
  saveSettings: (settings) => ipcRenderer.invoke(IPC.SETTINGS_SAVE, settings),
  listModels: (): Promise<OpenRouterModel[]> => ipcRenderer.invoke(IPC.MODELS_LIST),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.FOLDER_SELECT),
  onLogEntry: (callback) => subscribe<LogEntry>(IPC.LOG_ENTRY, callback),
  onPhaseChange: (callback) => subscribe<PhaseUpdate>(IPC.PHASE_CHANGE, callback),
  onTaskComplete: (callback) => subscribe<TaskResult>(IPC.TASK_COMPLETE, callback),
  onTaskError: (callback) => subscribe<TaskError>(IPC.TASK_ERROR, callback),
  onDiffReady: (callback) => subscribe<FileDiff[]>(IPC.DIFF_READY, callback),
  onTaskBoardUpdate: (callback) => subscribe(IPC.TASK_BOARD_UPDATE, callback),
  onWorkerStatusUpdate: (callback) => subscribe(IPC.WORKER_STATUS_UPDATE, callback),
  workerCommand: (workerId, command, payload) =>
    ipcRenderer.invoke(IPC.WORKER_COMMAND, { workerId, command, payload }),
  buildRelease: () => ipcRenderer.invoke(IPC.BUILD_RELEASE)
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('slowburn', slowburn)
} else {
  // @ts-expect-error fallback
  window.slowburn = slowburn
}
