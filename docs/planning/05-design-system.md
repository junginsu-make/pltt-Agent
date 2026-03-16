# 05. Palette AI 디자인 시스템

> **UI 레퍼런스**: Kakao Work (깔끔, 심플, 한국형 업무 메신저)
> **기술 스택**: shadcn/ui + Tailwind CSS + Lucide Icons
> **문서 버전**: v1.0 (Phase 1 MVP)

---

## 1. MVP 캡슐

| # | 항목 | 내용 |
|---|------|------|
| 1 | **목표** | AI가 HR 반복 업무를 자동 처리하는 회사 메신저 구축 |
| 2 | **페르소나** | 대표, 경영지원팀장, 휴가 담당자, 직원 A(정인수), 상사(김민준) |
| 3 | **핵심 기능** | FEAT-1: 메신저 + AI 자동응답 / FEAT-2: 휴가 신청·결재 시스템 |
| 4 | **성공 지표** | 시나리오 A / B / C 전체 E2E 동작 |
| 5 | **입력 지표** | AI 자동 처리율, 평균 처리 시간 |
| 6 | **비기능 요구** | 실시간 메시지 전달 < 500ms, 웹 + 모바일 반응형 |
| 7 | **Out-of-scope** | 네이티브 앱, B2B SaaS 멀티테넌시, Google Calendar 연동 |
| 8 | **Top 리스크** | LLM 할루시네이션으로 잘못된 업무 처리 |
| 9 | **완화/실험** | Tool 호출 강제 + 응답 검증 + Human Takeover |
| 10 | **다음 단계** | Phase 2 프로젝트 셋업 |

---

## 2. 디자인 철학

### 2.1 핵심 가치

| 가치 | 설명 | 적용 |
|------|------|------|
| **단순함** | Kakao Work처럼 깔끔하고 군더더기 없는 UI | 불필요한 장식 제거, 여백 활용 |
| **신뢰감** | 업무 시스템에 맞는 안정적이고 전문적인 느낌 | 일관된 색상·타이포, 명확한 피드백 |
| **친근함** | AI 대화가 자연스럽고 부담 없는 톤 | 말풍선 디자인, 부드러운 라운딩, 따뜻한 AI 뱃지 |

### 2.2 참고 서비스

- **Kakao Work**: 깔끔한 레이아웃, 한국형 UI 패턴, 채널/DM 구조
- **Slack**: 채널 그룹 구조, 메시지 스레드 패턴

### 2.3 안티패턴 (피해야 할 것)

- 복잡한 HR 전용 UI (과도한 테이블, 입력 필드 폭탄)
- 딱딱한 챗봇 느낌 (기계적 응답, 차가운 인터페이스)
- 과도한 색상 사용 (3색 이상 동시 사용 지양)
- 모바일에서 읽기 불편한 작은 폰트

---

## 3. 컬러 팔레트

### 3.1 브랜드 색상 (Kakao Work Inspired, Professional)

```
┌─────────────────────────────────────────────────────┐
│  Primary         #4A6CF7   파란색 계열 (신뢰/전문성)   │
│  Primary Light   #E8EDFE   Primary의 밝은 변형         │
│  Secondary       #6B7280   회색 (보조 요소)            │
│  Surface         #FFFFFF   카드 배경                   │
│  Background      #F8F9FC   전체 앱 배경                │
│  Text Primary    #1F2937   진한 회색 (본문)            │
│  Text Secondary  #6B7280   보조 텍스트                 │
└─────────────────────────────────────────────────────┘
```

### 3.2 Tailwind CSS 설정

```typescript
// tailwind.config.ts
const colors = {
  primary: {
    DEFAULT: '#4A6CF7',
    light: '#E8EDFE',
    hover: '#3B5DE6',    // Primary보다 약간 어두운 hover 상태
    active: '#2D4ED4',   // 클릭 시 상태
  },
  secondary: {
    DEFAULT: '#6B7280',
    light: '#F3F4F6',
  },
  surface: '#FFFFFF',
  background: '#F8F9FC',
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    inverse: '#FFFFFF',   // 어두운 배경 위 텍스트
  },
}
```

### 3.3 피드백 색상

| 상태 | 색상 | Hex | 용도 |
|------|------|-----|------|
| **Success** | 초록 | `#22C55E` | 승인 완료, 성공 알림 |
| **Warning** | 노랑 | `#EAB308` | 주의 필요, 자동승인 타이머 |
| **Error** | 빨강 | `#EF4444` | 반려, 에러, 유효성 검증 실패 |
| **Info** | 파랑 | `#3B82F6` | 일반 안내, 정보성 알림 |

### 3.4 메시지 말풍선 색상

메시지 유형별로 시각적으로 즉시 구분할 수 있어야 합니다.

| 유형 | 위치 | 배경색 | 텍스트 색상 | 비고 |
|------|------|--------|------------|------|
| **내 메시지** (`isMe=true`) | 오른쪽 | `#4A6CF7` (Primary) | `#FFFFFF` (흰색) | 이름 미표시 |
| **상대방** (`human`) | 왼쪽 | `#F3F4F6` (회색) | `#1F2937` (기본) | 이름 표시 |
| **AI 자동응답** (`llm`) | 왼쪽 | `#F3E8FF` (보라) | `#1F2937` (기본) | 이름 + `[AI]` 뱃지 |
| **담당자 직접 응답** | 왼쪽 | `#ECFDF5` (초록) | `#1F2937` (기본) | 이름 + `[직접 응답]` 뱃지 |
| **시스템 메시지** | 가운데 | 투명 | `#9CA3AF` (연회색) | 작은 글씨, 시간 구분선 |

```
 ┌─── 대화창 ───────────────────────────────────────────┐
 │                                                       │
 │   ── 2026년 3월 16일 월요일 ──                         │
 │                                                       │
 │  [아바타] 정인수                                       │
 │  ┌──────────────────┐                                 │
 │  │ 나 휴가 몇개 남았어? │  ← 회색 (#F3F4F6)            │
 │  └──────────────────┘                                 │
 │                                                       │
 │  [AI] 휴가 담당자 AI                                   │
 │  ┌─────────────────────────────┐                      │
 │  │ 15개 중 14개 남았습니다.      │  ← 보라 (#F3E8FF)   │
 │  └─────────────────────────────┘                      │
 │                                                       │
 │                    ┌──────────────────────┐            │
 │                    │ 3월 18일 휴가 쓰고 싶어 │ ← 파랑    │
 │                    └──────────────────────┘  (#4A6CF7) │
 │                                                       │
 │  [직접 응답] 휴가 담당자                                │
 │  ┌─────────────────────────────┐                      │
 │  │ 네, 제가 직접 처리해드릴게요.  │  ← 초록 (#ECFDF5)   │
 │  └─────────────────────────────┘                      │
 │                                                       │
 └───────────────────────────────────────────────────────┘
```

---

## 4. 타이포그래피

### 4.1 서체

| 용도 | 서체 | Fallback |
|------|------|----------|
| **본문/제목** | Pretendard (한국어 최적화) | `system-ui, -apple-system, sans-serif` |
| **숫자/코드** | Roboto Mono | `monospace` |

```css
/* globals.css */
@font-face {
  font-family: 'Pretendard';
  src: url('/fonts/PretendardVariable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}

:root {
  --font-sans: 'Pretendard', system-ui, -apple-system, sans-serif;
  --font-mono: 'Roboto Mono', monospace;
}
```

### 4.2 타입 스케일

| 이름 | 크기 | 줄 높이 | 굵기 | 용도 |
|------|------|---------|------|------|
| **Display** | 36px (2.25rem) | 44px | Bold (700) | 로그인 헤더, 대시보드 제목 |
| **H1** | 28px (1.75rem) | 36px | SemiBold (600) | 페이지 제목 |
| **H2** | 22px (1.375rem) | 30px | SemiBold (600) | 섹션 제목 |
| **H3** | 18px (1.125rem) | 26px | Medium (500) | 카드 제목, 사이드바 그룹명 |
| **Body Large** | 16px (1rem) | 24px | Regular (400) | 강조 본문 |
| **Body** | 14px (0.875rem) | 20px | Regular (400) | 기본 본문, 메시지 텍스트 |
| **Caption** | 12px (0.75rem) | 16px | Regular (400) | 타임스탬프, 부가 정보 |

### 4.3 Tailwind 유틸리티 매핑

```typescript
// tailwind.config.ts > theme.extend.fontSize
fontSize: {
  'display': ['2.25rem', { lineHeight: '2.75rem', fontWeight: '700' }],
  'h1':      ['1.75rem', { lineHeight: '2.25rem', fontWeight: '600' }],
  'h2':      ['1.375rem', { lineHeight: '1.875rem', fontWeight: '600' }],
  'h3':      ['1.125rem', { lineHeight: '1.625rem', fontWeight: '500' }],
  'body-lg': ['1rem',     { lineHeight: '1.5rem',   fontWeight: '400' }],
  'body':    ['0.875rem', { lineHeight: '1.25rem',  fontWeight: '400' }],
  'caption': ['0.75rem',  { lineHeight: '1rem',     fontWeight: '400' }],
}
```

---

## 5. 간격 시스템

### 5.1 스페이싱 스케일

| 토큰 | 값 | Tailwind | 용도 |
|------|----|----------|------|
| `xs` | 4px | `p-1`, `gap-1` | 아이콘과 텍스트 사이, 뱃지 내부 패딩 |
| `sm` | 8px | `p-2`, `gap-2` | 말풍선 내부 패딩, 리스트 아이템 간격 |
| `md` | 16px | `p-4`, `gap-4` | 카드 내부 패딩, 섹션 간격 |
| `lg` | 24px | `p-6`, `gap-6` | 페이지 여백, 큰 섹션 사이 |
| `xl` | 32px | `p-8`, `gap-8` | 레이아웃 큰 여백 |
| `2xl` | 48px | `p-12`, `gap-12` | 페이지 최상위 여백 |

### 5.2 레이아웃 간격 가이드

```
┌─ AppLayout ─────────────────────────────────────┐
│ ┌─ Sidebar (280px) ──┐ ┌─ ChatPanel ──────────┐ │
│ │  p-4 (16px)        │ │  p-0                 │ │
│ │                    │ │ ┌─ Header ──────────┐ │ │
│ │  [UserProfile]     │ │ │  px-6 py-4        │ │ │
│ │   mb-4             │ │ └───────────────────┘ │ │
│ │                    │ │ ┌─ MessageList ─────┐ │ │
│ │  [ChannelGroup]    │ │ │  px-6 py-4        │ │ │
│ │   gap-1 (아이템간) │ │ │  gap-2 (메시지간)  │ │ │
│ │                    │ │ └───────────────────┘ │ │
│ │  [ChannelGroup]    │ │ ┌─ Input ───────────┐ │ │
│ │   mt-6             │ │ │  px-6 py-4        │ │ │
│ └────────────────────┘ │ └───────────────────┘ │ │
│         gap-0          └───────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 6. 컴포넌트 라이브러리

> 모든 컴포넌트는 **shadcn/ui** 기반으로 커스터마이징합니다.

### 6.1 Button

| 변형 | 스타일 | 용도 |
|------|--------|------|
| **Primary** | `bg-primary text-white` (채움) | 주요 액션: 전송, 승인, 저장 |
| **Secondary** | `border border-secondary text-secondary` (테두리) | 보조 액션: 취소, 이전 |
| **Ghost** | `text-secondary hover:bg-secondary/10` (텍스트만) | 보조 링크, 더보기 |
| **Destructive** | `bg-error text-white` | 위험 액션: 반려, 삭제 |

**크기:**

| 사이즈 | 높이 | 패딩 | 폰트 | 용도 |
|--------|------|------|------|------|
| **L (Large)** | 48px | `px-6 py-3` | Body Large (16px) | 로그인 버튼, 주요 CTA |
| **M (Medium)** | 40px | `px-4 py-2` | Body (14px) | 일반 버튼 (기본값) |
| **S (Small)** | 32px | `px-3 py-1.5` | Caption (12px) | 인라인 버튼, 카드 내부 |

```tsx
// 사용 예시
<Button variant="primary" size="md">전송</Button>
<Button variant="secondary" size="sm">취소</Button>
<Button variant="ghost" size="sm">
  <MoreHorizontal className="w-4 h-4" />
</Button>
```

### 6.2 Input

| 상태 | 스타일 |
|------|--------|
| **기본** | `border-gray-200 bg-white` |
| **포커스** | `border-primary ring-2 ring-primary/20` |
| **에러** | `border-error ring-2 ring-error/20` + 에러 메시지 텍스트 |
| **비활성** | `bg-gray-50 text-gray-400 cursor-not-allowed` |

```tsx
// 기본 텍스트 입력
<Input placeholder="메시지를 입력하세요..." />

// 에러 상태
<div>
  <Input className="border-error" />
  <p className="text-error text-caption mt-1">필수 입력 항목입니다.</p>
</div>
```

### 6.3 Card

```
┌─────────────────────────────────────────┐
│  bg-surface                             │
│  border: 1px solid #E5E7EB (gray-200)   │
│  border-radius: 8px (rounded-lg)        │
│  shadow: shadow-sm                      │
│  padding: 16px (p-4)                    │
└─────────────────────────────────────────┘
```

```tsx
<Card className="bg-surface border border-gray-200 rounded-lg shadow-sm p-4">
  <CardHeader className="pb-3">
    <CardTitle className="text-h3">카드 제목</CardTitle>
  </CardHeader>
  <CardContent>
    {/* 내용 */}
  </CardContent>
</Card>
```

### 6.4 Badge (뱃지)

| 유형 | 스타일 | 용도 |
|------|--------|------|
| **AI** | `bg-purple-100 text-purple-700` | AI 자동응답 표시 |
| **직접 응답** | `bg-green-100 text-green-700` | 담당자 직접 응답 표시 |
| **안읽음** | `bg-primary text-white rounded-full` | 채널 안읽음 메시지 수 |
| **상태** | `bg-{status}-100 text-{status}-700` | 승인/반려/대기 상태 |
| **AI 응답 중** | `bg-blue-100 text-blue-700` | AI 처리 중인 채널 표시 |

```tsx
// AI 뱃지
<Badge className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5">
  AI
</Badge>

// 안읽음 카운트
<Badge className="bg-primary text-white rounded-full min-w-[20px] h-5 text-[11px]">
  3
</Badge>
```

### 6.5 Avatar (아바타)

| 크기 | 값 | 용도 |
|------|----|------|
| **sm** | 28px | 메시지 말풍선 옆 |
| **md** | 36px | 채널 목록 |
| **lg** | 48px | 사용자 프로필 |

```tsx
<Avatar className="w-7 h-7">       {/* sm: 메시지 */}
  <AvatarFallback className="bg-primary-light text-primary text-caption">
    정
  </AvatarFallback>
</Avatar>
```

---

## 7. 메시지 컴포넌트

### 7.1 TextBubble (텍스트 말풍선)

```tsx
interface TextBubbleProps {
  senderType: 'human' | 'llm' | 'system';
  senderName: string;
  isMe: boolean;
  isLlmAuto: boolean;
  text: string;
  timestamp: string;
}
```

**렌더링 규칙:**

```tsx
// isMe=true → 오른쪽 정렬, Primary 배경
<div className="flex justify-end">
  <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-3 py-2 max-w-[70%]">
    <p className="text-body">{text}</p>
    <span className="text-caption text-white/70">{timestamp}</span>
  </div>
</div>

// isMe=false, senderType='human' → 왼쪽 정렬, 회색 배경
<div className="flex gap-2">
  <Avatar size="sm" />
  <div>
    <span className="text-caption text-text-secondary">{senderName}</span>
    <div className="bg-[#F3F4F6] text-text-primary rounded-2xl rounded-tl-sm px-3 py-2">
      <p className="text-body">{text}</p>
    </div>
  </div>
</div>

// isMe=false, senderType='llm' → 왼쪽 정렬, 보라 배경 + AI 뱃지
<div className="flex gap-2">
  <Avatar size="sm" />
  <div>
    <div className="flex items-center gap-1.5">
      <span className="text-caption text-text-secondary">{senderName}</span>
      <Badge variant="ai">AI</Badge>
    </div>
    <div className="bg-[#F3E8FF] text-text-primary rounded-2xl rounded-tl-sm px-3 py-2">
      <p className="text-body">{text}</p>
    </div>
  </div>
</div>

// system → 가운데 정렬, 투명 배경
<div className="flex justify-center">
  <span className="text-caption text-gray-400">{text}</span>
</div>
```

### 7.2 ChannelItem (채널 목록 아이템)

```
┌─────────────────────────────────────────────┐
│ [아바타]  채널명/상대방 이름     [시간] [안읽음] │
│           마지막 메시지 미리보기...    [AI뱃지] │
└─────────────────────────────────────────────┘
```

```tsx
<div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg cursor-pointer">
  <Avatar size="md" />
  <div className="flex-1 min-w-0">
    <div className="flex items-center justify-between">
      <span className="text-body font-medium truncate">{channelName}</span>
      <span className="text-caption text-text-secondary">{lastMessageTime}</span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-caption text-text-secondary truncate">{lastMessage}</span>
      {unreadCount > 0 && <Badge variant="unread">{unreadCount}</Badge>}
    </div>
  </div>
</div>
```

### 7.3 TypingIndicator (입력 중 표시)

```tsx
// "AI가 입력 중..." 또는 "김민준님이 입력 중..."
<div className="flex items-center gap-2 px-4 py-1">
  <div className="flex gap-1">
    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
  </div>
  <span className="text-caption text-text-secondary">{userName}이(가) 입력 중...</span>
</div>
```

### 7.4 TakeoverButton (개입/넘기기 버튼)

담당자 전용 버튼. 채팅 헤더에 위치합니다.

```tsx
// AI가 처리 중일 때 (human_takeover=false)
<Button variant="secondary" size="sm" className="border-orange-300 text-orange-600">
  <UserCheck className="w-4 h-4 mr-1" />
  개입하기
</Button>

// 담당자가 직접 응답 중일 때 (human_takeover=true)
<Button variant="secondary" size="sm" className="border-primary text-primary">
  <Bot className="w-4 h-4 mr-1" />
  AI에게 넘기기
</Button>
```

---

## 8. 특수 카드 컴포넌트

### 8.1 LeaveBalanceCard (연차 현황 카드)

메시지 스트림 내에서 카드 형태로 표시됩니다.

```tsx
interface LeaveBalanceCardProps {
  total: number;       // 총 연차
  used: number;        // 사용
  pending: number;     // 승인대기
  remaining: number;   // 잔여
  expiresAt: string;   // 만료일
}
```

```
┌───────────────────────────────────────────┐
│  📋 2026년 연차 현황                        │
│                                           │
│  총 연차           15일                    │
│  사용               1일                    │
│  승인대기           0일                    │
│  잔여              14일                    │
│                                           │
│  ████████████████████████░░░░  14/15       │
│                                           │
│  📅 만료: 2027-03-01                       │
└───────────────────────────────────────────┘
```

```tsx
<Card className="bg-surface border border-gray-200 rounded-lg shadow-sm max-w-sm">
  <CardHeader className="pb-2">
    <CardTitle className="text-h3 flex items-center gap-2">
      <ClipboardList className="w-5 h-5 text-primary" />
      2026년 연차 현황
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
    {/* 항목별 수치 */}
    <div className="space-y-2">
      <div className="flex justify-between text-body">
        <span className="text-text-secondary">총 연차</span>
        <span className="font-medium font-mono">{total}일</span>
      </div>
      <div className="flex justify-between text-body">
        <span className="text-text-secondary">사용</span>
        <span className="font-medium font-mono">{used}일</span>
      </div>
      <div className="flex justify-between text-body">
        <span className="text-text-secondary">승인대기</span>
        <span className="font-medium font-mono">{pending}일</span>
      </div>
      <div className="flex justify-between text-body">
        <span className="text-text-secondary">잔여</span>
        <span className="font-semibold text-primary font-mono">{remaining}일</span>
      </div>
    </div>

    {/* 프로그레스 바 */}
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div
        className="bg-primary rounded-full h-2 transition-all"
        style={{ width: `${(remaining / total) * 100}%` }}
      />
    </div>

    {/* 만료일 */}
    <p className="text-caption text-text-secondary flex items-center gap-1">
      <Calendar className="w-3.5 h-3.5" />
      만료: {expiresAt}
    </p>
  </CardContent>
</Card>
```

### 8.2 ApprovalCard (결재 요청 카드)

상사(결재자)의 대화창에 표시되는 결재 요청 카드입니다.

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
```

```
┌───────────────────────────────────────────────┐
│  📋 휴가 승인 요청                              │
│                                               │
│  신청자    정인수 (개발팀)                       │
│  날짜      3/18(수) 연차 1일                    │
│  사유      개인사정                              │
│                                               │
│  ┌─ 🤖 AI 검토 결과 ───────────────────────┐   │
│  │  ✅ 팀 일정 충돌 없음                     │   │
│  │  ✅ 동일 날짜 팀원 휴가 없음              │   │
│  │  → 승인 추천                             │   │
│  └──────────────────────────────────────────┘   │
│                                               │
│  ⏰ 2시간 후 자동승인                           │
│                                               │
│  ┌────────┐ ┌────────┐ ┌─────────────┐        │
│  │ ✅ 승인 │ │ ❌ 반려 │ │ 💬 질문하기  │        │
│  └────────┘ └────────┘ └─────────────┘        │
└───────────────────────────────────────────────┘
```

```tsx
<Card className="bg-surface border border-gray-200 rounded-lg shadow-sm max-w-md">
  <CardHeader className="pb-2">
    <CardTitle className="text-h3 flex items-center gap-2">
      <ClipboardList className="w-5 h-5 text-primary" />
      휴가 승인 요청
    </CardTitle>
  </CardHeader>

  <CardContent className="space-y-4">
    {/* 신청 정보 */}
    <div className="space-y-1.5 text-body">
      <div className="flex gap-3">
        <span className="text-text-secondary w-12">신청자</span>
        <span className="font-medium">{employeeName}</span>
      </div>
      <div className="flex gap-3">
        <span className="text-text-secondary w-12">날짜</span>
        <span>{date} {leaveType} {days}일</span>
      </div>
      <div className="flex gap-3">
        <span className="text-text-secondary w-12">사유</span>
        <span>{reason}</span>
      </div>
    </div>

    {/* AI 검토 결과 */}
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
      <p className="text-caption font-medium text-blue-700 mb-2 flex items-center gap-1">
        <Bot className="w-3.5 h-3.5" />
        AI 검토 결과
      </p>
      <div className="space-y-1 text-body">
        <p className="flex items-center gap-1.5">
          {analysis.scheduleConflict
            ? <XCircle className="w-4 h-4 text-error" />
            : <CheckCircle className="w-4 h-4 text-success" />
          }
          팀 일정 충돌 {analysis.scheduleConflict ? '있음' : '없음'}
        </p>
        <p className="flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-success" />
          동일 날짜 팀원 휴가 {analysis.teamLeaves}명
        </p>
        <p className="text-caption text-blue-600 mt-1">
          → {analysis.recommendation === 'approve' ? '승인 추천' : '검토 필요'}
        </p>
      </div>
    </div>

    {/* 자동승인 타이머 */}
    <p className="text-caption text-warning flex items-center gap-1">
      <Clock className="w-3.5 h-3.5" />
      {autoApproveAt} 후 자동승인
    </p>

    {/* 액션 버튼 */}
    <div className="flex gap-2">
      <Button variant="primary" size="sm" className="flex-1">
        <Check className="w-4 h-4 mr-1" /> 승인
      </Button>
      <Button variant="destructive" size="sm" className="flex-1">
        <X className="w-4 h-4 mr-1" /> 반려
      </Button>
      <Button variant="ghost" size="sm">
        <MessageCircle className="w-4 h-4 mr-1" /> 질문하기
      </Button>
    </div>
  </CardContent>
</Card>
```

**버튼 동작:**

| 버튼 | API 호출 | 후속 동작 |
|------|----------|----------|
| **승인** | `POST /approvals/:id/decide { decision: "approved" }` | 승인 완료 알림, 카드 상태 변경 |
| **반려** | 사유 입력 모달 표시 → `POST /approvals/:id/decide { decision: "rejected", comment: "..." }` | 반려 알림 |
| **질문하기** | 텍스트 입력 활성화 | DM 또는 채널에서 직접 질문 |

---

## 9. 레이아웃

### 9.1 AppLayout (메인 레이아웃)

```
Desktop (> 1024px)
┌─────────────────────────────────────────────────────┐
│ ┌── Sidebar (280px) ──┐ ┌── ChatPanel (flex-1) ───┐ │
│ │                     │ │ ┌── Header ────────────┐ │ │
│ │ [UserProfile]       │ │ │ 채널명  [TakeoverBtn]│ │ │
│ │                     │ │ └──────────────────────┘ │ │
│ │ ── 다이렉트 메시지 ──│ │ ┌── MessageList ──────┐ │ │
│ │ [ChannelItem]       │ │ │                      │ │ │
│ │ [ChannelItem]       │ │ │  (메시지들)           │ │ │
│ │                     │ │ │                      │ │ │
│ │ ── 업무 ────────────│ │ │                      │ │ │
│ │ [ChannelItem] [AI]  │ │ │                      │ │ │
│ │                     │ │ │ [TypingIndicator]    │ │ │
│ │ ── AI가 처리 중 ────│ │ └──────────────────────┘ │ │
│ │ [ChannelItem]       │ │ ┌── MessageInput ─────┐ │ │
│ │                     │ │ │ [입력창]    [전송]    │ │ │
│ └─────────────────────┘ │ └──────────────────────┘ │ │
│                         └──────────────────────────┘ │
└─────────────────────────────────────────────────────┘

Mobile (< 768px)
┌───────────────────────┐     ┌───────────────────────┐
│ ☰ Palette AI          │     │ ← 정인수              │
│                       │     │                       │
│ ── 다이렉트 메시지 ──  │     │ (메시지들)             │
│ [ChannelItem]         │ ──→ │                       │
│ [ChannelItem]         │클릭  │                       │
│                       │     │                       │
│ ── 업무 ────────────  │     │ [TypingIndicator]     │
│ [ChannelItem] [AI]    │     │                       │
│                       │     │ [입력창]    [전송]      │
└───────────────────────┘     └───────────────────────┘
  사이드바 (전체 화면)            대화창 (전체 화면)
```

### 9.2 Sidebar 컴포넌트 구조

```tsx
<Sidebar className="w-[280px] border-r border-gray-200 bg-surface flex flex-col">
  {/* 사용자 프로필 */}
  <div className="p-4 border-b border-gray-100">
    <UserProfile />
  </div>

  {/* 채널 목록 (스크롤 가능) */}
  <div className="flex-1 overflow-y-auto py-2">
    <ChannelGroup title="다이렉트 메시지">
      <ChannelItem />
    </ChannelGroup>

    <ChannelGroup title="업무">
      <ChannelItem badge="AI" />
    </ChannelGroup>

    <ChannelGroup title="팀">
      <ChannelItem />
    </ChannelGroup>

    {/* 담당자 전용 */}
    <ChannelGroup title="AI가 처리 중" className="text-blue-600">
      <ChannelItem badge="AI 응답 중" />
    </ChannelGroup>
  </div>

  {/* 새 대화 버튼 */}
  <div className="p-4 border-t border-gray-100">
    <NewMessageButton />
  </div>
</Sidebar>
```

---

## 10. 접근성 (Accessibility)

### 10.1 필수 요구사항

| 항목 | 기준 | 구현 방법 |
|------|------|----------|
| **색상 대비** | WCAG AA 기준 4.5:1 이상 | 모든 텍스트-배경 조합 검증 |
| **포커스 링** | 키보드 탐색 시 포커스 명확 표시 | `focus-visible:ring-2 ring-primary` |
| **클릭 영역** | 최소 44x44px (터치 대상) | 버튼·링크 최소 크기 보장 |
| **에러 표시** | 색상만으로 구분하지 않음 | 아이콘 + 텍스트 병행 |
| **최소 폰트** | 본문 최소 14px | Body 기본 14px 이상 |

### 10.2 색상 대비 검증 결과

| 조합 | 전경 | 배경 | 대비 | 판정 |
|------|------|------|------|------|
| Primary 버튼 텍스트 | `#FFFFFF` | `#4A6CF7` | 4.6:1 | PASS (AA) |
| 본문 텍스트 | `#1F2937` | `#FFFFFF` | 14.7:1 | PASS (AAA) |
| 보조 텍스트 | `#6B7280` | `#FFFFFF` | 4.6:1 | PASS (AA) |
| AI 뱃지 텍스트 | `#7C3AED` | `#F3E8FF` | 5.2:1 | PASS (AA) |
| 내 메시지 타임스탬프 | `#FFFFFF/70` | `#4A6CF7` | 3.1:1 | 주의 (보조 정보) |

### 10.3 ARIA 가이드라인

```tsx
// 채널 목록: role="listbox"
<div role="listbox" aria-label="채널 목록">
  <div role="option" aria-selected={isActive}>
    {channelName}
  </div>
</div>

// 메시지: role="log" + aria-live
<div role="log" aria-live="polite" aria-label="대화 메시지">
  {messages.map(msg => (
    <div role="article" aria-label={`${msg.senderName}: ${msg.text}`}>
      {/* ... */}
    </div>
  ))}
</div>

// 에러 메시지: role="alert"
<div role="alert" className="text-error flex items-center gap-1">
  <AlertCircle className="w-4 h-4" />
  <span>연차가 부족합니다.</span>
</div>
```

---

## 11. 아이콘 시스템

### 11.1 아이콘 라이브러리: Lucide

- 공식 사이트: [lucide.dev](https://lucide.dev)
- React 패키지: `lucide-react`

### 11.2 크기 규격

| 사이즈 | 값 | Tailwind | 용도 |
|--------|----|----------|------|
| **Small** | 16px | `w-4 h-4` | 뱃지 내부, Caption 옆 |
| **Default** | 20px | `w-5 h-5` | 버튼 내부, 일반 아이콘 |
| **Large** | 24px | `w-6 h-6` | 헤더 아이콘, 강조 아이콘 |

### 11.3 색상 규칙

아이콘은 기본적으로 부모 요소의 텍스트 색상을 상속합니다.

```tsx
// 텍스트 색상 상속 (기본)
<span className="text-text-secondary">
  <Calendar className="w-5 h-5" />  {/* #6B7280 */}
</span>

// 명시적 색상 지정 (피드백 아이콘)
<CheckCircle className="w-5 h-5 text-success" />  {/* #22C55E */}
<XCircle className="w-5 h-5 text-error" />         {/* #EF4444 */}
<AlertTriangle className="w-5 h-5 text-warning" /> {/* #EAB308 */}
```

### 11.4 주요 사용 아이콘 매핑

| 용도 | 아이콘 | import |
|------|--------|--------|
| 전송 | `Send` | `lucide-react` |
| 개입하기 | `UserCheck` | `lucide-react` |
| AI에게 넘기기 | `Bot` | `lucide-react` |
| 휴가/캘린더 | `Calendar` | `lucide-react` |
| 승인 | `Check`, `CheckCircle` | `lucide-react` |
| 반려 | `X`, `XCircle` | `lucide-react` |
| 질문하기 | `MessageCircle` | `lucide-react` |
| 설정 | `Settings` | `lucide-react` |
| 검색 | `Search` | `lucide-react` |
| 알림 | `Bell` | `lucide-react` |
| 사용자 | `User`, `Users` | `lucide-react` |
| 메뉴 | `Menu` | `lucide-react` |
| 뒤로가기 | `ArrowLeft` | `lucide-react` |
| 더보기 | `MoreHorizontal` | `lucide-react` |
| 시간/타이머 | `Clock` | `lucide-react` |
| 경고 | `AlertTriangle` | `lucide-react` |
| 정보 | `Info` | `lucide-react` |
| 문서/리스트 | `ClipboardList` | `lucide-react` |

---

## 12. 반응형 디자인

### 12.1 브레이크포인트

| 이름 | 범위 | Tailwind | 레이아웃 변화 |
|------|------|----------|-------------|
| **Mobile** | < 768px | `기본` (mobile-first) | 사이드바 숨김, 햄버거 메뉴, 화면 전환 방식 |
| **Tablet** | 768px ~ 1024px | `md:` | 사이드바 축소 (아이콘만), 대화창 표시 |
| **Desktop** | > 1024px | `lg:` | 사이드바(280px) + 대화창 동시 표시 |

### 12.2 반응형 동작 상세

**Mobile (< 768px):**
- 사이드바와 대화창이 별도 화면으로 분리
- 채널 클릭 시 대화창으로 전환 (뒤로가기 버튼 표시)
- 햄버거 메뉴 (`Menu` 아이콘)로 사이드바 토글
- 메시지 입력창이 화면 하단에 고정

**Tablet (768px ~ 1024px):**
- 사이드바 축소: 아바타 + 안읽음 뱃지만 표시 (채널명 숨김)
- 사이드바 너비: 64px
- 대화창이 나머지 영역 차지

**Desktop (> 1024px):**
- 사이드바(280px) + 대화창이 좌우로 동시 표시
- 사이드바에 채널명, 마지막 메시지 미리보기 모두 표시

### 12.3 Tailwind 반응형 구현

```tsx
// AppLayout
<div className="flex h-screen bg-background">
  {/* Sidebar: 모바일에서 숨김, 태블릿에서 축소, 데스크톱에서 풀 */}
  <aside className={cn(
    "hidden md:flex flex-col border-r border-gray-200 bg-surface",
    "md:w-16 lg:w-[280px]",   // 태블릿: 64px, 데스크톱: 280px
  )}>
    {/* 채널명은 데스크톱에서만 표시 */}
    <span className="hidden lg:inline">{channelName}</span>
  </aside>

  {/* 모바일 사이드바: 오버레이 방식 */}
  <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
    <SheetContent side="left" className="w-[280px] p-0">
      <Sidebar />
    </SheetContent>
  </Sheet>

  {/* 메인 대화 영역 */}
  <main className="flex-1 flex flex-col min-w-0">
    {/* 모바일 헤더: 햄버거 메뉴 + 뒤로가기 */}
    <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b">
      <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
        <Menu className="w-5 h-5" />
      </Button>
      <span className="text-h3 font-medium">{channelName}</span>
    </header>

    <ChatPanel />
  </main>
</div>
```

---

## 13. 모션 및 트랜지션

### 13.1 기본 원칙

- **빠르고 자연스럽게**: 업무 도구에서 과도한 애니메이션은 방해
- **목적이 있는 모션만**: 상태 변화, 피드백 전달 용도로만 사용
- **시간**: 기본 150ms, 진입/퇴장 200ms

### 13.2 트랜지션 토큰

```css
:root {
  --duration-fast: 100ms;      /* hover, 색상 변화 */
  --duration-normal: 150ms;    /* 기본 전환 */
  --duration-slow: 200ms;      /* 진입/퇴장, 모달 */
  --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 13.3 적용 대상

| 요소 | 트랜지션 | 시간 |
|------|----------|------|
| 버튼 hover | 배경색, 테두리 | 100ms |
| 사이드바 채널 hover | 배경색 | 100ms |
| 새 메시지 진입 | 아래에서 위로 fade-in | 200ms |
| 모달/Sheet 열기 | 슬라이드 + fade | 200ms |
| 타이핑 인디케이터 | bounce 애니메이션 | 반복 |
| 프로그레스 바 | width 변화 | 300ms |

---

## 14. 다크 모드 (Phase 2)

Phase 1에서는 라이트 모드만 지원합니다. 추후 다크 모드 지원을 위해 시맨틱 색상 변수를 사용합니다.

```css
/* Phase 2에서 추가할 다크 모드 변수 */
:root {
  --color-surface: #FFFFFF;
  --color-background: #F8F9FC;
  --color-text-primary: #1F2937;
  --color-text-secondary: #6B7280;
  --color-border: #E5E7EB;
}

/* [data-theme="dark"] 또는 .dark 클래스 */
.dark {
  --color-surface: #1E1E2E;
  --color-background: #11111B;
  --color-text-primary: #CDD6F4;
  --color-text-secondary: #A6ADC8;
  --color-border: #313244;
}
```

---

## 15. 파일 구조 (apps/messenger)

```
apps/messenger/
├── public/
│   └── fonts/
│       └── PretendardVariable.woff2
├── src/
│   ├── app/
│   │   ├── globals.css          # Tailwind + 커스텀 CSS 변수
│   │   ├── layout.tsx           # 루트 레이아웃 (폰트, 프로바이더)
│   │   └── (chat)/
│   │       └── page.tsx         # 메인 채팅 페이지
│   ├── components/
│   │   ├── ui/                  # shadcn/ui 컴포넌트 (Button, Input, Card, Badge, ...)
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ChatPanel.tsx
│   │   │   └── ChatHeader.tsx
│   │   ├── channel/
│   │   │   ├── ChannelGroup.tsx
│   │   │   ├── ChannelItem.tsx
│   │   │   └── NewMessageButton.tsx
│   │   ├── message/
│   │   │   ├── MessageList.tsx
│   │   │   ├── TextBubble.tsx
│   │   │   ├── CardMessage.tsx
│   │   │   ├── SystemNotification.tsx
│   │   │   └── TypingIndicator.tsx
│   │   ├── cards/
│   │   │   ├── LeaveBalanceCard.tsx
│   │   │   └── ApprovalCard.tsx
│   │   ├── chat/
│   │   │   ├── MessageInput.tsx
│   │   │   └── TakeoverButton.tsx
│   │   └── user/
│   │       ├── UserProfile.tsx
│   │       └── Avatar.tsx
│   ├── hooks/
│   │   └── useSocket.ts         # Socket.IO 연결
│   ├── stores/
│   │   └── chat-store.ts        # Zustand 상태 관리
│   ├── lib/
│   │   ├── utils.ts             # cn() 등 유틸리티
│   │   └── api.ts               # API 클라이언트
│   └── styles/
│       └── theme.ts             # 색상, 타이포 상수 export
```

---

## 16. 디자인 토큰 요약 (Quick Reference)

```typescript
// styles/theme.ts

export const COLORS = {
  primary:       '#4A6CF7',
  primaryLight:  '#E8EDFE',
  primaryHover:  '#3B5DE6',
  secondary:     '#6B7280',
  surface:       '#FFFFFF',
  background:    '#F8F9FC',
  textPrimary:   '#1F2937',
  textSecondary: '#6B7280',
  success:       '#22C55E',
  warning:       '#EAB308',
  error:         '#EF4444',
  info:          '#3B82F6',
} as const;

export const BUBBLE_COLORS = {
  me:             { bg: '#4A6CF7', text: '#FFFFFF' },
  human:          { bg: '#F3F4F6', text: '#1F2937' },
  llm:            { bg: '#F3E8FF', text: '#1F2937' },
  humanTakeover:  { bg: '#ECFDF5', text: '#1F2937' },
  system:         { bg: 'transparent', text: '#9CA3AF' },
} as const;

export const FONT_SIZE = {
  display:  '2.25rem',   // 36px
  h1:       '1.75rem',   // 28px
  h2:       '1.375rem',  // 22px
  h3:       '1.125rem',  // 18px
  bodyLg:   '1rem',      // 16px
  body:     '0.875rem',  // 14px
  caption:  '0.75rem',   // 12px
} as const;

export const SPACING = {
  xs:  '4px',
  sm:  '8px',
  md:  '16px',
  lg:  '24px',
  xl:  '32px',
  xxl: '48px',
} as const;

export const BREAKPOINTS = {
  mobile:  768,
  tablet:  1024,
  desktop: 1280,
} as const;

export const ICON_SIZE = {
  sm: 16,    // w-4 h-4
  md: 20,    // w-5 h-5
  lg: 24,    // w-6 h-6
} as const;
```
