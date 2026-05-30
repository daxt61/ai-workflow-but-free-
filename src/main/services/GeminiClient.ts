import type { ChatMessage, ToolDefinition } from '@shared/types'
import { LLMClient } from './LLMClient'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export class GeminiClient implements LLMClient {
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
    if (!apiKey) throw new Error('Gemini API key is not configured')

    this.abortController = new AbortController()
    const effectiveSignal = signal
      ? AbortSignal.any([signal, this.abortController.signal])
      : this.abortController.signal

    // Gemini API format is different from OpenAI/OpenRouter
    // Mapping our ChatMessage to Gemini's Content format
    const contents = messages.filter(m => m.role !== 'system').map(m => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          parts: [{
            functionResponse: {
              name: m.name,
              response: { content: m.content }
            }
          }]
        }
      }
      const parts: any[] = []
      if (m.content) parts.push({ text: m.content })
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments)
            }
          })
        }
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      }
    })

    const systemInstruction = messages.find(m => m.role === 'system')?.content

    const body: Record<string, unknown> = {
      contents,
    }
    if (systemInstruction) {
      body.system_instruction = { parts: [{ text: systemInstruction }] }
    }
    if (tools?.length) {
      body.tools = [{
        function_declarations: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }))
      }]
    }

    const response = await this.fetchWithRetry(
      `${BASE_URL}/${this.modelId}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      effectiveSignal
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Gemini error ${response.status}: ${text}`)
    }

    const data = (await response.json()) as {
      candidates: Array<{
        content: {
          parts: Array<{
            text?: string
            functionCall?: { name: string; args: Record<string, any> }
          }>
        }
      }>
    }

    const candidate = data.candidates[0]
    const content = candidate.content.parts.find(p => p.text)?.text ?? null
    const tool_calls = candidate.content.parts
      .filter(p => p.functionCall)
      .map(p => ({
        id: Math.random().toString(36).substring(7),
        type: 'function' as const,
        function: {
          name: p.functionCall!.name,
          arguments: JSON.stringify(p.functionCall!.args)
        }
      }))

    return {
      role: 'assistant',
      content,
      tool_calls: tool_calls.length > 0 ? tool_calls : undefined
    }
  }
}
