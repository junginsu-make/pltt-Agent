'use client';

export default function ChannelsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-purple-100">
          <svg className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900">Palette AI Messenger</h2>
        <p className="mt-2 text-sm text-gray-500">
          좌측에서 채널을 선택하여 대화를 시작하세요
        </p>
        <p className="mt-1 text-xs text-gray-400">
          AI 비서가 업무를 도와드립니다
        </p>
      </div>
    </div>
  );
}
