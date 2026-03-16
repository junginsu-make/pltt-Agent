'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface ApprovalCardProps {
  data: Record<string, unknown>;
}

export default function ApprovalCard({ data }: ApprovalCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decided, setDecided] = useState(false);

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
      await api.post(`/approvals/${approvalId}/decide`, { decision });
      setDecided(true);
    } catch {
      /* handle error silently */
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-80 rounded-xl border border-gray-200 bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">
        휴가 승인 요청
      </h3>

      <div className="mb-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">신청자</span>
          <span className="font-medium text-text-primary">{employeeName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">일자</span>
          <span className="font-medium text-text-primary">{date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">유형</span>
          <span className="font-medium text-text-primary">{leaveType}</span>
        </div>
        {reason && (
          <div className="flex justify-between">
            <span className="text-text-secondary">사유</span>
            <span className="font-medium text-text-primary">{reason}</span>
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
            <div className="text-xs text-text-secondary">
              일정 충돌:{' '}
              <span
                className={
                  aiAnalysis.scheduleConflict
                    ? 'font-medium text-error'
                    : 'font-medium text-success'
                }
              >
                {aiAnalysis.scheduleConflict ? '있음' : '없음'}
              </span>
            </div>
          )}
          {aiAnalysis.recommendation ? (
            <div className="mt-1 text-xs text-text-secondary">
              추천: {String(aiAnalysis.recommendation)}
            </div>
          ) : null}
        </div>
      )}

      {/* Auto-approve countdown */}
      {autoApproveAt && !decided && (
        <div className="mb-3 text-center text-xs text-text-secondary">
          자동 승인: {autoApproveAt}
        </div>
      )}

      {/* Action buttons */}
      {!decided ? (
        <div className="flex gap-2">
          <button
            onClick={() => handleDecide('approve')}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-success/90 disabled:opacity-50"
          >
            승인
          </button>
          <button
            onClick={() => handleDecide('reject')}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-error px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-error/90 disabled:opacity-50"
          >
            반려
          </button>
        </div>
      ) : (
        <div className="text-center text-sm font-medium text-success">
          처리 완료
        </div>
      )}
    </div>
  );
}
