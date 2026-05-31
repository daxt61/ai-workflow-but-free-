import { dialog, ipcMain } from 'electron'
import { existsSync } from 'fs'
import type { AgentOrchestrator } from '../agent/AgentOrchestrator'
import type { DiffTracker } from '../services/DiffTracker'
import type { FileService } from '../services/FileService'
import type { OpenRouterClient } from '../services/OpenRouterClient'
import type { SettingsService } from '../services/SettingsService'
import type { AIManager } from '../agent/AIManager'
import type { ModelDiscoveryService } from '../services/ModelDiscoveryService'
import type { AppSettings, StartTaskParams } from '@shared/types'
import { IPC } from '@shared/ipc'

export function registerIpcHandlers(deps: {
  settingsService: SettingsService
  fileService: FileService
  openRouterClient: OpenRouterClient
  orchestrator: AgentOrchestrator
  diffTracker: DiffTracker
  getApiKey: () => string | null
  aiManager: AIManager
  modelDiscoveryService: ModelDiscoveryService
}): void {
  const {
    settingsService,
    fileService,
    orchestrator,
    diffTracker,
    aiManager,
    modelDiscoveryService
  } = deps

  ipcMain.handle(IPC.TASK_START, async (_event, params: StartTaskParams) => {
    if (!params.description?.trim()) {
      throw new Error('Task description cannot be empty')
    }
    if (!params.projectFolder || !existsSync(params.projectFolder)) {
      throw new Error('Project folder does not exist')
    }
    if (!params.modelId) {
      throw new Error('Please select a model in Settings')
    }
    if (!deps.getApiKey()) {
      throw new Error('Please configure your OpenRouter API key in Settings')
    }
    if (orchestrator.isRunning()) {
      throw new Error('A task is already running')
    }

    void orchestrator.runTask(params)
  })

  ipcMain.handle(IPC.TASK_CANCEL, async () => {
    orchestrator.cancel()
  })

  ipcMain.handle(IPC.TASK_APPLY_DIFF, async () => diffTracker.applyAll())

  ipcMain.handle(IPC.TASK_DISCARD_DIFF, async () => {
    if (settingsService.getSettings().projectFolder) {
      fileService.setProjectFolder(settingsService.getSettings().projectFolder)
    }
    await diffTracker.discardAll(fileService)
  })

  ipcMain.handle(IPC.SETTINGS_GET, async (): Promise<AppSettings> => {
    return settingsService.getSettings()
  })

  ipcMain.handle(
    IPC.SETTINGS_SAVE,
    async (_event, partial: Partial<AppSettings> & { apiKey?: string }) => {
      if (partial.apiKey !== undefined && partial.apiKey.trim()) {
        settingsService.setApiKey(partial.apiKey.trim())
      }
      const { apiKey: _removed, ...rest } = partial
      settingsService.saveSettings(rest)
    }
  )

  ipcMain.handle(IPC.MODELS_LIST, async () => {
    return modelDiscoveryService.listAllModels()
  })

  ipcMain.handle(IPC.WORKER_COMMAND, async (_event, { workerId, command, payload }) => {
    return aiManager.handleWorkerCommand(workerId, command, payload)
  })

  ipcMain.handle(IPC.BUILD_RELEASE, async () => {
    const { exec } = require('child_process')
    const util = require('util')
    const execPromise = util.promisify(exec)
    try {
      await execPromise('npx tsx scripts/build-release.ts')
    } catch (err) {
      console.error('Manual build failed:', err)
      throw err
    }
  })

  ipcMain.handle(IPC.FOLDER_SELECT, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })
}
