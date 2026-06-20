import type { ChatMessage, ToolDefinition } from '@shared/types'
import { LLMClient } from './LLMClient'

const BASE_URL = 'https://api.openai.com/v1'

export class OpenAIClient implements LLMClient {
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
        if (signal?.aborted) throw err
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
    if (!apiKey) throw new Error('OpenAI API key is not configured')

    this.abortController = new AbortController()
    const effectiveSignal = signal
      ? AbortSignal.any([signal, this.abortController.signal])
      : this.abortController.signal

    const body: Record<string, unknown> = {
      model: this.modelId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        tool_call_id: m.tool_call_id,
        name: m.name,
        tool_calls: m.tool_calls
      }))
    }
    if (tools?.length) {
      body.tools = tools
      body.tool_choice = 'auto'
    }

    const response = await this.fetchWithRetry(
      `${BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      effectiveSignal
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`OpenAI error ${response.status}: ${text}`)
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: ChatMessage
      }>
    }
    const raw = data.choices[0]?.message ?? { role: 'assistant' as const, content: '' }

    return {
      role: 'assistant',
      content: raw.content ?? null,
      tool_calls: raw.tool_calls
    }
  }

  async listModels(): Promise<any[]> {
    const apiKey = this.getApiKey()
    if (!apiKey) return []

    const response = await this.fetchWithRetry(`${BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })

    if (!response.ok) return []
    const data = (await response.json()) as { data: any[] }
    return data.data
  }
}
