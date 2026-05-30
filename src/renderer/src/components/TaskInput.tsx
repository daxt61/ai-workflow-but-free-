import { useEffect, useState } from 'react'
import type { OpenRouterModel } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { ModelBrowser } from './ModelBrowser'

export function TaskInput(): React.JSX.Element {
  const {
    taskStatus,
    settings,
    models,
    modelsError,
    activeTaskDescription,
    setTaskStatus,
    setActiveTaskDescription,
    resetTask
  } = useAppStore()

  const [description, setDescription] = useState('')
  const [modelId, setModelId] = useState(settings?.selectedModelId ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [modelBrowserOpen, setModelBrowserOpen] = useState(false)

  const isRunning = taskStatus === 'running'
  const selectedModel = modelId || settings?.selectedModelId || ''
  const selectedMeta = models.find((m) => m.id === selectedModel)

  const handleModelSelect = async (m: OpenRouterModel): Promise<void> => {
    setModelId(m.id)
    await window.slowburn.saveSettings({ selectedModelId: m.id })
    const { setSettings } = useAppStore.getState()
    setSettings(await window.slowburn.getSettings())
  }

  useEffect(() => {
    if (settings?.selectedModelId) {
      setModelId(settings.selectedModelId)
    }
  }, [settings?.selectedModelId])

  const handleSubmit = async (): Promise<void> => {
    setValidationError(null)
    setSubmitError(null)

    if (!description.trim()) {
      setValidationError('Task description cannot be empty or whitespace only.')
      return
    }
    if (!settings?.projectFolder) {
      setSubmitError('Select a project folder in Settings first.')
      return
    }
    if (!selectedModel) {
      setSubmitError('Select a model in Settings or below.')
      return
    }
    if (!settings.hasApiKey) {
      setSubmitError('Add your OpenRouter API key in Settings.')
      return
    }

    try {
      resetTask()
      setActiveTaskDescription(description.trim())
      setTaskStatus('running')
      await window.slowburn.startTask({
        description: description.trim(),
        modelId: selectedModel,
        projectFolder: settings.projectFolder
      })
    } catch (err) {
      setTaskStatus('idle')
      setSubmitError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleCancel = async (): Promise<void> => {
    await window.slowburn.cancelTask()
  }

  return (
    <section className="task-input">
      <h2>Task</h2>
      {isRunning && activeTaskDescription && (
        <p className="active-task">
          Running: <em>{activeTaskDescription}</em>
        </p>
      )}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe what you want the agent to build or fix…"
        rows={4}
        disabled={isRunning}
      />
      <div className="task-row">
        <div className="model-picker-inline">
          <span className="field-label">Model</span>
          <div className="selected-model-chip compact">
            {selectedMeta ? (
              <>
                <strong>{selectedMeta.name}</strong>
                <span className="model-id">{selectedMeta.id}</span>
              </>
            ) : (
              <span className="muted">None selected</span>
            )}
          </div>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => setModelBrowserOpen(true)}
          >
            Search models…
          </button>
          {modelsError && <p className="error-text">{modelsError}</p>}
        </div>

        <ModelBrowser
          open={modelBrowserOpen}
          onClose={() => setModelBrowserOpen(false)}
          selectedId={selectedModel}
          onSelect={(m) => void handleModelSelect(m)}
        />
        <div className="task-actions">
          {!isRunning ? (
            <button type="button" className="primary" onClick={() => void handleSubmit()}>
              Start task
            </button>
          ) : (
            <button type="button" className="danger" onClick={() => void handleCancel()}>
              Cancel
            </button>
          )}
        </div>
      </div>
      {validationError && <p className="error-text">{validationError}</p>}
      {submitError && <p className="error-text">{submitError}</p>}
    </section>
  )
}
