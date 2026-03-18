import { db, employees, messages as messagesTable } from '@palette/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createServiceToken, type ServiceJwtPayload } from '@palette/shared/middleware/service-auth';
import { generateMessageId } from '@palette/shared';

function getServiceHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${createServiceToken('ai-runtime')}`,
  };
}

const toolInputSchemas: Record<string, z.ZodType> = {
  query_leave_balance: z.object({ employee_id: z.string().min(1) }),
  validate_date: z.object({ start_date: z.string(), end_date: z.string().optional(), employee_id: z.string().optional() }),
  submit_leave_request: z.object({ employee_id: z.string(), start_date: z.string(), end_date: z.string(), leave_type: z.string().optional(), reason: z.string().optional() }),
  approve_request: z.object({ approval_id: z.string(), comment: z.string().optional() }),
  reject_request: z.object({ approval_id: z.string(), comment: z.string() }),
  call_person: z.object({ callee_id: z.string() }),
  delegate_to_agent: z.object({ target_user_id: z.string(), task_message: z.string(), context: z.string().optional() }),
  invite_agent_to_channel: z.object({ target_user_id: z.string(), channel_id: z.string() }),
  broadcast_to_team: z.object({ team_id: z.string(), message: z.string() }),
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

const LEAVE_SERVICE_URL = requireEnv('LEAVE_SERVICE_URL');
const APPROVAL_SERVICE_URL = requireEnv('APPROVAL_SERVICE_URL');
const MESSAGING_SERVICE_URL = requireEnv('MESSAGING_SERVER_URL');
const AI_RUNTIME_URL = requireEnv('AI_RUNTIME_URL');

const DELEGATION_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_DEPTH = 3;

export interface DelegationContext {
  originUserId: string;
  originChannelId: string;
  delegationChain: string[];
  depth: number;
  maxDepth: number;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  _senderUserId: string,
  delegationCtx?: DelegationContext,
): Promise<ToolResult> {
  // Validate input if schema exists
  const schema = toolInputSchemas[toolName];
  if (schema) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: `Invalid tool input: ${parsed.error.issues.map(i => i.message).join(', ')}` };
    }
  }

  try {
    switch (toolName) {
      case 'query_leave_balance':
        return await queryLeaveBalance(input.employee_id as string);
      case 'validate_date':
        return await validateDate(input);
      case 'submit_leave_request':
        return await submitLeaveRequest(input);
      case 'search_policy':
        return await searchPolicy(input.query as string);
      case 'analyze_intent':
        // Internal tool - LLM outputs this directly, no external call needed
        return { success: true, data: input };
      case 'check_team_schedule':
      case 'check_team_leaves':
        return await checkTeamSchedule(input);
      case 'approve_request':
        return await decideApproval(input.approval_id as string, 'approved', input.comment as string);
      case 'reject_request':
        return await decideApproval(input.approval_id as string, 'rejected', input.comment as string);
      case 'call_person':
        return await callPerson(input.callee_id as string);
      case 'query_employee_schedule':
        return await queryEmployeeSchedule(input.employee_id as string);
      case 'get_team_summary':
        return await getTeamSummary(input.team_id as string);
      case 'delegate_to_agent':
        return await delegateToAgent(input, delegationCtx);
      case 'invite_agent_to_channel':
        return await inviteAgentToChannel(input);
      case 'broadcast_to_team':
        return await broadcastToTeam(input, delegationCtx);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Tool execution failed' };
  }
}

async function queryLeaveBalance(employeeId: string): Promise<ToolResult> {
  const res = await fetch(`${LEAVE_SERVICE_URL}/leave/balance/${employeeId}`, {
    headers: getServiceHeaders(),
  });
  if (!res.ok) return { success: false, error: `Failed to query balance: ${res.status}` };
  return { success: true, data: await res.json() };
}

async function validateDate(input: Record<string, unknown>): Promise<ToolResult> {
  const res = await fetch(`${LEAVE_SERVICE_URL}/leave/validate-date`, {
    method: 'POST',
    headers: getServiceHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) return { success: false, error: `Failed to validate date: ${res.status}` };
  return { success: true, data: await res.json() };
}

async function submitLeaveRequest(input: Record<string, unknown>): Promise<ToolResult> {
  const res = await fetch(`${LEAVE_SERVICE_URL}/leave/request`, {
    method: 'POST',
    headers: getServiceHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return {
      success: false,
      error: (err as Record<string, Record<string, string>>)?.error?.message || `Failed to submit: ${res.status}`,
    };
  }
  const leaveData = await res.json() as {
    data: {
      type: string;
      request: { id: string; employee_id: string; start_date: string; end_date: string; days: number; reason: string };
      approval: { approver_id: string | null; approver_name: string | null };
    };
  };

  // Auto-create approval request if approver exists
  const req = leaveData.data.request;
  const appr = leaveData.data.approval;
  if (appr?.approver_id) {
    try {
      const approvalRes = await fetch(`${APPROVAL_SERVICE_URL}/approvals`, {
        method: 'POST',
        headers: getServiceHeaders(),
        body: JSON.stringify({
          type: 'leave_request',
          related_id: req.id,
          requested_by: req.employee_id,
          approver_id: appr.approver_id,
          request_summary: `${req.start_date}~${req.end_date} ${req.days}일 연차 (${req.reason ?? ''})`,
          auto_approve_hours: 2,
        }),
      });

      if (approvalRes.ok) {
        const approvalData = await approvalRes.json() as { data: { id: string; auto_approve_at: string | null } };

        // Send approval notification to approver's notification channel
        const employeeRes = await db
          .select({ name: employees.name })
          .from(employees)
          .where(eq(employees.id, req.employee_id));
        const employeeName = employeeRes[0]?.name ?? req.employee_id;

        const notificationChannelId = `ch-notification-${appr.approver_id}`;

        // Directly insert into messages table for the approver's notification channel
        await db.insert(messagesTable).values({
          id: generateMessageId(),
          channelId: notificationChannelId,
          senderType: 'system',
          senderUserId: 'system',
          displayName: '시스템 알림',
          contentType: 'approval',
          contentText: `${employeeName}님이 ${req.start_date} ~ ${req.end_date} (${req.days}일) 연차를 신청했습니다. 사유: ${req.reason ?? ''}`,
          cardData: {
            type: 'approval',
            approvalId: approvalData.data.id,
            employeeName,
            date: `${req.start_date} ~ ${req.end_date}`,
            leaveType: '연차',
            reason: req.reason ?? '',
            days: req.days,
            autoApproveAt: approvalData.data.auto_approve_at,
          },
          isLlmAuto: false,
          readBy: [],
        });
      }
    } catch (err) {
      console.error('[tool-executor] Failed to create approval:', err);
    }
  }

  return { success: true, data: leaveData };
}

async function searchPolicy(_query: string): Promise<ToolResult> {
  // For now, return default policy info. In production, this queries leave-policies.
  return { success: true, data: { query: _query, result: 'LP-DEFAULT 규정: 연차 15일, 반차 가능, 병가 별도' } };
}

async function checkTeamSchedule(input: Record<string, unknown>): Promise<ToolResult> {
  const teamId = input.team_id as string;
  const date = input.date as string;
  const res = await fetch(
    `${LEAVE_SERVICE_URL}/leave/requests?team_id=${teamId}&date=${date}&status=approved`,
    { headers: getServiceHeaders() },
  );
  if (!res.ok) return { success: false, error: `Failed to check schedule: ${res.status}` };
  return { success: true, data: await res.json() };
}

async function decideApproval(
  approvalId: string,
  decision: string,
  comment?: string,
): Promise<ToolResult> {
  const res = await fetch(`${APPROVAL_SERVICE_URL}/approvals/${approvalId}/decide`, {
    method: 'PATCH',
    headers: getServiceHeaders(),
    body: JSON.stringify({ decision, decided_by: 'system', comment }),
  });
  if (!res.ok) return { success: false, error: `Failed to decide: ${res.status}` };
  return { success: true, data: await res.json() };
}

async function queryEmployeeSchedule(employeeId: string): Promise<ToolResult> {
  const res = await fetch(
    `${LEAVE_SERVICE_URL}/leave/requests?employee_id=${employeeId}&status=approved`,
    { headers: getServiceHeaders() },
  );
  if (!res.ok) return { success: false, error: `Failed to query schedule: ${res.status}` };
  return { success: true, data: await res.json() };
}

async function getTeamSummary(teamId: string): Promise<ToolResult> {
  const month = new Date().toISOString().slice(0, 7);
  const res = await fetch(
    `${LEAVE_SERVICE_URL}/leave/team-schedule?teamId=${teamId}&month=${month}`,
    { headers: getServiceHeaders() },
  );
  if (!res.ok) return { success: false, error: `Failed to get team summary: ${res.status}` };
  return { success: true, data: await res.json() };
}

async function callPerson(calleeId: string): Promise<ToolResult> {
  const res = await fetch(`${MESSAGING_SERVICE_URL}/messenger/call`, {
    method: 'POST',
    headers: getServiceHeaders(),
    body: JSON.stringify({ callee_id: calleeId }),
  });
  if (!res.ok) return { success: false, error: `Call failed: ${res.status}` };
  return { success: true, data: await res.json() };
}

// ─── Orchestration Tools ─────────────────────────────────────────────────────

async function delegateToAgent(
  input: Record<string, unknown>,
  ctx?: DelegationContext,
): Promise<ToolResult> {
  const targetUserId = input.target_user_id as string;
  const taskMessage = input.task_message as string;
  const taskContext = input.context as string | undefined;

  const currentCtx: DelegationContext = ctx ?? {
    originUserId: 'unknown',
    originChannelId: 'unknown',
    delegationChain: [],
    depth: 0,
    maxDepth: DEFAULT_MAX_DEPTH,
  };

  // Safety: depth check
  if (currentCtx.depth >= currentCtx.maxDepth) {
    return { success: false, error: `위임 깊이 초과 (최대 ${currentCtx.maxDepth}단계)` };
  }

  // Safety: loop detection
  if (currentCtx.delegationChain.includes(targetUserId)) {
    return {
      success: false,
      error: `순환 위임 감지: ${currentCtx.delegationChain.join(' → ')} → ${targetUserId}`,
    };
  }

  const delegationMessage = taskContext
    ? `[위임 요청] ${taskMessage}\n\n맥락: ${taskContext}`
    : `[위임 요청] ${taskMessage}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELEGATION_TIMEOUT_MS);

    const res = await fetch(`${AI_RUNTIME_URL}/runtime/chat`, {
      method: 'POST',
      headers: getServiceHeaders(),
      body: JSON.stringify({
        llm_user_id: targetUserId,
        channel_id: currentCtx.originChannelId,
        user_message: delegationMessage,
        sender_user_id: currentCtx.originUserId,
        delegation_context: {
          originUserId: currentCtx.originUserId,
          originChannelId: currentCtx.originChannelId,
          delegationChain: [...currentCtx.delegationChain, targetUserId],
          depth: currentCtx.depth + 1,
          maxDepth: currentCtx.maxDepth,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: `위임 실패 (${targetUserId}): HTTP ${res.status}` };
    }

    const result = (await res.json()) as { text?: string; tool_calls?: unknown[] };
    return {
      success: true,
      data: {
        delegated_to: targetUserId,
        response_text: result.text,
        tool_calls_made: result.tool_calls?.length ?? 0,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: `위임 타임아웃 (${targetUserId}): ${DELEGATION_TIMEOUT_MS}ms 초과` };
    }
    return { success: false, error: `위임 실패 (${targetUserId}): ${error instanceof Error ? error.message : 'unknown'}` };
  }
}

async function inviteAgentToChannel(input: Record<string, unknown>): Promise<ToolResult> {
  const targetUserId = input.target_user_id as string;
  const channelId = input.channel_id as string;

  const res = await fetch(`${MESSAGING_SERVICE_URL}/messenger/channel/invite`, {
    method: 'POST',
    headers: getServiceHeaders(),
    body: JSON.stringify({ channel_id: channelId, user_id: targetUserId }),
  });

  if (!res.ok) {
    return { success: false, error: `채널 초대 실패: ${res.status}` };
  }
  return { success: true, data: await res.json() };
}

async function broadcastToTeam(
  input: Record<string, unknown>,
  ctx?: DelegationContext,
): Promise<ToolResult> {
  const teamId = input.team_id as string;
  const message = input.message as string;

  try {
    // Query team members from DB
    const teamMembers = await db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(eq(employees.teamId, teamId));

    if (teamMembers.length === 0) {
      return { success: false, error: `팀 ${teamId}에 소속된 직원이 없습니다` };
    }

    // Filter out the origin user (don't delegate to self)
    const targets = ctx
      ? teamMembers.filter((m) => !ctx.delegationChain.includes(m.id))
      : teamMembers;

    if (targets.length === 0) {
      return { success: false, error: '전파 대상이 없습니다 (모두 이미 위임 체인에 포함)' };
    }

    // Delegate to each team member in parallel
    const results = await Promise.allSettled(
      targets.map((member) =>
        delegateToAgent({ target_user_id: member.id, task_message: message }, ctx),
      ),
    );

    const responses = results.map((r, i) => ({
      employee_id: targets[i].id,
      employee_name: targets[i].name,
      status: r.status === 'fulfilled' ? (r.value.success ? 'success' : 'failed') : 'error',
      response: r.status === 'fulfilled' ? r.value.data : r.reason?.message,
    }));

    return {
      success: true,
      data: {
        team_id: teamId,
        total_members: targets.length,
        responses,
      },
    };
  } catch (error) {
    return { success: false, error: `팀 전파 실패: ${error instanceof Error ? error.message : 'unknown'}` };
  }
}
