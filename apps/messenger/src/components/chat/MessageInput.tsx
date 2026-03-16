'use client';

import { useState, useRef, useCallback, KeyboardEvent, ChangeEvent } from 'react';
import { useChatStore } from '@/stores/chat-store';

interface MessageInputProps {
  onSend: (content: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

export default function MessageInput({
  onSend,
  onTypingStart,
  onTypingStop,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const isConnected = useChatStore((s) => s.isConnected);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingStop();
    }, 2000);
  }, [onTypingStart, onTypingStop]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    onSend(trimmed);
    setText('');

    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-surface p-4">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
            setText(e.target.value);
            handleTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            isConnected
              ? '메시지를 입력하세요...'
              : '서버에 연결 중...'
          }
          disabled={!isConnected}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-50"
        />
        <button
          onClick={handleSend}
          disabled={!isConnected || !text.trim()}
          className="flex-shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          전송
        </button>
      </div>
    </div>
  );
}
