'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTeams, useAddTeam, useUpdateTeam, useEmployeeList } from '@/hooks/useAdmin';

interface Team {
  id: string;
  name: string;
  managerId?: string;
  managerName?: string;
  memberCount: number;
}

export default function TeamsPage() {
  const { data, isLoading } = useTeams();
  const { data: employees } = useEmployeeList();
  const addTeam = useAddTeam();
  const updateTeam = useUpdateTeam();

  const teams = data?.data ?? [];
  const employeeList = employees ?? [];

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamManagerId, setNewTeamManagerId] = useState('');
  const [validationError, setValidationError] = useState('');

  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editManagerId, setEditManagerId] = useState('');

  const handleOpenAddForm = () => {
    setShowAddForm(true);
    setValidationError('');
    setNewTeamName('');
    setNewTeamManagerId('');
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setValidationError('');
    setNewTeamName('');
    setNewTeamManagerId('');
  };

  const handleSaveAdd = () => {
    if (!newTeamName.trim()) {
      setValidationError('팀명을 입력해주세요.');
      return;
    }

    addTeam.mutate(
      {
        name: newTeamName.trim(),
        ...(newTeamManagerId ? { managerId: newTeamManagerId } : {}),
      },
      {
        onSuccess: () => {
          setShowAddForm(false);
          setNewTeamName('');
          setNewTeamManagerId('');
          setValidationError('');
        },
      }
    );
  };

  const handleStartEdit = (team: Team) => {
    setEditingTeamId(team.id);
    setEditName(team.name);
    setEditManagerId(team.managerId ?? '');
  };

  const handleCancelEdit = () => {
    setEditingTeamId(null);
    setEditName('');
    setEditManagerId('');
  };

  const handleSaveEdit = (teamId: string) => {
    if (!editName.trim()) return;

    updateTeam.mutate(
      {
        id: teamId,
        data: {
          name: editName.trim(),
          ...(editManagerId ? { managerId: editManagerId } : {}),
        },
      },
      {
        onSuccess: () => {
          setEditingTeamId(null);
          setEditName('');
          setEditManagerId('');
        },
      }
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">조직 관리</h1>
        <button
          type="button"
          onClick={handleOpenAddForm}
          className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
        >
          팀 추가
        </button>
      </div>

      {/* Add Team Form */}
      {showAddForm && (
        <div className="rounded-lg bg-surface p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">팀 추가</h2>
          <div className="flex gap-4 items-end" data-testid="add-team-form">
            <div className="flex-1">
              <label htmlFor="team-name" className="block text-sm font-medium text-text-primary mb-1">
                팀명
              </label>
              <input
                id="team-name"
                type="text"
                value={newTeamName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setNewTeamName(e.target.value);
                  if (validationError) setValidationError('');
                }}
                placeholder="예: 마케팅팀"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="team-manager" className="block text-sm font-medium text-text-primary mb-1">
                팀장
              </label>
              <select
                id="team-manager"
                value={newTeamManagerId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewTeamManagerId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">선택 안함</option>
                {employeeList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveAdd}
                disabled={addTeam.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
              >
                저장
              </button>
              <button
                type="button"
                onClick={handleCancelAdd}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-text-secondary hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
          {validationError && (
            <p className="mt-2 text-sm text-error">{validationError}</p>
          )}
        </div>
      )}

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
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {teams.map((team) => (
                <tr key={team.id} className="hover:bg-gray-50 transition-colors">
                  {editingTeamId === team.id ? (
                    <>
                      <td className="px-6 py-4 text-sm text-text-secondary font-mono">
                        {team.id}
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                          data-testid={`edit-name-${team.id}`}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={editManagerId}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) => setEditManagerId(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                          data-testid={`edit-manager-${team.id}`}
                        >
                          <option value="">선택 안함</option>
                          {employeeList.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-primary">{team.memberCount}명</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(team.id)}
                            disabled={updateTeam.isPending}
                            className="text-sm text-primary hover:underline disabled:opacity-50"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="text-sm text-text-secondary hover:underline"
                          >
                            취소
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
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
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(team)}
                          className="text-sm text-primary hover:underline"
                        >
                          수정
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
