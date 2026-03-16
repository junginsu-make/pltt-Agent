# Messenger UI AGENTS.md

## Module Context

- **Role**: 메신저 프론트엔드. 실시간 채팅, 채널 관리, 메시지 렌더링, Human Takeover UI.
- **Dependencies**: packages/shared (타입), messaging-server (Socket.IO), leave-service (API), approval-service (API)
- **Data Flow**: User Input -> Socket.IO / REST API -> Server -> Socket.IO Event -> UI Update
- **Port**: 3010

## Tech Stack & Constraints

- **Framework**: Next.js 14 (App Router)
- **UI**: shadcn/ui + Tailwind CSS (Kakao Work 스타일)
- **State**: Zustand (ChatStore)
- **Realtime**: socket.io-client
- **HTTP**: axios
- **Font**: Pretendard (한글 최적화)
- **Constraint**: Server Components는 레이아웃/페이지에만 사용. 채팅 등 인터랙티브 영역은 Client Components.

## Implementation Patterns

### Component Architecture

```
src/
  app/
    layout.tsx              # RootLayout (AuthProvider, ThemeProvider)
    page.tsx                # 로그인 페이지 or 리다이렉트
    (auth)/
      login/page.tsx        # 로그인 폼
    (main)/
      layout.tsx            # MainLayout (SocketProvider, Sidebar + Content)
      channels/
        [channelId]/
          page.tsx          # ChatPanel (메시지 목록 + 입력)
  components/
    chat/
      ChatPanel.tsx         # 메시지 영역 전체
      MessageList.tsx       # 메시지 목록 (가상 스크롤)
      MessageBubble.tsx     # 개별 메시지 (sender_type별 분기)
      MessageInput.tsx      # 입력창 + 전송 버튼
      SystemMessage.tsx     # 시스템 알림 메시지
    cards/
      LeaveBalanceCard.tsx  # 연차 현황 카드
      ApprovalCard.tsx      # 결재 요청/결과 카드
      LeaveRequestCard.tsx  # 휴가 신청 폼 카드
    sidebar/
      ChannelList.tsx       # 채널 목록
      ChannelItem.tsx       # 개별 채널 (unread badge)
      UserStatus.tsx        # 온라인 상태 표시
    common/
      Avatar.tsx            # 사용자/AI 아바타
      Badge.tsx             # 읽지 않은 메시지 배지
  hooks/
    useSocket.ts            # Socket.IO 연결 관리
    useChat.ts              # 메시지 송수신
    useAuth.ts              # JWT 인증
  stores/
    chat-store.ts           # Zustand ChatStore
    auth-store.ts           # Zustand AuthStore
  lib/
    api.ts                  # axios 인스턴스 (JWT 인터셉터)
    socket.ts               # Socket.IO 클라이언트 설정
```

### Message Rendering by sender_type

| sender_type | 렌더링 |
|-------------|--------|
| human | 일반 채팅 버블 (발신자면 오른쪽, 수신자면 왼쪽) |
| llm | AI 아이콘 + 왼쪽 버블 (연보라 배경) |
| system | 중앙 정렬 시스템 메시지 (회색) |

### Message content_type Rendering

| content_type | 렌더링 |
|-------------|--------|
| text | 일반 텍스트 |
| card | 구조화된 카드 (LeaveBalanceCard, ApprovalCard 등) |
| file | 파일 첨부 (추후) |
| image | 이미지 (추후) |

### Zustand Store Pattern

```typescript
interface ChatStore {
  channels: Channel[];
  activeChannelId: string | null;
  messages: Record<string, Message[]>;
  setActiveChannel: (id: string) => void;
  addMessage: (channelId: string, message: Message) => void;
  // ...
}
```

### File Naming

- Components: PascalCase.tsx (e.g., ChatPanel.tsx)
- Hooks: useCamelCase.ts (e.g., useSocket.ts)
- Stores: kebab-case.ts (e.g., chat-store.ts)
- Utils: camelCase.ts
- Pages: page.tsx (Next.js App Router convention)

## Testing Strategy

```bash
pnpm --filter @palette/messenger test
```

- Unit: 컴포넌트 렌더링 (Vitest + @testing-library/react)
- Integration: 메시지 송수신 흐름 (Socket.IO Mock)
- E2E: Playwright로 시나리오 A/B/C 전체 흐름
- Visual: Storybook (선택, 추후)

## Local Golden Rules

### Do's

- 컴포넌트는 단일 책임 원칙 (한 컴포넌트 = 한 역할)
- Props에 TypeScript interface 정의 (Props suffix 사용: ChatPanelProps)
- 상태 관리는 Zustand로 통합 (useState는 로컬 UI 상태에만)
- Socket.IO 이벤트 핸들러는 useSocket 훅에서만 관리
- 메시지 목록 가상 스크롤 적용 (대량 메시지 성능)
- 접근성: 키보드 내비게이션, aria-label 적용

### Don'ts

- 컴포넌트 내 직접 API/Socket 호출 금지 (훅으로 분리)
- Server Component에서 useState, useEffect 사용 금지
- 인라인 스타일 금지 (Tailwind 유틸리티 클래스 사용)
- any 타입 사용 금지
- 하드코딩된 색상값 금지 (디자인 토큰 사용: CSS variables)
