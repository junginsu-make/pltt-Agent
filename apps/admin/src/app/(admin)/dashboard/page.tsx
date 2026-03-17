'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface DashboardStats {
  todayLeaves: number;
  pendingApprovals: number;
  totalEmployees: number;
  monthlyLeaves: number;
}

interface RecentLeaveRequest {
  id: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: '연차',
  sick: '병가',
  half: '반차',
  special: '특별',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  approved: '승인',
  rejected: '반려',
  cancelled: '취소',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const ACTION_LABELS: Record<string, string> = {
  create: '생성',
  update: '수정',
  delete: '삭제',
  approve: '승인',
  reject: '반려',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-blue-100 text-blue-800',
  update: 'bg-yellow-100 text-yellow-800',
  delete: 'bg-red-100 text-red-800',
  approve: 'bg-green-100 text-green-800',
  reject: 'bg-red-100 text-red-800',
};

function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${diffDays}일 전`;
}

function RecentLeaves() {
  const { data, isLoading } = useQuery<{ data: RecentLeaveRequest[] }>({
    queryKey: ['recent-leaves'],
    queryFn: async () => {
      const res = await api.get('/leave/requests', {
        params: { limit: 5, sort: 'desc' },
      });
      return res.data;
    },
  });

  const leaves = data?.data ?? [];

  return (
    <div
      className="rounded-lg bg-surface p-6 shadow-sm border border-gray-100"
      data-testid="recent-leaves"
    >
      <h2 className="text-lg font-semibold text-text-primary mb-4">최근 휴가 요청</h2>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-200" data-testid="loading-skeleton" />
          ))}
        </div>
      ) : leaves.length === 0 ? (
        <p className="text-text-secondary text-sm">최근 휴가 요청이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {leaves.map((leave) => (
            <li
              key={leave.id}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-text-primary">{leave.employeeName}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-text-secondary">
                  {LEAVE_TYPE_LABELS[leave.leaveType] ?? leave.leaveType}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">
                  {leave.startDate} ~ {leave.endDate}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[leave.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {STATUS_LABELS[leave.status] ?? leave.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentActivity() {
  const { data, isLoading } = useQuery<{ data: AuditEntry[] }>({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const res = await api.get('/admin/audit-log', {
        params: { limit: 5 },
      });
      return res.data;
    },
  });

  const entries = data?.data ?? [];

  return (
    <div
      className="rounded-lg bg-surface p-6 shadow-sm border border-gray-100"
      data-testid="recent-activity"
    >
      <h2 className="text-lg font-semibold text-text-primary mb-4">최근 활동</h2>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-200" data-testid="loading-skeleton" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-text-secondary text-sm">최근 활동이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary">
                  {formatTimeAgo(entry.timestamp)}
                </span>
                <span className="font-medium text-text-primary">{entry.actor}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${ACTION_COLORS[entry.action] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
              </div>
              <span className="text-sm text-text-secondary">
                {entry.targetType}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
        <RecentLeaves />
        <RecentActivity />
      </div>
    </div>
  );
}
