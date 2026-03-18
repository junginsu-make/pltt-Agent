'use client';

import { ChatMessage, useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';
import LeaveBalanceCard from '@/components/cards/LeaveBalanceCard';
import LeaveRequestCard from '@/components/cards/LeaveRequestCard';
import ApprovalCard from '@/components/cards/ApprovalCard';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const currentUser = useAuthStore((s) => s.user);
  const channels = useChatStore((s) => s.channels);
  const activeChannelId = useChatStore((s) => s.activeChannelId);
  const isMe = currentUser?.id === message.senderUserId;
  const activeChannel = channels.find((ch) => ch.id === activeChannelId);
  const isHumanTakeover =
    activeChannel?.humanTakeover &&
    activeChannel.type === 'work' &&
    message.senderType === 'human' &&
    !isMe;

  // System messages
  if (message.senderType === 'system') {
    return (
      <div data-testid="system-notification" className="flex justify-center px-4 py-2">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] text-gray-500">
          {message.contentText}
        </span>
      </div>
    );
  }

  // Card content rendering
  const renderCardContent = () => {
    if (message.contentType === 'card' && message.cardData) {
      const cardType = message.cardData.type as string | undefined;
      if (cardType === 'leave_balance') {
        return <LeaveBalanceCard data={message.cardData} />;
      }
      if (cardType === 'leave_request_confirmation') {
        return <LeaveRequestCard data={message.cardData} />;
      }
    }
    if (message.contentType === 'approval' && message.cardData) {
      return <ApprovalCard data={message.cardData} />;
    }
    return null;
  };

  const isLlm = message.senderType === 'llm';
  const cardContent = renderCardContent();
  const delegationInfo = (message.metadata as Record<string, unknown>)?.delegation as
    | { from?: string; chain?: string[] }
    | undefined;

  // My message - right aligned (KakaoTalk style)
  if (isMe) {
    return (
      <div className="flex justify-end px-4 py-0.5">
        <div className="flex items-end gap-1.5">
          <span className="mb-1 text-[10px] text-gray-400">
            {formatTime(message.createdAt)}
          </span>
          <div data-testid="text-bubble" className="max-w-xs rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm sm:max-w-sm">
            {cardContent || message.contentText}
          </div>
        </div>
      </div>
    );
  }

  // LLM message - purple accent
  if (isLlm) {
    return (
      <div className="flex gap-2.5 px-4 py-0.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-[10px] font-bold text-white shadow-sm">
          AI
        </div>
        <div className="max-w-xs sm:max-w-sm">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-800">
              {message.displayName}
            </span>
            <span data-testid="ai-badge" className="rounded-full bg-purple-100 px-1.5 py-px text-[9px] font-bold text-purple-600">
              AI
            </span>
            {message.isLlmAuto && (
              <span className="text-[10px] text-gray-400">자동</span>
            )}
            {delegationInfo?.from && (
              <span className="rounded-full bg-blue-100 px-1.5 py-px text-[9px] font-bold text-blue-600">
                위임
              </span>
            )}
          </div>
          <div data-testid={cardContent ? 'card-message' : 'text-bubble'} className="rounded-2xl rounded-tl-md border border-purple-100 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-gray-800 shadow-sm">
            {cardContent || message.contentText}
          </div>
          <span className="mt-0.5 block text-[10px] text-gray-400">
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  // Human takeover message - green accent
  if (isHumanTakeover) {
    return (
      <div className="flex gap-2.5 px-4 py-0.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-bold text-white shadow-sm">
          {message.displayName.charAt(0)}
        </div>
        <div className="max-w-xs sm:max-w-sm">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-800">
              {message.displayName}
            </span>
            <span className="rounded-full bg-green-100 px-1.5 py-px text-[9px] font-bold text-green-600">
              직접 응답
            </span>
          </div>
          <div data-testid="text-bubble" className="rounded-2xl rounded-tl-md border border-green-100 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-gray-800 shadow-sm">
            {cardContent || message.contentText}
          </div>
          <span className="mt-0.5 block text-[10px] text-gray-400">
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  // Other human message - left aligned
  return (
    <div className="flex gap-2.5 px-4 py-0.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
        {message.displayName.charAt(0)}
      </div>
      <div className="max-w-xs sm:max-w-sm">
        <div className="mb-1 text-xs font-semibold text-gray-800">
          {message.displayName}
        </div>
        <div data-testid="text-bubble" className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed text-gray-800 shadow-sm">
          {cardContent || message.contentText}
        </div>
        <span className="mt-0.5 block text-[10px] text-gray-400">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
