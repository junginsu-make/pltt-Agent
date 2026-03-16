// Interface for swappable LLM providers
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | LLMContentBlock[];
}

export interface LLMContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMChatParams {
  model: string;
  systemPrompt: string;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  maxTokens?: number;
}

export interface LLMChatResponse {
  content: LLMContentBlock[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
  usage: { inputTokens: number; outputTokens: number };
}

export interface LLMAdapter {
  chat(params: LLMChatParams): Promise<LLMChatResponse>;
}
