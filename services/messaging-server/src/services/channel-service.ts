import { db, channels, messages } from '@palette/db';
import { eq, sql, desc, and } from 'drizzle-orm';
import { generateChannelId } from '@palette/shared';

export async function getChannelsByParticipant(userId: string) {
  const userChannels = await db
    .select()
    .from(channels)
    .where(sql`${channels.participants} @> ARRAY[${userId}]::text[]`);

  // For each channel, get the last message
  const channelsWithLastMessage = await Promise.all(
    userChannels.map(async (channel) => {
      const lastMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.channelId, channel.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      const lastMessage = lastMessages[0] ?? null;

      // Count unread messages
      const unreadResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(
          and(
            eq(messages.channelId, channel.id),
            sql`NOT (${messages.readBy} @> ARRAY[${userId}]::text[])`
          )
        );

      const unreadCount = Number(unreadResult[0]?.count ?? 0);

      return {
        ...channel,
        lastMessage,
        unreadCount,
      };
    })
  );

  return channelsWithLastMessage;
}

export async function getOrCreateDmChannel(userId1: string, userId2: string) {
  // Find existing DM channel between these two users
  const existingChannels = await db
    .select()
    .from(channels)
    .where(
      and(
        eq(channels.type, 'direct'),
        sql`${channels.participants} @> ARRAY[${userId1}, ${userId2}]::text[]`,
        sql`array_length(${channels.participants}, 1) = 2`
      )
    );

  if (existingChannels.length > 0) {
    return { channel: existingChannels[0], created: false };
  }

  // Create new DM channel
  const newChannel = {
    id: generateChannelId(),
    type: 'direct' as const,
    name: null,
    participants: [userId1, userId2],
    workDomain: null,
    assignedLlm: null,
    humanTakeover: false,
    takeoverBy: null,
    metadata: {},
  };

  const inserted = await db.insert(channels).values(newChannel).returning();
  return { channel: inserted[0], created: true };
}

export async function createChannel(data: {
  type: string;
  name?: string;
  participants: string[];
  workDomain?: string;
  assignedLlm?: string;
}) {
  const newChannel = {
    id: generateChannelId(),
    type: data.type,
    name: data.name ?? null,
    participants: data.participants,
    workDomain: data.workDomain ?? null,
    assignedLlm: data.assignedLlm ?? null,
    humanTakeover: false,
    takeoverBy: null,
    metadata: {},
  };

  const inserted = await db.insert(channels).values(newChannel).returning();
  return inserted[0];
}

export async function getChannelById(channelId: string) {
  const result = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  return result[0] ?? null;
}

export async function addParticipant(channelId: string, userId: string) {
  const channel = await getChannelById(channelId);
  if (!channel) return null;

  // Skip if already a participant
  if (channel.participants.includes(userId)) {
    return { ...channel, added: false };
  }

  const updated = await db
    .update(channels)
    .set({
      participants: sql`array_append(${channels.participants}, ${userId})`,
      updatedAt: new Date(),
    })
    .where(eq(channels.id, channelId))
    .returning();

  return updated[0] ? { ...updated[0], added: true } : null;
}

export async function updateTakeover(
  channelId: string,
  takeover: boolean,
  takeoverBy: string | null
) {
  const updated = await db
    .update(channels)
    .set({
      humanTakeover: takeover,
      takeoverBy: takeoverBy,
      updatedAt: new Date(),
    })
    .where(eq(channels.id, channelId))
    .returning();

  return updated[0] ?? null;
}
