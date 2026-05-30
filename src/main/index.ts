import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { AgentOrchestrator } from './agent/AgentOrchestrator'
import { registerIpcHandlers } from './ipc/handlers'
import { DiffTracker } from './services/DiffTracker'
import { FileService } from './services/FileService'
import { OpenRouterClient } from './services/OpenRouterClient'
import { SearchService } from './services/SearchService'
import { SettingsService } from './services/SettingsService'
import { ShellService } from './services/ShellService'

let mainWindow: BrowserWindow | null = null

const settingsService = new SettingsService()
const fileService = new FileService('')
const shellService = new ShellService('')
const searchService = new SearchService(() => {
  const s = settingsService.getSettings()
  return {
    braveApiKey: s.searchProviderKey,
    searxInstanceUrl: s.searxInstanceUrl
  }
})
const openRouterClient = new OpenRouterClient(
  () => settingsService.getApiKey(),
  settingsService.getSettings().selectedModelId
)
const diffTracker = new DiffTracker()

const orchestrator = new AgentOrchestrator(
  fileService,
  shellService,
  searchService,
  openRouterClient,
  diffTracker,
  settingsService,
  () => mainWindow
)

function createWindow(): void {
  const bounds = settingsService.getWindowBounds()

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.on('close', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition()
      const [width, height] = mainWindow.getSize()
      settingsService.setWindowBounds({ x, y, width, height })
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.slowburn.agent')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const settings = settingsService.getSettings()
  if (settings.projectFolder) {
    fileService.setProjectFolder(settings.projectFolder)
    shellService.setProjectFolder(settings.projectFolder)
  }

  registerIpcHandlers({
    settingsService,
    fileService,
    openRouterClient,
    orchestrator,
    diffTracker,
    getApiKey: () => settingsService.getApiKey()
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
