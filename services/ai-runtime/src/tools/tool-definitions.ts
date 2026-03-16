import type { LLMToolDefinition } from '../adapters/llm-adapter.js';

// All available tool definitions
const ALL_TOOLS: Record<string, LLMToolDefinition> = {
  analyze_intent: {
    name: 'analyze_intent',
    description: '사용자 메시지의 의도를 분석하고 적절한 담당자에게 라우팅합니다.',
    input_schema: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['leave_inquiry', 'leave_request', 'leave_cancel', 'person_call', 'schedule_query', 'general'],
        },
        route_to: {
          type: 'string',
          enum: ['leave_agent', 'person_call', 'secretary', 'none'],
        },
        confidence: { type: 'number', description: '확신도 0~1' },
        extracted_date: { type: 'string', description: 'YYYY-MM-DD 형식 날짜 (있으면)' },
        extracted_person: { type: 'string', description: '사람 이름 (있으면)' },
      },
      required: ['intent', 'route_to', 'confidence'],
    },
  },
  query_leave_balance: {
    name: 'query_leave_balance',
    description: '직원의 연차 잔여 일수를 조회합니다.',
    input_schema: {
      type: 'object',
      properties: { employee_id: { type: 'string' } },
      required: ['employee_id'],
    },
  },
  validate_date: {
    name: 'validate_date',
    description: '휴가 날짜가 유효한지 검증합니다 (주말, 공휴일, 팀 충돌 확인).',
    input_schema: {
      type: 'object',
      properties: {
        employee_id: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        leave_type: { type: 'string', default: 'annual' },
      },
      required: ['employee_id', 'date'],
    },
  },
  submit_leave_request: {
    name: 'submit_leave_request',
    description: '휴가를 신청합니다. 반드시 직원의 확인을 받은 후에만 호출하세요.',
    input_schema: {
      type: 'object',
      properties: {
        employee_id: { type: 'string' },
        leave_type: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        days: { type: 'number' },
        reason: { type: 'string' },
      },
      required: ['employee_id', 'start_date', 'end_date', 'days'],
    },
  },
  search_policy: {
    name: 'search_policy',
    description: '연차 규정을 검색합니다.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  check_team_schedule: {
    name: 'check_team_schedule',
    description: '팀의 특정 날짜 일정을 확인합니다.',
    input_schema: {
      type: 'object',
      properties: {
        team_id: { type: 'string' },
        date: { type: 'string' },
      },
      required: ['team_id', 'date'],
    },
  },
  check_team_leaves: {
    name: 'check_team_leaves',
    description: '팀원 중 해당 날짜에 휴가인 사람을 확인합니다.',
    input_schema: {
      type: 'object',
      properties: {
        team_id: { type: 'string' },
        date: { type: 'string' },
      },
      required: ['team_id', 'date'],
    },
  },
  approve_request: {
    name: 'approve_request',
    description: '결재 요청을 승인합니다.',
    input_schema: {
      type: 'object',
      properties: {
        approval_id: { type: 'string' },
        comment: { type: 'string' },
      },
      required: ['approval_id'],
    },
  },
  reject_request: {
    name: 'reject_request',
    description: '결재 요청을 반려합니다.',
    input_schema: {
      type: 'object',
      properties: {
        approval_id: { type: 'string' },
        comment: { type: 'string' },
      },
      required: ['approval_id'],
    },
  },
  call_person: {
    name: 'call_person',
    description: '특정 사람을 메신저로 호출합니다.',
    input_schema: {
      type: 'object',
      properties: { callee_id: { type: 'string' } },
      required: ['callee_id'],
    },
  },
  query_employee_schedule: {
    name: 'query_employee_schedule',
    description: '직원의 일정을 조회합니다.',
    input_schema: {
      type: 'object',
      properties: { employee_id: { type: 'string' } },
      required: ['employee_id'],
    },
  },
  get_team_summary: {
    name: 'get_team_summary',
    description: '팀/부서 현황을 요약합니다.',
    input_schema: {
      type: 'object',
      properties: { team_id: { type: 'string' } },
      required: ['team_id'],
    },
  },
  delegate_to_agent: {
    name: 'delegate_to_agent',
    description: '다른 에이전트(직원 AI)에게 작업을 위임합니다. 해당 에이전트의 전문 영역에 맞는 요청을 전달하세요.',
    input_schema: {
      type: 'object',
      properties: {
        target_user_id: { type: 'string', description: '위임받을 직원 ID (예: EMP-HR-001)' },
        task_message: { type: 'string', description: '위임할 작업 내용' },
        context: { type: 'string', description: '작업 맥락 정보 (선택)' },
      },
      required: ['target_user_id', 'task_message'],
    },
  },
  invite_agent_to_channel: {
    name: 'invite_agent_to_channel',
    description: '특정 에이전트를 현재 채널에 초대하여 대화에 참여시킵니다.',
    input_schema: {
      type: 'object',
      properties: {
        target_user_id: { type: 'string', description: '초대할 직원 ID' },
        channel_id: { type: 'string', description: '초대할 채널 ID' },
        reason: { type: 'string', description: '초대 사유' },
      },
      required: ['target_user_id', 'channel_id'],
    },
  },
  broadcast_to_team: {
    name: 'broadcast_to_team',
    description: '팀 전체 에이전트에게 메시지를 전파합니다. 팀 공지나 전체 의견 수렴 시 사용합니다.',
    input_schema: {
      type: 'object',
      properties: {
        team_id: { type: 'string', description: '팀 ID (예: TEAM-DEV)' },
        message: { type: 'string', description: '전파할 메시지' },
      },
      required: ['team_id', 'message'],
    },
  },
};

// Tools available per role
const ROLE_TOOLS: Record<string, string[]> = {
  router: ['analyze_intent', 'delegate_to_agent'],
  work_assistant: ['query_leave_balance', 'validate_date', 'submit_leave_request', 'search_policy', 'delegate_to_agent'],
  approver: ['check_team_schedule', 'check_team_leaves', 'approve_request', 'reject_request', 'delegate_to_agent'],
  secretary: ['query_employee_schedule', 'call_person', 'get_team_summary', 'delegate_to_agent', 'invite_agent_to_channel', 'broadcast_to_team'],
  team_assistant: ['check_team_schedule', 'get_team_summary', 'delegate_to_agent', 'broadcast_to_team'],
};

export function getToolDefinitions(role: string, customTools?: string[]): LLMToolDefinition[] {
  const toolNames = customTools?.length ? customTools : ROLE_TOOLS[role] || [];
  return toolNames.map((name) => ALL_TOOLS[name]).filter(Boolean);
}

export { ALL_TOOLS };
