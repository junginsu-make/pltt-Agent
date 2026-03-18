'use client';

interface LeaveRequestCardProps {
  data: Record<string, unknown>;
}

export default function LeaveRequestCard({ data }: LeaveRequestCardProps) {
  const request = (data.request as Record<string, unknown>) ?? data;
  const approval = data.approval as Record<string, unknown> | undefined;

  const startDate = (request.start_date as string) ?? '';
  const endDate = (request.end_date as string) ?? '';
  const days = (request.days as number) ?? 0;
  const reason = (request.reason as string) ?? '';
  const status = (request.status as string) ?? 'pending';
  const leaveType = (request.leave_type as string) ?? 'annual';

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  return (
    <div data-testid="leave-request-card" className="w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">
        휴가 신청 확인
      </h3>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">유형</span>
          <span className="font-medium">{leaveType === 'annual' ? '연차' : leaveType}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">기간</span>
          <span className="font-medium">
            {formatDate(startDate)}{startDate !== endDate ? ` ~ ${formatDate(endDate)}` : ''} ({days}일)
          </span>
        </div>
        {reason && (
          <div className="flex justify-between">
            <span className="text-gray-500">사유</span>
            <span className="font-medium">{reason}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">상태</span>
          <span className={`font-medium ${status === 'pending' ? 'text-amber-500' : 'text-green-500'}`}>
            {status === 'pending' ? '승인 대기' : status}
          </span>
        </div>
        {approval?.approver_name && (
          <div className="flex justify-between">
            <span className="text-gray-500">결재자</span>
            <span className="font-medium">{approval.approver_name as string}</span>
          </div>
        )}
      </div>
    </div>
  );
}
