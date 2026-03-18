'use client';
import { MutableRefObject, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/lib/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

interface UseSocketReturn {
  sendMessage: (channelId: string, content: string) => void;
  startTyping: (channelId: string) => void;
  stopTyping: (channelId: string) => void;
  socket: MutableRefObject<Socket | null>;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const addMessage = useChatStore((s) => s.addMessage);
  const setTyping = useChatStore((s) => s.setTyping);
  const updateChannel = useChatStore((s) => s.updateChannel);
  const setConnected = useChatStore((s) => s.setConnected);
  const setChannels = useChatStore((s) => s.setChannels);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('message:new', (data: { channelId: string; message: Parameters<typeof addMessage>[1] }) => {
      addMessage(data.channelId, data.message);
    });

    socket.on('typing:start', (data: { channelId: string; userId: string; displayName: string }) => {
      setTyping(data.channelId, data.userId, data.displayName, true);
    });

    socket.on('typing:stop', (data: { channelId: string; userId: string; displayName: string }) => {
      setTyping(data.channelId, data.userId, data.displayName, false);
    });

    socket.on('channel:takeover', (data: { channelId: string; humanTakeover: boolean }) => {
      updateChannel(data.channelId, { humanTakeover: data.humanTakeover });
    });

    socket.on('approval:decided', (data: { approvalId: string; decision: string; leaveRequestId: string }) => {
      console.log('[socket] approval:decided', data);
      // Approval decision will appear as a new message via message:new
    });

    socket.on('notification:new', async (data: {
      targetUserId: string;
      type: string;
      callerName?: string;
      channelId?: string;
    }) => {
      console.log('[socket] notification:new', data);
      // Join the new channel room and refresh channel list
      if (data.channelId) {
        socket.emit('channel:join', { channelId: data.channelId });
      }
      try {
        const res = await api.get('/messenger/channels');
        setChannels(res.data.channels || res.data);
      } catch {
        /* ignore */
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, addMessage, setTyping, updateChannel, setConnected, setChannels]);

  const sendMessage = useCallback(
    (channelId: string, content: string) => {
      socketRef.current?.emit('message:send', {
        channelId,
        content,
        contentType: 'text',
      });
    },
    []
  );

  const startTyping = useCallback((channelId: string) => {
    socketRef.current?.emit('typing:start', { channelId });
  }, []);

  const stopTyping = useCallback((channelId: string) => {
    socketRef.current?.emit('typing:stop', { channelId });
  }, []);

  return { sendMessage, startTyping, stopTyping, socket: socketRef };
}
