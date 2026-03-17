/**
 * Test data constants derived from packages/db/src/seed.ts
 * All passwords are 'password123' as set in the seed file.
 */

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly name: string;
  readonly teamId: string;
  readonly position: string;
}

export const USERS = {
  /** 정인수 - 프론트엔드 개발자 (개발팀) */
  EMPLOYEE_A: {
    id: 'EMP-001',
    email: 'jinsu@palette.ai',
    password: 'password123',
    name: '정인수',
    teamId: 'TEAM-DEV',
    position: '프론트엔드 개발자',
  },
  /** 김민준 - 개발팀장 (정인수의 상사, 결재자) */
  MANAGER: {
    id: 'EMP-DEV-LEADER',
    email: 'minjun@palette.ai',
    password: 'password123',
    name: '김민준',
    teamId: 'TEAM-DEV',
    position: '개발팀장',
  },
  /** 휴가 담당자 - 인사담당 (경영지원팀) */
  HR_STAFF: {
    id: 'EMP-HR-001',
    email: 'hr@palette.ai',
    password: 'password123',
    name: '휴가 담당자',
    teamId: 'TEAM-MGMT',
    position: '인사담당',
  },
  /** 경영지원팀장 */
  TEAM_LEADER: {
    id: 'EMP-MGMT-LEADER',
    email: 'mgmt.leader@palette.ai',
    password: 'password123',
    name: '경영지원팀장',
    teamId: 'TEAM-MGMT',
    position: '경영지원팀장',
  },
  /** 대표이사 */
  CEO: {
    id: 'EMP-CEO',
    email: 'ceo@palette.ai',
    password: 'password123',
    name: '대표',
    teamId: 'TEAM-EXEC',
    position: '대표이사',
  },
} as const satisfies Record<string, TestUser>;

/** Well-known channel IDs from seed data */
export const CHANNELS = {
  COMPANY: 'ch-company-001',
  TEAM_MGMT: 'ch-team-mgmt',
  TEAM_DEV: 'ch-team-dev',
  NOTIFICATION_CEO: 'ch-notification-EMP-CEO',
  NOTIFICATION_MGMT_LEADER: 'ch-notification-EMP-MGMT-LEADER',
  NOTIFICATION_HR: 'ch-notification-EMP-HR-001',
  NOTIFICATION_DEV_LEADER: 'ch-notification-EMP-DEV-LEADER',
  NOTIFICATION_EMP001: 'ch-notification-EMP-001',
} as const;

/** Selectors for common UI components (Page Object Model) */
export const SELECTORS = {
  // Sidebar / Channel list
  SIDEBAR: '[data-testid="sidebar"]',
  CHANNEL_LIST: '[data-testid="channel-list"]',
  CHANNEL_ITEM: '[data-testid="channel-item"]',
  CHANNEL_GROUP_WORK: '[data-testid="channel-group-work"]',
  CHANNEL_GROUP_DM: '[data-testid="channel-group-dm"]',
  NEW_MESSAGE_BUTTON: '[data-testid="new-message-button"]',

  // Chat panel
  CHAT_PANEL: '[data-testid="chat-panel"]',
  CHAT_HEADER: '[data-testid="chat-header"]',
  MESSAGE_LIST: '[data-testid="message-list"]',
  MESSAGE_INPUT: '[data-testid="message-input"]',
  SEND_BUTTON: '[data-testid="send-button"]',
  TYPING_INDICATOR: '[data-testid="typing-indicator"]',

  // Message types
  TEXT_BUBBLE: '[data-testid="text-bubble"]',
  CARD_MESSAGE: '[data-testid="card-message"]',
  LEAVE_BALANCE_CARD: '[data-testid="leave-balance-card"]',
  APPROVAL_CARD: '[data-testid="approval-card"]',
  SYSTEM_NOTIFICATION: '[data-testid="system-notification"]',

  // Approval card actions
  APPROVE_BUTTON: '[data-testid="approve-button"]',
  REJECT_BUTTON: '[data-testid="reject-button"]',
  ASK_BUTTON: '[data-testid="ask-button"]',

  // Human takeover
  TAKEOVER_BUTTON: '[data-testid="takeover-button"]',
  RELEASE_BUTTON: '[data-testid="release-button"]',
  DIRECT_RESPONSE_BADGE: '[data-testid="direct-response-badge"]',

  // Auth
  LOGIN_EMAIL: '[name=email]',
  LOGIN_PASSWORD: '[name=password]',
  LOGIN_SUBMIT: 'button[type=submit]',

  // AI badge
  AI_BADGE: '[data-testid="ai-badge"]',

  // Connection status
  CONNECTION_BANNER: '[data-testid="connection-banner"]',
} as const;

/** Timeouts for various async operations */
export const TIMEOUTS = {
  /** Max time to wait for AI/LLM response */
  AI_RESPONSE: 15_000,
  /** Max time to wait for WebSocket message delivery */
  MESSAGE_DELIVERY: 10_000,
  /** Max time to wait for notification to appear */
  NOTIFICATION: 10_000,
  /** Max time to wait for card to render */
  CARD_RENDER: 10_000,
  /** Max time to wait for channel creation */
  CHANNEL_CREATION: 10_000,
  /** Max time for approval flow (approval card to appear) */
  APPROVAL_FLOW: 15_000,
} as const;

/** API base URL for intercepting/waiting on network requests */
export const API_BASE = '/api/v1';

/** API endpoint patterns for waitForResponse */
export const API_ROUTES = {
  LOGIN: `${API_BASE}/auth/login`,
  SEND_MESSAGE: `${API_BASE}/messenger/send`,
  SEND_DM: `${API_BASE}/messenger/dm`,
  CALL_PERSON: `${API_BASE}/messenger/call`,
  TAKEOVER: `${API_BASE}/messenger/takeover`,
  CHANNELS: `${API_BASE}/messenger/channels`,
  LEAVE_BALANCE: `${API_BASE}/leave/balance`,
  LEAVE_REQUEST: `${API_BASE}/leave/request`,
  APPROVE: `${API_BASE}/approvals/*/decide`,
} as const;
