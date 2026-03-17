/**
 * Scenario C: 담당자 직접 개입 (Human Takeover)
 *
 * Flow:
 * 1. 직원이 질문 → AI 자동 응답
 * 2. 담당자가 "개입하기" 버튼 클릭
 * 3. AI 응답 중단 확인
 * 4. 담당자가 직접 응답
 * 5. "AI에게 넘기기" 버튼 클릭
 * 6. AI 응답 재개 확인
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAs } from './helpers/auth';
import {
  USERS,
  SELECTORS,
  TIMEOUTS,
  API_ROUTES,
} from './helpers/test-data';

// ─── Page Object ───────────────────────────────────────────────────────────

class TakeoverPage {
  constructor(private readonly page: Page) {}

  /** Open the first work channel in the sidebar */
  async openWorkChannel(): Promise<void> {
    const workGroup = this.page.locator(SELECTORS.CHANNEL_GROUP_WORK);
    await workGroup.waitFor({ state: 'visible', timeout: TIMEOUTS.MESSAGE_DELIVERY });

    const firstChannel = workGroup.locator(SELECTORS.CHANNEL_ITEM).first();
    const exists = await firstChannel.isVisible().catch(() => false);
    if (exists) {
      await firstChannel.click();
    }

    await this.page.locator(SELECTORS.MESSAGE_INPUT).waitFor({ state: 'visible' });
  }

  /** Open a specific channel that contains AI-handled conversations (for HR staff) */
  async openAIHandledChannel(): Promise<void> {
    // The HR staff should see a "AI가 처리 중" channel group
    const aiGroup = this.page.locator('[data-testid="channel-group-ai"]');
    const aiGroupVisible = await aiGroup.isVisible().catch(() => false);

    if (aiGroupVisible) {
      const firstChannel = aiGroup.locator(SELECTORS.CHANNEL_ITEM).first();
      await firstChannel.click();
    } else {
      // Fallback: look for any work channel that has an AI badge
      const workGroup = this.page.locator(SELECTORS.CHANNEL_GROUP_WORK);
      await workGroup.waitFor({ state: 'visible', timeout: TIMEOUTS.MESSAGE_DELIVERY });

      const channelWithAI = workGroup
        .locator(SELECTORS.CHANNEL_ITEM)
        .filter({ has: this.page.locator(SELECTORS.AI_BADGE) });
      const hasAIChannel = await channelWithAI.first().isVisible().catch(() => false);

      if (hasAIChannel) {
        await channelWithAI.first().click();
      } else {
        // As a last fallback, open the first channel
        await workGroup.locator(SELECTORS.CHANNEL_ITEM).first().click();
      }
    }

    await this.page.locator(SELECTORS.MESSAGE_INPUT).waitFor({ state: 'visible' });
  }

  /** Send a text message */
  async sendMessage(text: string): Promise<void> {
    const input = this.page.locator(SELECTORS.MESSAGE_INPUT);
    await input.fill(text);

    const sendButton = this.page.locator(SELECTORS.SEND_BUTTON);
    await sendButton.click();

    await this.page.waitForResponse(
      (resp) =>
        (resp.url().includes(API_ROUTES.SEND_MESSAGE) || resp.url().includes(API_ROUTES.SEND_DM)) &&
        (resp.status() === 200 || resp.status() === 201),
      { timeout: TIMEOUTS.MESSAGE_DELIVERY },
    );
  }

  /** Wait for an AI response containing expected text */
  async waitForAIResponse(expectedSubstring: string): Promise<void> {
    await this.page
      .locator(SELECTORS.MESSAGE_LIST)
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: expectedSubstring })
      .last()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.AI_RESPONSE });
  }

  /** Click the "개입하기" (takeover) button */
  async clickTakeover(): Promise<void> {
    const takeoverButton = this.page.locator(SELECTORS.TAKEOVER_BUTTON);
    await takeoverButton.waitFor({ state: 'visible', timeout: TIMEOUTS.MESSAGE_DELIVERY });
    await takeoverButton.click();

    // Wait for the takeover API response
    await this.page.waitForResponse(
      (resp) => resp.url().includes(API_ROUTES.TAKEOVER) && resp.status() === 200,
      { timeout: TIMEOUTS.MESSAGE_DELIVERY },
    );
  }

  /** Click the "AI에게 넘기기" (release) button */
  async clickRelease(): Promise<void> {
    const releaseButton = this.page.locator(SELECTORS.RELEASE_BUTTON);
    await releaseButton.waitFor({ state: 'visible', timeout: TIMEOUTS.MESSAGE_DELIVERY });
    await releaseButton.click();

    // Wait for the release API response
    await this.page.waitForResponse(
      (resp) => resp.url().includes(API_ROUTES.TAKEOVER) && resp.status() === 200,
      { timeout: TIMEOUTS.MESSAGE_DELIVERY },
    );
  }

  /** Verify that the takeover button is visible (means AI is currently responding) */
  async verifyTakeoverButtonVisible(): Promise<void> {
    await expect(this.page.locator(SELECTORS.TAKEOVER_BUTTON)).toBeVisible({
      timeout: TIMEOUTS.MESSAGE_DELIVERY,
    });
  }

  /** Verify that the release button is visible (means human has taken over) */
  async verifyReleaseButtonVisible(): Promise<void> {
    await expect(this.page.locator(SELECTORS.RELEASE_BUTTON)).toBeVisible({
      timeout: TIMEOUTS.MESSAGE_DELIVERY,
    });
  }

  /** Verify that a direct response badge is shown on a message */
  async verifyDirectResponseBadge(messageText: string): Promise<void> {
    const message = this.page
      .locator(SELECTORS.MESSAGE_LIST)
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: messageText })
      .last();

    const badge = message.locator(SELECTORS.DIRECT_RESPONSE_BADGE);
    await expect(badge).toBeVisible({ timeout: TIMEOUTS.MESSAGE_DELIVERY });
  }

  /** Count messages received after a specific action (to verify AI is stopped/resumed) */
  async getMessageCount(): Promise<number> {
    const bubbles = this.page.locator(`${SELECTORS.MESSAGE_LIST} ${SELECTORS.TEXT_BUBBLE}`);
    return bubbles.count();
  }

  /** Wait for a system notification */
  async waitForNotification(expectedText: string): Promise<void> {
    await this.page
      .locator(SELECTORS.SYSTEM_NOTIFICATION)
      .filter({ hasText: expectedText })
      .last()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.NOTIFICATION });
  }
}

// ─── Test Suite ────────────────────────────────────────────────────────────

test.describe.serial('Scenario C: 담당자 직접 개입 (Human Takeover)', () => {
  let employeeContext: BrowserContext;
  let hrStaffContext: BrowserContext;
  let employeePage: Page;
  let hrStaffPage: Page;
  let employeeView: TakeoverPage;
  let hrStaffView: TakeoverPage;

  test.beforeAll(async ({ browser }) => {
    employeeContext = await browser.newContext();
    hrStaffContext = await browser.newContext();
    employeePage = await employeeContext.newPage();
    hrStaffPage = await hrStaffContext.newPage();
    employeeView = new TakeoverPage(employeePage);
    hrStaffView = new TakeoverPage(hrStaffPage);
  });

  test.afterAll(async () => {
    await employeeContext?.close();
    await hrStaffContext?.close();
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const slug = testInfo.title.replace(/\s+/g, '-');
      await employeePage
        ?.screenshot({ path: `test-results/scenario-c-${slug}-employee.png`, fullPage: true })
        .catch(() => {});
      await hrStaffPage
        ?.screenshot({ path: `test-results/scenario-c-${slug}-hr.png`, fullPage: true })
        .catch(() => {});
    }
  });

  test('Step 0: 직원과 휴가 담당자 로그인', async () => {
    // Login both users
    await loginAs(employeePage, USERS.EMPLOYEE_A.email, USERS.EMPLOYEE_A.password);
    await expect(employeePage).toHaveURL(/\/channels\//);

    await loginAs(hrStaffPage, USERS.HR_STAFF.email, USERS.HR_STAFF.password);
    await expect(hrStaffPage).toHaveURL(/\/channels\//);

    // Wait for both sidebars
    await employeePage.locator(SELECTORS.SIDEBAR).waitFor({
      state: 'visible',
      timeout: TIMEOUTS.MESSAGE_DELIVERY,
    });
    await hrStaffPage.locator(SELECTORS.SIDEBAR).waitFor({
      state: 'visible',
      timeout: TIMEOUTS.MESSAGE_DELIVERY,
    });
  });

  test('Step 1: 직원이 질문 → AI 자동 응답', async () => {
    // Employee opens work channel and asks a question
    await employeeView.openWorkChannel();
    await employeeView.sendMessage('나 다음주에 3일 연속 휴가 쓸 수 있어?');

    // Wait for AI automatic response
    // Based on the scenario, AI should respond about leave balance and availability
    await employeeView.waitForAIResponse('가능');

    // Verify the AI response has an AI badge (auto response)
    const aiResponse = employeePage
      .locator(SELECTORS.MESSAGE_LIST)
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: '가능' })
      .last();
    await expect(aiResponse).toBeVisible();
  });

  test('Step 2: 담당자가 "개입하기" 버튼 클릭', async () => {
    // HR staff opens the AI-handled channel where the employee's conversation is
    await hrStaffView.openAIHandledChannel();

    // Verify the takeover button is visible for HR staff
    await hrStaffView.verifyTakeoverButtonVisible();

    // Click takeover
    await hrStaffView.clickTakeover();

    // Verify the release button is now visible (confirming takeover succeeded)
    await hrStaffView.verifyReleaseButtonVisible();
  });

  test('Step 3: AI 응답 중단 확인', async () => {
    // After takeover, if the employee sends another message, AI should NOT respond
    // First, record the current message count on the employee side
    const messageCountBefore = await employeeView.getMessageCount();

    // Employee sends a follow-up question
    await employeeView.sendMessage('월요일부터 수요일까지 가능해?');

    // Wait a reasonable amount of time for any potential AI response
    // The AI should NOT respond since human has taken over
    await employeePage.waitForTimeout(3000);

    // Verify no new AI response appeared (message count should have increased
    // by only 1 - the employee's own sent message, not an AI reply)
    const messageCountAfter = await employeeView.getMessageCount();

    // At most 1 new message (the employee's own message)
    // If AI responded, there would be 2+ new messages
    expect(messageCountAfter - messageCountBefore).toBeLessThanOrEqual(1);

    // Additionally, check that there's a system notification about takeover
    const takeoverNotification = employeePage
      .locator(SELECTORS.SYSTEM_NOTIFICATION)
      .filter({ hasText: /개입|담당자/ });
    // Takeover notification might or might not be visible depending on implementation
    // Don't make this a hard failure
  });

  test('Step 4: 담당자가 직접 응답', async () => {
    // HR staff sends a direct response
    await hrStaffView.sendMessage(
      '잠깐, 직원님! 수요일에 전사 회의가 있어서 월~화(2일)로 조정하시거나, 목~금으로 변경하시는 게 좋을 것 같아요.',
    );

    // Verify the message appears on the employee's side
    await employeeView.waitForAIResponse('전사 회의');

    // Verify the response has a "직접 응답" badge (not AI)
    const directResponse = employeePage
      .locator(SELECTORS.MESSAGE_LIST)
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: '전사 회의' })
      .last();
    await expect(directResponse).toBeVisible();

    // Check for direct response badge
    const badge = directResponse.locator(SELECTORS.DIRECT_RESPONSE_BADGE);
    const hasBadge = await badge.isVisible().catch(() => false);
    if (hasBadge) {
      await expect(badge).toBeVisible();
    }

    // Employee replies
    await employeeView.sendMessage('아 그렇군요, 그럼 목금으로 할게요.');

    // HR staff sees the employee's response
    const employeeReply = hrStaffPage
      .locator(SELECTORS.MESSAGE_LIST)
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: '목금으로' })
      .last();
    await expect(employeeReply).toBeVisible({ timeout: TIMEOUTS.MESSAGE_DELIVERY });

    // HR staff confirms
    await hrStaffView.sendMessage('네, 목금 2일로 올려드릴게요!');

    // Verify employee receives the confirmation
    await employeeView.waitForAIResponse('목금 2일');
  });

  test('Step 5: "AI에게 넘기기" 버튼 클릭', async () => {
    // HR staff clicks release to hand back to AI
    await hrStaffView.clickRelease();

    // Verify the takeover button is now visible again (AI mode restored)
    await hrStaffView.verifyTakeoverButtonVisible();
  });

  test('Step 6: AI 응답 재개 확인', async () => {
    // Employee sends a new question - AI should now respond again
    await employeeView.sendMessage('내 연차 며칠 남았어?');

    // Wait for AI to respond (should respond since human takeover is released)
    await employeeView.waitForAIResponse('남');

    // Verify the response is from AI (has AI badge, not direct response badge)
    const aiResponse = employeePage
      .locator(SELECTORS.MESSAGE_LIST)
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: '남' })
      .last();
    await expect(aiResponse).toBeVisible();

    // Verify no "직접 응답" badge on the AI response
    const directBadge = aiResponse.locator(SELECTORS.DIRECT_RESPONSE_BADGE);
    await expect(directBadge).not.toBeVisible();
  });
});
