'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { ChatChannel } from '@/stores/chat-store';

interface ChatHeaderProps {
  channel: ChatChannel | null;
}

export default function ChatHeader({ channel }: ChatHeaderProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!channel) {
    return (
      <div className="flex h-16 items-center border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm">채널을 선택하세요</span>
        </div>
      </div>
    );
  }

  const handleTakeover = async () => {
    setIsLoading(true);
    try {
      await api.post('/messenger/takeover', {
        channel_id: channel.id,
        action: channel.humanTakeover ? 'release' : 'takeover',
      });
    } catch {
      /* handle error silently */
    } finally {
      setIsLoading(false);
    }
  };

  const isWorkChannel = channel.type === 'work';
  const participantCount = channel.participants?.length || 0;

  return (
    <div data-testid="chat-header" className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-bold text-gray-900">{channel.name}</h2>
        {participantCount > 0 && (
          <span className="text-xs text-gray-400">{participantCount}</span>
        )}
        {channel.assignedLlm && (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-600">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI 연결됨
          </span>
        )}
        {channel.humanTakeover && (
          <span data-testid="direct-response-badge" className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-600">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            직접 응답 모드
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isWorkChannel && (
          <button
            onClick={handleTakeover}
            disabled={isLoading}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
              channel.humanTakeover
                ? 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {channel.humanTakeover ? (<span data-testid="release-button">AI에게 넘기기</span>) : (<span data-testid="takeover-button">직접 개입</span>)}
          </button>
        )}
      </div>
    </div>
  );
}
