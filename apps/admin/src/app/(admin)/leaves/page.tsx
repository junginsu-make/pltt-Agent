'use client';

import { useState, type ChangeEvent } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useLeaveRequests } from '@/hooks/useLeaves';

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
}

const columnHelper = createColumnHelper<LeaveRequest>();

const statusLabels: Record<string, string> = {
  pending: '대기',
  approved: '승인',
  rejected: '반려',
  cancelled: '취소',
};

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-error/10 text-error',
  cancelled: 'bg-gray-100 text-text-secondary',
};

const columns = [
  columnHelper.accessor('employeeName', {
    header: '직원',
  }),
  columnHelper.accessor('leaveType', {
    header: '유형',
    cell: (info) => {
      const type = info.getValue();
      return type === 'annual' ? '연차' : type === 'sick' ? '병가' : type;
    },
  }),
  columnHelper.accessor('startDate', {
    header: '시작일',
  }),
  columnHelper.accessor('endDate', {
    header: '종료일',
  }),
  columnHelper.accessor('days', {
    header: '일수',
    cell: (info) => `${info.getValue()}일`,
  }),
  columnHelper.accessor('status', {
    header: '상태',
    cell: (info) => {
      const status = info.getValue();
      return (
        <span
          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            statusColors[status] || 'bg-gray-100 text-text-secondary'
          }`}
        >
          {statusLabels[status] || status}
        </span>
      );
    },
  }),
  columnHelper.display({
    id: 'actions',
    header: '관리',
    cell: (info) => {
      const status = info.row.original.status;
      if (status !== 'pending') return null;
      return (
        <div className="flex gap-2">
          <button className="text-xs text-success hover:underline">승인</button>
          <button className="text-xs text-error hover:underline">반려</button>
        </div>
      );
    },
  }),
];

export default function LeavesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data: leavesData, isLoading } = useLeaveRequests({
    status: statusFilter,
    page,
    limit: 20,
  });

  const leaves = leavesData?.data ?? [];
  const totalPages = leavesData?.totalPages ?? 1;

  const table = useReactTable({
    data: leaves,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">휴가 관리</h1>

      <div className="flex gap-4 mb-4">
        <select
          value={statusFilter}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
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
          <div className="p-8 text-center text-text-secondary" data-testid="loading">로딩 중...</div>
        ) : (
          <table className="w-full" data-testid="leaves-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 text-sm text-text-primary">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4" data-testid="pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            이전
          </button>
          <span className="px-3 py-1 text-sm text-text-secondary">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
