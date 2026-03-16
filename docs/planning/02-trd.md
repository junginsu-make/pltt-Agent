# TRD (Technical Requirements Document)

> Palette AI - 회사 메신저 + AI 통합 플랫폼
> 버전: 1.0 | 작성일: 2026-03-16

---

## 1. MVP 캡슐

### 1.1 목표

AI가 HR 반복 업무를 자동 처리하는 회사 메신저를 구축한다.

- 사람 간 실시간 메시지 교환 (DM)
- AI LLM이 업무별 담당자를 대신하여 자동 응답 및 업무 처리
- 담당자(사람)가 AI 대화에 개입하여 직접 응답 가능 (Human Takeover)
- 경영지원팀 휴가 관리를 Phase 1 범위로 한정

### 1.2 페르소나

| ID | 이름 | 역할 | LLM 역할 | 설명 |
|----|------|------|---------|------|
| EMP-CEO | 대표 | CEO | 비서 (secretary) | 전사 일정 조회, 사람 호출, 모든 사람과 직접 대화 가능 |
| EMP-MGMT-LEADER | 경영지원팀장 | HR Manager | 팀 현황 보조 (team_assistant) | 대표와 직접 대화, 팀 관리 |
| EMP-HR-001 | 휴가 담당자 | HR Staff | 휴가 업무 자동 처리 (work_assistant) | 직원 질문에 LLM 자동 응답 + 본인 직접 개입 가능 |
| EMP-001 | 정인수 (직원 A) | Employee | 의도 파악 + 라우팅 (router) | 휴가 질문 시 담당자 LLM 연결, DM은 직접 전달 |
| EMP-DEV-LEADER | 김민준 (상사) | Manager | 결재 보조 (approver) | 승인 요청 분석 + 추천, 최종 결정은 사람이 수행 |

### 1.3 핵심 기능

#### FEAT-1: 메신저 + AI 자동응답

| 항목 | 내용 |
|------|------|
| 설명 | 회사 내부 메신저에 사용자별 AI LLM을 연동하여 업무 자동 처리 |
| 채널 유형 | direct (1:1 DM), work (업무), team (팀), notification (알림), company (전사) |
| 메시지 라우팅 | messaging-server(L3)가 모든 메시지의 허브. DM은 직접 전달, 업무 채널은 AI 자동 응답 |
| Human Takeover | 담당자(사람)가 AI 대화에 [개입하기] 클릭 시 LLM 중지, [AI에게 넘기기] 클릭 시 LLM 재개 |
| 사람 호출 | 대표가 "경영지원팀장 호출해줘" 시 DM 채널 생성 + 호출 알림 전송 |
| 실시간 통신 | WebSocket (Socket.IO) 기반 실시간 메시지 전달, 타이핑 표시, 온라인 상태 |

#### FEAT-2: 휴가 신청/결재 시스템

| 항목 | 내용 |
|------|------|
| 설명 | AI가 대화형으로 휴가 신청을 처리하고, 상사에게 결재 카드를 전송 |
| 신청 흐름 | 잔여 조회 -> 날짜 검증 -> 사유 확인 -> 신청 확인 -> DB 저장 -> 결재 요청 생성 |
| 결재 흐름 | AI가 팀 일정 분석 -> 승인/반려 추천 -> 상사(사람)가 최종 결정 |
| 자동 승인 | 2시간 미응답 시 자동 승인 (scheduler 서비스) |
| 알림 | 신청 시 상사/담당자/팀장에게 알림, 승인/반려 시 신청자에게 알림 |
| 에러 처리 | 연차 부족, 주말/공휴일, 중복 신청, 과거 날짜, 팀원 충돌 등 18개 에러 케이스 |

### 1.4 성공 지표 (Exit Criteria)

| 지표 | 기준 | 측정 방법 |
|------|------|----------|
| 시나리오 A E2E 동작 | 직원 휴가 신청 -> 상사 승인 전체 흐름 통과 | Playwright E2E 테스트 |
| 시나리오 B E2E 동작 | 대표 일정 조회 + 팀장 호출 -> DM 대화 통과 | Playwright E2E 테스트 |
| 시나리오 C E2E 동작 | 담당자 Human Takeover 개입/복귀 통과 | Playwright E2E 테스트 |
| 전체 시나리오 통과 | 3개 시나리오 모두 E2E 성공 | CI/CD 파이프라인 |

### 1.5 입력 지표 (Input Metrics)

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| AI 자동 처리율 | 휴가 관련 질문의 90% 이상 AI가 Tool 호출로 정확 응답 | audit_log 분석 |
| 평균 처리 시간 | 사용자 메시지 수신 -> AI 응답 전달 5초 이내 | 서버 로그 타임스탬프 차이 |
| LLM 응답 정확도 | Tool 호출 결과와 LLM 응답 숫자 일치율 100% | post-processing 검증 |
| 메시지 전달 성공률 | WebSocket 메시지 전달 99.9% | Socket.IO 이벤트 로그 |

### 1.6 비기능 요구사항

| 항목 | 요구사항 | 비고 |
|------|---------|------|
| 실시간성 | 메시지 전달 지연 < 500ms | WebSocket (Socket.IO) |
| 반응형 | 웹 + 모바일 브라우저 반응형 | Tailwind CSS 반응형 |
| 인증 | JWT Bearer Token 방식 | bcrypt 비밀번호 해싱 |
| 보안 | HTTPS 필수, CORS 설정, 서버사이드 입력 검증 | - |
| 감사 | 모든 업무 처리 내역 audit_log 기록 | INSERT만 허용, UPDATE/DELETE 차단 |
| 가용성 | Docker Compose 기반 로컬 개발 환경 | 단일 인스턴스 |
| 데이터 무결성 | PostgreSQL 트랜잭션 + UNIQUE 제약 | Race Condition 방지 |

### 1.7 Out-of-scope (Phase 1 범위 외)

| 항목 | 사유 |
|------|------|
| 네이티브 앱 (iOS/Android) | Phase 1은 웹 반응형으로 충분 |
| B2B SaaS 멀티테넌시 | 단일 회사 내부 시스템으로 시작 |
| Google Calendar 연동 | Phase 2에서 선택적 연동. Phase 1은 DB calendar_events 테이블로 관리 |
| Telegram 외부 알림 | notification-service 구조만 설계, 실제 Telegram 연동은 Phase 2 |
| SSO/OAuth 연동 | Phase 1은 이메일/비밀번호 JWT 인증 |
| 파일 첨부/이미지 전송 | Phase 1은 텍스트/카드 메시지만 지원 |
| 다국어 지원 | Phase 1은 한국어 전용 |

### 1.8 Top 리스크

| 순위 | 리스크 | 영향도 | 발생 가능성 |
|------|--------|--------|-----------|
| 1 | LLM 할루시네이션으로 잘못된 업무 처리 | 높음 (잘못된 연차 정보 제공, 미승인 휴가 신청) | 중간 |
| 2 | WebSocket 연결 불안정 | 중간 (메시지 유실, 실시간성 저하) | 중간 |
| 3 | LLM API 호출 실패/지연 | 중간 (AI 응답 불가) | 낮음 |
| 4 | 동시 요청 Race Condition | 높음 (데이터 불일치) | 낮음 |

### 1.9 완화/실험

| 리스크 | 완화 전략 |
|--------|----------|
| LLM 할루시네이션 | (1) 숫자 데이터는 반드시 Tool 호출 강제 (System Prompt에 명시) (2) Tool 결과와 LLM 응답의 숫자 비교 (post-processing 검증) (3) submit_leave_request 호출 없이 "완료" 메시지 시 무효 처리 (4) Human Takeover: 담당자가 언제든 개입하여 직접 응답 가능 |
| WebSocket 불안정 | (1) 자동 재연결 (1초, 2초, 4초... 최대 30초 간격) (2) 재연결 시 놓친 메시지 자동 조회 (3) UI 연결 상태 배너 표시 |
| LLM API 실패 | (1) 3회 재시도 (1초, 2초, 4초 간격) (2) 실패 시 사용자에게 안내 메시지 + 감사 로그 기록 (3) 관리자 알림 |
| Race Condition | (1) DB UNIQUE 제약 + 트랜잭션 (2) 중복 요청 시 기존 에러 코드(LV_003)로 처리 |

### 1.10 다음 단계

Phase 2 프로젝트 셋업:
- Google Calendar API 연동 (승인된 휴가 자동 등록)
- Telegram 외부 알림 연동
- 추가 업무 도메인 확장 (출장, 경비, 근태 등)
- 멀티테넌시 SaaS 구조 전환 검토
- 네이티브 모바일 앱 검토

---

## 2. 시스템 아키텍처

### 2.1 4-Layer 아키텍처

```
Layer 4: 메신저 프론트엔드  <- 사용자가 보는 화면 (Next.js)
Layer 3: 메시징 서버       <- 모든 메시지의 허브 (라우팅 판단, Socket.IO)
Layer 2: AI 런타임         <- LLM 호출, Tool 실행 (Claude API)
Layer 1: 비즈니스 서비스    <- DB, 휴가 CRUD, 결재, Admin
```

### 2.2 레이어 상세

| Layer | 서비스 | 포트 | 역할 |
|-------|--------|------|------|
| L4 | apps/messenger | 3010 | 메신저 UI (사용자 화면) |
| L4 | apps/admin | 3020 | 관리자 UI (직원/연차/감사 관리) |
| L3 | services/messaging-server | 3000 | WebSocket 허브, 메시지 라우팅, 채널 관리 |
| L2 | services/ai-runtime | 3100 | LLM 호출, Tool 실행, 사용자별 LLM 설정 로드 |
| L1 | services/leave-service | 3001 | 휴가 CRUD API (잔여 조회, 날짜 검증, 신청) |
| L1 | services/approval-service | 3002 | 결재 워크플로우 (대기, 승인, 반려) |
| L1 | services/notification-service | 3003 | 알림 전송 (메신저 내 + Telegram) |
| L1 | services/scheduler | 3004 | 정기 작업 (연차 자동 발생, 자동승인 타임아웃) |

### 2.3 서비스 간 통신

```
messenger-frontend <--WebSocket--> messaging-server
                                       |
                                       | (HTTP)
                                       v
                                  ai-runtime <---> Claude API (Anthropic SDK)
                                       |
                                       | (HTTP, Tool 실행)
                                       v
                               leave-service <---> PostgreSQL (Drizzle ORM)
                               approval-service <---> PostgreSQL (Drizzle ORM)
                                       |
                                       | (HTTP)
                                       v
                               notification-service ---> Telegram API
```

| 통신 경로 | 프로토콜 | 설명 |
|-----------|---------|------|
| messenger-frontend <-> messaging-server | WebSocket (Socket.IO) | 실시간 메시지 송수신 |
| messaging-server -> ai-runtime | HTTP | LLM 응답이 필요한 메시지 전달 |
| ai-runtime -> leave-service | HTTP | Tool 실행 시 휴가 API 호출 |
| ai-runtime -> approval-service | HTTP | Tool 실행 시 결재 API 호출 |
| approval-service -> messaging-server | HTTP | 결재 결과 알림 전송 |
| 모든 서비스 -> PostgreSQL | TCP (Drizzle ORM) | 데이터 영속화 |
| messaging-server <-> Redis | TCP | 세션, 온라인 상태, Pub/Sub |

### 2.4 메시지 흐름

#### Case 1: 사람 -> 사람 (DM)
```
대표(사람) -> messaging-server -> 경영지원팀장(사람)
```
- LLM 관여 없음. 순수 메신저. channel.type = 'direct'

#### Case 2: 사람 -> LLM (업무 질문)
```
직원 A(사람) -> messaging-server -> [의도 분석] -> ai-runtime -> 휴가 담당자 LLM
                                                                     |
                                                         leave-service (DB 조회)
                                                                     |
직원 A(사람) <- messaging-server <- ai-runtime <- 휴가 담당자 LLM 응답 생성
```

#### Case 3: 담당자(사람) 개입 (Human Takeover)
```
직원 A(사람) -> messaging-server -> ai-runtime -> 휴가 담당자 LLM 자동 응답 중...

[휴가 담당자(사람)가 [개입하기] 클릭]
  -> POST /messenger/takeover { channel_id, action: "takeover" }
  -> channel.human_takeover = true, LLM 자동 응답 중지
  -> 담당자(사람)가 직접 타이핑하여 응답

[휴가 담당자(사람)가 [AI에게 넘기기] 클릭]
  -> POST /messenger/takeover { channel_id, action: "release" }
  -> channel.human_takeover = false, LLM 자동 응답 재개
```

#### Case 4: LLM -> 사람 (자동 알림)
```
leave-service가 휴가 신청 처리 완료
  -> approval-service가 결재 요청 생성
  -> messaging-server가 상사에게 알림 메시지 전송
  -> 상사의 WebSocket으로 결재 요청 카드 표시
```

### 2.5 채널 구조

| type | 설명 | LLM 관여 | 예시 |
|------|------|---------|------|
| direct | 1:1 사람<->사람 | 없음 | 대표 <-> 팀장 |
| work | 업무 주제 채널 | 담당자 LLM 자동 응답 | 직원 -> 휴가 채널 |
| team | 팀 공유 채널 | 팀장 LLM 보조 | 경영지원팀 채널 |
| notification | 알림 수신 | LLM/시스템이 발신 | 결재 알림, 승인 알림 |
| company | 전사 | 대표 LLM(비서) 보조 | 대표가 "직원 A 일정 알려줘" |

### 2.6 메시지 라우팅 로직

```typescript
function routeMessage(message: IncomingMessage, channel: Channel): RouteDecision {
  // 1. DM 채널 -> 직접 전달, LLM 없음
  if (channel.type === 'direct') {
    return { type: 'direct', targetChannel: channel.id, llmRequired: false };
  }
  // 2. 담당자(사람) 개입 중 -> LLM 자동 응답 중지
  if (channel.human_takeover) {
    return { type: 'takeover_human', targetChannel: channel.id, llmRequired: false };
  }
  // 3. 발신자가 LLM -> 무한루프 방지
  if (message.sender.type === 'llm') {
    return { type: 'direct', targetChannel: channel.id, llmRequired: false };
  }
  // 4. 업무/전사 채널에서 사람이 보낸 메시지 -> LLM 응답
  if (['work', 'company'].includes(channel.type) && message.sender.type === 'human') {
    return {
      type: 'llm',
      targetChannel: channel.id,
      llmRequired: true,
      llmUserId: channel.assigned_llm,
    };
  }
  // 5. 그 외 -> 직접 전달
  return { type: 'direct', targetChannel: channel.id, llmRequired: false };
}
```

---

## 3. 기술 스택

| 영역 | 선택 | 사유 |
|------|------|------|
| Runtime | Node.js 20+ / TypeScript (strict mode) | 프론트엔드/백엔드 언어 통일, 타입 안전성 |
| Backend Framework | Hono | 초경량, Edge Runtime 호환, 빠른 라우팅 |
| Frontend Framework | Next.js 14 (App Router) | SSR 지원, 메신저 + Admin 모두 대응 |
| UI 컴포넌트 | shadcn/ui + Tailwind CSS | Kakao Work 스타일 커스터마이징 가능, 빠른 개발 |
| 상태 관리 | Zustand | 가볍고 보일러플레이트 최소, 클라이언트 상태 관리 |
| 데이터베이스 | PostgreSQL 15 + pgvector | Drizzle ORM, Supabase 호스팅, 벡터 검색 확장 가능 |
| 캐시/메시징 | Redis 7 | 세션 관리, 온라인 상태, Pub/Sub 메시지 브로커 |
| 실시간 통신 | Socket.IO | WebSocket 추상화, 자동 재연결, 폴백 지원 |
| AI/LLM | Claude API (Anthropic SDK) | LLM Adapter 패턴으로 모델 교체 가능 |
| 인증 | JWT (Bearer Token) | bcrypt 비밀번호 해싱 |
| 모노레포 | pnpm workspace | 패키지 공유, 의존성 호이스팅 |
| 컨테이너 | Docker Compose | 로컬 개발 환경 통합 (PostgreSQL, Redis, 전체 서비스) |
| 테스트 | Vitest + Playwright | 단위/통합 테스트 + E2E 브라우저 테스트 |
| ORM | Drizzle ORM | TypeScript 네이티브, 스키마 기반 마이그레이션 |

### 3.1 LLM 모델 선택

| 역할 | 모델 | 사유 |
|------|------|------|
| 라우터 (router) | claude-haiku-4-5 | 빠르고 저렴. 의도 분석만 수행 |
| 휴가 담당 (work_assistant) | claude-haiku-4-5 | 정형화된 업무. 빠른 응답 중요 |
| 결재 보조 (approver) | claude-sonnet-4 | 판단이 필요. 정확성 중요 |
| 비서 (secretary) | claude-haiku-4-5 | 조회+전달 위주. 빠른 응답 중요 |

---

## 4. 프로젝트 구조

```
palette-platform/
  apps/
    messenger/                  # Next.js 메신저 UI (포트 3010)
    admin/                      # Next.js Admin UI (포트 3020)
  services/
    messaging-server/           # WebSocket 허브 + 메시지 라우팅 (포트 3000)
    ai-runtime/                 # LLM 호출 + Tool 실행 (포트 3100)
    leave-service/              # 휴가 CRUD API (포트 3001)
    approval-service/           # 결재 워크플로우 (포트 3002)
    notification-service/       # 알림 (포트 3003)
    scheduler/                  # 정기 작업 (포트 3004)
  packages/
    shared/                     # 공통 타입, 유틸, 에러 코드
    db/                         # Drizzle 스키마, 마이그레이션, seed
  docs/
    planning/                   # 기획/설계 문서
    ARCHITECTURE.md
    DATABASE.md
    API.md
    LLM.md
    FRONTEND.md
    SCENARIOS.md
  docker-compose.yml
  pnpm-workspace.yaml
  CLAUDE.md
```

### 4.1 패키지 의존 관계

```
apps/messenger     -> packages/shared
apps/admin         -> packages/shared
services/*         -> packages/shared, packages/db
packages/db        -> packages/shared
```

---

## 5. API 명세

모든 API Base URL: `http://localhost:{port}/api/v1`

### 5.1 인증 API (messaging-server :3000)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /auth/login | 이메일/비밀번호 로그인. JWT 토큰 반환 |

인증 헤더: `Authorization: Bearer {token}` (로그인 제외 모든 API에 필요)

### 5.2 메신저 API (messaging-server :3000)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /messenger/send | 메시지 전송. 라우팅 판단 포함. 실제 응답은 WebSocket |
| POST | /messenger/dm | 1:1 DM 전송. DM 채널 없으면 자동 생성 |
| POST | /messenger/call | 사람 호출 (알림 전송 + DM 채널 준비) |
| POST | /messenger/takeover | 담당자 개입(takeover) / 복귀(release) |
| GET | /messenger/channels | 현재 사용자의 채널 목록 |
| GET | /messenger/channels/:channelId/messages | 채널 메시지 목록 (?limit, ?before) |

### 5.3 휴가 API (leave-service :3001)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /leave/balance/:employeeId | 연차 잔여 조회 |
| POST | /leave/validate-date | 날짜 유효성 검증 (주말, 공휴일, 팀 충돌) |
| POST | /leave/request | 휴가 신청 (DB 저장 + 결재 요청 생성) |
| GET | /leave/requests | 휴가 신청 목록 (?employee_id, ?status, ?page) |
| DELETE | /leave/request/:id | 휴가 취소 (pending 상태에서만) |

### 5.4 결재 API (approval-service :3002)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /approvals/pending/:approverId | 대기 중 결재 목록 |
| POST | /approvals/:id/decide | 결재 결정 (approved / rejected) |

### 5.5 Admin API (messaging-server :3000 또는 별도)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /admin/employees | 직원 목록 |
| POST | /admin/employees | 직원 등록 |
| GET | /admin/employees/:id | 직원 상세 |
| PUT | /admin/employees/:id | 직원 수정 |
| POST | /admin/leave/adjust | 연차 수동 조정 |
| GET | /admin/leave-policies/:id | 연차 정책 조회 |
| PUT | /admin/leave-policies/:id | 연차 정책 수정 |
| GET/POST/DELETE | /admin/holidays | 공휴일 CRUD |
| GET | /admin/audit-log | 감사 로그 (?actor, ?action, ?from, ?to, ?page) |

### 5.6 WebSocket 이벤트 (Socket.IO)

#### 서버 -> 클라이언트

| 이벤트 | 설명 |
|--------|------|
| message:new | 새 메시지 도착 |
| message:typing | 타이핑 중 (사람 또는 LLM) |
| channel:created | 새 채널 생성됨 |
| channel:takeover | 담당자 개입 (LLM 중지) |
| channel:released | 담당자 AI에게 넘김 (LLM 재개) |
| approval:new | 새 결재 요청 도착 |
| approval:decided | 결재 결과 (승인/반려) |
| notification:new | 시스템 알림 |
| user:online | 사용자 온라인 |
| user:offline | 사용자 오프라인 |

#### 클라이언트 -> 서버

| 이벤트 | 설명 |
|--------|------|
| message:send | 메시지 전송 |
| message:read | 메시지 읽음 처리 |
| channel:join | 채널 참여 |
| channel:leave | 채널 퇴장 |
| takeover:start | 담당자 개입 시작 |
| takeover:end | 담당자 AI에게 넘기기 |
| typing:start | 타이핑 시작 |
| typing:stop | 타이핑 종료 |

---

## 6. 데이터베이스 스키마

PostgreSQL 15 + pgvector. Drizzle ORM 사용.

### 6.1 테이블 목록

| 번호 | 테이블 | 설명 |
|------|--------|------|
| 1 | teams | 팀/부서 |
| 2 | employees | 직원 (사용자) |
| 3 | user_llm_configs | 사용자별 LLM 설정 |
| 4 | leave_policies | 연차 정책 |
| 5 | leave_balances | 연차 잔여 |
| 6 | leave_requests | 휴가 신청 |
| 7 | approvals | 결재 |
| 8 | holidays | 공휴일 |
| 9 | channels | 채널 |
| 10 | messages | 메시지 |
| 11 | audit_log | 감사 로그 (INSERT만 허용) |
| 12 | leave_accrual_log | 연차 발생 이력 |

### 6.2 ID 생성 규칙

| 테이블 | 형식 | 예시 |
|--------|------|------|
| employees | EMP-XXX | EMP-001, EMP-CEO |
| teams | TEAM-XXX | TEAM-DEV |
| leave_requests | LV-YYYY-NNNN | LV-2026-0001 |
| approvals | APR-YYYY-NNNN | APR-2026-0031 |
| channels | ch-{uuid} | ch-a1b2c3d4 |
| messages | {uuid} | 자동 생성 |
| audit_log | {uuid} | 자동 생성 |

### 6.3 Seed 데이터

- 3개 팀: 경영진(TEAM-EXEC), 경영지원팀(TEAM-MGMT), 개발팀(TEAM-DEV)
- 5명 직원: 대표, 경영지원팀장, 휴가 담당자, 정인수, 김민준
- 연차 정책: LP-DEFAULT (기본 연차 정책)
- 2026년 한국 공휴일 15건
- 사용자별 LLM 설정 5건

---

## 7. 보안

### 7.1 인증/인가

| 항목 | 구현 방식 |
|------|----------|
| 인증 | JWT Bearer Token (로그인 시 발급) |
| 비밀번호 | bcrypt 해싱 |
| 토큰 전달 | Authorization 헤더 |
| HTTPS | 프로덕션 환경 필수 |
| CORS | 허용 origin 제한 |

### 7.2 입력 검증

- 모든 API 입력은 서버사이드에서 검증
- Zod 스키마 기반 유효성 검사
- SQL Injection 방지: Drizzle ORM 파라미터 바인딩

### 7.3 감사 로그

- audit_log 테이블에 모든 업무 처리 내역 기록
- INSERT만 허용, UPDATE/DELETE 차단 (PostgreSQL RULE)
- 해시 체인 (prev_hash -> hash)으로 위변조 감지

---

## 8. 역할 및 권한

| 역할 (Role) | 권한 (Permissions) |
|-------------|-------------------|
| Employee | 본인 데이터 CRUD, 휴가 신청, 메시지 송수신, 본인 채널 조회 |
| Manager | Employee 권한 + 팀원 데이터 읽기, 결재 승인/반려 |
| HR | Employee 권한 + 전체 직원 읽기, 휴가 관리, 연차 조정 |
| Admin | 전체 접근 (모든 API, 설정 변경, 감사 로그) |
| CEO | Employee 권한 + 전사 데이터 읽기, 사람 호출, 전사 일정 조회 |

### 8.1 페르소나별 역할 매핑

| 페르소나 | Role | 추가 권한 |
|---------|------|----------|
| 대표 (EMP-CEO) | CEO | 전사 데이터 조회, 사람 호출 |
| 경영지원팀장 (EMP-MGMT-LEADER) | Manager + HR | 팀 관리, 휴가 관리 |
| 휴가 담당자 (EMP-HR-001) | HR | 휴가 업무 처리, Human Takeover |
| 정인수 (EMP-001) | Employee | 기본 권한 |
| 김민준 (EMP-DEV-LEADER) | Manager | 팀원 결재 |

---

## 9. 테스트 전략

### 9.1 테스트 레벨

| 레벨 | 도구 | 커버리지 목표 | 대상 |
|------|------|-------------|------|
| Unit | Vitest | >= 80% | 비즈니스 로직, 유틸 함수, Tool 실행 |
| Integration | Vitest + HTTP 테스트 | 주요 API 경로 | API 엔드포인트, DB 연동, 서비스 간 호출 |
| E2E | Playwright | 3개 시나리오 전체 | 브라우저 기반 전체 흐름 |

### 9.2 TDD 방법론

```
RED    -> 실패하는 테스트 작성
GREEN  -> 테스트를 통과하는 최소 코드 작성
REFACTOR -> 코드 품질 개선 (테스트 유지)
```

### 9.3 E2E 시나리오

#### 시나리오 A: 직원 휴가 신청 전체 흐름

```
1. 정인수 로그인
2. "나 휴가 몇개 남았어?" 전송
3. AI가 연차 잔여 카드로 응답 확인 (14개)
4. "나 3월 18일에 휴가를 쓰고 싶어" 전송
5. AI가 날짜 유효성 확인 후 사유 질문
6. "개인사정이야" 전송
7. AI가 "휴가 올려드릴게요" 응답 + DB 저장 확인
8. 김민준 로그인 (상사)
9. 결재 요청 카드 표시 확인
10. [승인] 클릭
11. 정인수에게 "휴가가 승인되었습니다" 알림 확인
12. DB: leave_requests.status = 'approved' 확인
```

#### 시나리오 B: 대표 일정 조회 + 팀장 호출

```
1. 대표 로그인
2. "직원 A 일정에 대해서 알려줘" 전송
3. AI가 직원 A 휴가 일정 응답 확인
4. "경영지원팀장 호출해줘" 전송
5. AI가 호출 알림 전송 확인
6. 경영지원팀장 로그인
7. 호출 알림 확인
8. DM 채널에서 대표와 직접 대화 (LLM 관여 없음)
```

#### 시나리오 C: 담당자 직접 개입

```
1. 직원 B가 "다음주에 3일 연속 휴가 쓸 수 있어?" 전송
2. AI가 자동 응답
3. 휴가 담당자(사람)가 [개입하기] 클릭
4. channel.human_takeover = true 확인
5. 담당자(사람)가 직접 타이핑하여 응답
6. [직접 응답] 뱃지 표시 확인
7. 담당자(사람)가 [AI에게 넘기기] 클릭
8. channel.human_takeover = false 확인
9. LLM 자동 응답 재개 확인
```

---

## 10. 에러 코드

### 10.1 에러 응답 형식

```json
{
  "error": {
    "code": "LV_001",
    "message": "연차가 부족합니다. 잔여: 0일",
    "details": { "remaining": 0, "requested": 1 }
  }
}
```

### 10.2 에러 코드표

| 코드 | HTTP | 분류 | 상황 | 사용자 메시지 |
|------|------|------|------|-------------|
| LV_001 | 400 | 휴가 | 연차 부족 | 연차가 부족합니다 |
| LV_002 | 400 | 휴가 | 주말/공휴일 | 해당 날짜는 주말/공휴일입니다 |
| LV_003 | 409 | 휴가 | 중복 신청 | 이미 신청이 있습니다 |
| LV_004 | 400 | 휴가 | 과거 날짜 | 과거 날짜는 신청 불가 |
| LV_005 | 400 | 휴가 | 신청 불가 상태 | 신청할 수 없는 상태 |
| AP_001 | 400 | 결재 | 이미 처리된 결재 | 이미 처리된 건입니다 |
| AP_002 | 403 | 결재 | 결재 권한 없음 | 승인 권한이 없습니다 |
| SYS_001 | 503 | 시스템 | LLM 호출 실패 | 잠시 후 재시도해주세요 |
| SYS_002 | 503 | 시스템 | DB 연결 실패 | 시스템 점검 중 |
| AUTH_001 | 401 | 인증 | 인증 실패 | 로그인이 필요합니다 |
| AUTH_002 | 403 | 인증 | 권한 없음 | 접근 권한이 없습니다 |

### 10.3 에러 케이스 상세 (E-01 ~ E-18)

#### 휴가 신청 단계

| 코드 | 상황 | LLM 대응 | 시스템 처리 |
|------|------|---------|-----------|
| E-01 | 연차 0일 | "올해 연차를 모두 사용하셨어요. 병가나 특별휴가가 필요하시면 말씀해주세요!" | 신청 차단 |
| E-02 | 신청 일수 > 잔여 | "잔여 연차가 N일이라 M일은 어려워요. 조정하시겠어요?" | 신청 차단 |
| E-03 | 중복 신청 | "이미 해당 날짜에 신청이 있어요!" | DB UNIQUE 제약 |
| E-04 | 과거 날짜 | "이미 지난 날짜예요. 오늘 이후로 알려주세요!" | 신청 차단 |
| E-05 | 90일+ 미래 | "꽤 먼 미래네요. 맞으시죠?" | 확인 후 진행 |
| E-06 | 같은 날 팀원 다수 휴가 | "팀원 N명이 이미 휴가예요. 반려될 수 있어요." | team_conflicts 경고 |
| E-07 | 반차 오전/오후 미지정 | "오전 반차와 오후 반차 중 어떤 걸 원하세요?" | 추가 질문 |
| E-08 | 범위에 주말 포함 | "주말 제외하면 평일 N일이에요. 신청할까요?" | 주말 자동 제외 |

#### 결재 단계

| 코드 | 상황 | 처리 |
|------|------|------|
| E-09 | 팀장 반려 | 직원에게 반려 알림 + 날짜 변경 제안 |
| E-10 | 자동승인 타임아웃 (2시간) | scheduler 감지 -> 자동 승인 -> 감사 로그 기록 |
| E-11 | 팀장 질문 후 승인/반려 | 결재 상태 reviewing, 자동승인 타이머 일시정지 |
| E-12 | 승인 전 직원 취소 | pending 상태에서만 취소 가능. pending_days 원복 |
| E-13 | 승인 후 직원 취소 | 취소 결재 요청 생성 -> 팀장 승인 후 취소 |

#### 시스템/기술

| 코드 | 상황 | 처리 |
|------|------|------|
| E-14 | LLM API 실패 | 3회 재시도 (1초, 2초, 4초) -> 실패 시 안내 메시지 + 관리자 알림 |
| E-15 | LLM 할루시네이션 | Tool 호출 강제 + 숫자 비교 + submit 없이 완료 불가 |
| E-16 | DB 연결 실패 | Redis 큐 임시 저장 -> DB 복구 후 재처리 |
| E-17 | WebSocket 끊김 | 자동 재연결 (최대 30초) + 놓친 메시지 조회 + UI 배너 |
| E-18 | 동시 요청 Race Condition | DB UNIQUE 제약 + 트랜잭션 -> E-03으로 처리 |

---

## 11. 개발 순서

### Step 1: DB + 비즈니스 서비스

1. pnpm 모노레포 초기 설정 (pnpm-workspace.yaml, 루트 package.json, tsconfig)
2. packages/db 생성: Drizzle 스키마 정의
3. 마이그레이션 실행 + seed 데이터 (5명 참여자 + 팀 + 연차 정책 + 2026 공휴일)
4. packages/shared 생성: 공통 타입, 에러 코드, 유틸
5. services/leave-service 구현: 휴가 API 전체
6. services/approval-service 구현: 결재 API 전체
7. 테스트: 정인수 연차 조회 -> 날짜 검증 -> 휴가 신청 -> 결재 승인 전체 흐름

### Step 2: 메시징 서버

1. services/messaging-server 생성: Socket.IO 서버
2. 채널 관리: DM/업무/팀/알림 채널 CRUD
3. 메시지 라우팅 로직 구현
4. Human Takeover 메커니즘 구현
5. 온라인 상태 관리 (Redis)
6. 테스트: DM 직접 대화 동작 확인

### Step 3: AI 런타임

1. services/ai-runtime 생성
2. LLM Adapter: Claude API 연동 (Anthropic SDK)
3. 사용자별 LLM 로드: DB에서 system_prompt, tools 가져와서 호출
4. Tool Executor 구현: query_leave_balance, validate_date, submit_leave_request
5. messaging-server와 연동: 메시지 수신 -> LLM 호출 -> 응답 전송
6. 테스트: "휴가 몇개 남았어?" -> LLM이 DB 조회 -> "14개 남았습니다"

### Step 4: 메신저 프론트엔드

1. apps/messenger 생성: Next.js 14
2. 로그인 + JWT 인증
3. 채널 목록 (사이드바) + 대화창 (메인)
4. Socket.IO 연결: 실시간 메시지
5. 메시지 유형별 렌더링 (사람/AI/시스템 구분, 카드)
6. 담당자용: [개입하기] [AI에게 넘기기] 버튼
7. 테스트: 시나리오 A 전체 E2E

### Step 5: Admin + 나머지

1. apps/admin 생성: 직원 관리, 연차 설정, 감사 로그
2. services/notification-service: 메신저 내 알림
3. services/scheduler: 연차 자동 발생, 자동승인 타임아웃
4. 통합 테스트: 시나리오 A/B/C 전체

---

## 12. 환경 변수

```
ANTHROPIC_API_KEY=         # Claude API 키
DATABASE_URL=              # PostgreSQL 연결 문자열
REDIS_URL=redis://localhost:6379
JWT_SECRET=                # JWT 서명 키
TELEGRAM_BOT_TOKEN=        # Telegram 봇 토큰 (Phase 2)
```

---

## 13. 코딩 규칙

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
- 에러 코드 기반 처리 (10장 참조)

### Git 컨벤션

- 커밋 메시지: `feat: 휴가 신청 API 구현`, `fix: 날짜 검증 주말 처리`
- 브랜치: `step-1/db-setup`, `step-2/messaging-server` 등
