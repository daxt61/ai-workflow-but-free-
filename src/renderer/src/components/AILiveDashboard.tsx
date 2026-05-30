import { useAppStore } from '../store/useAppStore'
import { useState } from 'react'

export function AILiveDashboard(): React.JSX.Element | null {
  const { taskStatus, logEntries, workerStatuses } = useAppStore()
  const [filterWorker, setFilterWorker] = useState<string | null>(null)

  if (taskStatus !== 'running') return null

  const filteredLogs = filterWorker
    ? logEntries.filter(l => l.metadata?.worker === parseInt(filterWorker.split('-')[1]))
    : logEntries

  const handleCommand = async (workerId: string, command: 'stop' | 'restart' | 'reprompt') => {
    let payload = undefined
    if (command === 'reprompt') {
      payload = prompt('Enter new instructions for this worker:')
      if (!payload) return
    }
    await window.slowburn.workerCommand(workerId, command, payload)
  }

  return (
    <div className="ai-live-dashboard">
      <header className="dashboard-header">
        <h3>AI Swarm Live Activity</h3>
        <select value={filterWorker || ''} onChange={(e) => setFilterWorker(e.target.value || null)}>
          <option value="">All Workers</option>
          {workerStatuses.map(w => <option key={w.id} value={w.id}>{w.id} ({w.modelId})</option>)}
        </select>
      </header>

      <div className="worker-grid">
        {workerStatuses.map(w => (
          <div key={w.id} className={`worker-card ${w.status}`}>
            <div className="worker-info">
              <strong>{w.id}</strong>
              <span className="model-name">{w.modelId.split('/').pop()}</span>
              <span className="status-badge">{w.status}</span>
            </div>
            <div className="last-action">{w.lastAction}</div>
            <div className="worker-actions">
              <button onClick={() => handleCommand(w.id, 'stop')} title="Stop">🛑</button>
              <button onClick={() => handleCommand(w.id, 'restart')} title="Restart">🔄</button>
              <button onClick={() => handleCommand(w.id, 'reprompt')} title="Reprompt">💬</button>
            </div>
          </div>
        ))}
      </div>

      <div className="worker-streams">
        {filteredLogs.slice(-20).map(log => (
          <div key={log.id} className={`log-item ${log.type}`}>
             <span className="log-phase">[{log.phase}]</span>
             {log.metadata?.worker && <span className="log-worker">Worker {log.metadata.worker}:</span>}
             <span className="log-content">{log.content}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
