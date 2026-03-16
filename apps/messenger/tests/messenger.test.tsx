import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({}),
  usePathname: () => '/',
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

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
  })),
}));

// ==============================
// Auth Store Tests
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

  it('should login successfully', () => {
    const mockUser = {
      id: 'user-1',
      name: '김철수',
      email: 'test@palette.com',
      team: { id: 'team-1', name: '개발팀' },
      position: '시니어 개발자',
      avatarUrl: null,
    };

    useAuthStore.getState().login('test-token-123', mockUser);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe('test-token-123');
    expect(state.isAuthenticated).toBe(true);
    expect(localStorage.getItem('palette_token')).toBe('test-token-123');
    expect(localStorage.getItem('palette_user')).toBe(JSON.stringify(mockUser));
  });

  it('should logout and clear storage', () => {
    const mockUser = {
      id: 'user-1',
      name: '김철수',
      email: 'test@palette.com',
      team: { id: 'team-1', name: '개발팀' },
      position: '시니어 개발자',
      avatarUrl: null,
    };

    useAuthStore.getState().login('test-token-123', mockUser);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorage.getItem('palette_token')).toBeNull();
    expect(localStorage.getItem('palette_user')).toBeNull();
  });

  it('should load from storage on loadFromStorage', () => {
    const mockUser = {
      id: 'user-1',
      name: '김철수',
      email: 'test@palette.com',
      team: { id: 'team-1', name: '개발팀' },
      position: '시니어 개발자',
      avatarUrl: null,
    };

    localStorage.setItem('palette_token', 'stored-token');
    localStorage.setItem('palette_user', JSON.stringify(mockUser));

    useAuthStore.getState().loadFromStorage();

    const state = useAuthStore.getState();
    expect(state.token).toBe('stored-token');
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('should not crash on invalid JSON in loadFromStorage', () => {
    localStorage.setItem('palette_token', 'some-token');
    localStorage.setItem('palette_user', 'not-valid-json');

    useAuthStore.getState().loadFromStorage();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });
});

// ==============================
// Chat Store Tests
// ==============================
describe('Chat Store', () => {
  beforeEach(() => {
    useChatStore.setState({
      channels: [],
      activeChannelId: null,
      messagesByChannel: {},
      typingUsers: {},
      isConnected: false,
    });
  });

  it('should set channels', () => {
    const channels = [
      {
        id: 'ch-1',
        type: 'direct' as const,
        name: '김철수',
        participants: ['user-1', 'user-2'],
        unreadCount: 3,
        humanTakeover: false,
      },
      {
        id: 'ch-2',
        type: 'work' as const,
        name: '프로젝트 A',
        participants: ['user-1'],
        unreadCount: 0,
        humanTakeover: false,
      },
    ];

    useChatStore.getState().setChannels(channels);
    expect(useChatStore.getState().channels).toEqual(channels);
  });

  it('should add a message to channel', () => {
    const message = {
      id: 'msg-1',
      channelId: 'ch-1',
      senderType: 'human' as const,
      senderUserId: 'user-1',
      displayName: '김철수',
      contentType: 'text' as const,
      contentText: '안녕하세요!',
      isLlmAuto: false,
      createdAt: '2024-01-01T10:00:00Z',
    };

    useChatStore.getState().addMessage('ch-1', message);

    const msgs = useChatStore.getState().messagesByChannel['ch-1'];
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual(message);
  });

  it('should append messages to existing channel messages', () => {
    const msg1 = {
      id: 'msg-1',
      channelId: 'ch-1',
      senderType: 'human' as const,
      senderUserId: 'user-1',
      displayName: '김철수',
      contentType: 'text' as const,
      contentText: '첫 메시지',
      isLlmAuto: false,
      createdAt: '2024-01-01T10:00:00Z',
    };

    const msg2 = {
      id: 'msg-2',
      channelId: 'ch-1',
      senderType: 'llm' as const,
      senderUserId: 'ai-1',
      displayName: 'AI 비서',
      contentType: 'text' as const,
      contentText: '안녕하세요! 무엇을 도와드릴까요?',
      isLlmAuto: true,
      createdAt: '2024-01-01T10:00:01Z',
    };

    useChatStore.getState().addMessage('ch-1', msg1);
    useChatStore.getState().addMessage('ch-1', msg2);

    const msgs = useChatStore.getState().messagesByChannel['ch-1'];
    expect(msgs).toHaveLength(2);
    expect(msgs[0].contentText).toBe('첫 메시지');
    expect(msgs[1].contentText).toBe('안녕하세요! 무엇을 도와드릴까요?');
  });

  it('should set typing indicator', () => {
    useChatStore.getState().setTyping('ch-1', 'user-2', '이영희', true);

    const typing = useChatStore.getState().typingUsers['ch-1'];
    expect(typing).toHaveLength(1);
    expect(typing[0].displayName).toBe('이영희');
  });

  it('should remove typing indicator', () => {
    useChatStore.getState().setTyping('ch-1', 'user-2', '이영희', true);
    useChatStore.getState().setTyping('ch-1', 'user-2', '이영희', false);

    const typing = useChatStore.getState().typingUsers['ch-1'];
    expect(typing).toHaveLength(0);
  });

  it('should increment unread count', () => {
    useChatStore.getState().setChannels([
      {
        id: 'ch-1',
        type: 'direct',
        name: '김철수',
        participants: [],
        unreadCount: 0,
        humanTakeover: false,
      },
    ]);

    useChatStore.getState().incrementUnread('ch-1');

    const channel = useChatStore.getState().channels.find((c) => c.id === 'ch-1');
    expect(channel?.unreadCount).toBe(1);
  });

  it('should clear unread count', () => {
    useChatStore.getState().setChannels([
      {
        id: 'ch-1',
        type: 'direct',
        name: '김철수',
        participants: [],
        unreadCount: 5,
        humanTakeover: false,
      },
    ]);

    useChatStore.getState().clearUnread('ch-1');

    const channel = useChatStore.getState().channels.find((c) => c.id === 'ch-1');
    expect(channel?.unreadCount).toBe(0);
  });

  it('should set active channel', () => {
    useChatStore.getState().setActiveChannel('ch-1');
    expect(useChatStore.getState().activeChannelId).toBe('ch-1');

    useChatStore.getState().setActiveChannel(null);
    expect(useChatStore.getState().activeChannelId).toBeNull();
  });

  it('should update channel data', () => {
    useChatStore.getState().setChannels([
      {
        id: 'ch-1',
        type: 'work',
        name: '프로젝트 A',
        participants: [],
        unreadCount: 0,
        humanTakeover: false,
      },
    ]);

    useChatStore.getState().updateChannel('ch-1', { humanTakeover: true });

    const channel = useChatStore.getState().channels.find((c) => c.id === 'ch-1');
    expect(channel?.humanTakeover).toBe(true);
  });

  it('should set connected status', () => {
    expect(useChatStore.getState().isConnected).toBe(false);
    useChatStore.getState().setConnected(true);
    expect(useChatStore.getState().isConnected).toBe(true);
  });
});

// ==============================
// MessageBubble Component Tests
// ==============================
describe('MessageBubble', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'user-1',
        name: '나',
        email: 'me@palette.com',
        team: { id: 'team-1', name: '개발팀' },
        position: '개발자',
        avatarUrl: null,
      },
      token: 'test',
      isAuthenticated: true,
    });
  });

  it('should render human message from me (right-aligned)', async () => {
    const { default: MessageBubble } = await import(
      '@/components/chat/MessageBubble'
    );

    render(
      <MessageBubble
        message={{
          id: 'msg-1',
          channelId: 'ch-1',
          senderType: 'human',
          senderUserId: 'user-1',
          displayName: '나',
          contentType: 'text',
          contentText: '안녕하세요!',
          isLlmAuto: false,
          createdAt: '2024-01-01T10:00:00Z',
        }}
      />
    );

    expect(screen.getByText('안녕하세요!')).toBeInTheDocument();
  });

  it('should render LLM message with AI badge', async () => {
    const { default: MessageBubble } = await import(
      '@/components/chat/MessageBubble'
    );

    render(
      <MessageBubble
        message={{
          id: 'msg-2',
          channelId: 'ch-1',
          senderType: 'llm',
          senderUserId: 'ai-1',
          displayName: 'AI 비서',
          contentType: 'text',
          contentText: 'AI 응답입니다.',
          isLlmAuto: true,
          createdAt: '2024-01-01T10:00:00Z',
        }}
      />
    );

    expect(screen.getByText('AI 응답입니다.')).toBeInTheDocument();
    expect(screen.getByText('AI 비서')).toBeInTheDocument();
    // Check for AI badge
    const aiBadges = screen.getAllByText('AI');
    expect(aiBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('should render system message centered', async () => {
    const { default: MessageBubble } = await import(
      '@/components/chat/MessageBubble'
    );

    render(
      <MessageBubble
        message={{
          id: 'msg-3',
          channelId: 'ch-1',
          senderType: 'system',
          senderUserId: 'system',
          displayName: '시스템',
          contentType: 'text',
          contentText: '채팅방이 생성되었습니다.',
          isLlmAuto: false,
          createdAt: '2024-01-01T10:00:00Z',
        }}
      />
    );

    expect(screen.getByText('채팅방이 생성되었습니다.')).toBeInTheDocument();
  });

  it('should render other human message (left-aligned)', async () => {
    const { default: MessageBubble } = await import(
      '@/components/chat/MessageBubble'
    );

    render(
      <MessageBubble
        message={{
          id: 'msg-4',
          channelId: 'ch-1',
          senderType: 'human',
          senderUserId: 'user-2',
          displayName: '이영희',
          contentType: 'text',
          contentText: '반갑습니다!',
          isLlmAuto: false,
          createdAt: '2024-01-01T10:00:00Z',
        }}
      />
    );

    expect(screen.getByText('반갑습니다!')).toBeInTheDocument();
    expect(screen.getByText('이영희')).toBeInTheDocument();
  });
});

// ==============================
// Login Page Tests
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

    render(<LoginPage />);

    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
  });

  it('should have required fields in the form', async () => {
    const { default: LoginPage } = await import(
      '@/app/(auth)/login/page'
    );

    render(<LoginPage />);

    const emailInput = screen.getByLabelText('이메일');
    const passwordInput = screen.getByLabelText('비밀번호');

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it('should show Palette AI branding', async () => {
    const { default: LoginPage } = await import(
      '@/app/(auth)/login/page'
    );

    render(<LoginPage />);

    expect(screen.getByText('Palette AI')).toBeInTheDocument();
  });
});
