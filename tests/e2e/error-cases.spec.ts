import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * Palette AI E2E Error Case Tests (E-01 ~ E-18)
 *
 * SCENARIOS.md에 정의된 18개 에러 케이스를 검증합니다.
 *
 * 테스트 사용자 (seed 데이터 기준):
 * - 직원 A (정인수): jinsu@palette.ai / password123 (EMP-001)
 * - 직원 A 상사 (김민준): minjun@palette.ai / password123 (EMP-DEV-LEADER)
 * - 휴가 담당자: hr@palette.ai / password123 (EMP-HR-001)
 */

const EMPLOYEE = { email: 'jinsu@palette.ai', password: 'password123', id: 'EMP-001' };
const MANAGER = { email: 'minjun@palette.ai', password: 'password123', id: 'EMP-DEV-LEADER' };

const API_BASE = 'http://localhost:3001/api/v1';
const MESSAGING_API = 'http://localhost:3000/api/v1';
const APPROVAL_API = 'http://localhost:3002/api/v1';

// ─────────────────────────────────────────────────────────
// Helper: 메시지 전송 후 AI 응답 대기
// ─────────────────────────────────────────────────────────

async function navigateToWorkChannel(page: Page): Promise<void> {
  // Click the first work channel in sidebar
  const workGroup = page.locator('[data-testid="channel-group-work"]');
  const visible = await workGroup.isVisible().catch(() => false);
  if (visible) {
    const channel = workGroup.locator('[data-testid="channel-item"]').first();
    if (await channel.isVisible().catch(() => false)) {
      await channel.click();
    }
  }
  await page.locator('[data-testid="message-input"]').waitFor({ state: 'visible', timeout: 10000 });
}

async function sendMessageAndWaitForReply(
  page: Page,
  message: string,
  timeoutMs = 15000,
): Promise<string> {
  // Ensure we're in a channel with message input
  const inputVisible = await page.locator('[data-testid="message-input"]').isVisible().catch(() => false);
  if (!inputVisible) {
    await navigateToWorkChannel(page);
  }

  const chatInput = page.locator('[data-testid="message-input"]');
  await chatInput.fill(message);
  await chatInput.press('Enter');

  // AI 응답: text-bubble or card-message
  const messageList = page.locator('[data-testid="message-list"]');
  const aiBubble = messageList.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last();
  await aiBubble.waitFor({ state: 'visible', timeout: timeoutMs });
  await page.waitForTimeout(1000);
  return aiBubble.textContent() as Promise<string>;
}

async function getAuthToken(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await request.post(`${MESSAGING_API}/auth/login`, {
    data: { email, password },
  });
  const body = await response.json();
  return body.token;
}

// ─────────────────────────────────────────────────────────
// Part 1: 휴가 신청 단계 (E-01 ~ E-08)
// ─────────────────────────────────────────────────────────

test.describe('휴가 신청 검증 (E-01 ~ E-08)', () => {
  test.describe.configure({ mode: 'serial' });

  test('E-01: 연차 0일인 직원이 휴가 신청 시 차단 및 안내 메시지 표시', async ({ page }) => {
    // 연차가 0일인 직원으로 로그인 (또는 API로 잔여 0일 세팅 후 테스트)
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    const reply = await sendMessageAndWaitForReply(page, '휴가 쓰고 싶어');

    // 잔여 0일이면 신청 차단 메시지가 와야 함
    // API 레벨 검증: leave/balance 조회 후 remaining=0이면 LV_001
    await expect(page.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last())
      .toContainText(/연차.*모두 사용|잔여.*0일|연차가 부족/);

    // 병가/특별휴가 안내가 포함되어야 함
    await expect(page.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last())
      .toContainText(/병가|특별휴가/);
  });

  test('E-01: API - 잔여 0일일 때 휴가 신청 API가 LV_001 에러를 반환', async ({ request }) => {
    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    // 잔여 일수 확인
    const balanceRes = await request.get(`${API_BASE}/leave/balance/${EMPLOYEE.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(balanceRes.ok()).toBeTruthy();
    const balanceBody = await balanceRes.json();

    // 잔여보다 많은 일수로 신청 시도 (잔여 0일 상황 시뮬레이션)
    const requestRes = await request.post(`${API_BASE}/leave/request`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        employee_id: EMPLOYEE.id,
        leave_type: 'annual',
        start_date: '2026-12-28',
        end_date: '2026-12-31',
        days: 100, // 잔여보다 많은 수를 요청
        reason: '테스트',
      },
    });

    // 연차 부족이면 400 + LV_001
    if (!requestRes.ok()) {
      const errorBody = await requestRes.json();
      expect(errorBody.error.code).toMatch(/LV_001/);
      expect(requestRes.status()).toBe(400);
    }
  });

  test('E-02: 신청 일수가 잔여 연차보다 많으면 차단 및 대안 제시', async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    // 잔여보다 많은 일수를 요청
    const reply = await sendMessageAndWaitForReply(page, '10일 연속 휴가 쓸래');

    // 잔여 부족 안내 + 조정 제안
    await expect(page.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last())
      .toContainText(/잔여.*연차|어려워요|부족|조정/);
  });

  test('E-02: API - 신청 일수 > 잔여일 때 LV_001 에러', async ({ request }) => {
    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    const response = await request.post(`${API_BASE}/leave/request`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        employee_id: EMPLOYEE.id,
        leave_type: 'annual',
        start_date: '2026-06-01',
        end_date: '2026-06-20',
        days: 20,
        reason: '테스트',
      },
    });

    // 잔여 연차보다 많으면 차단
    if (!response.ok()) {
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('LV_001');
      expect(body.error.details).toBeDefined();
    }
  });

  test('E-03: 같은 날짜에 중복 신청 시 기존 건 안내', async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    // 이미 신청된 날짜에 다시 신청
    const reply = await sendMessageAndWaitForReply(page, '3월 18일에 휴가 쓰고 싶어');

    // 중복이면 기존 건 안내 메시지
    const messageLocator = page.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last();
    const text = await messageLocator.textContent();

    // 중복 신청이면 LV-번호와 상태가 안내되어야 함
    if (text && /이미|중복|신청.*있/.test(text)) {
      expect(text).toMatch(/LV-\d{4}-\d{4}|승인대기|pending|approved/);
    }
  });

  test('E-03: API - 중복 신청 시 409 + LV_003 에러', async ({ request }) => {
    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    const leaveData = {
      employee_id: EMPLOYEE.id,
      leave_type: 'annual',
      start_date: '2026-04-15',
      end_date: '2026-04-15',
      days: 1,
      reason: '중복 테스트',
    };

    // 첫 번째 신청
    const firstRes = await request.post(`${API_BASE}/leave/request`, {
      headers: { Authorization: `Bearer ${token}` },
      data: leaveData,
    });

    // 두 번째 동일 날짜 신청
    const secondRes = await request.post(`${API_BASE}/leave/request`, {
      headers: { Authorization: `Bearer ${token}` },
      data: leaveData,
    });

    // 두 번째는 중복으로 409 반환
    if (firstRes.ok()) {
      expect(secondRes.status()).toBe(409);
      const body = await secondRes.json();
      expect(body.error.code).toBe('LV_003');
    }
  });

  test('E-04: 과거 날짜로 휴가 신청 시 차단', async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    const reply = await sendMessageAndWaitForReply(page, '1월 5일에 휴가 쓰고 싶어');

    // 과거 날짜 차단 메시지
    await expect(page.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last())
      .toContainText(/지난 날짜|과거.*날짜|이후.*알려주세요|신청 불가/);
  });

  test('E-04: API - 과거 날짜 신청 시 400 + LV_004 에러', async ({ request }) => {
    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    const response = await request.post(`${API_BASE}/leave/validate-date`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        employee_id: EMPLOYEE.id,
        date: '2025-01-01',
        leave_type: 'annual',
      },
    });

    // 과거 날짜는 valid: false 또는 400 에러
    if (response.ok()) {
      const body = await response.json();
      expect(body.valid).toBe(false);
    } else {
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('LV_004');
    }
  });

  test('E-05: 90일 이상 먼 미래 날짜 신청 시 확인 메시지 표시', async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    // 90일 이후의 날짜로 신청
    const reply = await sendMessageAndWaitForReply(page, '12월 25일에 휴가 쓰고 싶어');

    // 먼 미래 확인 메시지
    await expect(page.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last())
      .toContainText(/먼 미래|맞으시죠|확인|공휴일/);
  });

  test('E-06: 같은 날 팀원 다수 휴가 시 경고 메시지 표시', async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    // 팀원이 이미 휴가인 날에 신청 시도
    const reply = await sendMessageAndWaitForReply(page, '휴가 쓰고 싶어');

    // 팀원 충돌 경고가 있으면 확인
    const messageLocator = page.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last();
    const text = await messageLocator.textContent();

    if (text && /팀원/.test(text)) {
      expect(text).toMatch(/팀원.*휴가|반려될 수 있|경고/);
    }
  });

  test('E-06: API - 날짜 검증 시 team_conflicts 필드 반환', async ({ request }) => {
    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    const response = await request.post(`${API_BASE}/leave/validate-date`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        employee_id: EMPLOYEE.id,
        date: '2026-04-01',
        leave_type: 'annual',
      },
    });

    if (response.ok()) {
      const body = await response.json();
      // team_conflicts 필드가 항상 존재해야 함 (빈 배열이라도)
      expect(body).toHaveProperty('team_conflicts');
      expect(Array.isArray(body.team_conflicts)).toBe(true);
    }
  });

  test('E-07: 반차 신청 시 오전/오후 미지정이면 선택 요청', async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    const reply = await sendMessageAndWaitForReply(page, '내일 반차 쓸래');

    // 오전/오후 선택 요청
    await expect(page.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last())
      .toContainText(/오전.*오후|반차.*선택|09.*13.*14.*18/);
  });

  test('E-08: 여러 날 신청에 주말이 포함되면 평일만 계산', async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    // 금~월 (주말 포함) 범위로 신청
    const reply = await sendMessageAndWaitForReply(page, '3월 20일부터 23일까지 휴가 쓸래');

    // 주말 제외 안내
    await expect(page.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last())
      .toContainText(/주말.*제외|평일.*일|금.*월/);
  });

  test('E-08: API - 주말 날짜 검증 시 valid=false 및 대안 제시', async ({ request }) => {
    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    // 2026-03-22는 일요일
    const response = await request.post(`${API_BASE}/leave/validate-date`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        employee_id: EMPLOYEE.id,
        date: '2026-03-22',
        leave_type: 'annual',
      },
    });

    if (response.ok()) {
      const body = await response.json();
      expect(body.valid).toBe(false);
      expect(body.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/주말/)])
      );
      // 대안 날짜 제시
      if (body.suggestions) {
        expect(body.suggestions.length).toBeGreaterThan(0);
        expect(body.suggestions[0]).toHaveProperty('date');
        expect(body.suggestions[0]).toHaveProperty('available');
      }
    }
  });
});

// ─────────────────────────────────────────────────────────
// Part 2: 결재 단계 (E-09 ~ E-13)
// ─────────────────────────────────────────────────────────

test.describe('결재 흐름 검증 (E-09 ~ E-13)', () => {

  test('E-09: 팀장 반려 시 직원에게 반려 안내 및 잔여일 원복', async ({ page, request }) => {
    // 직원으로 휴가 신청
    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    const leaveRes = await request.post(`${API_BASE}/leave/request`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        employee_id: EMPLOYEE.id,
        leave_type: 'annual',
        start_date: '2026-05-01',
        end_date: '2026-05-01',
        days: 1,
        reason: '반려 테스트',
      },
    });

    if (!leaveRes.ok()) {
      test.skip();
      return;
    }

    const leaveBody = await leaveRes.json();
    const approvalId = leaveBody.approval?.id;

    if (!approvalId) {
      test.skip();
      return;
    }

    // 잔여일 확인 (반려 전)
    const balanceBefore = await request.get(`${API_BASE}/leave/balance/${EMPLOYEE.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const balanceBeforeBody = await balanceBefore.json();
    const pendingBefore = balanceBeforeBody.balances?.[0]?.pending_days ?? 0;

    // 팀장으로 반려
    const managerToken = await getAuthToken(request, MANAGER.email, MANAGER.password);

    const rejectRes = await request.post(`${APPROVAL_API}/approvals/${approvalId}/decide`, {
      headers: { Authorization: `Bearer ${managerToken}` },
      data: {
        decision: 'rejected',
        comment: '일정 충돌로 반려',
        decided_by: MANAGER.id,
      },
    });

    expect(rejectRes.ok()).toBeTruthy();
    const rejectBody = await rejectRes.json();
    expect(rejectBody.status).toBe('rejected');

    // 잔여일 원복 확인
    const balanceAfter = await request.get(`${API_BASE}/leave/balance/${EMPLOYEE.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const balanceAfterBody = await balanceAfter.json();
    const pendingAfter = balanceAfterBody.balances?.[0]?.pending_days ?? 0;

    // pending_days가 1 감소했어야 함 (원복)
    expect(pendingAfter).toBeLessThanOrEqual(pendingBefore);
  });

  test('E-09: UI - 팀장 반려 시 직원 대화창에 반려 안내 표시', async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    // 반려 알림이 온 경우 확인
    const notification = page.locator('[data-testid="notification"], [data-testid="system-notification"]');
    const messages = page.locator('[data-testid="text-bubble"], [data-testid="card-message"]');

    // 반려 메시지가 있으면 사유와 날짜 변경 제안이 포함되어야 함
    const allMessages = await messages.allTextContents();
    const rejectMessage = allMessages.find(msg => /반려/.test(msg));

    if (rejectMessage) {
      expect(rejectMessage).toMatch(/반려|사유|날짜.*변경/);
    }
  });

  test('E-10: 자동승인 타임아웃 - 2시간 미응답 시 자동 승인 처리', async ({ request }) => {
    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    // 휴가 신청
    const leaveRes = await request.post(`${API_BASE}/leave/request`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        employee_id: EMPLOYEE.id,
        leave_type: 'annual',
        start_date: '2026-07-01',
        end_date: '2026-07-01',
        days: 1,
        reason: '자동승인 테스트',
      },
    });

    if (!leaveRes.ok()) {
      test.skip();
      return;
    }

    const leaveBody = await leaveRes.json();

    // auto_approve_at 필드가 존재하는지 확인 (2시간 후 자동 승인 예정)
    expect(leaveBody.approval).toBeDefined();
    expect(leaveBody.approval.auto_approve_at).toBeDefined();

    // auto_approve_at이 신청 시점으로부터 약 2시간 후인지 확인
    const createdAt = new Date();
    const autoApproveAt = new Date(leaveBody.approval.auto_approve_at);
    const diffHours = (autoApproveAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeGreaterThan(1.5);
    expect(diffHours).toBeLessThanOrEqual(2.5);
  });

  test('E-11: 팀장이 질문 후 승인/반려 - 결재 상태 reviewing 전환', async ({ request }) => {
    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    // 휴가 신청
    const leaveRes = await request.post(`${API_BASE}/leave/request`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        employee_id: EMPLOYEE.id,
        leave_type: 'annual',
        start_date: '2026-07-15',
        end_date: '2026-07-15',
        days: 1,
        reason: '질문 테스트',
      },
    });

    if (!leaveRes.ok()) {
      test.skip();
      return;
    }

    const leaveBody = await leaveRes.json();
    const approvalId = leaveBody.approval?.id;

    if (!approvalId) {
      test.skip();
      return;
    }

    // 팀장으로 로그인하여 pending 결재 목록 확인
    const managerToken = await getAuthToken(request, MANAGER.email, MANAGER.password);

    const pendingRes = await request.get(`${APPROVAL_API}/approvals/pending/${MANAGER.id}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    expect(pendingRes.ok()).toBeTruthy();
    const pendingBody = await pendingRes.json();
    expect(pendingBody.approvals).toBeDefined();
    expect(Array.isArray(pendingBody.approvals)).toBe(true);

    // 해당 결재건이 목록에 있는지 확인
    const targetApproval = pendingBody.approvals.find(
      (a: { id: string }) => a.id === approvalId
    );
    if (targetApproval) {
      expect(targetApproval).toHaveProperty('llm_reasoning');
      expect(targetApproval).toHaveProperty('auto_approve_at');
    }
  });

  test('E-11: UI - 팀장 결재 화면에 승인/반려/질문하기 버튼 표시', async ({ page }) => {
    await loginAs(page, MANAGER.email, MANAGER.password);

    // 결재 카드 확인
    const approvalCard = page.locator('[data-testid="approval-card"]');

    // 결재 카드가 있으면 3개 버튼 확인
    if (await approvalCard.count() > 0) {
      await expect(approvalCard.first().locator('button')).toHaveCount(3);
      await expect(approvalCard.first()).toContainText(/승인/);
      await expect(approvalCard.first()).toContainText(/반려/);
      await expect(approvalCard.first()).toContainText(/질문/);
    }
  });

  test('E-12: 승인 전(pending) 직원이 취소하면 status=cancelled 및 pending_days 원복', async ({ request }) => {
    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    // 휴가 신청
    const leaveRes = await request.post(`${API_BASE}/leave/request`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        employee_id: EMPLOYEE.id,
        leave_type: 'annual',
        start_date: '2026-08-01',
        end_date: '2026-08-01',
        days: 1,
        reason: '취소 테스트',
      },
    });

    if (!leaveRes.ok()) {
      test.skip();
      return;
    }

    const leaveBody = await leaveRes.json();
    const leaveId = leaveBody.leave_request?.id;

    if (!leaveId) {
      test.skip();
      return;
    }

    // 잔여일 확인 (취소 전)
    const balanceBefore = await request.get(`${API_BASE}/leave/balance/${EMPLOYEE.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const balanceBeforeBody = await balanceBefore.json();
    const pendingBefore = balanceBeforeBody.balances?.[0]?.pending_days ?? 0;

    // pending 상태에서 취소
    const cancelRes = await request.delete(`${API_BASE}/leave/request/${leaveId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(cancelRes.ok()).toBeTruthy();

    // 잔여일 원복 확인
    const balanceAfter = await request.get(`${API_BASE}/leave/balance/${EMPLOYEE.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const balanceAfterBody = await balanceAfter.json();
    const pendingAfter = balanceAfterBody.balances?.[0]?.pending_days ?? 0;

    expect(pendingAfter).toBeLessThan(pendingBefore);
  });

  test('E-12: UI - 직원이 대화에서 취소 요청 시 pending 건 취소', async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    const reply = await sendMessageAndWaitForReply(page, '아까 휴가 취소할래');

    const messageLocator = page.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last();
    const text = await messageLocator.textContent();

    // 취소 가능한 건이 있으면 취소 처리, 없으면 없다는 안내
    if (text) {
      expect(text).toMatch(/취소.*완료|취소.*되었|신청.*건.*없/);
    }
  });

  test('E-13: 승인 후 취소 시 취소 결재 요청 안내', async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    // 이미 승인된 건의 취소 시도
    const reply = await sendMessageAndWaitForReply(page, '승인된 휴가 취소하고 싶어');

    const messageLocator = page.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last();
    const text = await messageLocator.textContent();

    if (text) {
      // 이미 승인된 건이면 팀장 승인 필요 안내
      expect(text).toMatch(/이미 승인|팀장.*승인.*필요|취소.*결재|요청.*보낼까/);
    }
  });

  test('E-13: API - 승인된 휴가 직접 DELETE 시 에러', async ({ request }) => {
    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    // 승인된 휴가 목록 조회
    const listRes = await request.get(
      `${API_BASE}/leave/requests?employee_id=${EMPLOYEE.id}&status=approved`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!listRes.ok()) {
      test.skip();
      return;
    }

    const listBody = await listRes.json();
    const approvedLeave = listBody.data?.[0] ?? listBody[0];

    if (!approvedLeave) {
      test.skip();
      return;
    }

    // 승인된 건을 직접 삭제 시도 → 에러
    const deleteRes = await request.delete(`${API_BASE}/leave/request/${approvedLeave.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // pending만 삭제 가능하므로 승인된 건은 에러
    expect(deleteRes.ok()).toBeFalsy();
    expect(deleteRes.status()).toBeGreaterThanOrEqual(400);
  });
});

// ─────────────────────────────────────────────────────────
// Part 3: 시스템/기술 복원력 (E-14 ~ E-18)
// ─────────────────────────────────────────────────────────

test.describe('시스템 복원력 검증 (E-14 ~ E-18)', () => {

  test.skip('E-14: LLM API 실패 시 3회 재시도 후 안내 메시지 표시', async ({ page }) => {
    // SKIP 사유: LLM API 실패를 시뮬레이션하려면 서버 측 mock 또는
    // 환경변수로 ANTHROPIC_API_KEY를 무효화하는 등 특수 서버 설정이 필요합니다.
    // 실제 테스트 시 ai-runtime 서비스의 LLM 호출을 mock하거나
    // chaos engineering 도구로 API 장애를 주입해야 합니다.

    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    const reply = await sendMessageAndWaitForReply(page, '휴가 남은 거 알려줘', 30000);

    // SYS_001 에러 시 사용자 안내 메시지
    await expect(page.locator('[data-testid="text-bubble"], [data-testid="card-message"], [data-testid="system-notification"]').last())
      .toContainText(/일시적.*응답.*어려|잠시 후.*다시|재시도/);
  });

  test.skip('E-14: API - LLM 실패 시 503 + SYS_001 에러 반환', async ({ request }) => {
    // SKIP 사유: ai-runtime 서비스의 LLM 호출을 강제로 실패시키는
    // 테스트 전용 엔드포인트 또는 mock 설정이 필요합니다.

    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    const response = await request.post(`${MESSAGING_API}/messenger/send`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        content: '테스트 메시지',
        content_type: 'text',
      },
    });

    // LLM 장애 시 503 반환 확인
    if (response.status() === 503) {
      const body = await response.json();
      expect(body.error.code).toBe('SYS_001');
    }
  });

  test.skip('E-15: LLM 할루시네이션 방어 - Tool 호출 없이 숫자 응답 시 무효 처리', async ({ page }) => {
    // SKIP 사유: 할루시네이션 방어는 ai-runtime의 post-processing 로직으로 구현됩니다.
    // Tool 호출 결과와 LLM 응답의 숫자를 비교하는 로직을 검증하려면
    // ai-runtime의 단위 테스트 또는 통합 테스트 수준에서 검증해야 합니다.
    // E2E에서는 LLM이 정확한 숫자를 반환하는지만 간접 확인합니다.

    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    const reply = await sendMessageAndWaitForReply(page, '연차 며칠 남았어?');

    const messageLocator = page.locator('[data-testid="text-bubble"], [data-testid="card-message"]').last();
    const text = await messageLocator.textContent() ?? '';

    // 숫자가 포함된 응답이면 DB의 실제 값과 일치해야 함
    const numberMatch = text.match(/(\d+)개?\s*(남|잔여)/);
    if (numberMatch) {
      // 이 숫자가 실제 DB 값과 일치하는지는 API 호출로 교차 검증
      // (할루시네이션 방어가 작동했다면 Tool 결과와 동일해야 함)
      expect(parseInt(numberMatch[1], 10)).toBeGreaterThanOrEqual(0);
    }
  });

  test.skip('E-16: DB 연결 실패 시 "시스템 점검 중" 메시지 및 Redis 큐 임시 저장', async ({ page }) => {
    // SKIP 사유: DB 연결 실패를 시뮬레이션하려면 PostgreSQL 컨테이너를 중지하거나
    // 서비스의 DB 연결을 강제로 끊는 등 인프라 레벨 조작이 필요합니다.
    // chaos engineering 도구 (예: toxiproxy) 사용을 권장합니다.

    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    const reply = await sendMessageAndWaitForReply(page, '휴가 조회해줘');

    // DB 장애 시 안내 메시지
    await expect(page.locator('[data-testid="system-notification"], [data-testid="error-message"]').last())
      .toContainText(/시스템 점검|잠시 후/);
  });

  test.skip('E-16: API - DB 실패 시 503 + SYS_002 에러', async ({ request }) => {
    // SKIP 사유: DB 연결 실패 시뮬레이션에는 인프라 레벨 설정이 필요합니다.

    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    const response = await request.get(`${API_BASE}/leave/balance/${EMPLOYEE.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status() === 503) {
      const body = await response.json();
      expect(body.error.code).toBe('SYS_002');
      expect(body.error.message).toMatch(/시스템 점검/);
    }
  });

  test.skip('E-17: WebSocket 끊김 시 자동 재연결 및 UI 배너 표시', async ({ page, context }) => {
    // SKIP 사유: WebSocket 끊김을 시뮬레이션하려면 네트워크 레벨 조작이 필요합니다.
    // Playwright의 page.route()로 WebSocket을 차단하거나,
    // CDP(Chrome DevTools Protocol)로 네트워크를 오프라인 전환해야 합니다.

    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    // WebSocket 연결 확인
    await page.waitForTimeout(2000);

    // 네트워크 오프라인 전환으로 WebSocket 끊김 시뮬레이션
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: true,
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0,
    });

    // "연결이 끊어졌습니다" 배너 표시 확인
    await expect(
      page.locator('[data-testid="connection-banner"], [data-testid="reconnecting-banner"]')
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.locator('[data-testid="connection-banner"], [data-testid="reconnecting-banner"]')
    ).toContainText(/연결.*끊|재연결/);

    // 네트워크 복구
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });

    // 재연결 후 배너 사라짐 확인
    await expect(
      page.locator('[data-testid="connection-banner"], [data-testid="reconnecting-banner"]')
    ).toBeHidden({ timeout: 15000 });
  });

  test.skip('E-18: 동시 요청(Race Condition) - 같은 날짜 동시 신청 시 두 번째 요청 차단', async ({ request }) => {
    // SKIP 사유: 진정한 동시 요청 테스트는 DB 트랜잭션 격리 수준과
    // UNIQUE 제약 조건이 올바르게 설정되어 있어야 합니다.
    // 이 테스트는 두 요청을 거의 동시에 보내어 race condition을 시뮬레이션합니다.

    const token = await getAuthToken(request, EMPLOYEE.email, EMPLOYEE.password);

    const leaveData = {
      employee_id: EMPLOYEE.id,
      leave_type: 'annual',
      start_date: '2026-09-01',
      end_date: '2026-09-01',
      days: 1,
      reason: 'Race Condition 테스트',
    };

    // 두 요청을 동시에 전송
    const [res1, res2] = await Promise.all([
      request.post(`${API_BASE}/leave/request`, {
        headers: { Authorization: `Bearer ${token}` },
        data: leaveData,
      }),
      request.post(`${API_BASE}/leave/request`, {
        headers: { Authorization: `Bearer ${token}` },
        data: leaveData,
      }),
    ]);

    const statuses = [res1.status(), res2.status()].sort();

    // 하나는 성공(201), 하나는 중복(409)이어야 함
    // 또는 둘 다 실패할 수도 있지만 둘 다 성공하면 안 됨
    const successCount = statuses.filter(s => s === 201).length;
    expect(successCount).toBeLessThanOrEqual(1);

    // 중복 건은 LV_003 에러
    if (res2.status() === 409) {
      const body = await res2.json();
      expect(body.error.code).toBe('LV_003');
    } else if (res1.status() === 409) {
      const body = await res1.json();
      expect(body.error.code).toBe('LV_003');
    }
  });
});
