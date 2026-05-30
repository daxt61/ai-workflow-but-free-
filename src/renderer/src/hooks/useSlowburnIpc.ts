import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useSlowburnIpc(): void {
  const {
    appendLogEntry,
    setPhase,
    setTaskStatus,
    setDiffs,
    resetTask
  } = useAppStore()

  useEffect(() => {
    const api = window.slowburn
    const unsubs = [
      api.onLogEntry(appendLogEntry),
      api.onPhaseChange(setPhase),
      api.onDiffReady((diffs) => {
        setDiffs(diffs)
      }),
      api.onTaskComplete((result) => {
        if (result.success) {
          setTaskStatus('complete')
        } else {
          setTaskStatus('cancelled')
        }
      }),
      api.onTaskError(() => {
        setTaskStatus('failed')
      })
    ]
    return () => unsubs.forEach((u) => u())
  }, [appendLogEntry, setPhase, setTaskStatus, setDiffs, resetTask])
}

export async function loadInitialData(): Promise<void> {
  const api = window.slowburn
  const { setSettings, setModels, setModelsError } = useAppStore.getState()

  try {
    setSettings(await api.getSettings())
  } catch (err) {
    console.error(err)
  }

  try {
    const models = await api.listModels()
    setModels(models)
    if (!models.length) {
      setModelsError('No models returned from OpenRouter. Check your connection and try Refresh.')
    }
  } catch (err) {
    setModels([])
    setModelsError(err instanceof Error ? err.message : 'Failed to load models')
  }
}
