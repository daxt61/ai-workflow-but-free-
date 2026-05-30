import { AGENT_PHASES, PHASE_LABELS, type AgentPhase } from '@shared/types'
import { useAppStore } from '../store/useAppStore'

export function ProgressBar(): React.JSX.Element {
  const { taskStatus, currentPhase, phaseIndex } = useAppStore()

  if (taskStatus === 'idle') {
    return (
      <div className="progress-bar idle">
        <span>Ready — submit a task to begin the 8-phase workflow</span>
      </div>
    )
  }

  return (
    <div className={`progress-bar status-${taskStatus}`}>
      <div className="progress-label">
        {taskStatus === 'complete'
          ? 'All 8 phases complete'
          : taskStatus === 'failed'
            ? `Failed at phase ${phaseIndex}`
            : `Phase ${phaseIndex} of 8: ${currentPhase ? PHASE_LABELS[currentPhase] : '…'}`}
      </div>
      <div className="phase-steps">
        {AGENT_PHASES.map((phase: AgentPhase, index) => {
          const stepNum = index + 1
          let state = 'pending'
          if (taskStatus === 'complete') state = 'done'
          else if (stepNum < phaseIndex) state = 'done'
          else if (stepNum === phaseIndex && taskStatus !== 'failed') state = 'active'
          else if (stepNum === phaseIndex && taskStatus === 'failed') state = 'failed'

          return (
            <div key={phase} className={`phase-step ${state}`} title={PHASE_LABELS[phase]}>
              <span className="step-num">{stepNum}</span>
              <span className="step-name">{PHASE_LABELS[phase]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
