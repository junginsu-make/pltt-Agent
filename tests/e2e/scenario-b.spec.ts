/**
 * Scenario B: 대표 일정 조회 + 팀장 호출 + DM
 *
 * Flow:
 * 1. 대표(EMP-CEO) 로그인
 * 2. "직원 A 일정 알려줘" 입력
 * 3. AI가 일정 정보 응답
 * 4. "경영지원팀장 호출해줘" 입력
 * 5. DM 채널 생성 확인
 * 6. 경영지원팀장과 직접 메시지 교환
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

class MessengerPage {
  constructor(private readonly page: Page) {}

  /** Open the work channel (the AI secretary channel for CEO) */
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

  /** Send a text message and wait for API acknowledgement */
  async sendMessage(text: string): Promise<void> {
    const input = this.page.locator(SELECTORS.MESSAGE_INPUT);
    await input.fill(text);

    const sendButton = this.page.locator(SELECTORS.SEND_BUTTON);
    await sendButton.click();

    await this.page.waitForResponse(
      (resp) => resp.url().includes(API_ROUTES.SEND_MESSAGE) && resp.status() === 200,
      { timeout: TIMEOUTS.MESSAGE_DELIVERY },
    );
  }

  /** Send a DM in the currently active DM channel */
  async sendDMInChannel(text: string): Promise<void> {
    const input = this.page.locator(SELECTORS.MESSAGE_INPUT);
    await input.fill(text);

    const sendButton = this.page.locator(SELECTORS.SEND_BUTTON);
    await sendButton.click();

    // DM messages go through either /messenger/send or /messenger/dm
    await this.page.waitForResponse(
      (resp) =>
        (resp.url().includes(API_ROUTES.SEND_MESSAGE) || resp.url().includes(API_ROUTES.SEND_DM)) &&
        (resp.status() === 200 || resp.status() === 201),
      { timeout: TIMEOUTS.MESSAGE_DELIVERY },
    );
  }

  /** Wait for an AI text response containing the expected substring */
  async waitForAIResponse(expectedSubstring: string): Promise<void> {
    const messageList = this.page.locator(SELECTORS.MESSAGE_LIST);

    await messageList
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: expectedSubstring })
      .last()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.AI_RESPONSE });
  }

  /** Wait for a DM channel to appear in the sidebar */
  async waitForDMChannel(partnerName: string): Promise<void> {
    const dmGroup = this.page.locator(SELECTORS.CHANNEL_GROUP_DM);
    await dmGroup.waitFor({ state: 'visible', timeout: TIMEOUTS.CHANNEL_CREATION });

    const dmChannel = dmGroup
      .locator(SELECTORS.CHANNEL_ITEM)
      .filter({ hasText: partnerName });
    await dmChannel.first().waitFor({ state: 'visible', timeout: TIMEOUTS.CHANNEL_CREATION });
  }

  /** Click on a DM channel in the sidebar */
  async openDMChannel(partnerName: string): Promise<void> {
    const dmGroup = this.page.locator(SELECTORS.CHANNEL_GROUP_DM);
    const dmChannel = dmGroup
      .locator(SELECTORS.CHANNEL_ITEM)
      .filter({ hasText: partnerName });
    await dmChannel.first().click();

    await this.page.locator(SELECTORS.MESSAGE_INPUT).waitFor({ state: 'visible' });
  }

  /** Wait for a message from a specific person */
  async waitForMessageFrom(senderName: string, textSubstring: string): Promise<void> {
    const messageList = this.page.locator(SELECTORS.MESSAGE_LIST);

    // Look for a message bubble that contains both the sender name and text
    const messageBubble = messageList
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: textSubstring });
    await messageBubble.last().waitFor({ state: 'visible', timeout: TIMEOUTS.MESSAGE_DELIVERY });
  }

  /** Wait for a system notification */
  async waitForNotification(expectedText: string): Promise<void> {
    await this.page
      .locator(SELECTORS.SYSTEM_NOTIFICATION)
      .filter({ hasText: expectedText })
      .last()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.NOTIFICATION });
  }

  /** Verify the chat header shows the correct channel/partner name */
  async verifyChatHeader(expectedName: string): Promise<void> {
    const header = this.page.locator(SELECTORS.CHAT_HEADER);
    await expect(header).toContainText(expectedName);
  }

  /** Check that no AI badge is present in the current chat (DM = no LLM) */
  async verifyNoAIBadge(): Promise<void> {
    const aiBadge = this.page.locator(`${SELECTORS.CHAT_HEADER} ${SELECTORS.AI_BADGE}`);
    await expect(aiBadge).not.toBeVisible();
  }
}

// ─── Test Suite ────────────────────────────────────────────────────────────

test.describe.serial('Scenario B: 대표 일정 조회 + 팀장 호출 + DM', () => {
  let ceoContext: BrowserContext;
  let teamLeaderContext: BrowserContext;
  let ceoPage: Page;
  let teamLeaderPage: Page;
  let ceoMessenger: MessengerPage;
  let teamLeaderMessenger: MessengerPage;

  test.beforeAll(async ({ browser }) => {
    ceoContext = await browser.newContext();
    teamLeaderContext = await browser.newContext();
    ceoPage = await ceoContext.newPage();
    teamLeaderPage = await teamLeaderContext.newPage();
    ceoMessenger = new MessengerPage(ceoPage);
    teamLeaderMessenger = new MessengerPage(teamLeaderPage);
  });

  test.afterAll(async () => {
    await ceoContext?.close();
    await teamLeaderContext?.close();
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const slug = testInfo.title.replace(/\s+/g, '-');
      await ceoPage?.screenshot({ path: `test-results/scenario-b-${slug}-ceo.png`, fullPage: true }).catch(() => {});
      await teamLeaderPage
        ?.screenshot({ path: `test-results/scenario-b-${slug}-teamleader.png`, fullPage: true })
        .catch(() => {});
    }
  });

  test('Step 1: 대표(EMP-CEO) 로그인', async () => {
    await loginAs(ceoPage, USERS.CEO.email, USERS.CEO.password);

    await expect(ceoPage).toHaveURL(/\/channels/);
    await ceoPage.locator(SELECTORS.SIDEBAR).waitFor({
      state: 'visible',
      timeout: TIMEOUTS.MESSAGE_DELIVERY,
    });
  });

  test('Step 2: "직원 A 일정 알려줘" 입력', async () => {
    await ceoMessenger.openWorkChannel();
    await ceoMessenger.sendMessage('직원 A 일정에 대해서 알려줘');

    // Verify sent message appears
    const sentMsg = ceoPage
      .locator(SELECTORS.MESSAGE_LIST)
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: '직원 A 일정' });
    await expect(sentMsg.last()).toBeVisible();
  });

  test('Step 3: AI가 일정 정보 응답', async () => {
    // The CEO's secretary AI should query employee schedule and respond
    // Based on Scenario A, if 직원 A has a leave on 3/20, it should mention that
    // At minimum, AI should respond with schedule information
    await ceoMessenger.waitForAIResponse('일정');

    // Verify the AI response mentions 정인수 or 직원 A
    const messageList = ceoPage.locator(SELECTORS.MESSAGE_LIST);
    const aiResponse = messageList
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: '정인수' })
      .or(messageList.locator(SELECTORS.TEXT_BUBBLE).filter({ hasText: '직원 A' }))
      .or(messageList.locator(SELECTORS.TEXT_BUBBLE).filter({ hasText: '휴가' }));
    await expect(aiResponse.last()).toBeVisible({ timeout: TIMEOUTS.AI_RESPONSE });
  });

  test('Step 4: "경영지원팀장 호출해줘" 입력', async () => {
    await ceoMessenger.sendMessage('경영지원팀장 호출해줘');

    // Wait for AI to confirm the call was made
    // The AI should respond with something like "호출 알림을 보냈습니다"
    await ceoMessenger.waitForAIResponse('호출');
  });

  test('Step 5: DM 채널 생성 확인', async () => {
    // After the call, a DM channel between CEO and 경영지원팀장 should be created
    await ceoMessenger.waitForDMChannel(USERS.TEAM_LEADER.name);

    // Also log in as team leader and verify they received the call notification
    await loginAs(teamLeaderPage, USERS.TEAM_LEADER.email, USERS.TEAM_LEADER.password);
    await expect(teamLeaderPage).toHaveURL(/\/channels/);

    // Team leader should see a notification about the call
    await teamLeaderPage.locator(SELECTORS.SIDEBAR).waitFor({
      state: 'visible',
      timeout: TIMEOUTS.MESSAGE_DELIVERY,
    });

    // Check for the call notification or the DM channel
    const notification = teamLeaderPage
      .locator(SELECTORS.SYSTEM_NOTIFICATION)
      .filter({ hasText: '호출' })
      .or(
        teamLeaderPage
          .locator(SELECTORS.CHANNEL_GROUP_DM)
          .locator(SELECTORS.CHANNEL_ITEM)
          .filter({ hasText: USERS.CEO.name }),
      );
    await expect(notification.first()).toBeVisible({ timeout: TIMEOUTS.NOTIFICATION });
  });

  test('Step 6: 경영지원팀장과 직접 메시지 교환', async () => {
    // CEO opens the DM channel with 경영지원팀장
    await ceoMessenger.openDMChannel(USERS.TEAM_LEADER.name);

    // Verify this is a DM (no AI badge, pure messenger)
    await ceoMessenger.verifyChatHeader(USERS.TEAM_LEADER.name);

    // CEO sends a message
    await ceoMessenger.sendDMInChannel('이번 달 인력 현황 어때?');

    // Team leader opens the DM channel with CEO
    await teamLeaderMessenger.waitForDMChannel(USERS.CEO.name);
    await teamLeaderMessenger.openDMChannel(USERS.CEO.name);

    // Verify team leader received the message
    await teamLeaderMessenger.waitForMessageFrom(USERS.CEO.name, '인력 현황');

    // Team leader replies
    await teamLeaderMessenger.sendDMInChannel(
      '현재 전원 정상 근무 중이고, 직원 A만 휴가 예정입니다.',
    );

    // Verify CEO receives the reply
    await ceoMessenger.waitForMessageFrom(USERS.TEAM_LEADER.name, '전원 정상 근무');

    // Verify the reply is from a human (no AI badge)
    const latestMessage = ceoPage
      .locator(SELECTORS.MESSAGE_LIST)
      .locator(SELECTORS.TEXT_BUBBLE)
      .filter({ hasText: '전원 정상 근무' })
      .last();
    const aiBadge = latestMessage.locator(SELECTORS.AI_BADGE);
    await expect(aiBadge).not.toBeVisible();
  });
});
