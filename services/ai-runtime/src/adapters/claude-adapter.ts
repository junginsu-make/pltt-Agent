import Anthropic from '@anthropic-ai/sdk';
import type { LLMAdapter, LLMChatParams, LLMChatResponse } from './llm-adapter.js';

export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
  }

  async chat(params: LLMChatParams): Promise<LLMChatResponse> {
    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens || 1024,
      system: params.systemPrompt,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content as Anthropic.MessageCreateParams['messages'][number]['content'],
      })),
      ...(params.tools?.length
        ? {
            tools: params.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.input_schema as Anthropic.Tool.InputSchema,
            })),
          }
        : {}),
    });

    return {
      content: response.content.map((block) => {
        if (block.type === 'text') {
          return { type: 'text' as const, text: block.text };
        }
        if (block.type === 'tool_use') {
          return {
            type: 'tool_use' as const,
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          };
        }
        return { type: 'text' as const, text: '' };
      }),
      stopReason:
        response.stop_reason === 'tool_use'
          ? 'tool_use'
          : response.stop_reason === 'max_tokens'
            ? 'max_tokens'
            : 'end_turn',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
