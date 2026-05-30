import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { LogEntryType } from '@shared/types'

const TYPE_CLASS: Record<LogEntryType, string> = {
  phase_header: 'log-phase',
  phase_progress: 'log-progress',
  side_task: 'log-side-task',
  thinking: 'log-thinking',
  tool_call: 'log-tool-call',
  tool_result: 'log-tool-result',
  reasoning: 'log-reasoning',
  error: 'log-error',
  cancelled: 'log-cancelled'
}

const TYPE_LABEL: Partial<Record<LogEntryType, string>> = {
  thinking: 'Thinking',
  reasoning: 'Reasoning',
  phase_progress: 'Progress',
  side_task: 'Side task',
  tool_call: 'Tool',
  tool_result: 'Result'
}

export function LogPanel(): React.JSX.Element {
  const logEntries = useAppStore((s) => s.logEntries)
  const [collapsed, setCollapsed] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!collapsed && autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logEntries, collapsed, autoScroll])

  const onScroll = (): void => {
    const el = listRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    setAutoScroll(atBottom)
  }

  return (
    <section className="log-panel">
      <header className="panel-header">
        <div>
          <h2>Thought process</h2>
          <p className="log-panel-sub">Live reasoning stream — SlowBurn targets 30–60 min per task</p>
        </div>
        <button type="button" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </header>
      {!collapsed && (
        <div className="log-list" ref={listRef} onScroll={onScroll}>
          {logEntries.length === 0 && (
            <p className="log-empty">
              Thinking, tool calls, and phase progress appear here as the agent works.
            </p>
          )}
          {logEntries.map((entry) => (
            <div key={entry.id} className={`log-entry ${TYPE_CLASS[entry.type]}`}>
              <div className="log-entry-meta">
                <time>{new Date(entry.timestamp).toLocaleTimeString()}</time>
                {TYPE_LABEL[entry.type] && (
                  <span className="log-type-badge">{TYPE_LABEL[entry.type]}</span>
                )}
                <span className="log-phase-tag">{entry.phase.replace(/_/g, ' ')}</span>
              </div>
              <pre>{entry.content}</pre>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </section>
  )
}
