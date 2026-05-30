import { safeStorage } from 'electron'
import ElectronStoreImport from 'electron-store'
import type { AppSettings, WindowBounds } from '@shared/types'

const ElectronStore =
  typeof ElectronStoreImport === 'function'
    ? ElectronStoreImport
    : (ElectronStoreImport as { default: typeof ElectronStoreImport }).default

interface PersistedStore {
  projectFolder: string
  selectedModelId: string
  searchProviderKey: string
  searxInstanceUrl: string
  encryptedApiKey: string
  encryptedGroqKey: string
  encryptedGeminiKey: string
  modelPool: string[]
  windowBounds: WindowBounds
}

const DEFAULT_BOUNDS: WindowBounds = { width: 1100, height: 800, x: 100, y: 100 }

const defaults: PersistedStore = {
  projectFolder: '',
  selectedModelId: '',
  searchProviderKey: '',
  searxInstanceUrl: '',
  encryptedApiKey: '',
  encryptedGroqKey: '',
  encryptedGeminiKey: '',
  modelPool: [],
  windowBounds: DEFAULT_BOUNDS
}

export class SettingsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private store: any
  private corruptedNotified = false

  constructor() {
    this.store = new ElectronStore({
      name: 'slowburn-settings',
      defaults,
      clearInvalidConfig: true
    })
  }

  private decrypt(key: string): string | null {
    const encrypted = this.store.get(key)
    if (!encrypted) return null
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
      }
      return Buffer.from(encrypted, 'base64').toString('utf8')
    } catch {
      try {
        return Buffer.from(encrypted, 'base64').toString('utf8')
      } catch {
        return null
      }
    }
  }

  private encrypt(key: string, value: string): void {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value)
      this.store.set(key, encrypted.toString('base64'))
    } else {
      this.store.set(key, Buffer.from(value, 'utf8').toString('base64'))
    }
  }

  getApiKey(): string | null {
    return this.decrypt('encryptedApiKey')
  }

  setApiKey(key: string): void {
    this.encrypt('encryptedApiKey', key)
  }

  getGroqKey(): string | null {
    return this.decrypt('encryptedGroqKey')
  }

  setGroqKey(key: string): void {
    this.encrypt('encryptedGroqKey', key)
  }

  getGeminiKey(): string | null {
    return this.decrypt('encryptedGeminiKey')
  }

  setGeminiKey(key: string): void {
    this.encrypt('encryptedGeminiKey', key)
  }

  getSettings(): AppSettings {
    const key = this.getApiKey()
    const groqKey = this.getGroqKey()
    const geminiKey = this.getGeminiKey()
    return {
      projectFolder: this.store.get('projectFolder', ''),
      selectedModelId: this.store.get('selectedModelId', ''),
      searchProviderKey: this.store.get('searchProviderKey', ''),
      searxInstanceUrl: this.store.get('searxInstanceUrl', ''),
      hasApiKey: Boolean(key),
      apiKeyLast4: key ? key.slice(-4) : '',
      groqApiKey: groqKey || '',
      geminiApiKey: geminiKey || '',
      modelPool: this.store.get('modelPool', [])
    }
  }

  saveSettings(partial: Partial<AppSettings> & { apiKey?: string }): void {
    if (partial.projectFolder !== undefined) {
      this.store.set('projectFolder', partial.projectFolder)
    }
    if (partial.selectedModelId !== undefined) {
      this.store.set('selectedModelId', partial.selectedModelId)
    }
    if (partial.searchProviderKey !== undefined) {
      this.store.set('searchProviderKey', partial.searchProviderKey)
    }
    if (partial.searxInstanceUrl !== undefined) {
      this.store.set('searxInstanceUrl', partial.searxInstanceUrl)
    }
    if (partial.apiKey !== undefined) {
      this.setApiKey(partial.apiKey)
    }
    if (partial.groqApiKey !== undefined) {
      this.setGroqKey(partial.groqApiKey)
    }
    if (partial.geminiApiKey !== undefined) {
      this.setGeminiKey(partial.geminiApiKey)
    }
    if (partial.modelPool !== undefined) {
      this.store.set('modelPool', partial.modelPool)
    }
  }

  getWindowBounds(): WindowBounds {
    return this.store.get('windowBounds', DEFAULT_BOUNDS)
  }

  setWindowBounds(bounds: WindowBounds): void {
    this.store.set('windowBounds', bounds)
  }

  reset(): void {
    this.store.clear()
    this.store.set(defaults)
  }

  notifyIfCorrupted(): void {
    if (!this.corruptedNotified && this.store.path) {
      this.corruptedNotified = true
    }
  }
}
