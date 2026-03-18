import { Hono } from 'hono';
import { z } from 'zod';
import * as channelService from '../services/channel-service.js';
import * as messageService from '../services/message-service.js';
import { routeMessage } from '../router.js';
import { getIO } from '../socket/index.js';
import type { JwtPayload } from '../lib/jwt.js';

type Env = {
  Variables: {
    user: JwtPayload;
  };
};

const messenger = new Hono<Env>();

// ─── POST /send ─────────────────────────────────────────────────────────────

const sendSchema = z.object({
  channel_id: z.string().min(1),
  content: z.string().min(1),
  content_type: z.enum(['text', 'card', 'approval', 'notification']).default('text'),
  card_data: z.record(z.unknown()).optional(),
});

messenger.post('/send', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = sendSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION',
          message: '잘못된 요청입니다',
          details: parsed.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      400
    );
  }

  const { channel_id, content, content_type, card_data } = parsed.data;

  // Verify channel exists
  const channel = await channelService.getChannelById(channel_id);
  if (!channel) {
    return c.json({ error: { code: 'NOT_FOUND', message: '채널을 찾을 수 없습니다' } }, 404);
  }

  // Save message (approval/notification types use 'llm' sender for card rendering)
  const senderType = (content_type === 'approval' || content_type === 'notification') ? 'llm' : 'human';
  const message = await messageService.saveMessage({
    channelId: channel_id,
    senderType,
    senderUserId: senderType === 'llm' ? 'system' : user.employeeId,
    displayName: senderType === 'llm' ? '결재 알림' : user.name,
    contentType: content_type,
    contentText: content,
    cardData: card_data,
  });

  // Route message
  const routing = routeMessage('human', {
    id: channel.id,
    type: channel.type,
    humanTakeover: channel.humanTakeover ?? false,
    assignedLlm: channel.assignedLlm,
  });

  return c.json({
    message_id: message.id,
    channel_id: channel_id,
    routing: {
      llm_will_respond: routing.llmRequired,
      routed_to_llm: routing.llmUserId,
      intent: routing.type,
    },
  });
});

// ─── POST /dm ───────────────────────────────────────────────────────────────

const dmSchema = z.object({
  to_user_id: z.string().min(1),
  content: z.string().min(1),
});

messenger.post('/dm', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = dmSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION',
          message: '잘못된 요청입니다',
          details: parsed.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      400
    );
  }

  const { to_user_id, content } = parsed.data;

  // Get or create DM channel
  const { channel } = await channelService.getOrCreateDmChannel(
    user.employeeId,
    to_user_id
  );

  // Save message
  const message = await messageService.saveMessage({
    channelId: channel.id,
    senderType: 'human',
    senderUserId: user.employeeId,
    displayName: user.name,
    contentType: 'text',
    contentText: content,
  });

  return c.json({
    channel_id: channel.id,
    message_id: message.id,
  });
});

// ─── POST /call ─────────────────────────────────────────────────────────────

const callSchema = z.object({
  callee_id: z.string().min(1),
  caller_id: z.string().min(1).optional(),
});

messenger.post('/call', async (c) => {
  const user = c.get('user') as JwtPayload | undefined;
  const body = await c.req.json();
  const parsed = callSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION',
          message: '잘못된 요청입니다',
        },
      },
      400
    );
  }

  const { callee_id, caller_id } = parsed.data;
  const callerId = user?.employeeId ?? caller_id ?? 'system';
  const callerName = user?.name ?? callerId;

  // Get or create DM channel for call
  const { channel } = await channelService.getOrCreateDmChannel(
    callerId,
    callee_id
  );

  // Notify callee via socket
  const io = getIO();
  if (io) {
    io.emit('notification:new', {
      targetUserId: callee_id,
      type: 'call',
      callerName,
      callerUserId: callerId,
      channelId: channel.id,
    });
  }

  return c.json({
    channel_id: channel.id,
    notification_sent: true,
  });
});

// ─── POST /takeover ─────────────────────────────────────────────────────────

const takeoverSchema = z.object({
  channel_id: z.string().min(1),
  action: z.enum(['takeover', 'release']),
});

messenger.post('/takeover', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = takeoverSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION',
          message: '잘못된 요청입니다',
        },
      },
      400
    );
  }

  const { channel_id, action } = parsed.data;

  const isTakeover = action === 'takeover';
  const takeoverBy = isTakeover ? user.employeeId : null;

  const updated = await channelService.updateTakeover(
    channel_id,
    isTakeover,
    takeoverBy
  );

  if (!updated) {
    return c.json({ error: { code: 'NOT_FOUND', message: '채널을 찾을 수 없습니다' } }, 404);
  }

  // Emit socket event so all clients in the channel update their UI
  const io = getIO();
  if (io) {
    io.to(channel_id).emit('channel:takeover', {
      channelId: channel_id,
      humanTakeover: updated.humanTakeover,
      takenOverBy: updated.takeoverBy,
    });
  }

  return c.json({
    channel_id: updated.id,
    human_takeover: updated.humanTakeover,
    taken_over_by: updated.takeoverBy,
  });
});

// ─── POST /channel/invite ───────────────────────────────────────────────────

const inviteSchema = z.object({
  channel_id: z.string().min(1),
  user_id: z.string().min(1),
});

messenger.post('/channel/invite', async (c) => {
  const body = await c.req.json();
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION',
          message: '잘못된 요청입니다',
        },
      },
      400
    );
  }

  const { channel_id, user_id } = parsed.data;

  const result = await channelService.addParticipant(channel_id, user_id);
  if (!result) {
    return c.json({ error: { code: 'NOT_FOUND', message: '채널을 찾을 수 없습니다' } }, 404);
  }

  return c.json({
    channel_id: result.id,
    user_id: user_id,
    added: result.added,
  });
});

// ─── GET /channels ──────────────────────────────────────────────────────────

messenger.get('/channels', async (c) => {
  const user = c.get('user');
  const channelList = await channelService.getChannelsByParticipant(user.employeeId);

  return c.json({
    channels: channelList.map((ch) => ({
      id: ch.id,
      type: ch.type,
      name: ch.name,
      participants: ch.participants,
      assigned_llm: ch.assignedLlm,
      human_takeover: ch.humanTakeover,
      last_message: ch.lastMessage,
      unread_count: ch.unreadCount,
      created_at: ch.createdAt,
      updated_at: ch.updatedAt,
    })),
  });
});

// ─── GET /channels/:channelId/messages ──────────────────────────────────────

messenger.get('/channels/:channelId/messages', async (c) => {
  const channelId = c.req.param('channelId');
  const limit = Number(c.req.query('limit') ?? '50');
  const before = c.req.query('before');

  const result = await messageService.getMessagesByChannel(channelId, {
    limit,
    before: before ?? undefined,
  });

  return c.json({
    messages: result.messages,
    has_more: result.hasMore,
  });
});

export default messenger;
