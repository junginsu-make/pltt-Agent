'use client';

import { useState, type ChangeEvent } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useAuditLog } from '@/hooks/useAdmin';

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
}

const columnHelper = createColumnHelper<AuditEntry>();

const columns = [
  columnHelper.accessor('timestamp', {
    header: '시간',
    cell: (info) => {
      const date = new Date(info.getValue());
      return date.toLocaleString('ko-KR');
    },
  }),
  columnHelper.accessor('actor', {
    header: '수행자',
  }),
  columnHelper.accessor('action', {
    header: '작업',
    cell: (info) => (
      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-info/10 text-info">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('targetType', {
    header: '대상 유형',
  }),
  columnHelper.accessor('targetId', {
    header: '대상 ID',
    cell: (info) => (
      <span className="font-mono text-xs">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('details', {
    header: '세부 정보',
    cell: (info) => {
      const details = info.getValue();
      return (
        <span className="text-xs text-text-secondary truncate max-w-xs block">
          {details ? JSON.stringify(details) : '-'}
        </span>
      );
    },
  }),
];

export default function AuditLogPage() {
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const { data: logData, isLoading } = useAuditLog({
    actor: actorFilter,
    action: actionFilter,
    from: fromDate,
    to: toDate,
    page,
  });

  const entries = logData?.data ?? [];
  const totalPages = logData?.totalPages ?? 1;

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">감사 로그</h1>

      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="수행자"
          value={actorFilter}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setActorFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          data-testid="actor-filter"
        />
        <select
          value={actionFilter}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          data-testid="action-filter"
        >
          <option value="">전체 작업</option>
          <option value="create">생성</option>
          <option value="update">수정</option>
          <option value="delete">삭제</option>
          <option value="approve">승인</option>
          <option value="reject">반려</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setFromDate(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          data-testid="from-date"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setToDate(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          data-testid="to-date"
        />
      </div>

      <div className="rounded-lg bg-surface shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-text-secondary" data-testid="loading">로딩 중...</div>
        ) : (
          <table className="w-full" data-testid="audit-table">
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
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-secondary text-sm">
                    로그가 없습니다.
                  </td>
                </tr>
              )}
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
