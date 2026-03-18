'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';

interface ApprovalCardProps {
  data: Record<string, unknown>;
}

export default function ApprovalCard({ data }: ApprovalCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decided, setDecided] = useState(false);
  const currentUser = useAuthStore((s) => s.user);

  const approvalId = data.approvalId as string;
  const employeeName = (data.employeeName as string) || '';
  const date = (data.date as string) || '';
  const leaveType = (data.leaveType as string) || '';
  const reason = (data.reason as string) || '';
  const aiAnalysis = data.aiAnalysis as Record<string, unknown> | undefined;
  const autoApproveAt = data.autoApproveAt as string | undefined;

  const handleDecide = async (decision: 'approve' | 'reject') => {
    setIsSubmitting(true);
    try {
      const approvalServiceUrl = process.env.NEXT_PUBLIC_APPROVAL_SERVICE_URL || 'http://localhost:3002/api/v1';
      const token = typeof window !== 'undefined' ? localStorage.getItem('palette_token') : null;
      await fetch(`${approvalServiceUrl}/approvals/${approvalId}/decide`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          decision: decision === 'approve' ? 'approved' : 'rejected',
          decided_by: currentUser?.id ?? '',
          comment: decision === 'approve' ? '승인합니다' : '',
        }),
      });
      setDecided(true);
    } catch {
      /* handle error silently */
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-testid="approval-card" className="w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">
        휴가 승인 요청
      </h3>

      <div className="mb-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">신청자</span>
          <span className="font-medium text-gray-900">{employeeName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">일자</span>
          <span className="font-medium text-gray-900">{date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">유형</span>
          <span className="font-medium text-gray-900">{leaveType}</span>
        </div>
        {reason && (
          <div className="flex justify-between">
            <span className="text-gray-500">사유</span>
            <span className="font-medium text-gray-900">{reason}</span>
          </div>
        )}
      </div>

      {/* AI Analysis */}
      {aiAnalysis && (
        <div className="mb-3 rounded-lg bg-purple-50 p-3">
          <div className="mb-1 flex items-center gap-1">
            <span className="text-xs font-semibold text-purple-700">
              AI 분석
            </span>
          </div>
          {aiAnalysis.scheduleConflict !== undefined && (
            <div className="text-xs text-gray-500">
              일정 충돌:{' '}
              <span
                className={
                  aiAnalysis.scheduleConflict
                    ? 'font-medium text-red-600'
                    : 'font-medium text-green-600'
                }
              >
                {aiAnalysis.scheduleConflict ? '있음' : '없음'}
              </span>
            </div>
          )}
          {aiAnalysis.recommendation ? (
            <div className="mt-1 text-xs text-gray-500">
              추천: {String(aiAnalysis.recommendation)}
            </div>
          ) : null}
        </div>
      )}

      {/* Auto-approve countdown */}
      {autoApproveAt && !decided && (
        <div className="mb-3 text-center text-xs text-gray-400">
          자동 승인: {autoApproveAt}
        </div>
      )}

      {/* Action buttons */}
      {!decided ? (
        <div className="flex gap-2">
          <button
            data-testid="approve-button"
            onClick={() => handleDecide('approve')}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
          >
            승인
          </button>
          <button
            data-testid="reject-button"
            onClick={() => handleDecide('reject')}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            반려
          </button>
        </div>
      ) : (
        <div className="text-center text-sm font-medium text-green-600">
          처리 완료
        </div>
      )}
    </div>
  );
}
