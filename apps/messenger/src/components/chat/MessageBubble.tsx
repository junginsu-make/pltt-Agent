'use client';

import { ChatMessage, useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';
import LeaveBalanceCard from '@/components/cards/LeaveBalanceCard';
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
      <div className="flex justify-center px-4 py-1">
        <span className="text-xs text-text-secondary">
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

  // Human message - right aligned if me
  if (isMe) {
    return (
      <div className="flex justify-end px-4 py-1">
        <div className="max-w-md">
          <div className="rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-white">
            {cardContent || message.contentText}
          </div>
          <div className="mt-0.5 text-right text-xs text-text-secondary">
            {formatTime(message.createdAt)}
          </div>
        </div>
      </div>
    );
  }

  // LLM message
  if (isLlm) {
    return (
      <div className="flex gap-2 px-4 py-1">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-200 text-xs font-bold text-purple-700">
          AI
        </div>
        <div className="max-w-md">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="text-xs font-medium text-text-primary">
              {message.displayName}
            </span>
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
              AI
            </span>
            {message.isLlmAuto && (
              <span className="text-[10px] text-text-secondary">자동</span>
            )}
            {delegationInfo?.from && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                위임 응답
              </span>
            )}
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-purple-50 px-4 py-2.5 text-sm text-text-primary">
            {cardContent || message.contentText}
          </div>
          <div className="mt-0.5 text-xs text-text-secondary">
            {formatTime(message.createdAt)}
          </div>
        </div>
      </div>
    );
  }

  // Human takeover message - green badge
  if (isHumanTakeover) {
    return (
      <div className="flex gap-2 px-4 py-1">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-200 text-xs font-bold text-green-700">
          {message.displayName.charAt(0)}
        </div>
        <div className="max-w-md">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="text-xs font-medium text-text-primary">
              {message.displayName}
            </span>
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
              직접 응답
            </span>
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-green-50 px-4 py-2.5 text-sm text-text-primary">
            {cardContent || message.contentText}
          </div>
          <div className="mt-0.5 text-xs text-text-secondary">
            {formatTime(message.createdAt)}
          </div>
        </div>
      </div>
    );
  }

  // Other human message - left aligned
  return (
    <div className="flex gap-2 px-4 py-1">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-text-secondary">
        {message.displayName.charAt(0)}
      </div>
      <div className="max-w-md">
        <div className="mb-0.5 text-xs font-medium text-text-primary">
          {message.displayName}
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2.5 text-sm text-text-primary">
          {cardContent || message.contentText}
        </div>
        <div className="mt-0.5 text-xs text-text-secondary">
          {formatTime(message.createdAt)}
        </div>
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
