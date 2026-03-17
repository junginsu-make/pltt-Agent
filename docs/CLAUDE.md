# Palette AI - 회사 메신저 + AI 통합 플랫폼

## 이 프로젝트가 뭔가

회사 내부 메신저(Slack 같은)인데, 모든 사용자에게 AI LLM이 붙어 있다.
사람끼리 직접 대화도 하고, AI가 업무를 자동으로 처리해주기도 한다.

### 핵심 공식: 사용자 = 사람 + LLM

- 직원이 "휴가 며칠 남았어?" → 담당자의 LLM이 DB 조회해서 자동 응답
- 대표가 "팀장 호출해줘" → 대표의 LLM(비서)이 팀장에게 알림 → 대표와 팀장이 직접 메신저 대화
- 담당자가 LLM의 자동 응답을 보다가 "내가 직접 할게" → 개입해서 본인이 응답

### 3가지 동시 동작

1. **메신저**: 사람 ↔ 사람 직접 대화 (DM). LLM 관여 없음.
2. **AI 어시스턴트**: 사람 → LLM 자동 응답. 담당자의 LLM이 DB 조회하고 업무 처리.
3. **담당자 개입**: LLM이 처리 중인 대화에 담당자(사람)가 끼어들어 직접 응답 가능.

### 회사 통합 AI

누구든(대표, 팀장, 직원 등) 회사 정보를 물어보면 AI가 DB를 조회해서 답해줌.
- 대표: "직원 A 일정 알려줘" → AI가 DB 조회 → "3월 18일 휴가 예정입니다"
- 팀장: "이번 달 팀 휴가 현황" → AI가 팀원 휴가 목록 조회
- 직원: "내 연차 며칠 남았어?" → AI가 연차 잔여 조회
각 사용자의 LLM이 비서 역할을 겸하되, 업무별 전문 LLM(휴가 담당 등)이 따로 있음.

## Phase 1 범위: 경영지원팀 휴가 관리

### 참여자 (5명)

| 사용자 | LLM 역할 | 설명 |
|--------|---------|------|
| 대표 | 비서 (일정 조회, 사람 호출) | 모든 사람과 직접 대화 가능 |
| 경영지원팀장 | 팀 현황 보조 | 대표와 직접 대화, 팀 관리 |
| 휴가 담당자 | 휴가 업무 자동 처리 | 직원 질문에 LLM 자동 응답 + 본인 직접 개입 가능 |
| 직원 A (정인수) | 의도 파악 + 라우팅 | 휴가 → 담당자 LLM 연결, DM → 직접 전달 |
| 직원 A 상사 (김민준) | 결재 보조 | 승인 요청 분석 + 추천 |

## 기술 스택

- Runtime: Node.js 20+ / TypeScript (strict mode)
- Frontend: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- Backend: Hono (경량 프레임워크) 또는 Express
- DB: PostgreSQL 15 (Supabase) + pgvector
- 실시간: Socket.IO
- LLM: Anthropic Claude API (claude-haiku-4-5-20251001 기본)
- 상태관리: Zustand
- ORM: Drizzle ORM
- 인증: JWT
- 캐시/메시징: Redis 7
- 모노레포: pnpm workspace

## 프로젝트 구조

```
palette-platform/
  apps/
    messenger/              # Next.js 메신저 UI (포트 3010)
    admin/                  # Next.js Admin UI (포트 3020)
  services/
    messaging-server/       # WebSocket 허브 + 메시지 라우팅 (포트 3000)
    ai-runtime/             # LLM 호출 + Tool 실행 (포트 3100)
    leave-service/          # 휴가 CRUD API (포트 3001)
    approval-service/       # 결재 워크플로우 (포트 3002)
    notification-service/   # 알림 (포트 3003)
    scheduler/              # 정기 작업 (포트 3004)
  packages/
    shared/                 # 공통 타입, 유틸, 에러 코드
    db/                     # Drizzle 스키마, 마이그레이션, seed
  docs/                     # 설계 문서 (아래 파일들)
    ARCHITECTURE.md
    DATABASE.md
    API.md
    LLM.md
    FRONTEND.md
    SCENARIOS.md
  docker-compose.yml
  pnpm-workspace.yaml
  CLAUDE.md                 # 이 파일
```

## 핵심 설계 문서 (반드시 읽을 것)

각 Step을 시작하기 전에 관련 문서를 참조하세요:

| 문서 | 내용 | 참조 시점 |
|------|------|----------|
| docs/ARCHITECTURE.md | 4개 레이어, 메시지 라우팅, 채널 구조, Human Takeover | 항상 |
| docs/DATABASE.md | 13개 테이블 DDL + seed SQL | Step 1 |
| docs/API.md | 전체 REST API Request/Response | Step 1~3 |
| docs/LLM.md | System Prompt, Tool 정의, 파이프라인 코드 | Step 3 |
| docs/FRONTEND.md | 컴포넌트 트리, Socket.IO 이벤트, 상태 관리 | Step 4~5 |
| docs/SCENARIOS.md | 시나리오 A/B/C + 에러 케이스 18개 | 테스트 시 |

## 개발 순서

### Step 1: DB + 비즈니스 서비스
```
docs/DATABASE.md를 읽고:
1. pnpm 모노레포 초기 설정 (pnpm-workspace.yaml, 루트 package.json, tsconfig)
2. packages/db 생성: Drizzle 스키마 정의 (DATABASE.md의 DDL을 Drizzle 형태로)
3. 마이그레이션 실행 + seed 데이터 (5명 참여자 + 팀 + 연차 정책 + 2026 공휴일)
4. packages/shared 생성: 공통 타입, 에러 코드, 유틸
5. services/leave-service 구현: API.md의 /leave/* 엔드포인트 전부
6. services/approval-service 구현: API.md의 /approvals/* 엔드포인트 전부
7. 테스트: curl로 정인수 연차 조회 → 날짜 검증 → 휴가 신청 → 결재 승인 전체 흐름
```

### Step 2: 메시징 서버
```
docs/ARCHITECTURE.md를 읽고:
1. services/messaging-server 생성: Socket.IO 서버
2. 채널 관리: DM/업무/팀/알림 채널 CRUD
3. 메시지 라우팅 로직: 사람→사람(DM), 사람→LLM(업무), LLM→사람(알림)
4. Human Takeover: 담당자 개입/복귀 메커니즘
5. 온라인 상태 관리 (Redis)
6. 테스트: 두 사용자가 DM으로 직접 대화하는 것이 작동하는지 확인
```

### Step 3: AI 런타임
```
docs/LLM.md를 읽고:
1. services/ai-runtime 생성
2. LLM Adapter: Claude Haiku 연동
3. 사용자별 LLM 로드: DB에서 system_prompt, tools 가져와서 호출
4. Tool Executor: query_leave_balance, validate_date, submit_leave_request 구현
5. messaging-server와 연동: 메시지 수신 → LLM 호출 → 응답 전송
6. 테스트: 정인수가 "휴가 몇개 남았어?" → LLM이 DB 조회 → "14개 남았습니다"
```

### Step 4: 메신저 프론트엔드
```
docs/FRONTEND.md를 읽고:
1. apps/messenger 생성: Next.js 14
2. 로그인 + JWT 인증
3. 채널 목록 (사이드바) + 대화창 (메인)
4. Socket.IO 연결: 실시간 메시지
5. 메시지 유형별 렌더링: 사람/AI/시스템 구분, 카드(연차 현황, 승인 요청)
6. 담당자용: [개입하기] [AI에게 넘기기] 버튼
7. 테스트: 시나리오 A 전체 E2E (직원 휴가 신청 → 상사 승인)
```

### Step 5: Admin + 나머지
```
1. apps/admin 생성: 직원 관리, 연차 설정, 감사 로그
2. services/notification-service: 메신저 내 알림 + Telegram
3. services/scheduler: 연차 자동 발생, 자동승인 타임아웃
4. 통합 테스트: docs/SCENARIOS.md의 모든 시나리오
```

## 코딩 규칙

### TypeScript
- strict mode 필수
- interface 우선 (type은 union일 때만)
- 함수/변수: camelCase, 타입: PascalCase, 상수: UPPER_SNAKE_CASE
- 모든 함수에 return type 명시

### API 응답 형식
```typescript
// 성공
{ "data": T, "meta"?: { pagination, etc } }

// 에러
{ "error": { "code": "LV_001", "message": "연차가 부족합니다", "details"?: any } }
```

### 에러 처리
- 커스텀 AppError 클래스 사용 (packages/shared)
- 에러 코드: LV_001~005(휴가), AP_001~002(결재), SYS_001~002(시스템)
- 상세: docs/SCENARIOS.md Part 1 참조

### Git
- 커밋 메시지: `feat: 휴가 신청 API 구현`, `fix: 날짜 검증 주말 처리`
- 브랜치: `step-1/db-setup`, `step-2/messaging-server` 등

### 환경 변수 (.env)
```
ANTHROPIC_API_KEY=         # Claude API
DATABASE_URL=              # PostgreSQL
REDIS_URL=redis://localhost:6379
JWT_SECRET=                # 아무 긴 문자열
TELEGRAM_BOT_TOKEN=        # 나중에 설정
```
