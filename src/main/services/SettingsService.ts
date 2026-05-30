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
  windowBounds: WindowBounds
}

const DEFAULT_BOUNDS: WindowBounds = { width: 1100, height: 800, x: 100, y: 100 }

const defaults: PersistedStore = {
  projectFolder: '',
  selectedModelId: '',
  searchProviderKey: '',
  searxInstanceUrl: '',
  encryptedApiKey: '',
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

  getApiKey(): string | null {
    const encrypted = this.store.get('encryptedApiKey')
    if (!encrypted) return null
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
      }
      console.warn('[SlowBurn] safeStorage unavailable — using base64 fallback for API key')
      return Buffer.from(encrypted, 'base64').toString('utf8')
    } catch {
      try {
        return Buffer.from(encrypted, 'base64').toString('utf8')
      } catch {
        return null
      }
    }
  }

  setApiKey(key: string): void {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(key)
      this.store.set('encryptedApiKey', encrypted.toString('base64'))
    } else {
      console.warn('[SlowBurn] safeStorage unavailable — storing API key with base64 only')
      this.store.set('encryptedApiKey', Buffer.from(key, 'utf8').toString('base64'))
    }
  }

  getSettings(): AppSettings {
    const key = this.getApiKey()
    return {
      projectFolder: this.store.get('projectFolder', ''),
      selectedModelId: this.store.get('selectedModelId', ''),
      searchProviderKey: this.store.get('searchProviderKey', ''),
      searxInstanceUrl: this.store.get('searxInstanceUrl', ''),
      hasApiKey: Boolean(key),
      apiKeyLast4: key ? key.slice(-4) : ''
    }
  }

  saveSettings(partial: Partial<AppSettings>): void {
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
