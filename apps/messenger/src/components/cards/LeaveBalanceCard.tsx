'use client';

interface LeaveBalanceCardProps {
  data: Record<string, unknown>;
}

export default function LeaveBalanceCard({ data }: LeaveBalanceCardProps) {
  const total = (data.totalDays as number) || 0;
  const used = (data.usedDays as number) || 0;
  const pending = (data.pendingDays as number) || 0;
  const remaining = total - used - pending;
  const usagePercent = total > 0 ? ((used + pending) / total) * 100 : 0;
  const expiryDate = data.expiryDate as string | undefined;

  return (
    <div className="w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">
        연차 현황
      </h3>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-blue-50 p-2 text-center">
          <div className="text-lg font-bold text-blue-600">{total}</div>
          <div className="text-xs text-gray-500">총 연차</div>
        </div>
        <div className="rounded-lg bg-green-50 p-2 text-center">
          <div className="text-lg font-bold text-green-600">{remaining}</div>
          <div className="text-xs text-gray-500">잔여</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <div className="text-lg font-bold text-gray-500">{used}</div>
          <div className="text-xs text-gray-500">사용</div>
        </div>
        <div className="rounded-lg bg-yellow-50 p-2 text-center">
          <div className="text-lg font-bold text-amber-500">{pending}</div>
          <div className="text-xs text-gray-500">승인대기</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <div className="mt-1 text-right text-xs text-gray-500">
          {usagePercent.toFixed(0)}% 사용
        </div>
      </div>

      {expiryDate && (
        <div className="text-xs text-gray-400">
          만료일: {expiryDate}
        </div>
      )}
    </div>
  );
}
