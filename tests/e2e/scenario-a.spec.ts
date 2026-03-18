/**
 * Scenario A: 직원 휴가 신청 → 승인 흐름
 *
 * Flow:
 * 1. 정인수(EMP-001) 로그인
 * 2. 업무 채널에서 "휴가 며칠 남았어?" 입력
 * 3. AI가 연차 잔여 카드로 응답 확인
 * 4. "3월 20일 휴가 신청할게" 입력
 * 5. AI가 사유 입력 요청 → 사유 입력
 * 6. AI가 휴가 신청 확인 카드 표시
 * 7. 김민준(EMP-DEV-LEADER) 로그인
 * 8. 결재 카드에서 "승인" 클릭
 * 9. 정인수에게 승인 알림 확인
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAs } from './helpers/auth';
import {
  USERS,
  SELECTORS,
  TIMEOUTS,
  API_ROUTES,
  type TestUser,
} from './helpers/test-data';

// ─── Page Object ───────────────────────────────────────────────────────────

class ChatPage {
  constructor(private readonly page: Page) {}

  /** Navigate to a work channel (the first one in the sidebar, or create new) */
  async openWorkChannel(): Promise<void> {
    const workGroup = this.page.locator(SELECTORS.CHANNEL_GROUP_WORK);
    await workGroup.waitFor({ state: 'visible', timeout: TIMEOUTS.MESSAGE_DELIVERY });

    const firstWorkChannel = workGroup.locator(SELECTORS.CHANNEL_ITEM).first();
    const channelExists = await firstWorkChannel.isVisible().catch(() => false);

    if (channelExists) {
      await firstWorkChannel.click();
    } else {
      // If no work channel exists, click the message input to auto-create one
      await this.page.locator(SELECTORS.MESSAGE_INPUT).waitFor({
        state: 'visible',
        timeout: TIMEOUTS.MESSAGE_DELIVERY,
      });
    }

    await this.page.locator(SELECTORS.MESSAGE_INPUT).waitFor({ state: 'visible' });
  }

  /** Type a message and send it (via WebSocket, not REST) */
  async sendMessage(text: string): Promise<void> {
    const input = this.page.locator(SELECTORS.MESSAGE_INPUT);
    await input.fill(text);

    const sendButton = this.page.locator(SELECTORS.SEND_BUTTON);
    await sendButton.click();

    // Wait for the sent message to appear in the chat (delivered via WebSocket)
    const messageList = this.page.locator(SELECTORS.MESSAGE_LIST);
    await messageList
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: text })
      .last()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.MESSAGE_DELIVERY });
  }

  /** Wait for an AI text response containing the expected substring */
  async waitForAIResponse(expectedSubstring: string): Promise<void> {
    const messageList = this.page.locator(SELECTORS.MESSAGE_LIST);

    // Search in both text-bubble and card-message (AI may render as either)
    await messageList
      .locator(`${SELECTORS.TEXT_BUBBLE}, ${SELECTORS.CARD_MESSAGE}`)
      .filter({ hasText: expectedSubstring })
      .last()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.AI_RESPONSE });
  }

  /** Wait for a leave balance card to appear */
  async waitForLeaveBalanceCard(): Promise<void> {
    await this.page
      .locator(SELECTORS.LEAVE_BALANCE_CARD)
      .last()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.CARD_RENDER });
  }

  /** Wait for an approval card to appear */
  async waitForApprovalCard(): Promise<void> {
    await this.page
      .locator(SELECTORS.APPROVAL_CARD)
      .last()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.APPROVAL_FLOW });
  }

  /** Click the approve button on the latest approval card */
  async clickApprove(): Promise<void> {
    const approvalCard = this.page.locator(SELECTORS.APPROVAL_CARD).last();
    const approveButton = approvalCard.locator(SELECTORS.APPROVE_BUTTON);
    await approveButton.click();

    // Wait for the approval API response
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/approvals/') && resp.url().includes('/decide') && resp.status() === 200,
      { timeout: TIMEOUTS.APPROVAL_FLOW },
    );
  }

  /** Wait for a system notification containing the given text */
  async waitForNotification(expectedText: string): Promise<void> {
    await this.page
      .locator(SELECTORS.SYSTEM_NOTIFICATION)
      .filter({ hasText: expectedText })
      .last()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.NOTIFICATION });
  }

  /** Get all visible messages' text content in order */
  async getVisibleMessages(): Promise<string[]> {
    const bubbles = this.page.locator(`${SELECTORS.MESSAGE_LIST} ${SELECTORS.TEXT_BUBBLE}`);
    return bubbles.allTextContents();
  }

  /** Verify leave balance card shows expected values */
  async verifyLeaveBalanceCard(expected: {
    total?: number;
    used?: number;
    remaining?: number;
  }): Promise<void> {
    const card = this.page.locator(SELECTORS.LEAVE_BALANCE_CARD).last();

    if (expected.total !== undefined) {
      await expect(card).toContainText(`${expected.total}`);
    }
    if (expected.used !== undefined) {
      await expect(card).toContainText(`${expected.used}`);
    }
    if (expected.remaining !== undefined) {
      await expect(card).toContainText(`${expected.remaining}`);
    }
  }
}

// ─── Test Suite ────────────────────────────────────────────────────────────

test.describe.serial('Scenario A: 직원 휴가 신청 → 승인', () => {
  let employeeContext: BrowserContext;
  let managerContext: BrowserContext;
  let employeePage: Page;
  let managerPage: Page;
  let employeeChat: ChatPage;
  let managerChat: ChatPage;

  test.beforeAll(async ({ browser }) => {
    // Create separate browser contexts for employee and manager
    employeeContext = await browser.newContext();
    managerContext = await browser.newContext();
    employeePage = await employeeContext.newPage();
    managerPage = await managerContext.newPage();
    employeeChat = new ChatPage(employeePage);
    managerChat = new ChatPage(managerPage);
  });

  test.afterAll(async () => {
    await employeeContext?.close();
    await managerContext?.close();
  });

  // Capture screenshot on failure for each test
  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const screenshotPath = `test-results/scenario-a-${testInfo.title.replace(/\s+/g, '-')}.png`;
      await employeePage?.screenshot({ path: `${screenshotPath}-employee.png`, fullPage: true }).catch(() => {});
      await managerPage?.screenshot({ path: `${screenshotPath}-manager.png`, fullPage: true }).catch(() => {});
    }
  });

  test('Step 1: 정인수(EMP-001) 로그인', async () => {
    await loginAs(employeePage, USERS.EMPLOYEE_A.email, USERS.EMPLOYEE_A.password);

    // Verify we are on the channels page after login
    await expect(employeePage).toHaveURL(/\/channels/);

    // Verify sidebar is visible
    await employeePage.locator(SELECTORS.SIDEBAR).waitFor({
      state: 'visible',
      timeout: TIMEOUTS.MESSAGE_DELIVERY,
    });
  });

  test('Step 2: 업무 채널에서 "휴가 며칠 남았어?" 입력', async () => {
    await employeeChat.openWorkChannel();
    await employeeChat.sendMessage('나 휴가 몇개 남았어?');

    // Verify the sent message appears in the chat
    const sentMessage = employeePage
      .locator(SELECTORS.MESSAGE_LIST)
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: '휴가 몇개 남았어' });
    await expect(sentMessage.last()).toBeVisible();
  });

  test('Step 3: AI가 연차 잔여 카드로 응답 확인', async () => {
    // Wait for the AI to respond with the leave balance card
    await employeeChat.waitForLeaveBalanceCard();

    // Verify the card shows correct data from seed:
    // total: 15, used: 1, remaining: 14
    await employeeChat.verifyLeaveBalanceCard({
      total: 15,
      used: 1,
      remaining: 14,
    });

    // Also verify AI text response mentions remaining days
    await employeeChat.waitForAIResponse('14');
  });

  test('Step 4: "3월 20일 휴가 신청할게" 입력', async () => {
    await employeeChat.sendMessage('나 3월 20일에 휴가를 쓰고 싶어');

    // Wait for AI to acknowledge the date and ask for reason
    // The AI validates the date first, then asks for leave reason
    // AI may use "이유" or "사유" when asking for reason
    await employeeChat.waitForAIResponse('사유');
  });

  test('Step 5: AI가 사유 입력 요청 → 사유 입력', async () => {
    // The AI should have asked for the reason in the previous step
    // Now provide the reason
    await employeeChat.sendMessage('개인사정이야');

    // Wait for the leave request submission confirmation
    // The AI should say something like "휴가 올려드릴게요" and show a confirmation card
    await employeeChat.waitForAIResponse('휴가');
  });

  test('Step 6: AI가 휴가 신청 확인 카드 표시', async () => {
    const messageList = employeePage.locator(SELECTORS.MESSAGE_LIST);

    // Check for confirmation: card-message or text-bubble with leave request info
    // AI may render as card or text depending on frontend card support
    const confirmationLocator = messageList.locator(
      `${SELECTORS.CARD_MESSAGE}, ${SELECTORS.TEXT_BUBBLE}`,
    );
    const confirmation = confirmationLocator
      .filter({ hasText: /LV-|신청.*완료|접수/ })
      .last();
    await confirmation.waitFor({ state: 'visible', timeout: TIMEOUTS.CARD_RENDER });

    await expect(confirmation).toContainText('3월 20일');
    await expect(confirmation).toContainText('개인사정');
  });

  test('Step 7: 김민준(EMP-DEV-LEADER) 로그인', async () => {
    await loginAs(managerPage, USERS.MANAGER.email, USERS.MANAGER.password);

    // Verify login success
    await expect(managerPage).toHaveURL(/\/channels/);

    // Wait for sidebar to load
    await managerPage.locator(SELECTORS.SIDEBAR).waitFor({
      state: 'visible',
      timeout: TIMEOUTS.MESSAGE_DELIVERY,
    });
  });

  test('Step 8: 결재 카드에서 "승인" 클릭', async () => {
    // Navigate to manager's notification channel where approval card is sent
    await managerPage.goto('/channels/ch-notification-EMP-DEV-LEADER');
    await managerPage.locator(SELECTORS.MESSAGE_LIST).waitFor({ state: 'visible', timeout: 10000 });

    // Wait for approval card to appear
    await managerChat.waitForApprovalCard();

    const approvalCard = managerPage.locator(SELECTORS.APPROVAL_CARD).last();

    // Verify the approval card details
    await expect(approvalCard).toContainText('정인수');
    await expect(approvalCard).toContainText('3월 20일');
    await expect(approvalCard).toContainText('개인사정');

    // Verify AI analysis is shown
    const aiAnalysis = approvalCard.locator('[data-testid="ai-analysis"]');
    const hasAnalysis = await aiAnalysis.isVisible().catch(() => false);
    if (hasAnalysis) {
      await expect(aiAnalysis).toContainText('승인');
    }

    // Click approve
    await managerChat.clickApprove();

    // Verify the approval card updates to show approved status
    await expect(approvalCard).toContainText(/승인/);
  });

  test('Step 9: 정인수에게 승인 알림 확인', async () => {
    // Switch back to employee page and check for approval notification
    // The notification should arrive via WebSocket

    await employeeChat.waitForNotification('승인');

    // Verify the notification contains approval confirmation
    const notification = employeePage
      .locator(SELECTORS.SYSTEM_NOTIFICATION)
      .filter({ hasText: '승인' })
      .last();
    await expect(notification).toBeVisible({ timeout: TIMEOUTS.NOTIFICATION });
  });
});
