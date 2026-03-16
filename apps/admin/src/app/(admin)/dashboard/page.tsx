'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface DashboardStats {
  todayLeaves: number;
  pendingApprovals: number;
  totalEmployees: number;
  monthlyLeaves: number;
}

function StatCard({
  title,
  value,
  color,
  loading,
}: {
  title: string;
  value: number;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface p-6 shadow-sm border border-gray-100" data-testid="stat-card">
      <p className="text-sm text-text-secondary">{title}</p>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200" data-testid="loading-skeleton" />
      ) : (
        <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [employees, leaves, approvals] = await Promise.all([
        api.get('/admin/employees', { params: { limit: 1 } }),
        api.get('/leave/requests', { params: { status: 'approved', limit: 1 } }),
        api.get('/approvals/pending/admin', {}),
      ]);
      return {
        totalEmployees: employees.data.total || 0,
        todayLeaves: leaves.data.total || 0,
        pendingApprovals: approvals.data.length || 0,
        monthlyLeaves: leaves.data.monthlyTotal || 0,
      };
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">대시보드</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="stats-grid">
        <StatCard
          title="오늘 휴가"
          value={stats?.todayLeaves ?? 0}
          color="text-info"
          loading={isLoading}
        />
        <StatCard
          title="승인 대기"
          value={stats?.pendingApprovals ?? 0}
          color="text-warning"
          loading={isLoading}
        />
        <StatCard
          title="전체 직원"
          value={stats?.totalEmployees ?? 0}
          color="text-text-primary"
          loading={isLoading}
        />
        <StatCard
          title="이번 달 휴가"
          value={stats?.monthlyLeaves ?? 0}
          color="text-success"
          loading={isLoading}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg bg-surface p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-text-primary mb-4">최근 휴가 요청</h2>
          <p className="text-text-secondary text-sm">최근 휴가 요청이 여기에 표시됩니다.</p>
        </div>
        <div className="rounded-lg bg-surface p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-text-primary mb-4">최근 활동</h2>
          <p className="text-text-secondary text-sm">최근 관리 활동이 여기에 표시됩니다.</p>
        </div>
      </div>
    </div>
  );
}
