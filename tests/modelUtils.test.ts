import { describe, expect, it } from 'vitest'
import { enrichOpenRouterModel, filterModels, sortModels } from '@shared/modelUtils'
import type { OpenRouterModel } from '@shared/types'

describe('modelUtils', () => {
  const sample: OpenRouterModel[] = [
    enrichOpenRouterModel({
      id: 'a/expensive',
      name: 'Expensive',
      context_length: 1000,
      pricing: { prompt: '0.00001', completion: '0.00002' },
      supported_parameters: ['tools']
    }),
    enrichOpenRouterModel({
      id: 'b/free-flash',
      name: 'Free Flash',
      context_length: 8000,
      pricing: { prompt: '0', completion: '0' },
      supported_parameters: ['tools', 'temperature']
    })
  ]

  it('filters by query', () => {
    expect(filterModels(sample, 'flash', {}).map((m) => m.id)).toEqual(['b/free-flash'])
  })

  it('sorts by price ascending', () => {
    const sorted = sortModels(sample, 'price_asc')
    expect(sorted[0].id).toBe('b/free-flash')
  })
})
