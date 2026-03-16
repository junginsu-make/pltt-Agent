'use client';
import { create } from 'zustand';

export interface ChatChannel {
  id: string;
  type: 'direct' | 'work' | 'team' | 'notification' | 'company';
  name: string;
  participants: string[];
  lastMessage?: { text: string; senderName: string; at: string };
  unreadCount: number;
  humanTakeover: boolean;
  assignedLlm?: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderType: 'human' | 'llm' | 'system';
  senderUserId: string;
  displayName: string;
  contentType: 'text' | 'card' | 'approval' | 'notification';
  contentText?: string;
  cardData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isLlmAuto: boolean;
  createdAt: string;
}

interface ChatStore {
  channels: ChatChannel[];
  activeChannelId: string | null;
  messagesByChannel: Record<string, ChatMessage[]>;
  typingUsers: Record<string, Array<{ userId: string; displayName: string }>>;
  isConnected: boolean;
  setChannels: (channels: ChatChannel[]) => void;
  setActiveChannel: (id: string | null) => void;
  addChannel: (channel: ChatChannel) => void;
  updateChannel: (id: string, data: Partial<ChatChannel>) => void;
  setMessages: (channelId: string, messages: ChatMessage[]) => void;
  addMessage: (channelId: string, message: ChatMessage) => void;
  setTyping: (channelId: string, userId: string, displayName: string, isTyping: boolean) => void;
  setConnected: (connected: boolean) => void;
  incrementUnread: (channelId: string) => void;
  clearUnread: (channelId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  channels: [],
  activeChannelId: null,
  messagesByChannel: {},
  typingUsers: {},
  isConnected: false,

  setChannels: (channels) => set({ channels }),

  setActiveChannel: (id) => set({ activeChannelId: id }),

  addChannel: (channel) =>
    set((s) => ({ channels: [channel, ...s.channels] })),

  updateChannel: (id, data) =>
    set((s) => ({
      channels: s.channels.map((ch) =>
        ch.id === id ? { ...ch, ...data } : ch
      ),
    })),

  setMessages: (channelId, messages) =>
    set((s) => ({
      messagesByChannel: { ...s.messagesByChannel, [channelId]: messages },
    })),

  addMessage: (channelId, message) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: [...(s.messagesByChannel[channelId] || []), message],
      },
    })),

  setTyping: (channelId, userId, displayName, isTyping) =>
    set((s) => {
      const current = s.typingUsers[channelId] || [];
      const filtered = current.filter((u) => u.userId !== userId);
      return {
        typingUsers: {
          ...s.typingUsers,
          [channelId]: isTyping
            ? [...filtered, { userId, displayName }]
            : filtered,
        },
      };
    }),

  setConnected: (connected) => set({ isConnected: connected }),

  incrementUnread: (channelId) =>
    set((s) => ({
      channels: s.channels.map((ch) =>
        ch.id === channelId
          ? { ...ch, unreadCount: ch.unreadCount + 1 }
          : ch
      ),
    })),

  clearUnread: (channelId) =>
    set((s) => ({
      channels: s.channels.map((ch) =>
        ch.id === channelId ? { ...ch, unreadCount: 0 } : ch
      ),
    })),
}));
