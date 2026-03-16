'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface Team {
  id: string;
  name: string;
  managerId?: string;
  managerName?: string;
  memberCount: number;
}

interface TeamsResponse {
  data: Team[];
}

export default function TeamsPage() {
  const { data, isLoading } = useQuery<TeamsResponse>({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await api.get('/admin/teams');
      return res.data;
    },
  });

  const teams = data?.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">조직 관리</h1>
      </div>

      <div className="rounded-lg bg-surface shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-text-secondary" data-testid="loading">
            로딩 중...
          </div>
        ) : teams.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">등록된 팀이 없습니다.</div>
        ) : (
          <table className="w-full" data-testid="teams-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  팀 ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  팀명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  팀장
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  팀원 수
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {teams.map((team) => (
                <tr key={team.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-text-secondary font-mono">
                    {team.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-primary font-medium">
                    {team.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-primary">
                    {team.managerName ?? '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-primary">{team.memberCount}명</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
