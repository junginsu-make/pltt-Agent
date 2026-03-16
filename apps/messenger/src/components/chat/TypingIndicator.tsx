'use client';

interface TypingIndicatorProps {
  users: Array<{ userId: string; displayName: string }>;
}

export default function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const names = users.map((u) => u.displayName);
  let text: string;

  if (names.length === 1) {
    text = `${names[0]}님이 입력 중`;
  } else if (names.length === 2) {
    text = `${names[0]}, ${names[1]}님이 입력 중`;
  } else {
    text = `${names[0]} 외 ${names.length - 1}명이 입력 중`;
  }

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
          <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
          <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
        </div>
        <span className="text-[11px] text-gray-400">{text}</span>
      </div>
    </div>
  );
}
