import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import type { ReactNode } from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({ id: 'emp-1' }),
  usePathname: () => '/dashboard',
  redirect: vi.fn(),
}));

// Mock axios
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

// Helper to render with QueryProvider
function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

// ==============================
// Auth Store Tests (4 tests)
// ==============================
describe('Auth Store', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  });

  it('should have initial state with no auth', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should login and store token', () => {
    const mockUser = {
      id: 'admin-1',
      name: '관리자',
      email: 'admin@palette.com',
      role: 'admin',
    };

    useAuthStore.getState().login('admin-token-123', mockUser);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe('admin-token-123');
    expect(state.isAuthenticated).toBe(true);
    expect(localStorage.getItem('admin_token')).toBe('admin-token-123');
    expect(localStorage.getItem('admin_user')).toBe(JSON.stringify(mockUser));
  });

  it('should logout and clear storage', () => {
    const mockUser = {
      id: 'admin-1',
      name: '관리자',
      email: 'admin@palette.com',
      role: 'admin',
    };

    useAuthStore.getState().login('admin-token-123', mockUser);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorage.getItem('admin_token')).toBeNull();
    expect(localStorage.getItem('admin_user')).toBeNull();
  });

  it('should load from storage on loadFromStorage', () => {
    const mockUser = {
      id: 'admin-1',
      name: '관리자',
      email: 'admin@palette.com',
      role: 'admin',
    };

    localStorage.setItem('admin_token', 'stored-token');
    localStorage.setItem('admin_user', JSON.stringify(mockUser));

    useAuthStore.getState().loadFromStorage();

    const state = useAuthStore.getState();
    expect(state.token).toBe('stored-token');
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });
});

// ==============================
// Dashboard Tests (3 tests)
// ==============================
describe('Dashboard', () => {
  it('should render dashboard heading', async () => {
    const { default: DashboardPage } = await import(
      '@/app/(admin)/dashboard/page'
    );

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('대시보드')).toBeInTheDocument();
  });

  it('should render summary stat cards', async () => {
    const { default: DashboardPage } = await import(
      '@/app/(admin)/dashboard/page'
    );

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('오늘 휴가')).toBeInTheDocument();
    expect(screen.getByText('승인 대기')).toBeInTheDocument();
    expect(screen.getByText('전체 직원')).toBeInTheDocument();
    expect(screen.getByText('이번 달 휴가')).toBeInTheDocument();
  });

  it('should render stat cards container', async () => {
    const { default: DashboardPage } = await import(
      '@/app/(admin)/dashboard/page'
    );

    renderWithProviders(<DashboardPage />);

    const grid = screen.getByTestId('stats-grid');
    expect(grid).toBeInTheDocument();
    const cards = screen.getAllByTestId('stat-card');
    expect(cards.length).toBe(4);
  });
});

// ==============================
// Employee List Tests (4 tests)
// ==============================
describe('Employee List', () => {
  // Mock useEmployees to return data
  vi.mock('@/hooks/useEmployees', () => ({
    useEmployees: () => ({
      data: {
        data: [
          {
            id: 'emp-1',
            name: '김철수',
            email: 'kim@palette.com',
            teamId: 'engineering',
            position: '시니어 개발자',
            grade: 'S3',
            status: 'active',
            hireDate: '2023-01-15',
          },
          {
            id: 'emp-2',
            name: '이영희',
            email: 'lee@palette.com',
            teamId: 'design',
            position: '디자이너',
            grade: 'S2',
            status: 'active',
            hireDate: '2023-03-01',
          },
        ],
        total: 2,
        page: 1,
        totalPages: 1,
      },
      isLoading: false,
    }),
    useEmployee: () => ({
      data: {
        id: 'emp-1',
        name: '김철수',
        email: 'kim@palette.com',
        teamId: 'engineering',
        position: '시니어 개발자',
        grade: 'S3',
        status: 'active',
        hireDate: '2023-01-15',
        leaveBalances: [],
        leaveHistory: [],
      },
      isLoading: false,
    }),
  }));

  it('should render table headers', async () => {
    const { default: EmployeesPage } = await import(
      '@/app/(admin)/employees/page'
    );

    renderWithProviders(<EmployeesPage />);

    expect(screen.getByText('이름')).toBeInTheDocument();
    expect(screen.getByText('이메일')).toBeInTheDocument();
    expect(screen.getByText('팀')).toBeInTheDocument();
    expect(screen.getByText('직위')).toBeInTheDocument();
    expect(screen.getByText('상태')).toBeInTheDocument();
  });

  it('should render employee rows', async () => {
    const { default: EmployeesPage } = await import(
      '@/app/(admin)/employees/page'
    );

    renderWithProviders(<EmployeesPage />);

    expect(screen.getByText('김철수')).toBeInTheDocument();
    expect(screen.getByText('이영희')).toBeInTheDocument();
    expect(screen.getByText('kim@palette.com')).toBeInTheDocument();
    expect(screen.getByText('lee@palette.com')).toBeInTheDocument();
  });

  it('should render search input', async () => {
    const { default: EmployeesPage } = await import(
      '@/app/(admin)/employees/page'
    );

    renderWithProviders(<EmployeesPage />);

    const searchInput = screen.getByTestId('search-input');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('placeholder', '이름으로 검색...');
  });

  it('should render team filter select', async () => {
    const { default: EmployeesPage } = await import(
      '@/app/(admin)/employees/page'
    );

    renderWithProviders(<EmployeesPage />);

    const teamFilter = screen.getByTestId('team-filter');
    expect(teamFilter).toBeInTheDocument();
  });
});

// ==============================
// Leave List Tests (3 tests)
// ==============================
describe('Leave List', () => {
  vi.mock('@/hooks/useLeaves', () => ({
    useLeaveRequests: () => ({
      data: {
        data: [
          {
            id: 'lr-1',
            employeeId: 'emp-1',
            employeeName: '김철수',
            leaveType: 'annual',
            startDate: '2026-03-20',
            endDate: '2026-03-21',
            days: 2,
            reason: '개인 사유',
            status: 'pending',
          },
          {
            id: 'lr-2',
            employeeId: 'emp-2',
            employeeName: '이영희',
            leaveType: 'sick',
            startDate: '2026-03-18',
            endDate: '2026-03-18',
            days: 1,
            reason: '병원 방문',
            status: 'approved',
          },
        ],
        total: 2,
        page: 1,
        totalPages: 1,
      },
      isLoading: false,
    }),
  }));

  it('should render leave requests table', async () => {
    const { default: LeavesPage } = await import(
      '@/app/(admin)/leaves/page'
    );

    renderWithProviders(<LeavesPage />);

    expect(screen.getByText('휴가 관리')).toBeInTheDocument();
    expect(screen.getByText('김철수')).toBeInTheDocument();
    expect(screen.getByText('이영희')).toBeInTheDocument();
  });

  it('should render status filter', async () => {
    const { default: LeavesPage } = await import(
      '@/app/(admin)/leaves/page'
    );

    renderWithProviders(<LeavesPage />);

    const statusFilter = screen.getByTestId('status-filter');
    expect(statusFilter).toBeInTheDocument();
  });

  it('should show leave type labels', async () => {
    const { default: LeavesPage } = await import(
      '@/app/(admin)/leaves/page'
    );

    renderWithProviders(<LeavesPage />);

    expect(screen.getByText('연차')).toBeInTheDocument();
    expect(screen.getByText('병가')).toBeInTheDocument();
  });
});

// ==============================
// Holiday Management Tests (3 tests)
// ==============================
describe('Holiday Management', () => {
  vi.mock('@/hooks/useAdmin', () => ({
    useHolidays: () => ({
      data: [
        { date: '2026-01-01', name: '신정', year: 2026 },
        { date: '2026-03-01', name: '삼일절', year: 2026 },
        { date: '2026-05-05', name: '어린이날', year: 2026 },
      ],
      isLoading: false,
    }),
    useAddHoliday: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
    useDeleteHoliday: () => ({
      mutate: vi.fn(),
    }),
    useLeavePolicy: () => ({
      data: null,
      isLoading: false,
    }),
    useUpdateLeavePolicy: () => ({
      mutate: vi.fn(),
    }),
    useAuditLog: () => ({
      data: {
        data: [
          {
            id: 'log-1',
            timestamp: '2026-03-15T10:30:00Z',
            actor: 'admin@palette.com',
            action: 'create',
            targetType: 'employee',
            targetId: 'emp-1',
            details: { name: '김철수' },
          },
          {
            id: 'log-2',
            timestamp: '2026-03-14T09:00:00Z',
            actor: 'admin@palette.com',
            action: 'approve',
            targetType: 'leave_request',
            targetId: 'lr-1',
            details: { days: 2 },
          },
        ],
        total: 2,
        page: 1,
        totalPages: 1,
      },
      isLoading: false,
    }),
    useTeams: () => ({
      data: {
        data: [
          { id: 'team-1', name: '개발팀', managerId: 'emp-1', managerName: '김철수', memberCount: 5 },
          { id: 'team-2', name: '디자인팀', managerId: 'emp-2', managerName: '이영희', memberCount: 3 },
        ],
      },
      isLoading: false,
    }),
    useAddTeam: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
    useUpdateTeam: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
    useEmployeeList: () => ({
      data: [
        { id: 'emp-1', name: '김철수' },
        { id: 'emp-2', name: '이영희' },
        { id: 'emp-3', name: '박민수' },
      ],
      isLoading: false,
    }),
  }));

  it('should render holiday list', async () => {
    const { default: HolidaysPage } = await import(
      '@/app/(admin)/settings/holidays/page'
    );

    renderWithProviders(<HolidaysPage />);

    expect(screen.getByText('공휴일 관리')).toBeInTheDocument();
    expect(screen.getByText('신정')).toBeInTheDocument();
    expect(screen.getByText('삼일절')).toBeInTheDocument();
    expect(screen.getByText('어린이날')).toBeInTheDocument();
  });

  it('should render add holiday form', async () => {
    const { default: HolidaysPage } = await import(
      '@/app/(admin)/settings/holidays/page'
    );

    renderWithProviders(<HolidaysPage />);

    const form = screen.getByTestId('add-holiday-form');
    expect(form).toBeInTheDocument();
    expect(screen.getByLabelText('날짜')).toBeInTheDocument();
    expect(screen.getByLabelText('공휴일 이름')).toBeInTheDocument();
  });

  it('should render delete buttons for holidays', async () => {
    const { default: HolidaysPage } = await import(
      '@/app/(admin)/settings/holidays/page'
    );

    renderWithProviders(<HolidaysPage />);

    const deleteButtons = screen.getAllByText('삭제');
    expect(deleteButtons.length).toBe(3);
  });
});

// ==============================
// Audit Log Tests (3 tests)
// ==============================
describe('Audit Log', () => {
  it('should render audit log heading', async () => {
    const { default: AuditLogPage } = await import(
      '@/app/(admin)/audit-log/page'
    );

    renderWithProviders(<AuditLogPage />);

    expect(screen.getByText('감사 로그')).toBeInTheDocument();
  });

  it('should render log entries', async () => {
    const { default: AuditLogPage } = await import(
      '@/app/(admin)/audit-log/page'
    );

    renderWithProviders(<AuditLogPage />);

    // Actor column
    const actorCells = screen.getAllByText('admin@palette.com');
    expect(actorCells.length).toBe(2);
  });

  it('should render filter controls', async () => {
    const { default: AuditLogPage } = await import(
      '@/app/(admin)/audit-log/page'
    );

    renderWithProviders(<AuditLogPage />);

    expect(screen.getByTestId('actor-filter')).toBeInTheDocument();
    expect(screen.getByTestId('action-filter')).toBeInTheDocument();
    expect(screen.getByTestId('from-date')).toBeInTheDocument();
    expect(screen.getByTestId('to-date')).toBeInTheDocument();
  });
});

// ==============================
// Admin Layout Tests (2 tests)
// ==============================
describe('Admin Layout', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'admin-1',
        name: '관리자',
        email: 'admin@palette.com',
        role: 'admin',
      },
      token: 'test-token',
      isAuthenticated: true,
    });
  });

  it('should render sidebar navigation', async () => {
    const { default: AdminLayout } = await import(
      '@/app/(admin)/layout'
    );

    renderWithProviders(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    );

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('대시보드')).toBeInTheDocument();
    expect(screen.getByText('직원 관리')).toBeInTheDocument();
    expect(screen.getByText('휴가 관리')).toBeInTheDocument();
    expect(screen.getByText('설정')).toBeInTheDocument();
    expect(screen.getByText('감사 로그')).toBeInTheDocument();
  });

  it('should render user info and logout button', async () => {
    const { default: AdminLayout } = await import(
      '@/app/(admin)/layout'
    );

    renderWithProviders(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    );

    const adminTexts = screen.getAllByText('관리자');
    expect(adminTexts.length).toBeGreaterThanOrEqual(2); // sidebar header + user info
    expect(screen.getByText('admin@palette.com')).toBeInTheDocument();
    expect(screen.getByText('로그아웃')).toBeInTheDocument();
  });
});

// ==============================
// Login Page Tests (2 tests)
// ==============================
describe('Login Page', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  });

  it('should render login form', async () => {
    const { default: LoginPage } = await import(
      '@/app/(auth)/login/page'
    );

    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
  });

  it('should show Palette AI branding', async () => {
    const { default: LoginPage } = await import(
      '@/app/(auth)/login/page'
    );

    renderWithProviders(<LoginPage />);

    expect(screen.getByText('Palette AI')).toBeInTheDocument();
    expect(screen.getByText('관리자 로그인')).toBeInTheDocument();
  });
});

// ==============================
// Dashboard Recent Sections Tests (5 tests)
// ==============================
describe('Dashboard Recent Sections', () => {
  // We need to mock the api module to control responses for recent sections
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset modules to get fresh imports
    vi.resetModules();

    // Re-mock axios with controllable get
    mockGet = vi.fn();
    vi.doMock('axios', () => {
      const mockAxiosInstance = {
        get: mockGet,
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
        defaults: { headers: { common: {} } },
      };
      return {
        default: {
          create: vi.fn(() => mockAxiosInstance),
        },
      };
    });

    // Re-mock next/navigation
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
      }),
      useParams: () => ({ id: 'emp-1' }),
      usePathname: () => '/dashboard',
      redirect: vi.fn(),
    }));
  });

  it('renders recent leave requests list', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/leave/requests' ) {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'lr-1',
                employeeName: '김철수',
                leaveType: 'annual',
                startDate: '2026-03-20',
                endDate: '2026-03-21',
                status: 'pending',
              },
            ],
            total: 1,
          },
        });
      }
      if (url === '/admin/audit-log') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      return Promise.resolve({ data: { total: 0, length: 0 } });
    });

    const { default: DashboardPage } = await import(
      '@/app/(admin)/dashboard/page'
    );

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('최근 휴가 요청')).toBeInTheDocument();
    expect(screen.getByTestId('recent-leaves')).toBeInTheDocument();
  });

  it('shows leave request employee name, dates, status', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/leave/requests') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'lr-1',
                employeeName: '김철수',
                leaveType: 'annual',
                startDate: '2026-03-20',
                endDate: '2026-03-21',
                status: 'pending',
              },
              {
                id: 'lr-2',
                employeeName: '이영희',
                leaveType: 'sick',
                startDate: '2026-03-18',
                endDate: '2026-03-18',
                status: 'approved',
              },
            ],
            total: 2,
          },
        });
      }
      if (url === '/admin/audit-log') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      return Promise.resolve({ data: { total: 0, length: 0 } });
    });

    const { default: DashboardPage } = await import(
      '@/app/(admin)/dashboard/page'
    );

    renderWithProviders(<DashboardPage />);

    // Wait for data to render
    const leaveSection = await screen.findByTestId('recent-leaves');
    expect(leaveSection).toBeInTheDocument();

    // Employee names
    expect(await screen.findByText('김철수')).toBeInTheDocument();
    expect(screen.getByText('이영희')).toBeInTheDocument();

    // Dates
    expect(screen.getByText('2026-03-20 ~ 2026-03-21')).toBeInTheDocument();
    expect(screen.getByText('2026-03-18 ~ 2026-03-18')).toBeInTheDocument();

    // Status badges
    expect(screen.getByText('대기')).toBeInTheDocument();
    expect(screen.getByText('승인')).toBeInTheDocument();
  });

  it('renders recent activity list', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/leave/requests') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      if (url === '/admin/audit-log') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'log-1',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                actor: 'admin@palette.com',
                action: 'create',
                targetType: 'employee',
                targetId: 'emp-1',
                details: { name: '김철수' },
              },
            ],
            total: 1,
          },
        });
      }
      return Promise.resolve({ data: { total: 0, length: 0 } });
    });

    const { default: DashboardPage } = await import(
      '@/app/(admin)/dashboard/page'
    );

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('최근 활동')).toBeInTheDocument();
    expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
  });

  it('shows activity timestamp, actor, action', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    mockGet.mockImplementation((url: string) => {
      if (url === '/leave/requests') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      if (url === '/admin/audit-log') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'log-1',
                timestamp: twoHoursAgo,
                actor: 'admin@palette.com',
                action: 'create',
                targetType: 'employee',
                targetId: 'emp-1',
                details: { name: '김철수' },
              },
              {
                id: 'log-2',
                timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                actor: 'manager@palette.com',
                action: 'approve',
                targetType: 'leave_request',
                targetId: 'lr-1',
                details: { days: 2 },
              },
            ],
            total: 2,
          },
        });
      }
      return Promise.resolve({ data: { total: 0, length: 0 } });
    });

    const { default: DashboardPage } = await import(
      '@/app/(admin)/dashboard/page'
    );

    renderWithProviders(<DashboardPage />);

    const activitySection = await screen.findByTestId('recent-activity');
    expect(activitySection).toBeInTheDocument();

    // Actor names
    expect(await screen.findByText('admin@palette.com')).toBeInTheDocument();
    expect(screen.getByText('manager@palette.com')).toBeInTheDocument();

    // Action badges
    expect(screen.getByText('생성')).toBeInTheDocument();
    expect(screen.getByText('승인')).toBeInTheDocument();
  });

  it('shows empty state when no recent items', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/leave/requests') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      if (url === '/admin/audit-log') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      return Promise.resolve({ data: { total: 0, length: 0 } });
    });

    const { default: DashboardPage } = await import(
      '@/app/(admin)/dashboard/page'
    );

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('최근 휴가 요청이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('최근 활동이 없습니다.')).toBeInTheDocument();
  });
});

// ==============================
// Teams CRUD Tests (5 tests)
// ==============================
describe('Teams CRUD', () => {
  it('renders add team button', async () => {
    const { default: TeamsPage } = await import(
      '@/app/(admin)/settings/teams/page'
    );

    renderWithProviders(<TeamsPage />);

    expect(screen.getByRole('button', { name: '팀 추가' })).toBeInTheDocument();
  });

  it('shows add team form when button clicked', async () => {
    const { default: TeamsPage } = await import(
      '@/app/(admin)/settings/teams/page'
    );

    renderWithProviders(<TeamsPage />);

    // Form should not be visible initially
    expect(screen.queryByTestId('add-team-form')).not.toBeInTheDocument();

    // Click the add button
    fireEvent.click(screen.getByRole('button', { name: '팀 추가' }));

    // Form should now be visible
    expect(screen.getByTestId('add-team-form')).toBeInTheDocument();
    expect(screen.getByLabelText('팀명')).toBeInTheDocument();
    expect(screen.getByLabelText('팀장')).toBeInTheDocument();
  });

  it('validates team name is required', async () => {
    const { default: TeamsPage } = await import(
      '@/app/(admin)/settings/teams/page'
    );

    renderWithProviders(<TeamsPage />);

    // Open form
    fireEvent.click(screen.getByRole('button', { name: '팀 추가' }));

    // Try to submit without team name
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    // Validation message should appear
    expect(screen.getByText('팀명을 입력해주세요.')).toBeInTheDocument();
  });

  it('submits new team creation', async () => {
    const { default: TeamsPage } = await import(
      '@/app/(admin)/settings/teams/page'
    );

    renderWithProviders(<TeamsPage />);

    // Open form
    fireEvent.click(screen.getByRole('button', { name: '팀 추가' }));

    // Fill in the form
    fireEvent.change(screen.getByLabelText('팀명'), { target: { value: '마케팅팀' } });
    fireEvent.change(screen.getByLabelText('팀장'), { target: { value: 'emp-1' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    // Form should close (no validation error)
    expect(screen.queryByText('팀명을 입력해주세요.')).not.toBeInTheDocument();
  });

  it('shows edit button on each team row', async () => {
    const { default: TeamsPage } = await import(
      '@/app/(admin)/settings/teams/page'
    );

    renderWithProviders(<TeamsPage />);

    const editButtons = screen.getAllByRole('button', { name: '수정' });
    expect(editButtons.length).toBe(2);
  });
});

// ==============================
// Leave Policy Edit Tests (5 tests)
// ==============================
describe('Leave Policy Edit', () => {
  const mockMutate = vi.fn();

  const mockPolicy = {
    id: 'default',
    name: '기본 연차 규정',
    rules: {},
    leaveTypes: [
      { type: 'annual', label: '연차', defaultDays: 15 },
      { type: 'sick', label: '병가', defaultDays: 3 },
    ],
    autoApprove: { maxHours: 4 },
    isActive: true,
  };

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('next/navigation', () => ({
      useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
      }),
      useParams: () => ({}),
      usePathname: () => '/settings/leave-policy',
      redirect: vi.fn(),
    }));

    vi.doMock('axios', () => {
      const mockAxiosInstance = {
        get: vi.fn().mockResolvedValue({ data: {} }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
        defaults: { headers: { common: {} } },
      };
      return {
        default: {
          create: vi.fn(() => mockAxiosInstance),
        },
      };
    });

    mockMutate.mockReset();

    vi.doMock('@/hooks/useAdmin', () => ({
      useLeavePolicy: () => ({
        data: mockPolicy,
        isLoading: false,
      }),
      useUpdateLeavePolicy: () => ({
        mutate: mockMutate,
        isPending: false,
      }),
      useHolidays: () => ({ data: [], isLoading: false }),
      useAddHoliday: () => ({ mutate: vi.fn(), isPending: false }),
      useDeleteHoliday: () => ({ mutate: vi.fn() }),
      useAuditLog: () => ({ data: { data: [], total: 0, page: 1, totalPages: 1 }, isLoading: false }),
    }));
  });

  it('renders leave type list with default days', async () => {
    const { default: LeavePolicyPage } = await import(
      '@/app/(admin)/settings/leave-policy/page'
    );

    renderWithProviders(<LeavePolicyPage />);

    expect(screen.getByText('연차')).toBeInTheDocument();
    expect(screen.getByText('병가')).toBeInTheDocument();
    expect(screen.getByText(/15일/)).toBeInTheDocument();
    expect(screen.getByText(/3일/)).toBeInTheDocument();
  });

  it('shows edit form fields when edit button clicked', async () => {
    const { default: LeavePolicyPage } = await import(
      '@/app/(admin)/settings/leave-policy/page'
    );

    renderWithProviders(<LeavePolicyPage />);

    const editButton = screen.getByText('수정');
    fireEvent.click(editButton);

    // Should show input fields for each leave type's defaultDays
    const dayInputs = screen.getAllByTestId('default-days-input');
    expect(dayInputs.length).toBe(2);

    // Should show input fields for leave type labels
    const labelInputs = screen.getAllByTestId('leave-label-input');
    expect(labelInputs.length).toBe(2);

    // Should show auto-approve hours input
    expect(screen.getByTestId('auto-approve-hours-input')).toBeInTheDocument();
  });

  it('allows editing default days for each leave type', async () => {
    const { default: LeavePolicyPage } = await import(
      '@/app/(admin)/settings/leave-policy/page'
    );

    renderWithProviders(<LeavePolicyPage />);

    fireEvent.click(screen.getByText('수정'));

    const dayInputs = screen.getAllByTestId('default-days-input');

    // First input should have value 15
    expect(dayInputs[0]).toHaveValue(15);

    // Change the value
    fireEvent.change(dayInputs[0], { target: { value: '20' } });
    expect(dayInputs[0]).toHaveValue(20);

    // Second input should have value 3
    expect(dayInputs[1]).toHaveValue(3);

    fireEvent.change(dayInputs[1], { target: { value: '5' } });
    expect(dayInputs[1]).toHaveValue(5);
  });

  it('saves changes when save button clicked', async () => {
    const { default: LeavePolicyPage } = await import(
      '@/app/(admin)/settings/leave-policy/page'
    );

    renderWithProviders(<LeavePolicyPage />);

    // Enter edit mode
    fireEvent.click(screen.getByText('수정'));

    // Modify a value
    const dayInputs = screen.getAllByTestId('default-days-input');
    fireEvent.change(dayInputs[0], { target: { value: '20' } });

    // Click save
    fireEvent.click(screen.getByText('저장'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'default',
        data: expect.objectContaining({
          leaveTypes: expect.arrayContaining([
            expect.objectContaining({ type: 'annual', defaultDays: 20 }),
          ]),
        }),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('cancels edit mode when cancel button clicked', async () => {
    const { default: LeavePolicyPage } = await import(
      '@/app/(admin)/settings/leave-policy/page'
    );

    renderWithProviders(<LeavePolicyPage />);

    // Enter edit mode
    fireEvent.click(screen.getByText('수정'));

    // Modify a value
    const dayInputs = screen.getAllByTestId('default-days-input');
    fireEvent.change(dayInputs[0], { target: { value: '99' } });

    // Click cancel
    fireEvent.click(screen.getByText('취소'));

    // Should exit edit mode - no input fields visible
    expect(screen.queryAllByTestId('default-days-input').length).toBe(0);

    // Should show original values (not modified)
    expect(screen.getByText(/15일/)).toBeInTheDocument();
  });
});
