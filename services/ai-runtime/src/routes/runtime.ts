import { Hono } from 'hono';
import { z } from 'zod';
import { LLMPipeline } from '../pipeline/llm-pipeline.js';
import { ClaudeAdapter } from '../adapters/claude-adapter.js';

const runtime = new Hono();

const chatRequestSchema = z.object({
  llm_user_id: z.string(),
  channel_id: z.string(),
  user_message: z.string(),
  sender_user_id: z.string(),
  conversation_history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .optional(),
  delegation_context: z
    .object({
      originUserId: z.string(),
      originChannelId: z.string(),
      delegationChain: z.array(z.string()),
      depth: z.number(),
      maxDepth: z.number(),
    })
    .optional(),
});

// Lazy-init adapter (allows tests to mock)
let pipeline: LLMPipeline | null = null;

export function getPipeline(): LLMPipeline {
  if (!pipeline) {
    pipeline = new LLMPipeline(new ClaudeAdapter());
  }
  return pipeline;
}

export function setPipeline(p: LLMPipeline): void {
  pipeline = p;
}

runtime.post('/chat', async (c) => {
  const body = await c.req.json();
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION',
          message: 'Invalid request',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      400,
    );
  }

  try {
    const result = await getPipeline().handle({
      llmUserId: parsed.data.llm_user_id,
      channelId: parsed.data.channel_id,
      userMessage: parsed.data.user_message,
      senderUserId: parsed.data.sender_user_id,
      conversationHistory: parsed.data.conversation_history,
      delegationContext: parsed.data.delegation_context,
    });

    return c.json({
      text: result.text,
      card_data: result.cardData || null,
      tool_calls: result.toolCalls || [],
      tool_results: result.toolResults || [],
      usage: result.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LLM processing failed';
    return c.json({ error: { code: 'SYS_001', message } }, 503);
  }
});

export default runtime;
