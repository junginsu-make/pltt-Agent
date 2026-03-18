// NOTE: requires `bcryptjs` as a dependency — run: pnpm add bcryptjs @types/bcryptjs

import { hashSync } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './index';
import {
  teams,
  employees,
  userLlmConfigs,
  leavePolicies,
  leaveBalances,
  holidays,
  channels,
} from './schema/index';

const PASSWORD_HASH = hashSync('password123', 10);

async function main() {
  // ── Teams ──────────────────────────────────────────────────────────
  await db.insert(teams).values([
    { id: 'TEAM-EXEC', name: '경영진' },
    { id: 'TEAM-MGMT', name: '경영지원팀' },
    { id: 'TEAM-DEV', name: '개발팀' },
  ]);
  console.log('Seeded: teams');

  // ── Employees ──────────────────────────────────────────────────────
  await db.insert(employees).values([
    {
      id: 'EMP-CEO',
      name: '대표',
      email: 'ceo@palette.ai',
      passwordHash: PASSWORD_HASH,
      teamId: 'TEAM-EXEC',
      position: '대표이사',
      grade: '대표',
      managerId: null,
      hireDate: '2023-01-01',
    },
    {
      id: 'EMP-MGMT-LEADER',
      name: '경영지원팀장',
      email: 'mgmt.leader@palette.ai',
      passwordHash: PASSWORD_HASH,
      teamId: 'TEAM-MGMT',
      position: '경영지원팀장',
      grade: '팀장',
      managerId: 'EMP-CEO',
      hireDate: '2023-03-01',
    },
    {
      id: 'EMP-HR-001',
      name: '휴가 담당자',
      email: 'hr@palette.ai',
      passwordHash: PASSWORD_HASH,
      teamId: 'TEAM-MGMT',
      position: '인사담당',
      grade: '대리',
      managerId: 'EMP-MGMT-LEADER',
      hireDate: '2023-06-01',
    },
    {
      id: 'EMP-DEV-LEADER',
      name: '김민준',
      email: 'minjun@palette.ai',
      passwordHash: PASSWORD_HASH,
      teamId: 'TEAM-DEV',
      position: '개발팀장',
      grade: '팀장',
      managerId: 'EMP-CEO',
      hireDate: '2023-01-15',
    },
    {
      id: 'EMP-001',
      name: '정인수',
      email: 'jinsu@palette.ai',
      passwordHash: PASSWORD_HASH,
      teamId: 'TEAM-DEV',
      position: '프론트엔드 개발자',
      grade: '사원',
      managerId: 'EMP-DEV-LEADER',
      hireDate: '2024-03-01',
    },
  ]);
  console.log('Seeded: employees');

  // ── Update team leaders ────────────────────────────────────────────
  await db.update(teams).set({ leaderId: 'EMP-CEO' }).where(eq(teams.id, 'TEAM-EXEC'));
  await db.update(teams).set({ leaderId: 'EMP-MGMT-LEADER' }).where(eq(teams.id, 'TEAM-MGMT'));
  await db.update(teams).set({ leaderId: 'EMP-DEV-LEADER' }).where(eq(teams.id, 'TEAM-DEV'));
  console.log('Updated: team leaders');

  // ── Leave Policy ───────────────────────────────────────────────────
  await db.insert(leavePolicies).values({
    id: 'LP-DEFAULT',
    name: '기본 연차 정책',
    rules: {
      first_year: {
        type: 'monthly_accrual',
        condition: 'full_month_worked',
        days_per_month: 1,
        max_days: 11,
      },
      after_one_year: {
        type: 'annual_grant',
        min_attendance_rate: 0.8,
        base_days: 15,
      },
      seniority_bonus: {
        start_after_years: 3,
        bonus_days: 1,
        every_years: 2,
        max_total_days: 25,
      },
      expiry: {
        duration_months: 12,
        allow_carryover: false,
      },
    },
    leaveTypes: [
      { code: 'annual', name: '연차', deducts_balance: true, needs_approval: true },
      { code: 'half_am', name: '오전 반차', deducts_balance: true, deduction: 0.5, needs_approval: true },
      { code: 'half_pm', name: '오후 반차', deducts_balance: true, deduction: 0.5, needs_approval: true },
      { code: 'sick', name: '병가', deducts_balance: false, needs_approval: true },
      { code: 'special', name: '특별휴가', deducts_balance: false, needs_approval: true },
    ],
  });
  console.log('Seeded: leave_policies');

  // ── Leave Balances ─────────────────────────────────────────────────
  // NOTE: remainingDays is a GENERATED column — do not set it.
  //       pendingDays defaults to '0'.
  await db.insert(leaveBalances).values([
    {
      employeeId: 'EMP-001',
      year: 2026,
      leaveType: 'annual',
      totalDays: '15',
      usedDays: '1',
      expiresAt: '2027-03-01',
    },
    {
      employeeId: 'EMP-CEO',
      year: 2026,
      leaveType: 'annual',
      totalDays: '15',
      usedDays: '0',
      expiresAt: '2027-01-01',
    },
    {
      employeeId: 'EMP-MGMT-LEADER',
      year: 2026,
      leaveType: 'annual',
      totalDays: '17',
      usedDays: '2',
      expiresAt: '2027-03-01',
    },
    {
      employeeId: 'EMP-HR-001',
      year: 2026,
      leaveType: 'annual',
      totalDays: '16',
      usedDays: '1',
      expiresAt: '2027-06-01',
    },
    {
      employeeId: 'EMP-DEV-LEADER',
      year: 2026,
      leaveType: 'annual',
      totalDays: '17',
      usedDays: '3',
      expiresAt: '2027-01-15',
    },
  ]);
  console.log('Seeded: leave_balances');

  // ── 2026 Korean Holidays ──────────────────────────────────────────
  await db.insert(holidays).values([
    { date: '2026-01-01', name: '신정', year: 2026 },
    { date: '2026-02-16', name: '설날 전날', year: 2026 },
    { date: '2026-02-17', name: '설날', year: 2026 },
    { date: '2026-02-18', name: '설날 다음날', year: 2026 },
    { date: '2026-03-01', name: '삼일절', year: 2026 },
    { date: '2026-05-05', name: '어린이날', year: 2026 },
    { date: '2026-05-24', name: '부처님오신날', year: 2026 },
    { date: '2026-06-06', name: '현충일', year: 2026 },
    { date: '2026-08-15', name: '광복절', year: 2026 },
    { date: '2026-09-24', name: '추석 전날', year: 2026 },
    { date: '2026-09-25', name: '추석', year: 2026 },
    { date: '2026-09-26', name: '추석 다음날', year: 2026 },
    { date: '2026-10-03', name: '개천절', year: 2026 },
    { date: '2026-10-09', name: '한글날', year: 2026 },
    { date: '2026-12-25', name: '크리스마스', year: 2026 },
  ]);
  console.log('Seeded: holidays');

  // ── User LLM Configs ──────────────────────────────────────────────
  await db.insert(userLlmConfigs).values([
    {
      userId: 'EMP-001',
      llmRole: 'router',
      systemPrompt: `당신은 직원 정인수(EMP-001)의 AI 비서입니다. 사용자의 메시지 의도를 분석하여 적절한 전문 에이전트에게 위임하세요.

[위임 규칙]
- 휴가 조회/신청/취소 → delegate_to_agent(EMP-HR-001) 휴가 담당자 AI
- 결재 관련 → delegate_to_agent(EMP-DEV-LEADER) 개발팀장 결재 AI
- 일정/호출/전사 현황 → delegate_to_agent(EMP-CEO) 대표 비서 AI
- 팀 현황 → delegate_to_agent(EMP-MGMT-LEADER) 경영지원팀장 AI
- 일상 대화 → 직접 응답

항상 analyze_intent로 의도를 먼저 파악한 후 적절한 에이전트에게 위임하세요.
친근하고 자연스러운 말투(~해드릴게요)를 사용하세요.`,
      tools: ['analyze_intent', 'delegate_to_agent'],
      workDomains: [],
    },
    {
      userId: 'EMP-DEV-LEADER',
      llmRole: 'approver',
      systemPrompt: `당신은 개발팀장 김민준(EMP-DEV-LEADER)의 결재 전문 AI입니다.

[역할]
- 팀 일정 확인 후 휴가 승인/반려 결재 처리
- check_team_schedule로 팀 일정 확인
- approve_request / reject_request로 결재 처리

[위임 규칙]
- 휴가 잔여일 조회가 필요하면 → delegate_to_agent(EMP-HR-001) 휴가 담당자에게 위임
- 전사 현황이 필요하면 → delegate_to_agent(EMP-CEO) 대표 비서에게 위임

공정하고 신중하게 판단하되, 친근한 말투를 유지하세요.`,
      tools: ['check_team_schedule', 'check_team_leaves', 'approve_request', 'reject_request', 'delegate_to_agent'],
      workDomains: [],
    },
    {
      userId: 'EMP-HR-001',
      llmRole: 'work_assistant',
      systemPrompt: `당신은 휴가 담당자(EMP-HR-001)의 휴가 전문 AI입니다.

[역할]
- 연차 잔여일 조회 (query_leave_balance)
- 휴가 날짜 검증 (validate_date)
- 휴가 신청 처리 (submit_leave_request)
- 연차 규정 안내 (search_policy)

[필수 규칙]
1. 연차 잔여일 조회 요청 시: 즉시 query_leave_balance를 호출하세요. 직원 ID를 묻지 마세요 (컨텍스트에서 자동 제공됨).
2. 휴가 신청 요청 시 아래 순서를 반드시 따르세요:
   a) 날짜 확인: validate_date로 날짜 유효성을 검증합니다
   b) 사유 확인: "사유(이유)를 알려주세요"라고 물어봅니다. 반드시 "이유"라는 단어를 포함하세요.
   c) 신청 처리: 사유를 받으면 submit_leave_request로 휴가를 신청합니다
   d) 결과 안내: 신청 결과를 안내합니다
3. 휴가 신청 시 days 계산: 시작일과 종료일이 같으면 1일, 다르면 주말/공휴일을 제외한 영업일 수를 계산하세요.

[위임 규칙]
- 결재 승인/반려가 필요하면 → delegate_to_agent(EMP-DEV-LEADER) 결재 담당에게 위임
- 전사 일정 확인이 필요하면 → delegate_to_agent(EMP-CEO) 대표 비서에게 위임

친근하고 정확하게 안내해주세요.`,
      tools: ['query_leave_balance', 'validate_date', 'submit_leave_request', 'search_policy', 'delegate_to_agent'],
      workDomains: ['leave'],
    },
    {
      userId: 'EMP-MGMT-LEADER',
      llmRole: 'team_assistant',
      systemPrompt: `당신은 경영지원팀장(EMP-MGMT-LEADER)의 팀 관리 AI입니다.

[역할]
- 팀 현황 요약 (get_team_summary)
- 팀 일정 확인 (check_team_schedule)

[위임 규칙]
- 휴가 관련 문의 → delegate_to_agent(EMP-HR-001) 휴가 담당자에게 위임
- 팀 전체 공지가 필요하면 → broadcast_to_team으로 팀원 전체에게 전파
- 결재 관련 → delegate_to_agent(EMP-DEV-LEADER) 결재 담당에게 위임

팀 관리에 필요한 정보를 정확하게 제공하세요.`,
      tools: ['check_team_schedule', 'get_team_summary', 'delegate_to_agent', 'broadcast_to_team'],
      workDomains: [],
    },
    {
      userId: 'EMP-CEO',
      llmRole: 'secretary',
      systemPrompt: `당신은 대표(EMP-CEO)의 비서 AI입니다. 메인 에이전트로서 모든 하위 에이전트를 조율할 수 있습니다.

[역할]
- 직원 일정 조회 (query_employee_schedule)
- 사람 호출 (call_person)
- 팀 현황 요약 (get_team_summary)
- 다른 에이전트 채널 초대 (invite_agent_to_channel)
- 팀 전체 브로드캐스트 (broadcast_to_team)

[위임 규칙]
- 휴가 관련 업무 → delegate_to_agent(EMP-HR-001) 휴가 담당자에게 위임
- 결재 관련 → delegate_to_agent(EMP-DEV-LEADER) 결재 담당에게 위임
- 경영지원 현황 → delegate_to_agent(EMP-MGMT-LEADER) 경영지원팀장에게 위임
- 전사 공지 → broadcast_to_team으로 팀별 전파
- 특정 전문가가 필요하면 → invite_agent_to_channel로 채널에 초대

대표의 비서답게 격식있으면서도 효율적으로 응대하세요.`,
      tools: ['query_employee_schedule', 'call_person', 'get_team_summary', 'delegate_to_agent', 'invite_agent_to_channel', 'broadcast_to_team'],
      workDomains: [],
    },
  ]);
  console.log('Seeded: user_llm_configs');

  // ── Channels ──────────────────────────────────────────────────────
  const allEmployeeIds = [
    'EMP-CEO',
    'EMP-MGMT-LEADER',
    'EMP-HR-001',
    'EMP-DEV-LEADER',
    'EMP-001',
  ];

  await db.insert(channels).values([
    // Company-wide announcement channel
    {
      id: 'ch-company-001',
      type: 'company',
      name: '전사 공지',
      participants: allEmployeeIds,
    },
    // Team channels
    {
      id: 'ch-team-mgmt',
      type: 'team',
      name: '경영지원팀',
      participants: ['EMP-MGMT-LEADER', 'EMP-HR-001'],
    },
    {
      id: 'ch-team-dev',
      type: 'team',
      name: '개발팀',
      participants: ['EMP-DEV-LEADER', 'EMP-001'],
    },
    // Work channels (AI-connected, one per employee for AI interactions)
    {
      id: 'ch-work-EMP-001',
      type: 'work',
      name: '정인수 업무',
      participants: ['EMP-001'],
      assignedLlm: 'palette-ai',
    },
    {
      id: 'ch-work-EMP-CEO',
      type: 'work',
      name: '대표 업무',
      participants: ['EMP-CEO'],
      assignedLlm: 'palette-ai',
    },
    {
      id: 'ch-work-EMP-HR-001',
      type: 'work',
      name: '휴가 담당자 업무',
      participants: ['EMP-HR-001'],
      assignedLlm: 'palette-ai',
    },
    // Notification channels (one per employee)
    {
      id: 'ch-notification-EMP-CEO',
      type: 'notification',
      name: '대표 알림',
      participants: ['EMP-CEO'],
    },
    {
      id: 'ch-notification-EMP-MGMT-LEADER',
      type: 'notification',
      name: '경영지원팀장 알림',
      participants: ['EMP-MGMT-LEADER'],
    },
    {
      id: 'ch-notification-EMP-HR-001',
      type: 'notification',
      name: '휴가 담당자 알림',
      participants: ['EMP-HR-001'],
    },
    {
      id: 'ch-notification-EMP-DEV-LEADER',
      type: 'notification',
      name: '김민준 알림',
      participants: ['EMP-DEV-LEADER'],
    },
    {
      id: 'ch-notification-EMP-001',
      type: 'notification',
      name: '정인수 알림',
      participants: ['EMP-001'],
    },
  ]);
  console.log('Seeded: channels');

  console.log('\nSeed completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
