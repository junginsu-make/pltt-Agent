'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useChatStore } from '@/stores/chat-store';
import { useSocket } from '@/hooks/useSocket';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageList from '@/components/chat/MessageList';
import MessageInput from '@/components/chat/MessageInput';

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const { sendMessage, startTyping, stopTyping } = useSocket();
  const setActiveChannel = useChatStore((s) => s.setActiveChannel);
  const setMessages = useChatStore((s) => s.setMessages);
  const clearUnread = useChatStore((s) => s.clearUnread);
  const channels = useChatStore((s) => s.channels);

  const channel = channels.find((ch) => ch.id === channelId);

  useEffect(() => {
    setActiveChannel(channelId);
    clearUnread(channelId);

    const fetchMessages = async () => {
      try {
        const res = await api.get(`/messenger/channels/${channelId}/messages`);
        setMessages(channelId, res.data.messages || res.data);
      } catch {
        /* handle error silently */
      }
    };

    fetchMessages();

    return () => {
      setActiveChannel(null);
    };
  }, [channelId, setActiveChannel, setMessages, clearUnread]);

  const handleSend = (content: string) => {
    sendMessage(channelId, content);
  };

  const handleTypingStart = () => {
    startTyping(channelId);
  };

  const handleTypingStop = () => {
    stopTyping(channelId);
  };

  return (
    <div data-testid="chat-panel" className="flex flex-1 flex-col overflow-hidden">
      <ChatHeader channel={channel ?? null} />
      <MessageList channelId={channelId} />
      <MessageInput
        onSend={handleSend}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
      />
    </div>
  );
}
