import { useAppStore } from '../store/useAppStore'

export function TaskBoard(): React.JSX.Element | null {
  const { taskBoard, taskStatus } = useAppStore()

  if (!taskBoard || taskStatus === 'idle') return null

  return (
    <div className="task-board">
      <h3>Active Task Board</h3>
      <div className="task-columns">
        <div className="task-column">
          <h4>Todo</h4>
          {taskBoard.subTasks.filter(t => t.status === 'todo').map(t => (
            <div key={t.id} className="task-card">
              <strong>{t.title}</strong>
              <p>{t.description}</p>
            </div>
          ))}
        </div>
        <div className="task-column">
          <h4>In Progress</h4>
          {taskBoard.subTasks.filter(t => t.status === 'in_progress').map(t => (
            <div key={t.id} className="task-card in-progress">
              <strong>{t.title}</strong>
              <p>{t.description}</p>
              {t.assignedTo && <span className="assigned">Assigned to {t.assignedTo}</span>}
            </div>
          ))}
        </div>
        <div className="task-column">
          <h4>Done</h4>
          {taskBoard.subTasks.filter(t => t.status === 'done').map(t => (
            <div key={t.id} className="task-card done">
              <strong>{t.title}</strong>
              <p>{t.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
