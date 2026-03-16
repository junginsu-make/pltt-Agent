'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEmployee } from '@/hooks/useEmployees';

export default function EmployeeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: employee, isLoading } = useEmployee(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-secondary">직원 정보를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/employees" className="text-text-secondary hover:text-text-primary">
          &larr; 목록으로
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">{employee.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <div className="lg:col-span-2 rounded-lg bg-surface p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-text-primary mb-4">기본 정보</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-text-secondary">이름</dt>
              <dd className="text-sm font-medium text-text-primary mt-1">{employee.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-secondary">이메일</dt>
              <dd className="text-sm font-medium text-text-primary mt-1">{employee.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-secondary">팀</dt>
              <dd className="text-sm font-medium text-text-primary mt-1">{employee.teamId || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-secondary">직위</dt>
              <dd className="text-sm font-medium text-text-primary mt-1">{employee.position || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-secondary">등급</dt>
              <dd className="text-sm font-medium text-text-primary mt-1">{employee.grade || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-secondary">입사일</dt>
              <dd className="text-sm font-medium text-text-primary mt-1">{employee.hireDate || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-secondary">상태</dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    employee.status === 'active'
                      ? 'bg-success/10 text-success'
                      : 'bg-gray-100 text-text-secondary'
                  }`}
                >
                  {employee.status === 'active' ? '재직' : '퇴직'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Leave Balance */}
        <div className="rounded-lg bg-surface p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-text-primary mb-4">연차 현황</h2>
          {employee.leaveBalances && employee.leaveBalances.length > 0 ? (
            <div className="space-y-3">
              {employee.leaveBalances.map((balance: { leaveType: string; totalDays: number; usedDays: number; remainingDays: number }, idx: number) => (
                <div key={idx} className="border-b border-gray-100 pb-3 last:border-0">
                  <p className="text-sm font-medium text-text-primary">{balance.leaveType}</p>
                  <div className="flex justify-between text-xs text-text-secondary mt-1">
                    <span>총 {balance.totalDays}일</span>
                    <span>사용 {balance.usedDays}일</span>
                    <span>잔여 {balance.remainingDays}일</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">연차 정보가 없습니다.</p>
          )}
        </div>
      </div>

      {/* Leave History */}
      <div className="mt-6 rounded-lg bg-surface p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-text-primary mb-4">휴가 이력</h2>
        {employee.leaveHistory && employee.leaveHistory.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">유형</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">기간</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">일수</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employee.leaveHistory.map((leave: { id: string; leaveType: string; startDate: string; endDate: string; days: number; status: string }) => (
                <tr key={leave.id}>
                  <td className="px-4 py-2 text-sm">{leave.leaveType}</td>
                  <td className="px-4 py-2 text-sm">{leave.startDate} ~ {leave.endDate}</td>
                  <td className="px-4 py-2 text-sm">{leave.days}일</td>
                  <td className="px-4 py-2 text-sm">{leave.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-text-secondary">휴가 이력이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
