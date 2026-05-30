import { useAppStore } from '../store/useAppStore'

export function AILiveDashboard(): React.JSX.Element | null {
  const { taskStatus, logEntries } = useAppStore()

  if (taskStatus !== 'running') return null

  // Group reasoning by worker if available
  const workerLogs = logEntries.filter(l => l.metadata?.worker || l.type === 'thinking' || l.type === 'reasoning')

  return (
    <div className="ai-live-dashboard">
      <h3>AI Swarm Live Activity</h3>
      <div className="worker-streams">
        {logEntries.slice(-10).map(log => (
          <div key={log.id} className={`log-item ${log.type}`}>
             <span className="log-phase">[{log.phase}]</span>
             {log.metadata?.worker && <span className="log-worker">Worker {log.metadata.worker}:</span>}
             <span className="log-content">{log.content.slice(0, 150)}...</span>
          </div>
        ))}
      </div>
    </div>
  )
}
