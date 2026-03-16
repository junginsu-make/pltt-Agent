export interface RouteDecision {
  type: 'direct' | 'llm' | 'takeover_human' | 'broadcast';
  targetChannel: string;
  llmRequired: boolean;
  llmUserId?: string;
}

export function routeMessage(
  senderType: string,
  channel: { id: string; type: string; humanTakeover: boolean; assignedLlm: string | null }
): RouteDecision {
  // 1. DM channel -> direct, no LLM
  if (channel.type === 'direct') {
    return { type: 'direct', targetChannel: channel.id, llmRequired: false };
  }

  // 2. Human takeover active -> no LLM
  if (channel.humanTakeover) {
    return { type: 'takeover_human', targetChannel: channel.id, llmRequired: false };
  }

  // 3. Sender is LLM -> just broadcast (prevent loop)
  if (senderType === 'llm') {
    return { type: 'direct', targetChannel: channel.id, llmRequired: false };
  }

  // 4. Work/company channel + human sender -> need LLM response
  if (['work', 'company'].includes(channel.type) && senderType === 'human') {
    return {
      type: 'llm',
      targetChannel: channel.id,
      llmRequired: true,
      llmUserId: channel.assignedLlm ?? undefined,
    };
  }

  // 5. Default -> just broadcast
  return { type: 'direct', targetChannel: channel.id, llmRequired: false };
}
