# 프론트엔드 상세

## 메신저 UI (apps/messenger)

### 기술 스택
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui (컴포넌트)
- Socket.IO Client
- Zustand (상태 관리)

### 컴포넌트 트리

```
<AuthProvider>
  <SocketProvider>
    <AppLayout>

      {/* 사이드바 */}
      <Sidebar>
        <UserProfile />           // 내 이름, 아바타, 온라인 상태
        <ChannelList>
          <ChannelGroup title="다이렉트 메시지">
            <ChannelItem />       // DM 채널 (상대방 이름, 마지막 메시지, 안읽음 수)
          </ChannelGroup>
          <ChannelGroup title="업무">
            <ChannelItem />       // 업무 채널 (채널명, AI 뱃지)
          </ChannelGroup>
          <ChannelGroup title="팀">
            <ChannelItem />
          </ChannelGroup>
          {/* 담당자 전용 */}
          <ChannelGroup title="AI가 처리 중">
            <ChannelItem badge="AI 응답 중" />
          </ChannelGroup>
        </ChannelList>
        <NewMessageButton />      // 새 대화 시작 (사람 검색 + DM)
      </Sidebar>

      {/* 대화 영역 */}
      <ChatPanel>
        <ChatHeader>
          <ChannelName />         // 채널명 또는 상대방 이름
          <OnlineStatus />        // 온라인/오프라인 (DM일 때)
          <TakeoverButton />      // [개입하기] 또는 [AI에게 넘기기] (담당자용)
        </ChatHeader>

        <MessageList ref={scrollRef}>
          {messages.map(msg => {
            switch(msg.content_type) {
              case 'text':         return <TextBubble />;
              case 'card':         return <CardMessage />;
              case 'approval':     return <ApprovalCard />;
              case 'notification': return <SystemNotification />;
            }
          })}
          <TypingIndicator />     // "AI가 입력 중..." 또는 "김민준님이 입력 중..."
        </MessageList>

        <MessageInput>
          <TextInput />
          <SendButton />
        </MessageInput>
      </ChatPanel>

    </AppLayout>
  </SocketProvider>
</AuthProvider>
```

### 메시지 컴포넌트 상세

#### TextBubble

```tsx
interface TextBubbleProps {
  senderType: 'human' | 'llm' | 'system';
  senderName: string;
  isMe: boolean;           // 내가 보낸 메시지인지
  isLlmAuto: boolean;      // LLM 자동 응답인지
  text: string;
  timestamp: string;
}

// 표시 규칙:
// isMe=true         → 오른쪽, 파란 배경, 이름 없음
// isMe=false, human → 왼쪽, 회색 배경, 이름 표시
// isMe=false, llm   → 왼쪽, 보라 배경, 이름 + [AI] 뱃지
// human + 담당자 개입 → 왼쪽, 초록 배경, 이름 + [직접 응답] 뱃지
// system            → 가운데, 투명, 작은 회색 글씨
```

#### CardMessage (연차 현황)

```tsx
interface LeaveBalanceCardProps {
  total: number;
  used: number;
  pending: number;
  remaining: number;
  expiresAt: string;
}

// UI:
// ┌───────────────────────────┐
// │ 📋 2026년 연차 현황        │
// │                           │
// │ 총 연차     15일          │
// │ 사용         1일          │
// │ 승인대기     0일          │
// │ 잔여        14일  ██░░░   │
// │                           │
// │ 만료: 2027-03-01          │
// └───────────────────────────┘
```

#### ApprovalCard (결재 요청 - 상사용)

```tsx
interface ApprovalCardProps {
  approvalId: string;
  employeeName: string;
  date: string;
  leaveType: string;
  days: number;
  reason: string;
  analysis: {
    scheduleConflict: boolean;
    teamLeaves: number;
    recommendation: 'approve' | 'review_needed';
    reasoning: string;
  };
  autoApproveAt: string;
}

// UI:
// ┌───────────────────────────────┐
// │ 📋 휴가 승인 요청              │
// │                               │
// │ 신청자: 정인수 (개발팀)        │
// │ 날짜: 3/18(수) 연차 1일       │
// │ 사유: 개인사정                 │
// │                               │
// │ 🤖 AI 검토:                   │
// │ ✅ 팀 일정 충돌 없음           │
// │ ✅ 동일 날짜 팀원 휴가 없음    │
// │ → 승인 추천                   │
// │                               │
// │ ⏰ 2시간 후 자동승인           │
// │                               │
// │ [승인 ✅] [반려 ❌] [질문하기]  │
// └───────────────────────────────┘
//
// [승인] 클릭 → POST /approvals/:id/decide {decision:"approved"}
// [반려] 클릭 → 사유 입력 모달 → POST /approvals/:id/decide {decision:"rejected", comment:...}
// [질문하기] 클릭 → 텍스트 입력 활성화, 상사가 직접 질문 (DM 또는 채널에서)
```

### 상태 관리 (Zustand)

```typescript
// stores/chat-store.ts

interface ChatStore {
  // 현재 사용자
  currentUser: Employee | null;
  setCurrentUser: (user: Employee) => void;

  // 채널
  channels: Channel[];
  activeChannelId: string | null;
  setActiveChannel: (id: string) => void;
  updateChannel: (id: string, data: Partial<Channel>) => void;
  addChannel: (channel: Channel) => void;

  // 메시지 (채널별)
  messagesByChannel: Record<string, Message[]>;
  addMessage: (channelId: string, msg: Message) => void;
  setMessages: (channelId: string, msgs: Message[]) => void;

  // 타이핑
  typingUsers: Record<string, string[]>; // channelId → [userId, ...]
  setTyping: (channelId: string, userId: string, isTyping: boolean) => void;

  // WebSocket 상태
  isConnected: boolean;
  setConnected: (v: boolean) => void;

  // 알림
  unreadCounts: Record<string, number>; // channelId → count
  markRead: (channelId: string) => void;
}

interface Channel {
  id: string;
  type: 'direct' | 'work' | 'team' | 'notification' | 'company';
  name: string;
  participants: string[];
  lastMessage?: { text: string; senderName: string; at: string };
  unreadCount: number;
  humanTakeover: boolean;
  assignedLlm?: string;
}

interface Message {
  id: string;
  channelId: string;
  senderType: 'human' | 'llm' | 'system';
  senderUserId: string;
  displayName: string;
  contentType: 'text' | 'card' | 'approval' | 'notification';
  contentText?: string;
  cardData?: any;
  isLlmAuto: boolean;
  createdAt: string;
}
```

### Socket.IO 연결 (구현 완료)

```typescript
// hooks/useSocket.ts — 실제 구현 반영

import { io, Socket } from 'socket.io-client';
import api from '@/lib/api';

function useSocket() {
  const socket = useRef<Socket | null>(null);
  const { addMessage, setTyping, updateChannel, setConnected, setChannels } = useChatStore();

  useEffect(() => {
    const token = getToken();
    socket.current = io('ws://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.current.on('connect', () => setConnected(true));
    socket.current.on('disconnect', () => setConnected(false));

    // ✅ 새 메시지
    socket.current.on('message:new', (data) => addMessage(data.channelId, data.message));

    // ✅ 타이핑
    socket.current.on('typing:start', (data) => setTyping(data.channelId, data.userId, data.displayName, true));
    socket.current.on('typing:stop', (data) => setTyping(data.channelId, data.userId, data.displayName, false));

    // ✅ 담당자 개입/복귀 — POST /takeover 후 서버에서 자동 발신
    socket.current.on('channel:takeover', (data) => {
      updateChannel(data.channelId, { humanTakeover: data.humanTakeover });
    });

    // ✅ 결재 결과 — message:new로 카드 메시지가 도착
    socket.current.on('approval:decided', (data) => {
      console.log('[socket] approval:decided', data);
    });

    // ✅ 알림 (DM 호출 등) — 채널 목록 리프레시
    socket.current.on('notification:new', async (data) => {
      if (data.channelId) socket.current?.emit('channel:join', { channelId: data.channelId });
      const res = await api.get('/messenger/channels');
      setChannels(res.data.channels || res.data);
    });

    return () => { socket.current?.disconnect(); };
  }, [token, addMessage, setTyping, updateChannel, setConnected, setChannels]);

  const sendMessage = (channelId: string, content: string) => {
    socket.current?.emit('message:send', { channelId, content, contentType: 'text' });
  };

  return { sendMessage, startTyping, stopTyping, socket: socketRef };
}
```

---

## Admin UI (apps/admin)

### 기술 스택
- Next.js 14 (App Router)
- TypeScript + Tailwind CSS
- shadcn/ui
- TanStack Table (데이터 테이블)
- TanStack Query (React Query, 서버 상태)
- React Hook Form + Zod (폼 검증)

### 페이지 라우트

| 경로 | 페이지 | 주요 기능 |
|------|--------|----------|
| /admin | 대시보드 | 오늘 휴가자, 대기 결재, 이번 달 통계 |
| /admin/employees | 직원 목록 | 데이터 테이블 + 필터 + 검색 |
| /admin/employees/new | 직원 등록 | 입력 폼 (등록 시 연차/결재선/대화계정 자동 설정) |
| /admin/employees/[id] | 직원 상세 | 정보 + 연차 현황 + 휴가 이력 |
| /admin/leaves | 휴가 신청 목록 | 상태별 필터, 기간 필터 |
| /admin/leaves/calendar | 휴가 캘린더 | 월간 뷰 (팀별/전사) |
| /admin/approvals | 결재 현황 | 대기/완료 필터 |
| /admin/settings/leave-policy | 연차 규정 | 규칙 편집 폼 |
| /admin/settings/holidays | 공휴일 | 연도별 목록 편집 |
| /admin/settings/teams | 조직도 | 팀 트리 + 팀장 지정 |
| /admin/settings/llm | AI/LLM 설정 | 사용자별 LLM 설정, 프롬프트 편집 |
| /admin/audit-log | 감사 로그 | 전체 로그 + 필터 + 상세 |
| /admin/conversations | 대화 기록 | 모든 대화 조회 (사람+AI 구분) |

### Admin API 호출 패턴

```typescript
// React Query 사용

// 목록 조회
const { data } = useQuery({
  queryKey: ['employees', { team, status, page }],
  queryFn: () => api.get('/admin/employees', { params: { team_id: team, status, page } }),
});

// 생성
const createEmployee = useMutation({
  mutationFn: (data: CreateEmployeeInput) => api.post('/admin/employees', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    toast.success('직원이 등록되었습니다');
    router.push('/admin/employees');
  },
});

// 수정
const updateEmployee = useMutation({
  mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeInput }) =>
    api.put(`/admin/employees/${id}`, data),
});
```
