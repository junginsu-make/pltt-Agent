import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LLMAdapter, LLMChatResponse } from '../src/adapters/llm-adapter.js';
import { getToolDefinitions, ALL_TOOLS } from '../src/tools/tool-definitions.js';
import { executeTool, type DelegationContext } from '../src/tools/tool-executor.js';
import app from '../src/app.js';
import { setPipeline } from '../src/routes/runtime.js';
import { LLMPipeline } from '../src/pipeline/llm-pipeline.js';

// ─── Mock @palette/db ─────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();

vi.mock('@palette/db', () => ({
  db: {
    select: () => {
      mockSelect();
      return {
        from: () => {
          mockFrom();
          return {
            where: (condition: unknown) => {
              mockWhere(condition);
              return mockWhere._results ?? [];
            },
          };
        },
      };
    },
  },
  userLlmConfigs: {
    userId: 'user_id',
  },
  employees: {
    id: 'id',
    name: 'name',
    teamId: 'team_id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Tool Definitions Tests
// ═══════════════════════════════════════════════════════════════════════════════
describe('Tool Definitions', () => {
  it('returns correct tools for "router" role', () => {
    const tools = getToolDefinitions('router');
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('analyze_intent');
    expect(names).toContain('delegate_to_agent');
  });

  it('returns correct tools for "work_assistant" role', () => {
    const tools = getToolDefinitions('work_assistant');
    expect(tools).toHaveLength(5);
    const names = tools.map((t) => t.name);
    expect(names).toContain('query_leave_balance');
    expect(names).toContain('validate_date');
    expect(names).toContain('submit_leave_request');
    expect(names).toContain('search_policy');
    expect(names).toContain('delegate_to_agent');
  });

  it('returns correct tools for "approver" role', () => {
    const tools = getToolDefinitions('approver');
    expect(tools).toHaveLength(5);
    const names = tools.map((t) => t.name);
    expect(names).toContain('check_team_schedule');
    expect(names).toContain('check_team_leaves');
    expect(names).toContain('approve_request');
    expect(names).toContain('reject_request');
    expect(names).toContain('delegate_to_agent');
  });

  it('returns correct tools for "secretary" role', () => {
    const tools = getToolDefinitions('secretary');
    expect(tools).toHaveLength(6);
    const names = tools.map((t) => t.name);
    expect(names).toContain('query_employee_schedule');
    expect(names).toContain('call_person');
    expect(names).toContain('get_team_summary');
    expect(names).toContain('delegate_to_agent');
    expect(names).toContain('invite_agent_to_channel');
    expect(names).toContain('broadcast_to_team');
  });

  it('returns correct tools for "team_assistant" role', () => {
    const tools = getToolDefinitions('team_assistant');
    expect(tools).toHaveLength(4);
    const names = tools.map((t) => t.name);
    expect(names).toContain('check_team_schedule');
    expect(names).toContain('get_team_summary');
    expect(names).toContain('delegate_to_agent');
    expect(names).toContain('broadcast_to_team');
  });

  it('with custom tools overrides role defaults', () => {
    const tools = getToolDefinitions('router', ['call_person', 'approve_request']);
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('call_person');
    expect(tools[1].name).toBe('approve_request');
  });

  it('returns empty array for unknown role', () => {
    const tools = getToolDefinitions('unknown_role');
    expect(tools).toHaveLength(0);
  });

  it('filters out unknown custom tool names', () => {
    const tools = getToolDefinitions('router', ['nonexistent_tool', 'call_person']);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('call_person');
  });

  it('all tool definitions have required fields', () => {
    for (const [name, tool] of Object.entries(ALL_TOOLS)) {
      expect(tool.name).toBe(name);
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe('object');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Tool Executor Tests
// ═══════════════════════════════════════════════════════════════════════════════
describe('Tool Executor', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('analyze_intent returns input directly without HTTP call', async () => {
    const input = { intent: 'leave_request', route_to: 'leave_agent', confidence: 0.95 };
    const result = await executeTool('analyze_intent', input, 'EMP-001');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(input);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('query_leave_balance calls leave-service', async () => {
    const balanceData = { remaining: 10, total: 15, used: 5 };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(balanceData), { status: 200 }),
    );

    const result = await executeTool('query_leave_balance', { employee_id: 'EMP-001' }, 'EMP-001');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(balanceData);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/v1/leave/balance/EMP-001');
  });

  it('query_leave_balance handles API error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    const result = await executeTool('query_leave_balance', { employee_id: 'EMP-001' }, 'EMP-001');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to query balance: 500');
  });

  it('validate_date calls leave-service with POST', async () => {
    const validationResult = { valid: true, warnings: [] };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(validationResult), { status: 200 }),
    );

    const input = { employee_id: 'EMP-001', date: '2026-04-01' };
    const result = await executeTool('validate_date', input, 'EMP-001');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validationResult);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/v1/leave/validate-date', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  });

  it('submit_leave_request calls leave-service with POST', async () => {
    const leaveData = { id: 'LR-001', status: 'pending' };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(leaveData), { status: 201 }),
    );

    const input = {
      employee_id: 'EMP-001',
      start_date: '2026-04-01',
      end_date: '2026-04-01',
      days: 1,
    };
    const result = await executeTool('submit_leave_request', input, 'EMP-001');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(leaveData);
  });

  it('submit_leave_request handles error response with message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Insufficient balance' } }), {
        status: 400,
      }),
    );

    const input = {
      employee_id: 'EMP-001',
      start_date: '2026-04-01',
      end_date: '2026-04-01',
      days: 1,
    };
    const result = await executeTool('submit_leave_request', input, 'EMP-001');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient balance');
  });

  it('search_policy returns default result', async () => {
    const result = await executeTool('search_policy', { query: '연차 규정' }, 'EMP-001');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      query: '연차 규정',
      result: 'LP-DEFAULT 규정: 연차 15일, 반차 가능, 병가 별도',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('check_team_schedule calls leave-service', async () => {
    const scheduleData = { leaves: [] };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(scheduleData), { status: 200 }),
    );

    const result = await executeTool(
      'check_team_schedule',
      { team_id: 'TEAM-001', date: '2026-04-01' },
      'EMP-001',
    );
    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/leave/requests?team_id=TEAM-001&date=2026-04-01&status=approved',
    );
  });

  it('approve_request calls approval-service', async () => {
    const approvalData = { id: 'APR-001', status: 'approved' };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(approvalData), { status: 200 }),
    );

    const result = await executeTool(
      'approve_request',
      { approval_id: 'APR-001', comment: '승인합니다' },
      'EMP-001',
    );
    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3002/api/v1/approvals/APR-001/decide',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ decision: 'approved', decided_by: 'system', comment: '승인합니다' }),
      }),
    );
  });

  it('reject_request calls approval-service with rejected decision', async () => {
    const rejectionData = { id: 'APR-001', status: 'rejected' };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(rejectionData), { status: 200 }),
    );

    const result = await executeTool(
      'reject_request',
      { approval_id: 'APR-001', comment: '사유 부족' },
      'EMP-001',
    );
    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3002/api/v1/approvals/APR-001/decide',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ decision: 'rejected', decided_by: 'system', comment: '사유 부족' }),
      }),
    );
  });

  it('call_person calls messaging-service', async () => {
    const callData = { status: 'calling' };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(callData), { status: 200 }),
    );

    const result = await executeTool('call_person', { callee_id: 'EMP-002' }, 'EMP-001');
    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/messenger/call',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ callee_id: 'EMP-002' }),
      }),
    );
  });

  it('returns error for unknown tool', async () => {
    const result = await executeTool('nonexistent_tool', {}, 'EMP-001');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown tool: nonexistent_tool');
  });

  it('handles fetch network error gracefully', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await executeTool('query_leave_balance', { employee_id: 'EMP-001' }, 'EMP-001');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2b. Orchestration Tool Tests
// ═══════════════════════════════════════════════════════════════════════════════
describe('Orchestration Tools', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const baseDelegationCtx: DelegationContext = {
    originUserId: 'EMP-001',
    originChannelId: 'CH-001',
    delegationChain: ['EMP-001'],
    depth: 0,
    maxDepth: 3,
  };

  it('delegate_to_agent calls ai-runtime /chat endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ text: '잔여 연차 10일입니다.', tool_calls: [] }), { status: 200 }),
    );

    const result = await executeTool(
      'delegate_to_agent',
      { target_user_id: 'EMP-HR-001', task_message: '연차 잔여일 조회해줘' },
      'EMP-001',
      baseDelegationCtx,
    );

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).delegated_to).toBe('EMP-HR-001');
    expect((result.data as Record<string, unknown>).response_text).toBe('잔여 연차 10일입니다.');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3100/api/v1/runtime/chat',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('delegate_to_agent rejects when depth exceeds maxDepth', async () => {
    const deepCtx: DelegationContext = { ...baseDelegationCtx, depth: 3, maxDepth: 3 };

    const result = await executeTool(
      'delegate_to_agent',
      { target_user_id: 'EMP-HR-001', task_message: 'test' },
      'EMP-001',
      deepCtx,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('위임 깊이 초과');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('delegate_to_agent rejects circular delegation', async () => {
    const circularCtx: DelegationContext = {
      ...baseDelegationCtx,
      delegationChain: ['EMP-001', 'EMP-HR-001'],
      depth: 1,
    };

    const result = await executeTool(
      'delegate_to_agent',
      { target_user_id: 'EMP-001', task_message: 'test' },
      'EMP-001',
      circularCtx,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('순환 위임 감지');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('delegate_to_agent handles API error gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('', { status: 503 }),
    );

    const result = await executeTool(
      'delegate_to_agent',
      { target_user_id: 'EMP-HR-001', task_message: 'test' },
      'EMP-001',
      baseDelegationCtx,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('위임 실패 (EMP-HR-001): HTTP 503');
  });

  it('delegate_to_agent works without explicit delegation context', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ text: 'OK', tool_calls: [] }), { status: 200 }),
    );

    const result = await executeTool(
      'delegate_to_agent',
      { target_user_id: 'EMP-HR-001', task_message: 'test' },
      'EMP-001',
    );

    expect(result.success).toBe(true);
  });

  it('invite_agent_to_channel calls messaging-server', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ channel_id: 'CH-001', user_id: 'EMP-HR-001', added: true }), { status: 200 }),
    );

    const result = await executeTool(
      'invite_agent_to_channel',
      { target_user_id: 'EMP-HR-001', channel_id: 'CH-001' },
      'EMP-001',
    );

    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/messenger/channel/invite',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('invite_agent_to_channel handles error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));

    const result = await executeTool(
      'invite_agent_to_channel',
      { target_user_id: 'EMP-HR-001', channel_id: 'CH-NONEXISTENT' },
      'EMP-001',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('채널 초대 실패');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. LLM Pipeline Tests
// ═══════════════════════════════════════════════════════════════════════════════
describe('LLM Pipeline', () => {
  let mockAdapter: LLMAdapter;

  const mockConfig = {
    userId: 'EMP-HR-001',
    llmRole: 'work_assistant',
    systemPrompt: 'You are a helpful HR assistant.',
    llmModel: 'claude-haiku-4-5-20251001',
    autoRespond: true,
    tools: [],
    workDomains: [],
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockAdapter = { chat: vi.fn() };
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupDbMock(config: typeof mockConfig | null) {
    if (config) {
      mockWhere._results = [config];
    } else {
      mockWhere._results = [];
    }
  }

  it('handles text-only response (no tool use)', async () => {
    setupDbMock(mockConfig);

    const textResponse: LLMChatResponse = {
      content: [{ type: 'text', text: '안녕하세요! 무엇을 도와드릴까요?' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 50, outputTokens: 20 },
    };
    vi.mocked(mockAdapter.chat).mockResolvedValueOnce(textResponse);

    const pipeline = new LLMPipeline(mockAdapter);
    const result = await pipeline.handle({
      llmUserId: 'EMP-HR-001',
      channelId: 'CH-001',
      userMessage: '안녕하세요',
      senderUserId: 'EMP-001',
    });

    expect(result.text).toBe('안녕하세요! 무엇을 도와드릴까요?');
    expect(result.toolCalls).toBeUndefined();
    expect(result.toolResults).toBeUndefined();
    expect(result.usage).toEqual({ inputTokens: 50, outputTokens: 20 });
  });

  it('handles tool_use -> executes tool -> re-calls LLM', async () => {
    setupDbMock(mockConfig);

    // First call: LLM requests a tool
    const toolUseResponse: LLMChatResponse = {
      content: [
        { type: 'tool_use', id: 'call-1', name: 'search_policy', input: { query: '연차 규정' } },
      ],
      stopReason: 'tool_use',
      usage: { inputTokens: 60, outputTokens: 30 },
    };

    // Second call: LLM gives final text
    const finalResponse: LLMChatResponse = {
      content: [{ type: 'text', text: '연차는 15일입니다.' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 80, outputTokens: 25 },
    };

    vi.mocked(mockAdapter.chat)
      .mockResolvedValueOnce(toolUseResponse)
      .mockResolvedValueOnce(finalResponse);

    const pipeline = new LLMPipeline(mockAdapter);
    const result = await pipeline.handle({
      llmUserId: 'EMP-HR-001',
      channelId: 'CH-001',
      userMessage: '연차 규정이 뭐야?',
      senderUserId: 'EMP-001',
    });

    expect(result.text).toBe('연차는 15일입니다.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0].name).toBe('search_policy');
    expect(result.toolResults).toHaveLength(1);
    expect(result.usage).toEqual({ inputTokens: 140, outputTokens: 55 });
    expect(mockAdapter.chat).toHaveBeenCalledTimes(2);
  });

  it('limits tool iterations to MAX_TOOL_ITERATIONS (5)', async () => {
    setupDbMock(mockConfig);

    // All responses want tool_use
    const toolUseResponse: LLMChatResponse = {
      content: [
        { type: 'tool_use', id: 'call-loop', name: 'search_policy', input: { query: 'test' } },
      ],
      stopReason: 'tool_use',
      usage: { inputTokens: 10, outputTokens: 10 },
    };

    // After 5 iterations, even though stop_reason is tool_use, pipeline should stop
    // We'll also provide a 6th response that would be the "final" one
    vi.mocked(mockAdapter.chat).mockResolvedValue(toolUseResponse);

    const pipeline = new LLMPipeline(mockAdapter);
    const result = await pipeline.handle({
      llmUserId: 'EMP-HR-001',
      channelId: 'CH-001',
      userMessage: 'loop test',
      senderUserId: 'EMP-001',
    });

    // 1 initial + 5 iterations = 6 calls total
    expect(mockAdapter.chat).toHaveBeenCalledTimes(6);
    expect(result.toolCalls).toHaveLength(5);
  });

  it('throws when config not found', async () => {
    setupDbMock(null);

    const pipeline = new LLMPipeline(mockAdapter);
    await expect(
      pipeline.handle({
        llmUserId: 'NONEXISTENT',
        channelId: 'CH-001',
        userMessage: 'test',
        senderUserId: 'EMP-001',
      }),
    ).rejects.toThrow('LLM config not found for user: NONEXISTENT');
  });

  it('passes conversation history', async () => {
    setupDbMock(mockConfig);

    const textResponse: LLMChatResponse = {
      content: [{ type: 'text', text: 'Response.' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 100, outputTokens: 20 },
    };
    vi.mocked(mockAdapter.chat).mockResolvedValueOnce(textResponse);

    const pipeline = new LLMPipeline(mockAdapter);
    await pipeline.handle({
      llmUserId: 'EMP-HR-001',
      channelId: 'CH-001',
      userMessage: '다음 질문',
      senderUserId: 'EMP-001',
      conversationHistory: [
        { role: 'user', content: '이전 질문' },
        { role: 'assistant', content: '이전 답변' },
      ],
    });

    const chatCall = vi.mocked(mockAdapter.chat).mock.calls[0][0];
    expect(chatCall.messages).toHaveLength(3); // 2 history + 1 new
    expect(chatCall.messages[0]).toEqual({ role: 'user', content: '이전 질문' });
    expect(chatCall.messages[1]).toEqual({ role: 'assistant', content: '이전 답변' });
    expect(chatCall.messages[2]).toEqual({ role: 'user', content: '다음 질문' });
  });

  it('returns cardData from tool results when type field present', async () => {
    setupDbMock(mockConfig);

    // Tool returns data with 'type' field
    const toolUseResponse: LLMChatResponse = {
      content: [
        {
          type: 'tool_use',
          id: 'call-1',
          name: 'query_leave_balance',
          input: { employee_id: 'EMP-001' },
        },
      ],
      stopReason: 'tool_use',
      usage: { inputTokens: 50, outputTokens: 20 },
    };
    const finalResponse: LLMChatResponse = {
      content: [{ type: 'text', text: '잔여 연차 10일입니다.' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 70, outputTokens: 25 },
    };

    vi.mocked(mockAdapter.chat)
      .mockResolvedValueOnce(toolUseResponse)
      .mockResolvedValueOnce(finalResponse);

    // Mock fetch for query_leave_balance
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ type: 'leave_balance', remaining: 10, total: 15 }), {
        status: 200,
      }),
    );

    const pipeline = new LLMPipeline(mockAdapter);
    const result = await pipeline.handle({
      llmUserId: 'EMP-HR-001',
      channelId: 'CH-001',
      userMessage: '연차 잔여일 확인',
      senderUserId: 'EMP-001',
    });

    expect(result.cardData).toBeDefined();
    expect(result.cardData!.type).toBe('leave_balance');
    expect(result.cardData!.remaining).toBe(10);
  });

  it('truncates conversation history to last 20 messages', async () => {
    setupDbMock(mockConfig);

    const textResponse: LLMChatResponse = {
      content: [{ type: 'text', text: 'OK' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 200, outputTokens: 10 },
    };
    vi.mocked(mockAdapter.chat).mockResolvedValueOnce(textResponse);

    // Create 25 history messages
    const history = Array.from({ length: 25 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
    }));

    const pipeline = new LLMPipeline(mockAdapter);
    await pipeline.handle({
      llmUserId: 'EMP-HR-001',
      channelId: 'CH-001',
      userMessage: 'new message',
      senderUserId: 'EMP-001',
      conversationHistory: history,
    });

    const chatCall = vi.mocked(mockAdapter.chat).mock.calls[0][0];
    // 20 from history (sliced) + 1 new = 21
    expect(chatCall.messages).toHaveLength(21);
    // First history message should be Message 5 (skipped 0-4)
    expect(chatCall.messages[0].content).toBe('Message 5');
  });

  it('uses default model when config has null llmModel', async () => {
    setupDbMock({ ...mockConfig, llmModel: null });

    const textResponse: LLMChatResponse = {
      content: [{ type: 'text', text: 'OK' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 50, outputTokens: 10 },
    };
    vi.mocked(mockAdapter.chat).mockResolvedValueOnce(textResponse);

    const pipeline = new LLMPipeline(mockAdapter);
    await pipeline.handle({
      llmUserId: 'EMP-HR-001',
      channelId: 'CH-001',
      userMessage: 'test',
      senderUserId: 'EMP-001',
    });

    const chatCall = vi.mocked(mockAdapter.chat).mock.calls[0][0];
    expect(chatCall.model).toBe('claude-haiku-4-5-20251001');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Route Tests
// ═══════════════════════════════════════════════════════════════════════════════
describe('Routes', () => {
  beforeEach(() => {
    // Reset pipeline before each route test
    setPipeline(null as unknown as LLMPipeline);
  });

  it('GET /health returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', service: 'ai-runtime' });
  });

  it('POST /api/v1/runtime/chat returns LLM response', async () => {
    const mockPipelineResult = {
      text: '안녕하세요!',
      cardData: undefined,
      toolCalls: undefined,
      toolResults: undefined,
      usage: { inputTokens: 50, outputTokens: 20 },
    };

    const mockPipeline = {
      handle: vi.fn().mockResolvedValue(mockPipelineResult),
    } as unknown as LLMPipeline;
    setPipeline(mockPipeline);

    const res = await app.request('/api/v1/runtime/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        llm_user_id: 'EMP-HR-001',
        channel_id: 'CH-001',
        user_message: '안녕하세요',
        sender_user_id: 'EMP-001',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe('안녕하세요!');
    expect(body.card_data).toBeNull();
    expect(body.tool_calls).toEqual([]);
    expect(body.tool_results).toEqual([]);
    expect(body.usage).toEqual({ inputTokens: 50, outputTokens: 20 });
  });

  it('POST /api/v1/runtime/chat returns 400 on validation error', async () => {
    const res = await app.request('/api/v1/runtime/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing required fields
        channel_id: 'CH-001',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toBe('Invalid request');
  });

  it('POST /api/v1/runtime/chat returns 503 on pipeline error', async () => {
    const mockPipeline = {
      handle: vi.fn().mockRejectedValue(new Error('LLM config not found')),
    } as unknown as LLMPipeline;
    setPipeline(mockPipeline);

    const res = await app.request('/api/v1/runtime/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        llm_user_id: 'NONEXISTENT',
        channel_id: 'CH-001',
        user_message: 'test',
        sender_user_id: 'EMP-001',
      }),
    });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('SYS_001');
    expect(body.error.message).toBe('LLM config not found');
  });

  it('POST /api/v1/runtime/chat with conversation_history', async () => {
    const mockPipelineResult = {
      text: 'Response with history',
      usage: { inputTokens: 100, outputTokens: 30 },
    };

    const mockPipeline = {
      handle: vi.fn().mockResolvedValue(mockPipelineResult),
    } as unknown as LLMPipeline;
    setPipeline(mockPipeline);

    const res = await app.request('/api/v1/runtime/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        llm_user_id: 'EMP-HR-001',
        channel_id: 'CH-001',
        user_message: 'follow up',
        sender_user_id: 'EMP-001',
        conversation_history: [
          { role: 'user', content: 'previous question' },
          { role: 'assistant', content: 'previous answer' },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const handleCall = vi.mocked(mockPipeline.handle).mock.calls[0][0];
    expect(handleCall.conversationHistory).toHaveLength(2);
  });

  it('POST /api/v1/runtime/chat returns tool_calls and tool_results', async () => {
    const mockPipelineResult = {
      text: 'Your balance is 10 days.',
      cardData: { type: 'leave_balance', remaining: 10 },
      toolCalls: [{ name: 'query_leave_balance', input: { employee_id: 'EMP-001' } }],
      toolResults: [{ toolName: 'query_leave_balance', result: { remaining: 10 } }],
      usage: { inputTokens: 120, outputTokens: 40 },
    };

    const mockPipeline = {
      handle: vi.fn().mockResolvedValue(mockPipelineResult),
    } as unknown as LLMPipeline;
    setPipeline(mockPipeline);

    const res = await app.request('/api/v1/runtime/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        llm_user_id: 'EMP-HR-001',
        channel_id: 'CH-001',
        user_message: '연차 확인',
        sender_user_id: 'EMP-001',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tool_calls).toHaveLength(1);
    expect(body.tool_results).toHaveLength(1);
    expect(body.card_data).toEqual({ type: 'leave_balance', remaining: 10 });
  });
});
