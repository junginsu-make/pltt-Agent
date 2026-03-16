'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export default function NewEmployeePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const createEmployee = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await api.post('/admin/employees', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      router.push('/employees');
    },
    onError: (err: Error) => {
      setError(err.message || '직원 등록에 실패했습니다.');
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.currentTarget);
    createEmployee.mutate({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      team_id: formData.get('team_id') as string,
      position: formData.get('position') as string,
      grade: formData.get('grade') as string,
      hire_date: formData.get('hire_date') as string,
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">직원 등록</h1>

      <div className="max-w-lg rounded-lg bg-surface shadow-sm border border-gray-100 p-6">
        {error && (
          <div className="mb-4 rounded-md bg-error/10 px-4 py-3 text-sm text-error" data-testid="error-msg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="new-employee-form">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-1">
              이름 *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
              이메일 *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="team_id" className="block text-sm font-medium text-text-primary mb-1">
              팀 *
            </label>
            <select
              id="team_id"
              name="team_id"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">팀 선택</option>
              <option value="TEAM-MGMT">경영지원팀</option>
              <option value="TEAM-DEV">개발팀</option>
              <option value="TEAM-DESIGN">디자인팀</option>
              <option value="TEAM-SALES">영업팀</option>
            </select>
          </div>

          <div>
            <label htmlFor="position" className="block text-sm font-medium text-text-primary mb-1">
              직위 *
            </label>
            <select
              id="position"
              name="position"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">직위 선택</option>
              <option value="대표">대표</option>
              <option value="팀장">팀장</option>
              <option value="대리">대리</option>
              <option value="사원">사원</option>
            </select>
          </div>

          <div>
            <label htmlFor="grade" className="block text-sm font-medium text-text-primary mb-1">
              직급
            </label>
            <input
              id="grade"
              name="grade"
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="예: G3"
            />
          </div>

          <div>
            <label htmlFor="hire_date" className="block text-sm font-medium text-text-primary mb-1">
              입사일 *
            </label>
            <input
              id="hire_date"
              name="hire_date"
              type="date"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={createEmployee.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {createEmployee.isPending ? '등록 중...' : '직원 등록'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/employees')}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-text-secondary hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
