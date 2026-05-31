import { OpenRouterClient } from './OpenRouterClient'
import { LLM7Client } from './LLM7Client'
import type { OpenRouterModel } from '@shared/types'
import { enrichOpenRouterModel } from '@shared/modelUtils'

export class ModelDiscoveryService {
  constructor(
    private getOpenRouterKey: () => string | null,
    private getGroqKey: () => string | null,
    private getGeminiKey: () => string | null,
    private getLLM7Key: () => string | null
  ) {}

  async listAllModels(): Promise<OpenRouterModel[]> {
    const results = await Promise.allSettled([
      this.fetchOpenRouterModels(),
      this.fetchGroqModels(),
      this.fetchGeminiModels(),
      this.fetchLLM7Models()
    ])

    const allModels: OpenRouterModel[] = []
    results.forEach((res) => {
      if (res.status === 'fulfilled') {
        allModels.push(...res.value)
      }
    })

    // Remove duplicates by ID
    const unique = new Map<string, OpenRouterModel>()
    allModels.forEach(m => unique.set(m.id, m))

    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  private async fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
    const client = new OpenRouterClient(this.getOpenRouterKey, '')
    try {
      return await client.listModels()
    } catch (err) {
      console.error('Failed to fetch OpenRouter models:', err)
      return []
    }
  }

  private async fetchGroqModels(): Promise<OpenRouterModel[]> {
    const key = this.getGroqKey()
    if (!key) return []

    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` }
      })
      if (!response.ok) return []
      const data = await response.json() as { data: any[] }
      return data.data.map(m => enrichOpenRouterModel({
        id: m.id,
        name: `Groq: ${m.id}`,
        pricing: { prompt: '0', completion: '0' },
        context_length: 8192, // Default or heuristic
        supported_parameters: ['tools']
      }))
    } catch {
      return []
    }
  }

  private async fetchGeminiModels(): Promise<OpenRouterModel[]> {
    const key = this.getGeminiKey()
    if (!key) return []

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
      if (!response.ok) return []
      const data = await response.json() as { models: any[] }
      return data.models
        .filter(m => m.supportedGenerationMethods.includes('generateContent'))
        .map(m => enrichOpenRouterModel({
          id: m.name.replace('models/', ''),
          name: `Gemini: ${m.displayName}`,
          pricing: { prompt: '0', completion: '0' },
          context_length: m.inputTokenLimit,
          supported_parameters: ['tools']
        }))
    } catch {
      return []
    }
  }

  private async fetchLLM7Models(): Promise<OpenRouterModel[]> {
    const key = this.getLLM7Key()
    if (!key) return []

    const client = new LLM7Client(this.getLLM7Key, '')
    try {
      const raw = await client.listModels()
      return raw.map(m => enrichOpenRouterModel({
        id: m.id,
        name: `LLM7: ${m.id}`,
        pricing: { prompt: '0', completion: '0' },
        context_length: m.context_window?.tokens ?? 4096,
        supported_parameters: m.tools_calling ? ['tools'] : []
      }))
    } catch {
      return []
    }
  }
}
