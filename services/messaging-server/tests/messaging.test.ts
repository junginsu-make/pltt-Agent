import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Hoisted mocks (accessible inside vi.mock factory) ──────────────────────

const {
  mockSelect,
  mockFrom,
  mockWhere,
  mockLimit,
  mockOrderBy,
  mockInsert,
  mockValues,
  mockReturning,
  mockUpdate,
  mockSet,
} = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockLimit = vi.fn();
  const mockOrderBy = vi.fn();
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockReturning = vi.fn();
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();
  return { mockSelect, mockFrom, mockWhere, mockLimit, mockOrderBy, mockInsert, mockValues, mockReturning, mockUpdate, mockSet };
});

// Set up default chaining
function setupChains() {
  const chain = {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    orderBy: mockOrderBy,
    insert: mockInsert,
    values: mockValues,
    returning: mockReturning,
    update: mockUpdate,
    set: mockSet,
  };
  mockSelect.mockReturnValue(chain);
  mockFrom.mockReturnValue(chain);
  mockWhere.mockReturnValue(chain);
  mockLimit.mockReturnValue(chain);
  mockOrderBy.mockReturnValue(chain);
  mockInsert.mockReturnValue(chain);
  mockValues.mockReturnValue(chain);
  mockReturning.mockReturnValue([]);
  mockUpdate.mockReturnValue(chain);
  mockSet.mockReturnValue(chain);
}

setupChains();

vi.mock('@palette/db', () => ({
  db: {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    orderBy: mockOrderBy,
    insert: mockInsert,
    values: mockValues,
    returning: mockReturning,
    update: mockUpdate,
    set: mockSet,
  },
  channels: {
    id: 'id',
    type: 'type',
    name: 'name',
    participants: 'participants',
    assignedLlm: 'assigned_llm',
    humanTakeover: 'human_takeover',
    takeoverBy: 'takeover_by',
    workDomain: 'work_domain',
    metadata: 'metadata',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  messages: {
    id: 'id',
    channelId: 'channel_id',
    senderType: 'sender_type',
    senderUserId: 'sender_user_id',
    displayName: 'display_name',
    contentType: 'content_type',
    contentText: 'content_text',
    cardData: 'card_data',
    toolCalls: 'tool_calls',
    toolResults: 'tool_results',
    isLlmAuto: 'is_llm_auto',
    readBy: 'read_by',
    createdAt: 'created_at',
  },
  employees: {
    id: 'id',
    name: 'name',
    email: 'email',
    passwordHash: 'password_hash',
    teamId: 'team_id',
    position: 'position',
    managerId: 'manager_id',
    avatarUrl: 'avatar_url',
    status: 'status',
    messengerStatus: 'messenger_status',
  },
}));

vi.mock('@palette/shared', () => ({
  generateChannelId: () => 'ch-test-uuid',
  generateMessageId: () => 'msg-test-uuid',
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import { routeMessage } from '../src/router.js';
import { signToken } from '../src/lib/jwt.js';
import app from '../src/app.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeToken(overrides?: Partial<{ employeeId: string; email: string; name: string; teamId: string }>) {
  return signToken({
    employeeId: 'emp-001',
    email: 'test@palette.com',
    name: 'Test User',
    teamId: 'team-001',
    ...overrides,
  });
}

function resetMocks() {
  mockSelect.mockReset();
  mockFrom.mockReset();
  mockWhere.mockReset();
  mockLimit.mockReset();
  mockOrderBy.mockReset();
  mockInsert.mockReset();
  mockValues.mockReset();
  mockReturning.mockReset();
  mockUpdate.mockReset();
  mockSet.mockReset();
  setupChains();
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. routeMessage tests
// ═══════════════════════════════════════════════════════════════════════════

describe('routeMessage', () => {
  it('should return direct/no LLM for direct (DM) channels', () => {
    const result = routeMessage('human', {
      id: 'ch-1',
      type: 'direct',
      humanTakeover: false,
      assignedLlm: null,
    });
    expect(result.type).toBe('direct');
    expect(result.llmRequired).toBe(false);
    expect(result.targetChannel).toBe('ch-1');
  });

  it('should return llm required for work channel with human sender', () => {
    const result = routeMessage('human', {
      id: 'ch-2',
      type: 'work',
      humanTakeover: false,
      assignedLlm: 'llm-gpt',
    });
    expect(result.type).toBe('llm');
    expect(result.llmRequired).toBe(true);
    expect(result.llmUserId).toBe('llm-gpt');
  });

  it('should return no LLM when sender is llm (prevent loop)', () => {
    const result = routeMessage('llm', {
      id: 'ch-2',
      type: 'work',
      humanTakeover: false,
      assignedLlm: 'llm-gpt',
    });
    expect(result.type).toBe('direct');
    expect(result.llmRequired).toBe(false);
  });

  it('should return takeover_human when human takeover is active', () => {
    const result = routeMessage('human', {
      id: 'ch-3',
      type: 'work',
      humanTakeover: true,
      assignedLlm: 'llm-gpt',
    });
    expect(result.type).toBe('takeover_human');
    expect(result.llmRequired).toBe(false);
  });

  it('should return llm required for company channel with human sender', () => {
    const result = routeMessage('human', {
      id: 'ch-4',
      type: 'company',
      humanTakeover: false,
      assignedLlm: 'llm-company',
    });
    expect(result.type).toBe('llm');
    expect(result.llmRequired).toBe(true);
    expect(result.llmUserId).toBe('llm-company');
  });

  it('should return direct for team channel (no LLM)', () => {
    const result = routeMessage('human', {
      id: 'ch-5',
      type: 'team',
      humanTakeover: false,
      assignedLlm: null,
    });
    expect(result.type).toBe('direct');
    expect(result.llmRequired).toBe(false);
  });

  it('should handle work channel with no assigned LLM', () => {
    const result = routeMessage('human', {
      id: 'ch-6',
      type: 'work',
      humanTakeover: false,
      assignedLlm: null,
    });
    expect(result.type).toBe('llm');
    expect(result.llmRequired).toBe(true);
    expect(result.llmUserId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Auth routes tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Auth routes', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('POST /api/v1/auth/login - success', async () => {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.default.hash('password123', 10);

    mockLimit.mockResolvedValueOnce([
      {
        id: 'emp-001',
        name: 'Test User',
        email: 'test@palette.com',
        passwordHash: hashedPassword,
        teamId: 'team-001',
        position: 'Developer',
        managerId: 'emp-mgr',
        avatarUrl: null,
      },
    ]);

    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@palette.com', password: 'password123' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.employee.id).toBe('emp-001');
    expect(data.employee.email).toBe('test@palette.com');
  });

  it('POST /api/v1/auth/login - invalid email format', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'password123' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('AUTH_001');
  });

  it('POST /api/v1/auth/login - user not found', async () => {
    mockLimit.mockResolvedValueOnce([]);

    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@palette.com', password: 'password123' }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe('AUTH_001');
  });

  it('POST /api/v1/auth/login - wrong password', async () => {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.default.hash('correct-password', 10);

    mockLimit.mockResolvedValueOnce([
      {
        id: 'emp-001',
        name: 'Test User',
        email: 'test@palette.com',
        passwordHash: hashedPassword,
        teamId: 'team-001',
        position: 'Developer',
        managerId: null,
        avatarUrl: null,
      },
    ]);

    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@palette.com', password: 'wrong-password' }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe('AUTH_001');
  });

  it('Protected route without token returns 401', async () => {
    const res = await app.request('/api/v1/messenger/channels', {
      method: 'GET',
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe('AUTH_001');
  });

  it('Protected route with invalid token returns 401', async () => {
    const res = await app.request('/api/v1/messenger/channels', {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid-token' },
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe('AUTH_001');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Messenger routes tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Messenger routes', () => {
  const token = makeToken();

  beforeEach(() => {
    resetMocks();
  });

  it('POST /messenger/send - success', async () => {
    // getChannelById returns a channel
    mockLimit.mockResolvedValueOnce([
      {
        id: 'ch-work-1',
        type: 'work',
        name: 'Work Channel',
        participants: ['emp-001', 'emp-002'],
        assignedLlm: 'llm-gpt',
        humanTakeover: false,
        takeoverBy: null,
      },
    ]);

    // saveMessage insert returning
    mockReturning.mockResolvedValueOnce([
      {
        id: 'msg-test-uuid',
        channelId: 'ch-work-1',
        senderType: 'human',
        senderUserId: 'emp-001',
        displayName: 'Test User',
        contentType: 'text',
        contentText: 'Hello world',
        readBy: ['emp-001'],
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await app.request('/api/v1/messenger/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel_id: 'ch-work-1',
        content: 'Hello world',
        content_type: 'text',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message_id).toBe('msg-test-uuid');
    expect(data.channel_id).toBe('ch-work-1');
    expect(data.routing.llm_will_respond).toBe(true);
    expect(data.routing.routed_to_llm).toBe('llm-gpt');
  });

  it('POST /messenger/send - channel not found', async () => {
    mockLimit.mockResolvedValueOnce([]);

    const res = await app.request('/api/v1/messenger/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel_id: 'ch-nonexistent',
        content: 'Hello',
        content_type: 'text',
      }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('POST /messenger/dm - creates new DM channel', async () => {
    // getOrCreateDmChannel: select finds no existing channels
    mockWhere.mockResolvedValueOnce([]);

    // insert returning (create new channel)
    mockReturning.mockResolvedValueOnce([
      {
        id: 'ch-test-uuid',
        type: 'direct',
        name: null,
        participants: ['emp-001', 'emp-002'],
        assignedLlm: null,
        humanTakeover: false,
        takeoverBy: null,
      },
    ]);

    // saveMessage insert returning
    mockReturning.mockResolvedValueOnce([
      {
        id: 'msg-test-uuid',
        channelId: 'ch-test-uuid',
        senderType: 'human',
        senderUserId: 'emp-001',
        displayName: 'Test User',
        contentType: 'text',
        contentText: 'Hi there',
      },
    ]);

    const res = await app.request('/api/v1/messenger/dm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to_user_id: 'emp-002',
        content: 'Hi there',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBeDefined();
    expect(data.message_id).toBeDefined();
  });

  it('POST /messenger/dm - uses existing DM channel', async () => {
    // getOrCreateDmChannel: select finds existing channel
    mockWhere.mockResolvedValueOnce([
      {
        id: 'ch-existing',
        type: 'direct',
        name: null,
        participants: ['emp-001', 'emp-002'],
        assignedLlm: null,
        humanTakeover: false,
      },
    ]);

    // saveMessage insert returning
    mockReturning.mockResolvedValueOnce([
      {
        id: 'msg-test-uuid',
        channelId: 'ch-existing',
        senderType: 'human',
        senderUserId: 'emp-001',
        displayName: 'Test User',
        contentType: 'text',
        contentText: 'Hello again',
      },
    ]);

    const res = await app.request('/api/v1/messenger/dm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to_user_id: 'emp-002',
        content: 'Hello again',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBe('ch-existing');
  });

  it('POST /messenger/takeover - start takeover', async () => {
    // updateTakeover: update returning
    mockReturning.mockResolvedValueOnce([
      {
        id: 'ch-work-1',
        type: 'work',
        humanTakeover: true,
        takeoverBy: 'emp-001',
      },
    ]);

    const res = await app.request('/api/v1/messenger/takeover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel_id: 'ch-work-1',
        action: 'takeover',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.human_takeover).toBe(true);
    expect(data.taken_over_by).toBe('emp-001');
  });

  it('POST /messenger/takeover - release takeover', async () => {
    mockReturning.mockResolvedValueOnce([
      {
        id: 'ch-work-1',
        type: 'work',
        humanTakeover: false,
        takeoverBy: null,
      },
    ]);

    const res = await app.request('/api/v1/messenger/takeover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel_id: 'ch-work-1',
        action: 'release',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.human_takeover).toBe(false);
    expect(data.taken_over_by).toBeNull();
  });

  it('GET /messenger/channels - returns channels list', async () => {
    // getChannelsByParticipant flow:
    // 1st where() call: main query (terminal) -> returns channels
    // 2nd where() call: last message subquery (NOT terminal, chains to .orderBy()) -> return chain
    // 3rd where() call: unread count query (terminal) -> returns count
    const chain = {
      select: mockSelect,
      from: mockFrom,
      where: mockWhere,
      limit: mockLimit,
      orderBy: mockOrderBy,
      insert: mockInsert,
      values: mockValues,
      returning: mockReturning,
      update: mockUpdate,
      set: mockSet,
    };

    mockWhere
      .mockResolvedValueOnce([
        {
          id: 'ch-1',
          type: 'direct',
          name: null,
          participants: ['emp-001', 'emp-002'],
          assignedLlm: null,
          humanTakeover: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
      .mockReturnValueOnce(chain)      // last message subquery: return chain so .orderBy() works
      .mockResolvedValueOnce([{ count: 2 }]); // unread count query

    // For last message subquery terminal: .orderBy().limit()
    mockLimit.mockResolvedValueOnce([
      {
        id: 'msg-last',
        channelId: 'ch-1',
        contentText: 'Last message',
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await app.request('/api/v1/messenger/channels', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channels).toBeDefined();
    expect(Array.isArray(data.channels)).toBe(true);
  });

  it('GET /messenger/channels/:channelId/messages - returns messages', async () => {
    // getMessagesByChannel: select returns messages
    mockLimit.mockResolvedValueOnce([
      {
        id: 'msg-1',
        channelId: 'ch-1',
        senderType: 'human',
        senderUserId: 'emp-001',
        displayName: 'Test User',
        contentType: 'text',
        contentText: 'Hello',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        channelId: 'ch-1',
        senderType: 'human',
        senderUserId: 'emp-002',
        displayName: 'Other User',
        contentType: 'text',
        contentText: 'Hi',
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await app.request('/api/v1/messenger/channels/ch-1/messages?limit=50', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.messages).toBeDefined();
    expect(data.has_more).toBe(false);
  });

  it('POST /messenger/call - success', async () => {
    // getOrCreateDmChannel: select finds existing channel
    mockWhere.mockResolvedValueOnce([
      {
        id: 'ch-call',
        type: 'direct',
        name: null,
        participants: ['emp-001', 'emp-003'],
      },
    ]);

    const res = await app.request('/api/v1/messenger/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ callee_id: 'emp-003' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBe('ch-call');
    expect(data.notification_sent).toBe(true);
  });

  it('POST /messenger/send - validation error for empty content', async () => {
    const res = await app.request('/api/v1/messenger/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel_id: 'ch-1',
        content: '',
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('VALIDATION');
  });

  it('POST /messenger/takeover - channel not found', async () => {
    mockReturning.mockResolvedValueOnce([]);

    const res = await app.request('/api/v1/messenger/takeover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel_id: 'ch-nonexistent',
        action: 'takeover',
      }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe('NOT_FOUND');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Channel service tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Channel service', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('createChannel inserts a new channel and returns it', async () => {
    const { createChannel } = await import('../src/services/channel-service.js');

    const channelData = {
      id: 'ch-test-uuid',
      type: 'work',
      name: 'Test Channel',
      participants: ['emp-001', 'emp-002'],
      workDomain: 'leave',
      assignedLlm: 'llm-gpt',
      humanTakeover: false,
      takeoverBy: null,
      metadata: {},
    };

    mockReturning.mockResolvedValueOnce([channelData]);

    const result = await createChannel({
      type: 'work',
      name: 'Test Channel',
      participants: ['emp-001', 'emp-002'],
      workDomain: 'leave',
      assignedLlm: 'llm-gpt',
    });

    expect(result).toBeDefined();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('getChannelsByParticipant queries channels with array contains', async () => {
    const { getChannelsByParticipant } = await import('../src/services/channel-service.js');

    // Flow: 1st where (terminal) -> channels, 2nd where (chain for .orderBy) -> chain, 3rd where (terminal) -> count
    const chain = {
      select: mockSelect,
      from: mockFrom,
      where: mockWhere,
      limit: mockLimit,
      orderBy: mockOrderBy,
      insert: mockInsert,
      values: mockValues,
      returning: mockReturning,
      update: mockUpdate,
      set: mockSet,
    };

    mockWhere
      .mockResolvedValueOnce([
        {
          id: 'ch-1',
          type: 'direct',
          name: null,
          participants: ['emp-001', 'emp-002'],
        },
      ])
      .mockReturnValueOnce(chain)            // last message subquery: return chain
      .mockResolvedValueOnce([{ count: 0 }]); // unread count query

    // Last message subquery terminal: .orderBy().limit()
    mockLimit.mockResolvedValueOnce([]);

    const result = await getChannelsByParticipant('emp-001');

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('getOrCreateDmChannel returns existing channel without creating', async () => {
    const { getOrCreateDmChannel } = await import('../src/services/channel-service.js');

    mockWhere.mockResolvedValueOnce([
      {
        id: 'ch-existing-dm',
        type: 'direct',
        participants: ['emp-001', 'emp-002'],
      },
    ]);

    const result = await getOrCreateDmChannel('emp-001', 'emp-002');

    expect(result.created).toBe(false);
    expect(result.channel.id).toBe('ch-existing-dm');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('getOrCreateDmChannel creates new channel when none exists', async () => {
    const { getOrCreateDmChannel } = await import('../src/services/channel-service.js');

    mockWhere.mockResolvedValueOnce([]);

    const newChannel = {
      id: 'ch-test-uuid',
      type: 'direct',
      participants: ['emp-001', 'emp-002'],
    };
    mockReturning.mockResolvedValueOnce([newChannel]);

    const result = await getOrCreateDmChannel('emp-001', 'emp-002');

    expect(result.created).toBe(true);
    expect(result.channel.id).toBe('ch-test-uuid');
    expect(mockInsert).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Health check
// ═══════════════════════════════════════════════════════════════════════════

describe('Health check', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('messaging-server');
  });
});
