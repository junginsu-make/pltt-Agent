'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chat-store';
import MessageBubble from '@/components/chat/MessageBubble';
import TypingIndicator from '@/components/chat/TypingIndicator';

interface MessageListProps {
  channelId: string;
}

const EMPTY_MESSAGES: never[] = [];
const EMPTY_TYPING: never[] = [];

export default function MessageList({ channelId }: MessageListProps) {
  const messages = useChatStore(
    (s) => s.messagesByChannel[channelId] ?? EMPTY_MESSAGES
  );
  const typingUsers = useChatStore(
    (s) => s.typingUsers[channelId] ?? EMPTY_TYPING
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
    <div data-testid="message-list" className="scrollbar-thin flex-1 overflow-y-auto bg-gray-50 py-4">
      {groupedByDate.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500">대화를 시작해보세요</p>
            <p className="mt-1 text-xs text-gray-400">AI 비서가 도와드립니다</p>
          </div>
        </div>
      )}

      {groupedByDate.map((group) => (
        <div key={group.date}>
          <div className="flex items-center justify-center py-3">
            <div className="flex items-center gap-2">
              <div className="h-px w-8 bg-gray-200" />
              <span className="text-[11px] font-medium text-gray-400">
                {group.date}
              </span>
              <div className="h-px w-8 bg-gray-200" />
            </div>
          </div>
          <div className="space-y-1">
            {group.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
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
