import { enrichOpenRouterModel } from '@shared/modelUtils'
import type { ChatMessage, OpenRouterModel, ToolDefinition } from '@shared/types'

const BASE_URL = 'https://openrouter.ai/api/v1'

export class OpenRouterClient {
  private abortController: AbortController | null = null

  constructor(
    private getApiKey: () => string | null,
    private modelId: string
  ) {}

  setModelId(modelId: string): void {
    this.modelId = modelId
  }

  abort(): void {
    this.abortController?.abort()
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    signal?: AbortSignal
  ): Promise<Response> {
    const delays = [1000, 2000, 4000]
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 180_000)
        const mergedSignal = signal
          ? AbortSignal.any([signal, controller.signal])
          : controller.signal

        const response = await fetch(url, { ...init, signal: mergedSignal })
        clearTimeout(timeout)

        if (response.status === 429 || response.status >= 500) {
          if (attempt < delays.length) {
            await new Promise((r) => setTimeout(r, delays[attempt]))
            continue
          }
        }
        return response
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < delays.length) {
          await new Promise((r) => setTimeout(r, delays[attempt]))
        }
      }
    }
    throw lastError ?? new Error('Request failed')
  }

  async chatCompletion(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    signal?: AbortSignal
  ): Promise<ChatMessage> {
    const apiKey = this.getApiKey()
    if (!apiKey) throw new Error('OpenRouter API key is not configured')

    this.abortController = new AbortController()
    const effectiveSignal = signal
      ? AbortSignal.any([signal, this.abortController.signal])
      : this.abortController.signal

    const buildBody = (withReasoning: boolean): Record<string, unknown> => {
      const b: Record<string, unknown> = { model: this.modelId, messages }
      if (withReasoning) b.reasoning = { effort: 'high' }
      if (tools?.length) {
        b.tools = tools
        b.tool_choice = 'auto'
      }
      return b
    }

    const post = (body: Record<string, unknown>) =>
      this.fetchWithRetry(
        `${BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://slowburn.local',
            'X-Title': 'SlowBurn Agent'
          },
          body: JSON.stringify(body)
        },
        effectiveSignal
      )

    let response = await post(buildBody(true))
    if (!response.ok && response.status === 400) {
      response = await post(buildBody(false))
    }

    if (!response.ok) {
      const text = await response.text()
      if (response.status === 401) {
        throw new Error('Invalid OpenRouter API key. Update your key in Settings.')
      }
      throw new Error(`OpenRouter error ${response.status}: ${text}`)
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: ChatMessage & {
          reasoning?: string
          reasoning_content?: string
        }
      }>
    }
    const raw = data.choices[0]?.message ?? { role: 'assistant' as const, content: '' }
    const extra = raw as { reasoning_details?: unknown }
    const reasoning =
      raw.reasoning ??
      raw.reasoning_content ??
      (typeof extra.reasoning_details === 'string' ? extra.reasoning_details : undefined)

    return {
      role: 'assistant',
      content: raw.content ?? null,
      reasoning: reasoning ?? null,
      tool_calls: raw.tool_calls
    }
  }

  async listModels(): Promise<OpenRouterModel[]> {
    const apiKey = this.getApiKey()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    const response = await this.fetchWithRetry(`${BASE_URL}/models`, {
      method: 'GET',
      headers
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to fetch models (${response.status}): ${text.slice(0, 200)}`)
    }

    const data = (await response.json()) as {
      data: Array<{
        id: string
        name?: string
        context_length?: number
        pricing?: { prompt: string; completion: string }
        architecture?: { modality?: string }
        description?: string
        supported_parameters?: string[]
      }>
    }

    return data.data
      .filter((m) => {
        const modality = m.architecture?.modality ?? ''
        return !modality || modality.includes('text') || modality.includes('image')
      })
      .map((m) => enrichOpenRouterModel(m))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
}
