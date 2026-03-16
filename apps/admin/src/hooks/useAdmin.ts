import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// --- Holidays ---

interface Holiday {
  date: string;
  name: string;
  year: number;
}

export function useHolidays(year: number) {
  return useQuery<Holiday[]>({
    queryKey: ['holidays', year],
    queryFn: async () => {
      const res = await api.get('/admin/holidays', { params: { year } });
      return res.data;
    },
  });
}

export function useAddHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { date: string; name: string; year: number }) => {
      const res = await api.post('/admin/holidays', data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['holidays', variables.year] });
    },
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const res = await api.delete(`/admin/holidays/${date}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
  });
}

// --- Leave Policies ---

interface LeaveType {
  type: string;
  label: string;
  defaultDays: number;
}

interface LeavePolicy {
  id: string;
  name: string;
  rules: Record<string, unknown>;
  leaveTypes: LeaveType[];
  autoApprove: Record<string, unknown>;
  isActive: boolean;
}

export function useLeavePolicy(id: string) {
  return useQuery<LeavePolicy>({
    queryKey: ['leave-policy', id],
    queryFn: async () => {
      const res = await api.get(`/admin/leave-policies/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useUpdateLeavePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LeavePolicy> }) => {
      const res = await api.put(`/admin/leave-policies/${id}`, data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leave-policy', variables.id] });
    },
  });
}

// --- Audit Log ---

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
}

interface AuditLogResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
}

interface AuditLogQuery {
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
}

export function useAuditLog(query: AuditLogQuery = {}) {
  return useQuery<AuditLogResponse>({
    queryKey: ['audit-log', query],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (query.actor) params.actor = query.actor;
      if (query.action) params.action = query.action;
      if (query.from) params.from = query.from;
      if (query.to) params.to = query.to;
      if (query.page) params.page = query.page;

      const res = await api.get('/admin/audit-log', { params });
      return res.data;
    },
  });
}
