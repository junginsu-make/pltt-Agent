'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { useChatStore, ChatChannel } from '@/stores/chat-store';

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  direct: '다이렉트 메시지',
  work: '업무 채널',
  team: '팀 채널',
  notification: '알림',
  company: '전사 채널',
};

const CHANNEL_TYPE_ORDER: string[] = [
  'direct',
  'work',
  'team',
  'company',
  'notification',
];

export default function ChannelList() {
  const router = useRouter();
  const params = useParams();
  const activeChannelId = params?.channelId as string | undefined;

  const channels = useChatStore((s) => s.channels);
  const setChannels = useChatStore((s) => s.setChannels);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await api.get('/messenger/channels');
        setChannels(res.data.channels || res.data);
      } catch {
        /* handle error silently */
      }
    };

    fetchChannels();
  }, [setChannels]);

  const grouped = CHANNEL_TYPE_ORDER.reduce<Record<string, ChatChannel[]>>(
    (acc, type) => {
      const filtered = channels.filter((ch) => ch.type === type);
      if (filtered.length > 0) {
        acc[type] = filtered;
      }
      return acc;
    },
    {}
  );

  const handleClick = (channelId: string) => {
    router.push(`/channels/${channelId}`);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {Object.entries(grouped).map(([type, chans]) => (
        <div key={type} className="py-2">
          <div className="px-4 py-1 text-xs font-semibold uppercase text-text-secondary">
            {CHANNEL_TYPE_LABELS[type] || type}
          </div>
          {chans.map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleClick(channel.id)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-100 ${
                activeChannelId === channel.id
                  ? 'bg-primary-light'
                  : ''
              }`}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-text-secondary">
                {channel.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium text-text-primary">
                    {channel.name}
                  </span>
                  {channel.unreadCount > 0 && (
                    <span className="ml-2 flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-error px-1.5 text-xs font-bold text-white">
                      {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                    </span>
                  )}
                </div>
                {channel.lastMessage && (
                  <p className="truncate text-xs text-text-secondary">
                    {channel.lastMessage.senderName}: {channel.lastMessage.text}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      ))}

      {channels.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-text-secondary">
          채널이 없습니다
        </div>
      )}
    </div>
  );
}
