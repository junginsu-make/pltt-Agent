import type { Server, Socket } from 'socket.io';
import { verifyToken } from '../lib/jwt.js';
import type { JwtPayload } from '../lib/jwt.js';
import * as channelService from '../services/channel-service.js';
import * as messageService from '../services/message-service.js';
import { routeMessage } from '../router.js';

// Extend Socket type with authenticated user data
interface AuthenticatedSocket extends Socket {
  data: {
    user: JwtPayload;
  };
}

let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export function emitApprovalDecided(channelId: string, data: {
  approvalId: string;
  decision: string;
  leaveRequestId: string;
}): void {
  ioInstance?.to(channelId).emit('approval:decided', data);
}

export function initSocketServer(io: Server): void {
  ioInstance = io;

  // Authentication middleware on handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('AUTH_001: 인증 토큰이 필요합니다'));
    }
    try {
      const payload = verifyToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('AUTH_001: 토큰이 만료되었거나 유효하지 않습니다'));
    }
  });

  io.on('connection', async (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const user = socket.data.user;

    console.log(`[socket] User connected: ${user.employeeId} (${user.name})`);

    // Join all user's channels as rooms
    try {
      const channels = await channelService.getChannelsByParticipant(user.employeeId);
      for (const channel of channels) {
        socket.join(channel.id);
      }
    } catch (err) {
      console.error(`[socket] Failed to join channels for ${user.employeeId}:`, err);
    }

    // Notify others of online status
    socket.broadcast.emit('user:online', {
      userId: user.employeeId,
      name: user.name,
    });

    // ─── message:send ─────────────────────────────────────────────────
    socket.on('message:send', async (data: {
      channelId: string;
      content: string;
      contentType?: string;
    }, callback?: (response: unknown) => void) => {
      try {
        const channel = await channelService.getChannelById(data.channelId);
        if (!channel) {
          callback?.({ error: 'Channel not found' });
          return;
        }

        const message = await messageService.saveMessage({
          channelId: data.channelId,
          senderType: 'human',
          senderUserId: user.employeeId,
          displayName: user.name,
          contentType: data.contentType ?? 'text',
          contentText: data.content,
        });

        const routing = routeMessage('human', {
          id: channel.id,
          type: channel.type,
          humanTakeover: channel.humanTakeover ?? false,
          assignedLlm: channel.assignedLlm,
        });

        // Broadcast to all members in the channel room
        io.to(data.channelId).emit('message:new', {
          channelId: data.channelId,
          message,
        });

        callback?.({
          messageId: message.id,
          routing: {
            llmWillRespond: routing.llmRequired,
            routedToLlm: routing.llmUserId,
          },
        });
      } catch (err) {
        console.error('[socket] message:send error:', err);
        callback?.({ error: 'Failed to send message' });
      }
    });

    // ─── message:read ─────────────────────────────────────────────────
    socket.on('message:read', async (data: { channelId: string }) => {
      try {
        await messageService.markMessagesAsRead(data.channelId, user.employeeId);
        io.to(data.channelId).emit('message:read', {
          channelId: data.channelId,
          userId: user.employeeId,
        });
      } catch (err) {
        console.error('[socket] message:read error:', err);
      }
    });

    // ─── typing:start / typing:stop ───────────────────────────────────
    socket.on('typing:start', (data: { channelId: string }) => {
      socket.to(data.channelId).emit('typing', {
        channelId: data.channelId,
        userId: user.employeeId,
        displayName: user.name,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (data: { channelId: string }) => {
      socket.to(data.channelId).emit('typing', {
        channelId: data.channelId,
        userId: user.employeeId,
        displayName: user.name,
        isTyping: false,
      });
    });

    // ─── channel:join / channel:leave ─────────────────────────────────
    socket.on('channel:join', (data: { channelId: string }) => {
      socket.join(data.channelId);
    });

    socket.on('channel:leave', (data: { channelId: string }) => {
      socket.leave(data.channelId);
    });

    // ─── approval:decided (from approval-service via internal call) ────
    socket.on('approval:decided', (data: {
      channelId: string;
      approvalId: string;
      decision: string;
      leaveRequestId: string;
    }) => {
      io.to(data.channelId).emit('approval:decided', {
        approvalId: data.approvalId,
        decision: data.decision,
        leaveRequestId: data.leaveRequestId,
      });
    });

    // ─── disconnect ───────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[socket] User disconnected: ${user.employeeId} (${user.name})`);
      socket.broadcast.emit('user:offline', {
        userId: user.employeeId,
        name: user.name,
      });
    });
  });
}
