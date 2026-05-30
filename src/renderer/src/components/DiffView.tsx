import { useState } from 'react'
import ReactDiffViewer from 'react-diff-viewer-continued'
import { useAppStore } from '../store/useAppStore'

export function DiffView(): React.JSX.Element | null {
  const { taskStatus, diffs, setDiffs, setTaskStatus, resetTask } = useAppStore()
  const [applyError, setApplyError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (taskStatus !== 'complete' || !diffs.length) return null

  const handleApply = async (): Promise<void> => {
    setApplyError(null)
    const result = await window.slowburn.applyDiff()
    if (!result.success) {
      setApplyError(`Failed to apply: ${result.failedFiles.join(', ')}`)
      return
    }
    setDiffs([])
    resetTask()
    setTaskStatus('idle')
  }

  const handleDiscard = async (): Promise<void> => {
    await window.slowburn.discardDiff()
    setDiffs([])
    resetTask()
    setTaskStatus('idle')
  }

  return (
    <section className="diff-view">
      <header className="panel-header">
        <h2>Review changes ({diffs.length} files)</h2>
        <div className="diff-actions">
          <button type="button" className="primary" onClick={() => void handleApply()}>
            Apply all
          </button>
          <button type="button" onClick={() => void handleDiscard()}>
            Discard all
          </button>
        </div>
      </header>
      {applyError && <p className="error-text">{applyError}</p>}
      {diffs.map((diff) => {
        const isCollapsed = collapsed[diff.relativePath]
        return (
          <div key={diff.relativePath} className="diff-file">
            <button
              type="button"
              className="diff-file-header"
              onClick={() =>
                setCollapsed((c) => ({ ...c, [diff.relativePath]: !c[diff.relativePath] }))
              }
            >
              {isCollapsed ? '▶' : '▼'} {diff.relativePath}{' '}
              <span className="diff-status">({diff.status})</span>
            </button>
            {!isCollapsed && (
              <ReactDiffViewer
                oldValue={diff.originalContent}
                newValue={diff.modifiedContent}
                splitView={false}
                useDarkTheme
                hideLineNumbers={false}
              />
            )}
          </div>
        )
      })}
    </section>
  )
}
