import { db, userLlmConfigs } from '@palette/db';
import { eq } from 'drizzle-orm';
import type { LLMAdapter, LLMMessage, LLMContentBlock } from '../adapters/llm-adapter.js';
import { executeTool, type DelegationContext } from '../tools/tool-executor.js';
import { getToolDefinitions } from '../tools/tool-definitions.js';

export interface PipelineRequest {
  llmUserId: string; // Which user's LLM to use (e.g. EMP-HR-001)
  channelId: string;
  userMessage: string;
  senderUserId: string; // Who sent the message (e.g. EMP-001)
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  delegationContext?: DelegationContext;
}

export interface PipelineResponse {
  text: string;
  cardData?: Record<string, unknown>;
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
  toolResults?: Array<{ toolName: string; result: unknown }>;
  usage: { inputTokens: number; outputTokens: number };
}

const MAX_TOOL_ITERATIONS = 5;

export class LLMPipeline {
  constructor(private adapter: LLMAdapter) {}

  async handle(request: PipelineRequest): Promise<PipelineResponse> {
    // 1. Load LLM config
    const configs = await db
      .select()
      .from(userLlmConfigs)
      .where(eq(userLlmConfigs.userId, request.llmUserId));
    const config = configs[0];
    if (!config) throw new Error(`LLM config not found for user: ${request.llmUserId}`);

    // 2. Build messages
    const messages: LLMMessage[] = [];

    // Add conversation history
    if (request.conversationHistory?.length) {
      for (const msg of request.conversationHistory.slice(-20)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add new user message
    messages.push({ role: 'user', content: request.userMessage });

    // 3. Build delegation context
    const delegationCtx: DelegationContext = request.delegationContext ?? {
      originUserId: request.senderUserId,
      originChannelId: request.channelId,
      delegationChain: [request.llmUserId],
      depth: 0,
      maxDepth: 3,
    };

    // 4. Get tools for this role
    const tools = getToolDefinitions(config.llmRole, (config.tools as string[]) || []);

    // 4. Call LLM
    const totalUsage = { inputTokens: 0, outputTokens: 0 };
    const allToolCalls: Array<{ name: string; input: Record<string, unknown> }> = [];
    const allToolResults: Array<{ toolName: string; result: unknown }> = [];

    let response = await this.adapter.chat({
      model: config.llmModel || 'claude-haiku-4-5-20251001',
      systemPrompt: config.systemPrompt,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      maxTokens: 1024,
    });

    totalUsage.inputTokens += response.usage.inputTokens;
    totalUsage.outputTokens += response.usage.outputTokens;

    // 5. Handle tool calls (loop up to MAX_TOOL_ITERATIONS)
    let iterations = 0;
    while (response.stopReason === 'tool_use' && iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      // Extract tool calls from response
      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');

      // Execute tools
      const toolResultBlocks: LLMContentBlock[] = [];
      for (const block of toolUseBlocks) {
        allToolCalls.push({ name: block.name!, input: block.input! });
        const result = await executeTool(block.name!, block.input!, request.senderUserId, delegationCtx);
        allToolResults.push({ toolName: block.name!, result: result.data ?? result.error });
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: block.id!,
          content: JSON.stringify(result.success ? result.data : { error: result.error }),
        });
      }

      // Add assistant response + tool results to messages
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResultBlocks });

      // Re-call LLM with tool results
      response = await this.adapter.chat({
        model: config.llmModel || 'claude-haiku-4-5-20251001',
        systemPrompt: config.systemPrompt,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        maxTokens: 1024,
      });

      totalUsage.inputTokens += response.usage.inputTokens;
      totalUsage.outputTokens += response.usage.outputTokens;
    }

    // 6. Extract final text
    const textBlocks = response.content.filter((b) => b.type === 'text');
    const text = textBlocks.map((b) => b.text).join('');

    // 7. Check for card_data in tool results (for structured UI cards)
    let cardData: Record<string, unknown> | undefined;
    for (const tr of allToolResults) {
      const data = tr.result as Record<string, unknown>;
      if (data && typeof data === 'object' && 'type' in data) {
        cardData = data;
        break;
      }
    }

    return {
      text,
      cardData,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      toolResults: allToolResults.length > 0 ? allToolResults : undefined,
      usage: totalUsage,
    };
  }
}
