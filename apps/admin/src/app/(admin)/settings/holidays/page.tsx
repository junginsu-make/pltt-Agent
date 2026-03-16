'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useHolidays, useAddHoliday, useDeleteHoliday } from '@/hooks/useAdmin';

interface Holiday {
  date: string;
  name: string;
  year: number;
}

export default function HolidaysPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const { data: holidays, isLoading } = useHolidays(year);
  const addHoliday = useAddHoliday();
  const deleteHoliday = useDeleteHoliday();

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!newDate || !newName) return;

    addHoliday.mutate(
      { date: newDate, name: newName, year },
      {
        onSuccess: () => {
          setNewDate('');
          setNewName('');
        },
      }
    );
  };

  const handleDelete = (date: string) => {
    deleteHoliday.mutate(date);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">공휴일 관리</h1>
        <select
          value={year}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setYear(Number(e.target.value))}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          data-testid="year-select"
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </div>

      {/* Add Holiday Form */}
      <div className="rounded-lg bg-surface p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">공휴일 추가</h2>
        <form onSubmit={handleAdd} className="flex gap-4 items-end" data-testid="add-holiday-form">
          <div className="flex-1">
            <label htmlFor="holiday-date" className="block text-sm font-medium text-text-primary mb-1">
              날짜
            </label>
            <input
              id="holiday-date"
              type="date"
              value={newDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewDate(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="holiday-name" className="block text-sm font-medium text-text-primary mb-1">
              공휴일 이름
            </label>
            <input
              id="holiday-name"
              type="text"
              value={newName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
              required
              placeholder="예: 설날"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={addHoliday.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
          >
            추가
          </button>
        </form>
      </div>

      {/* Holiday List */}
      <div className="rounded-lg bg-surface shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-text-secondary" data-testid="loading">로딩 중...</div>
        ) : (
          <table className="w-full" data-testid="holidays-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  날짜
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  이름
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(holidays ?? []).map((holiday: Holiday) => (
                <tr key={holiday.date} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-text-primary">{holiday.date}</td>
                  <td className="px-6 py-4 text-sm text-text-primary">{holiday.name}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(holiday.date)}
                      className="text-sm text-error hover:underline"
                      data-testid={`delete-holiday-${holiday.date}`}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {(holidays ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-text-secondary text-sm">
                    등록된 공휴일이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
