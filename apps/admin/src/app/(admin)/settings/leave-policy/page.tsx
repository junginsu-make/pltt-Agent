'use client';

import { useState, useEffect } from 'react';
import { useLeavePolicy, useUpdateLeavePolicy } from '@/hooks/useAdmin';

interface LeaveType {
  type: string;
  label: string;
  defaultDays: number;
}

interface LeavePolicy {
  id: string;
  name: string;
  rules: Record<string, unknown>;
  leaveTypes: LeaveType[];
  autoApprove: Record<string, unknown>;
  isActive: boolean;
}

export default function LeavePolicyPage() {
  const { data: policy, isLoading } = useLeavePolicy('default');
  const updatePolicy = useUpdateLeavePolicy();
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<LeavePolicy | null>(null);

  useEffect(() => {
    if (policy) {
      setFormData(policy);
    }
  }, [policy]);

  const handleSave = () => {
    if (formData) {
      updatePolicy.mutate(
        { id: formData.id, data: formData },
        {
          onSuccess: () => setEditMode(false),
        }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">연차 규정</h1>
        <button
          onClick={() => (editMode ? handleSave() : setEditMode(true))}
          className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
        >
          {editMode ? '저장' : '수정'}
        </button>
      </div>

      <div className="rounded-lg bg-surface p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          {formData?.name || '기본 연차 규정'}
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-2">휴가 유형</h3>
            <div className="space-y-3">
              {formData?.leaveTypes?.map((lt, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 p-3 rounded-md border border-gray-200"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">{lt.label}</p>
                    <p className="text-xs text-text-secondary">유형: {lt.type}</p>
                  </div>
                  <div className="text-sm text-text-primary">
                    기본 {lt.defaultDays}일
                  </div>
                </div>
              )) || (
                <p className="text-sm text-text-secondary">등록된 휴가 유형이 없습니다.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-text-primary mb-2">자동 승인 설정</h3>
            <p className="text-sm text-text-secondary">
              {formData?.autoApprove
                ? JSON.stringify(formData.autoApprove, null, 2)
                : '자동 승인 설정이 없습니다.'}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-text-primary mb-2">상태</h3>
            <span
              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                formData?.isActive
                  ? 'bg-success/10 text-success'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              {formData?.isActive ? '활성' : '비활성'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
