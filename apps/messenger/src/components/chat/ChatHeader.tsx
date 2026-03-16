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
      <div className="flex h-14 items-center border-b border-gray-200 bg-surface px-6">
        <span className="text-sm text-text-secondary">채널을 선택하세요</span>
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

  return (
    <div className="flex h-14 items-center justify-between border-b border-gray-200 bg-surface px-6">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-text-primary">
          {channel.name}
        </h2>
        {channel.type === 'direct' && (
          <span className="inline-block h-2 w-2 rounded-full bg-success" />
        )}
        {channel.assignedLlm && (
          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
            AI: {channel.assignedLlm}
          </span>
        )}
      </div>

      {isWorkChannel && (
        <button
          onClick={handleTakeover}
          disabled={isLoading}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            channel.humanTakeover
              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              : 'bg-primary-light text-primary hover:bg-blue-200'
          }`}
        >
          {channel.humanTakeover ? 'AI에게 넘기기' : '개입하기'}
        </button>
      )}
    </div>
  );
}
