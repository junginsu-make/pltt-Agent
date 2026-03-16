import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
