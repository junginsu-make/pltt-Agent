import { db, messages } from '@palette/db';
import { eq, and, sql, desc, lt } from 'drizzle-orm';
import { generateMessageId } from '@palette/shared';

export async function saveMessage(data: {
  channelId: string;
  senderType: string;
  senderUserId: string;
  displayName: string;
  contentType?: string;
  contentText?: string;
  cardData?: Record<string, unknown>;
  toolCalls?: unknown[];
  toolResults?: unknown[];
  isLlmAuto?: boolean;
}) {
  const newMessage = {
    id: generateMessageId(),
    channelId: data.channelId,
    senderType: data.senderType,
    senderUserId: data.senderUserId,
    displayName: data.displayName,
    contentType: data.contentType ?? 'text',
    contentText: data.contentText ?? null,
    cardData: data.cardData ?? null,
    toolCalls: data.toolCalls ?? [],
    toolResults: data.toolResults ?? [],
    isLlmAuto: data.isLlmAuto ?? false,
    readBy: [data.senderUserId],
  };

  const inserted = await db.insert(messages).values(newMessage).returning();
  return inserted[0];
}

export async function getMessagesByChannel(
  channelId: string,
  options?: { limit?: number; before?: string }
) {
  const limit = options?.limit ?? 50;

  const conditions = [eq(messages.channelId, channelId)];

  if (options?.before) {
    conditions.push(lt(messages.createdAt, new Date(options.before)));
  }

  const result = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit + 1);

  const hasMore = result.length > limit;
  const messageList = hasMore ? result.slice(0, limit) : result;

  return { messages: messageList, hasMore };
}

export async function markMessagesAsRead(channelId: string, userId: string) {
  await db
    .update(messages)
    .set({
      readBy: sql`array_append(${messages.readBy}, ${userId})`,
    })
    .where(
      and(
        eq(messages.channelId, channelId),
        sql`NOT (${messages.readBy} @> ARRAY[${userId}]::text[])`
      )
    );
}
