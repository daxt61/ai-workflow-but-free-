import { ChatMessage, ToolDefinition } from '@shared/types'

export interface LLMClient {
  chatCompletion(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    signal?: AbortSignal
  ): Promise<ChatMessage>
  abort(): void
  setModelId(modelId: string): void
}
