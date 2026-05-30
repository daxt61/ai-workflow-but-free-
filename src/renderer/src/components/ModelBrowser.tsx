import { useMemo, useState } from 'react'
import type { ModelSortKey, OpenRouterModel } from '@shared/types'
import {
  filterModels,
  formatPricePerMillion,
  sortModels,
  speedScore
} from '@shared/modelUtils'
import { useAppStore } from '../store/useAppStore'

interface ModelBrowserProps {
  open: boolean | 'pool'
  onClose: () => void
  selectedId: string
  onSelect: (model: OpenRouterModel) => void
}

const SORT_OPTIONS: { value: ModelSortKey; label: string }[] = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'price_asc', label: 'Price (low → high)' },
  { value: 'price_desc', label: 'Price (high → low)' },
  { value: 'speed', label: 'Speed (estimated)' },
  { value: 'context_desc', label: 'Context (largest)' },
  { value: 'tools_first', label: 'Tools support first' }
]

export function ModelBrowser({
  open,
  onClose,
  selectedId,
  onSelect
}: ModelBrowserProps): React.JSX.Element | null {
  const { models, modelsError } = useAppStore()
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<ModelSortKey>('price_asc')
  const [toolsOnly, setToolsOnly] = useState(true)
  const [freeOnly, setFreeOnly] = useState(false)
  const [highlightId, setHighlightId] = useState(selectedId)

  const displayed = useMemo(() => {
    const filtered = filterModels(models, query, { toolsOnly, freeOnly })
    return sortModels(filtered, sortKey)
  }, [models, query, sortKey, toolsOnly, freeOnly])

  if (!open) return null

  const selected = models.find((m) => m.id === highlightId)

  const handleChoose = (): void => {
    if (!selected) return
    onSelect(selected)
    onClose()
  }

  return (
    <div className="model-browser-overlay" onClick={onClose}>
      <div
        className="model-browser"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="model-browser-title"
      >
        <header className="model-browser-header">
          <div>
            <h2 id="model-browser-title">Search models</h2>
            <p className="model-browser-sub">
              {models.length} models from OpenRouter · sort & filter below
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="model-browser-toolbar">
          <input
            type="search"
            className="model-search-input"
            placeholder="Search by name, id, or description…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as ModelSortKey)}
            aria-label="Sort models"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="model-browser-filters">
          <label>
            <input
              type="checkbox"
              checked={toolsOnly}
              onChange={(e) => setToolsOnly(e.target.checked)}
            />
            Tools / agent compatible
          </label>
          <label>
            <input
              type="checkbox"
              checked={freeOnly}
              onChange={(e) => setFreeOnly(e.target.checked)}
            />
            Free only
          </label>
          <span className="filter-count">
            {displayed.length} shown
          </span>
        </div>

        {modelsError && <p className="error-text">{modelsError}</p>}

        <div className="model-table-wrap">
          <table className="model-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Price (blended /1M)</th>
                <th>Context</th>
                <th>Speed</th>
                <th>Tools</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={5} className="model-empty">
                    No models match your filters.
                  </td>
                </tr>
              )}
              {displayed.map((m) => (
                <tr
                  key={m.id}
                  className={m.id === highlightId ? 'selected' : ''}
                  onClick={() => setHighlightId(m.id)}
                  onDoubleClick={() => {
                    setHighlightId(m.id)
                    onSelect(m)
                    onClose()
                  }}
                >
                  <td className="model-name-cell">
                    <strong>{m.name}</strong>
                    <span className="model-id">{m.id}</span>
                  </td>
                  <td>
                    <span className="price-prompt" title="Prompt / 1M tokens">
                      {formatPricePerMillion(m.promptPricePerMillion)}
                    </span>
                    <span className="price-sep"> + </span>
                    <span className="price-completion" title="Completion / 1M tokens">
                      {formatPricePerMillion(m.completionPricePerMillion)}
                    </span>
                  </td>
                  <td>{m.contextLength >= 1000 ? `${Math.round(m.contextLength / 1000)}k` : m.contextLength}</td>
                  <td title="Estimated from name & price (not live latency)">
                    {speedScore(m).toFixed(0)}
                  </td>
                  <td>{m.supportsTools ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="model-preview">
            <p className="model-preview-desc">{selected.description || 'No description.'}</p>
          </div>
        )}

        <footer className="model-browser-footer">
          <span className="model-selected-label">
            {selected ? (
              <>
                Selected: <strong>{selected.name}</strong>
              </>
            ) : (
              'Click a row to select'
            )}
          </span>
          <div className="model-footer-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              disabled={!selected}
              onClick={handleChoose}
            >
              Use this model
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
