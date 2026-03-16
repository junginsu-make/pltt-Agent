'use client';

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useEmployees } from '@/hooks/useEmployees';

interface Employee {
  id: string;
  name: string;
  email: string;
  teamId: string;
  position: string;
  grade: string;
  status: string;
  hireDate: string;
}

const columnHelper = createColumnHelper<Employee>();

const columns = [
  columnHelper.accessor('name', {
    header: '이름',
    cell: (info) => (
      <Link
        href={`/employees/${info.row.original.id}`}
        className="text-primary hover:underline font-medium"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor('email', {
    header: '이메일',
  }),
  columnHelper.accessor('teamId', {
    header: '팀',
  }),
  columnHelper.accessor('position', {
    header: '직위',
  }),
  columnHelper.accessor('status', {
    header: '상태',
    cell: (info) => {
      const status = info.getValue();
      const colorClass =
        status === 'active'
          ? 'bg-success/10 text-success'
          : 'bg-gray-100 text-text-secondary';
      return (
        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
          {status === 'active' ? '재직' : '퇴직'}
        </span>
      );
    },
  }),
  columnHelper.display({
    id: 'actions',
    header: '관리',
    cell: (info) => (
      <Link
        href={`/employees/${info.row.original.id}`}
        className="text-sm text-primary hover:underline"
      >
        상세보기
      </Link>
    ),
  }),
];

export default function EmployeesPage() {
  const [teamFilter, setTeamFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: employeesData, isLoading } = useEmployees({ teamId: teamFilter });

  const employees = employeesData?.data ?? [];

  const filteredEmployees = employees.filter((emp: Employee) => {
    if (searchQuery) {
      return emp.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const table = useReactTable({
    data: filteredEmployees,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">직원 관리</h1>
        <Link
          href="/employees/new"
          className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
        >
          직원 추가
        </Link>
      </div>

      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="이름으로 검색..."
          value={searchQuery}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          data-testid="search-input"
        />
        <select
          value={teamFilter}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setTeamFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          data-testid="team-filter"
        >
          <option value="">전체 팀</option>
          <option value="engineering">개발팀</option>
          <option value="design">디자인팀</option>
          <option value="marketing">마케팅팀</option>
        </select>
      </div>

      <div className="rounded-lg bg-surface shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-text-secondary" data-testid="loading">로딩 중...</div>
        ) : (
          <table className="w-full" data-testid="employees-table">
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
    </div>
  );
}
