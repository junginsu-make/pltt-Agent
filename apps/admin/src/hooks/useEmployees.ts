import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface Employee {
  id: string;
  name: string;
  email: string;
  teamId: string;
  position: string;
  grade: string;
  status: string;
  hireDate: string;
  managerId?: string;
  avatarUrl?: string;
  leaveBalances?: LeaveBalance[];
  leaveHistory?: LeaveHistoryEntry[];
}

interface LeaveBalance {
  leaveType: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

interface LeaveHistoryEntry {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
}

interface EmployeesResponse {
  data: Employee[];
  total: number;
  page: number;
  totalPages: number;
}

interface EmployeesQuery {
  teamId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function useEmployees(query: EmployeesQuery = {}) {
  return useQuery<EmployeesResponse>({
    queryKey: ['employees', query],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (query.teamId) params.team_id = query.teamId;
      if (query.status) params.status = query.status;
      if (query.page) params.page = query.page;
      if (query.limit) params.limit = query.limit;

      const res = await api.get('/admin/employees', { params });
      return res.data;
    },
  });
}

export function useEmployee(id: string) {
  return useQuery<Employee>({
    queryKey: ['employee', id],
    queryFn: async () => {
      const res = await api.get(`/admin/employees/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}
