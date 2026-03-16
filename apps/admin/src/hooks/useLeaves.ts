import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
}

interface LeaveRequestsResponse {
  data: LeaveRequest[];
  total: number;
  page: number;
  totalPages: number;
}

interface LeaveRequestsQuery {
  status?: string;
  page?: number;
  limit?: number;
}

export function useLeaveRequests(query: LeaveRequestsQuery = {}) {
  return useQuery<LeaveRequestsResponse>({
    queryKey: ['leave-requests', query],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (query.status) params.status = query.status;
      if (query.page) params.page = query.page;
      if (query.limit) params.limit = query.limit;

      const res = await api.get('/leave/requests', { params });
      return res.data;
    },
  });
}
