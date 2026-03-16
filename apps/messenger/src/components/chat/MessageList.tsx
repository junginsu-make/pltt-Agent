'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chat-store';
import MessageBubble from '@/components/chat/MessageBubble';
import TypingIndicator from '@/components/chat/TypingIndicator';

interface MessageListProps {
  channelId: string;
}

export default function MessageList({ channelId }: MessageListProps) {
  const messages = useChatStore(
    (s) => s.messagesByChannel[channelId] || []
  );
  const typingUsers = useChatStore(
    (s) => s.typingUsers[channelId] || []
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Group messages by date
  const groupedByDate: { date: string; messages: typeof messages }[] = [];
  let currentDate = '';

  for (const msg of messages) {
    const msgDate = formatDate(msg.createdAt);
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedByDate.push({ date: msgDate, messages: [msg] });
    } else {
      groupedByDate[groupedByDate.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background py-4">
      {groupedByDate.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-text-secondary">
            메시지가 없습니다. 대화를 시작해보세요.
          </p>
        </div>
      )}

      {groupedByDate.map((group) => (
        <div key={group.date}>
          <div className="flex items-center justify-center py-3">
            <span className="rounded-full bg-gray-200 px-3 py-1 text-xs text-text-secondary">
              {group.date}
            </span>
          </div>
          {group.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      ))}

      <TypingIndicator users={typingUsers} />
      <div ref={bottomRef} />
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  } catch {
    return '';
  }
}
