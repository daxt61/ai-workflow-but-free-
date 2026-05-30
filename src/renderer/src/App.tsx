import { useEffect, useState } from 'react'
import { ProgressBar } from './components/ProgressBar'
import { LogPanel } from './components/LogPanel'
import { TaskInput } from './components/TaskInput'
import { DiffView } from './components/DiffView'
import { AILiveDashboard } from './components/AILiveDashboard'
import { TaskBoard } from './components/TaskBoard'
import { SettingsScreen } from './components/SettingsScreen'
import { loadInitialData, useSlowburnIpc } from './hooks/useSlowburnIpc'
import { useAppStore } from './store/useAppStore'

function App(): React.JSX.Element {
  const [showSettings, setShowSettings] = useState(false)
  const settings = useAppStore((s) => s.settings)

  useSlowburnIpc()

  useEffect(() => {
    void loadInitialData()
  }, [])

  useEffect(() => {
    if (settings && !settings.projectFolder) {
      setShowSettings(true)
    }
  }, [settings])

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>SlowBurn</h1>
          <p className="subtitle">Deep-thinking agent · 8 phases · ~30–60 min per task</p>
        </div>
        <div className="header-meta">
          {settings?.projectFolder ? (
            <span className="project-path" title={settings.projectFolder}>
              {settings.projectFolder}
            </span>
          ) : (
            <span className="project-path warning">No project folder selected</span>
          )}
          <button type="button" onClick={() => setShowSettings(true)}>
            Settings
          </button>
        </div>
      </header>

      <ProgressBar />
      <TaskInput />
      <TaskBoard />
      <AILiveDashboard />
      <LogPanel />
      <DiffView />

      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
