'use client';

import { useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface Approval {
  id: string;
  leaveRequestId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  approverName: string;
  createdAt: string;
  decidedAt?: string;
}

interface ApprovalsResponse {
  data: Approval[];
  total: number;
  page: number;
  totalPages: number;
}

export default function ApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useQuery<ApprovalsResponse>({
    queryKey: ['approvals', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/admin/approvals', { params });
      return res.data;
    },
  });

  const approvals = data?.data ?? [];

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return { text: '대기', class: 'bg-warning/10 text-warning' };
      case 'approved':
        return { text: '승인', class: 'bg-success/10 text-success' };
      case 'rejected':
        return { text: '반려', class: 'bg-error/10 text-error' };
      default:
        return { text: status, class: 'bg-gray-100 text-text-secondary' };
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">결재 현황</h1>
      </div>

      <div className="flex gap-4 mb-4">
        <select
          value={statusFilter}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          data-testid="status-filter"
        >
          <option value="">전체 상태</option>
          <option value="pending">대기</option>
          <option value="approved">승인</option>
          <option value="rejected">반려</option>
        </select>
      </div>

      <div className="rounded-lg bg-surface shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-text-secondary" data-testid="loading">
            로딩 중...
          </div>
        ) : approvals.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">결재 내역이 없습니다.</div>
        ) : (
          <table className="w-full" data-testid="approvals-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  신청자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  휴가 유형
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  기간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  일수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  결재자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  신청일
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {approvals.map((approval) => {
                const s = statusLabel(approval.status);
                return (
                  <tr key={approval.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-text-primary font-medium">
                      {approval.employeeName}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-primary">
                      {approval.leaveType}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-primary">
                      {approval.startDate} ~ {approval.endDate}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-primary">{approval.days}일</td>
                    <td className="px-6 py-4 text-sm text-text-primary">
                      {approval.approverName}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${s.class}`}
                      >
                        {s.text}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {approval.createdAt?.slice(0, 10)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
