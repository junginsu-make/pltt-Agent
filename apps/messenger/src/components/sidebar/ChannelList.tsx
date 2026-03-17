'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { useChatStore, ChatChannel } from '@/stores/chat-store';

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  direct: 'DM',
  work: '업무',
  team: '팀',
  notification: '알림',
  company: '전사',
};

const CHANNEL_TYPE_ORDER: string[] = [
  'notification',
  'direct',
  'work',
  'team',
  'company',
];

function ChannelTypeIcon({ type }: { type: string }) {
  const cls = "h-3.5 w-3.5";
  switch (type) {
    case 'direct':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
    case 'team':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case 'notification':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
    case 'company':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
    default:
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>;
  }
}

function getAvatarStyle(channel: ChatChannel) {
  switch (channel.type) {
    case 'notification': return 'bg-amber-100 text-amber-600';
    case 'team': return 'bg-emerald-100 text-emerald-600';
    case 'company': return 'bg-blue-100 text-blue-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}

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
    <div data-testid="channel-list" className="scrollbar-thin flex-1 overflow-y-auto">
      {Object.entries(grouped).map(([type, chans]) => (
        <div key={type} data-testid={`channel-group-${type === 'direct' ? 'dm' : type}`} className="py-1">
          <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <ChannelTypeIcon type={type} />
            {CHANNEL_TYPE_LABELS[type] || type}
          </div>
          {chans.map((channel) => {
            const isActive = activeChannelId === channel.id;
            return (
              <button
                key={channel.id}
                data-testid="channel-item"
                onClick={() => handleClick(channel.id)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-all ${
                  isActive
                    ? 'border-r-2 border-primary bg-primary/5'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarStyle(channel)}`}>
                  {channel.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`truncate text-sm ${isActive ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {channel.name}
                    </span>
                    {channel.unreadCount > 0 && (
                      <span className="ml-2 flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                        {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                      </span>
                    )}
                  </div>
                  {channel.lastMessage && (
                    <p className="truncate text-xs text-gray-400">
                      {channel.lastMessage.senderName}: {channel.lastMessage.text}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}

      {channels.length === 0 && (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">채널이 없습니다</p>
          <p className="mt-1 text-xs text-gray-400">서버에 연결하면 채널이 표시됩니다</p>
        </div>
      )}
    </div>
  );
}
