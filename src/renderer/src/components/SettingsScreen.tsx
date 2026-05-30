import { useEffect, useState } from 'react'
import type { OpenRouterModel } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { ModelBrowser } from './ModelBrowser'

interface SettingsScreenProps {
  onClose: () => void
}

export function SettingsScreen({ onClose }: SettingsScreenProps): React.JSX.Element {
  const { settings, models, modelsError, setSettings, setModels, setModelsError } = useAppStore()

  const [apiKey, setApiKey] = useState('')
  const [groqKey, setGroqKey] = useState(settings?.groqApiKey ?? '')
  const [geminiKey, setGeminiKey] = useState(settings?.geminiApiKey ?? '')
  const [modelPool, setModelPool] = useState<string[]>(settings?.modelPool ?? [])
  const [searxUrl, setSearxUrl] = useState(settings?.searxInstanceUrl ?? '')
  const [braveKey, setBraveKey] = useState(settings?.searchProviderKey ?? '')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [modelId, setModelId] = useState(settings?.selectedModelId ?? '')
  const [projectFolder, setProjectFolder] = useState(settings?.projectFolder ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)
  const [modelBrowserOpen, setModelBrowserOpen] = useState<boolean | 'pool'>(false)

  const refreshModels = async (): Promise<void> => {
    setLoadingModels(true)
    setModelsError(null)
    try {
      const list = await window.slowburn.listModels()
      setModels(list)
      if (!list.length) {
        setModelsError('No models returned. Check your internet connection.')
      }
    } catch (err) {
      setModels([])
      setModelsError(err instanceof Error ? err.message : 'Failed to load models')
    } finally {
      setLoadingModels(false)
    }
  }

  useEffect(() => {
    if (models.length === 0) {
      void refreshModels()
    }
    // Only load once when settings panel opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async (): Promise<void> => {
    setStatus(null)
    await window.slowburn.saveSettings({
      apiKey: apiKey || undefined,
      groqApiKey: groqKey,
      geminiApiKey: geminiKey,
      modelPool,
      searxInstanceUrl: searxUrl,
      searchProviderKey: braveKey,
      selectedModelId: modelId,
      projectFolder
    })
    const updated = await window.slowburn.getSettings()
    setSettings(updated)
    setApiKey('')
    setStatus('Settings saved.')
    if (updated.hasApiKey || apiKey.trim()) {
      await refreshModels()
    }
  }

  const pickFolder = async (): Promise<void> => {
    const path = await window.slowburn.selectFolder()
    if (path) setProjectFolder(path)
  }

  const buildRelease = async (): Promise<void> => {
    setIsBuilding(true)
    setStatus('Building release...')
    try {
      await window.slowburn.buildRelease()
      setStatus('Release built successfully! Check the "releases" folder.')
    } catch (err) {
      setStatus(`Build failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsBuilding(false)
    }
  }

  const resetAll = async (): Promise<void> => {
    if (!confirm('Reset all settings? This clears your API key and preferences.')) return
    await window.slowburn.saveSettings({
      apiKey: '',
      projectFolder: '',
      selectedModelId: '',
      searchProviderKey: '',
      searxInstanceUrl: ''
    })
    setProjectFolder('')
    setModelId('')
    setBraveKey('')
    setSearxUrl('')
    setSettings(await window.slowburn.getSettings())
    setStatus('Settings reset.')
  }

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <header>
          <h2>Settings</h2>
          <button type="button" onClick={onClose}>
            ✕
          </button>
        </header>

        <label>
          OpenRouter API key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              settings?.hasApiKey ? `Saved ••••${settings.apiKeyLast4}` : 'sk-or-…'
            }
          />
        </label>

        <label>
          Groq API key
          <input
            type="password"
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
            placeholder="gsk_..."
          />
        </label>

        <label>
          Gemini API key
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza..."
          />
        </label>

        <p className="settings-hint">
          Web search is <strong>free</strong> — SearXNG + DuckDuckGo, no API key required.
        </p>

        <label>
          Custom SearXNG URL <span className="optional">(optional)</span>
          <input
            type="url"
            value={searxUrl}
            onChange={(e) => setSearxUrl(e.target.value)}
            placeholder="https://searx.example.com"
          />
        </label>

        <label>
          Project folder
          <div className="folder-row">
            <input type="text" value={projectFolder} readOnly />
            <button type="button" onClick={() => void pickFolder()}>
              Browse…
            </button>
          </div>
        </label>

        <div className="model-picker-block">
          <span className="field-label">Primary Model</span>
          <div className="selected-model-chip">
            {modelId ? (
              <>
                <strong>{models.find((m) => m.id === modelId)?.name ?? modelId}</strong>
                <span className="model-id">{modelId}</span>
              </>
            ) : (
              <span className="muted">No model selected</span>
            )}
          </div>
          <div className="folder-row">
            <button
              type="button"
              className="primary"
              onClick={() => setModelBrowserOpen(true)}
              disabled={loadingModels && models.length === 0}
            >
              Search models…
            </button>
            <button type="button" onClick={() => void refreshModels()} disabled={loadingModels}>
              {loadingModels ? 'Loading…' : 'Refresh list'}
            </button>
          </div>
          {modelsError && <p className="error-text">{modelsError}</p>}
          {models.length > 0 && (
            <p className="settings-hint">{models.length} models loaded — open Search to filter & sort.</p>
          )}
        </div>

        <ModelBrowser
          open={modelBrowserOpen}
          onClose={() => setModelBrowserOpen(false)}
          selectedId={modelId}
          onSelect={(m: OpenRouterModel) => {
            if (modelBrowserOpen === 'pool') {
              if (!modelPool.includes(m.id)) setModelPool([...modelPool, m.id])
            } else {
              setModelId(m.id)
            }
          }}
        />

        <div className="model-pool-block">
          <span className="field-label">Model Pool (AI Swarm)</span>
          <div className="model-pool-list">
            {modelPool.map(id => (
              <div key={id} className="model-pool-item">
                <span>{id}</span>
                <button type="button" onClick={() => setModelPool(modelPool.filter(m => m !== id))}>✕</button>
              </div>
            ))}
            {modelPool.length === 0 && <p className="muted">No models in pool. Primary model will be used.</p>}
          </div>
          <button type="button" onClick={() => setModelBrowserOpen('pool')}>Add to pool...</button>
        </div>

        <button
          type="button"
          className="link-button"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? 'Hide' : 'Show'} advanced search options
        </button>

        {showAdvanced && (
          <label>
            Brave Search API key <span className="optional">(paid, optional)</span>
            <input
              type="password"
              value={braveKey}
              onChange={(e) => setBraveKey(e.target.value)}
              placeholder="Leave empty to use free search"
            />
          </label>
        )}

        <div className="settings-actions">
          <button type="button" className="primary" onClick={() => void save()}>
            Save
          </button>
          <button type="button" onClick={() => void buildRelease()} disabled={isBuilding}>
            {isBuilding ? 'Building...' : 'Build 1-Click Release'}
          </button>
          <button type="button" className="danger" onClick={() => void resetAll()}>
            Reset settings
          </button>
        </div>
        {status && <p className="status-text">{status}</p>}
      </div>
    </div>
  )
}
