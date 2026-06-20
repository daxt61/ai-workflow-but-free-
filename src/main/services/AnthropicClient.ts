import type { ChatMessage, ToolDefinition } from '@shared/types'
import { LLMClient } from './LLMClient'

const BASE_URL = 'https://api.anthropic.com/v1'

export class AnthropicClient implements LLMClient {
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
    if (!apiKey) throw new Error('Anthropic API key is not configured')

    this.abortController = new AbortController()
    const effectiveSignal = signal
      ? AbortSignal.any([signal, this.abortController.signal])
      : this.abortController.signal

    // Anthropic Messages API format
    const system = messages.find(m => m.role === 'system')?.content
    const anthropicMessages: any[] = []

    for (const m of messages) {
      if (m.role === 'system') continue

      if (m.role === 'tool') {
        const toolResult = {
          type: 'tool_result' as const,
          tool_use_id: m.tool_call_id!,
          content: m.content!
        }

        const lastMessage = anthropicMessages[anthropicMessages.length - 1]
        if (lastMessage && lastMessage.role === 'user' && Array.isArray(lastMessage.content) && lastMessage.content.some(c => c.type === 'tool_result')) {
          lastMessage.content.push(toolResult)
        } else {
          anthropicMessages.push({
            role: 'user' as const,
            content: [toolResult]
          })
        }
        continue
      }

      const content: any[] = []
      if (m.content) {
        content.push({ type: 'text', text: m.content })
      }
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments)
          })
        }
      }

      anthropicMessages.push({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content
      })
    }

    const body: Record<string, unknown> = {
      model: this.modelId,
      max_tokens: 4096,
      messages: anthropicMessages
    }
    if (system) {
      body.system = system
    }
    if (tools?.length) {
      body.tools = tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
      }))
    }

    const response = await this.fetchWithRetry(
      `${BASE_URL}/messages`,
      {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      effectiveSignal
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Anthropic error ${response.status}: ${text}`)
    }

    const data = (await response.json()) as {
      content: Array<{
        type: string
        text?: string
        id?: string
        name?: string
        input?: any
      }>
    }

    const textContent = data.content.find(c => c.type === 'text')?.text ?? null
    const tool_calls = data.content
      .filter(c => c.type === 'tool_use')
      .map(c => ({
        id: c.id!,
        type: 'function' as const,
        function: {
          name: c.name!,
          arguments: JSON.stringify(c.input)
        }
      }))

    return {
      role: 'assistant',
      content: textContent,
      tool_calls: tool_calls.length > 0 ? tool_calls : undefined
    }
  }

  async listModels(): Promise<any[]> {
    const apiKey = this.getApiKey()
    if (!apiKey) return []

    const response = await this.fetchWithRetry(`${BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    })

    if (!response.ok) return []
    const data = (await response.json()) as { data: any[] }
    return data.data
  }
}
