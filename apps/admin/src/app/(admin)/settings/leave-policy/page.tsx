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

  const handleCancel = () => {
    if (policy) {
      setFormData(policy);
    }
    setEditMode(false);
  };

  const handleLeaveTypeChange = (
    idx: number,
    field: keyof LeaveType,
    value: string | number
  ) => {
    if (!formData) return;
    setFormData({
      ...formData,
      leaveTypes: formData.leaveTypes.map((lt, i) =>
        i === idx ? { ...lt, [field]: value } : lt
      ),
    });
  };

  const handleAutoApproveHoursChange = (value: number) => {
    if (!formData) return;
    setFormData({
      ...formData,
      autoApprove: { ...formData.autoApprove, maxHours: value },
    });
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
        <div className="flex gap-2">
          {editMode && (
            <button
              onClick={handleCancel}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-text-primary hover:bg-gray-50"
            >
              취소
            </button>
          )}
          <button
            onClick={() => (editMode ? handleSave() : setEditMode(true))}
            className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
          >
            {editMode ? '저장' : '수정'}
          </button>
        </div>
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
                    {editMode ? (
                      <input
                        data-testid="leave-label-input"
                        type="text"
                        value={lt.label}
                        onChange={(e) =>
                          handleLeaveTypeChange(idx, 'label', e.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
                      />
                    ) : (
                      <p className="text-sm font-medium text-text-primary">{lt.label}</p>
                    )}
                    <p className="text-xs text-text-secondary mt-1">유형: {lt.type}</p>
                  </div>
                  <div className="text-sm text-text-primary">
                    {editMode ? (
                      <div className="flex items-center gap-2">
                        <span>기본</span>
                        <input
                          data-testid="default-days-input"
                          type="number"
                          value={lt.defaultDays}
                          onChange={(e) =>
                            handleLeaveTypeChange(
                              idx,
                              'defaultDays',
                              parseInt(e.target.value, 10) || 0
                            )
                          }
                          className="w-20 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
                          min={0}
                        />
                        <span>일</span>
                      </div>
                    ) : (
                      <>기본 {lt.defaultDays}일</>
                    )}
                  </div>
                </div>
              )) || (
                <p className="text-sm text-text-secondary">등록된 휴가 유형이 없습니다.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-text-primary mb-2">자동 승인 설정</h3>
            {editMode ? (
              <div className="flex items-center gap-2">
                <label htmlFor="auto-approve-hours" className="text-sm text-text-secondary">
                  최대 자동 승인 시간:
                </label>
                <input
                  id="auto-approve-hours"
                  data-testid="auto-approve-hours-input"
                  type="number"
                  value={
                    (formData?.autoApprove as Record<string, number>)?.maxHours ?? 0
                  }
                  onChange={(e) =>
                    handleAutoApproveHoursChange(
                      parseInt(e.target.value, 10) || 0
                    )
                  }
                  className="w-20 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
                  min={0}
                />
                <span className="text-sm text-text-secondary">시간</span>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                {formData?.autoApprove
                  ? JSON.stringify(formData.autoApprove, null, 2)
                  : '자동 승인 설정이 없습니다.'}
              </p>
            )}
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
