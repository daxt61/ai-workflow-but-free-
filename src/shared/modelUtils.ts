import type { ModelSortKey, OpenRouterModel } from './types'

export function pricePerMillion(tokenPrice: string): number {
  const n = parseFloat(tokenPrice)
  return Number.isFinite(n) ? n * 1_000_000 : 0
}

export function formatPricePerMillion(usd: number): string {
  if (usd === 0) return 'Free'
  if (usd < 0.01) return `$${usd.toFixed(4)}/M`
  if (usd < 1) return `$${usd.toFixed(3)}/M`
  return `$${usd.toFixed(2)}/M`
}

/** Higher = likely faster (heuristic; OpenRouter list has no live latency). */
export function speedScore(model: OpenRouterModel): number {
  const id = model.id.toLowerCase()
  let score = 0
  const fastHints = ['flash', 'mini', 'turbo', 'haiku', 'instant', 'lite', 'fast', 'small']
  for (const hint of fastHints) {
    if (id.includes(hint)) score += 15
  }
  if (model.blendedPricePerMillion > 0) {
    score += Math.max(0, 20 - Math.log10(model.blendedPricePerMillion + 0.001) * 5)
  }
  if (model.supportsTools) score += 2
  return score
}

export function filterModels(
  models: OpenRouterModel[],
  query: string,
  options: { toolsOnly?: boolean; freeOnly?: boolean }
): OpenRouterModel[] {
  const q = query.trim().toLowerCase()
  return models.filter((m) => {
    if (options.toolsOnly && !m.supportsTools) return false
    if (options.freeOnly && m.blendedPricePerMillion > 0) return false
    if (!q) return true
    return (
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.modality.toLowerCase().includes(q)
    )
  })
}

export function sortModels(models: OpenRouterModel[], sortKey: ModelSortKey): OpenRouterModel[] {
  const copy = [...models]
  switch (sortKey) {
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name))
    case 'price_asc':
      return copy.sort((a, b) => a.blendedPricePerMillion - b.blendedPricePerMillion)
    case 'price_desc':
      return copy.sort((a, b) => b.blendedPricePerMillion - a.blendedPricePerMillion)
    case 'context_desc':
      return copy.sort((a, b) => b.contextLength - a.contextLength)
    case 'speed':
      return copy.sort((a, b) => speedScore(b) - speedScore(a))
    case 'tools_first':
      return copy.sort((a, b) => {
        if (a.supportsTools !== b.supportsTools) return a.supportsTools ? -1 : 1
        return a.blendedPricePerMillion - b.blendedPricePerMillion
      })
    default:
      return copy
  }
}

export function enrichOpenRouterModel(raw: {
  id: string
  name?: string
  context_length?: number
  pricing?: { prompt: string; completion: string }
  architecture?: { modality?: string }
  description?: string
  supported_parameters?: string[]
}): OpenRouterModel {
  const prompt = pricePerMillion(raw.pricing?.prompt ?? '0')
  const completion = pricePerMillion(raw.pricing?.completion ?? '0')
  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    contextLength: raw.context_length ?? 0,
    pricing: {
      prompt: raw.pricing?.prompt ?? '0',
      completion: raw.pricing?.completion ?? '0'
    },
    promptPricePerMillion: prompt,
    completionPricePerMillion: completion,
    blendedPricePerMillion: prompt + completion,
    supportsTools: (raw.supported_parameters ?? []).includes('tools'),
    modality: raw.architecture?.modality ?? '',
    description: (raw.description ?? '').slice(0, 280)
  }
}
