# CLAUDE.md

> 이 파일은 Claude Code가 프로젝트 컨텍스트를 빠르게 파악하도록 돕습니다.

## 프로젝트 개요

- **이름**: Palette AI
- **설명**: 모든 직원에게 AI 비서가 붙은 회사 메신저 + AI 통합 플랫폼
- **기술 스택**: Hono (TypeScript) + Next.js 14 (App Router) + PostgreSQL 15 + Redis 7

## 빠른 시작

```bash
# 인프라 실행 (PostgreSQL + Redis)
docker compose up -d

# 의존성 설치
pnpm install

# DB 마이그레이션 + seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 전체 개발 서버 (모든 서비스)
pnpm dev

# 개별 서비스 실행
pnpm --filter @palette/messaging-server dev   # 포트 3000
pnpm --filter @palette/ai-runtime dev         # 포트 3100
pnpm --filter @palette/leave-service dev      # 포트 3001
pnpm --filter @palette/approval-service dev   # 포트 3002
pnpm --filter @palette/messenger dev          # 포트 3010
pnpm --filter @palette/admin dev              # 포트 3020

# 테스트
pnpm test

# 린트 + 타입 체크
pnpm lint
pnpm type-check
```

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
  docs/
    planning/               # Phase 1 기획 문서 (6개)
    ARCHITECTURE.md         # 4레이어 아키텍처, 메시지 라우팅
    DATABASE.md             # 13개 테이블 DDL + seed SQL
    API.md                  # 전체 REST API Request/Response
    LLM.md                  # System Prompt, Tool 정의, 파이프라인
    FRONTEND.md             # 컴포넌트 트리, Socket.IO, Zustand
    SCENARIOS.md            # 시나리오 A/B/C + 에러 케이스 18개
  .claude/
    agents/                 # AI 에이전트 팀 (5 specialists)
    commands/               # 오케스트레이터
  docker-compose.yml        # PostgreSQL 15 + Redis 7
  pnpm-workspace.yaml
  CLAUDE.md                 # 이 파일
```

## 핵심 설계 문서

| 문서 | 내용 | 참조 시점 |
|------|------|----------|
| docs/ARCHITECTURE.md | 4레이어, 메시지 라우팅, Human Takeover | 항상 |
| docs/DATABASE.md | 13개 테이블 DDL + seed SQL | DB 작업 시 |
| docs/API.md | REST API Request/Response 전체 | API 구현 시 |
| docs/LLM.md | System Prompt, Tool 정의, 파이프라인 | AI 런타임 시 |
| docs/FRONTEND.md | 컴포넌트 트리, Socket.IO, 상태 관리 | 프론트엔드 시 |
| docs/SCENARIOS.md | 시나리오 A/B/C + 에러 케이스 18개 | 테스트 시 |

## 기획 문서 (docs/planning/)

| 문서 | 내용 |
|------|------|
| 01-prd.md | 제품 요구사항 정의서 (5 페르소나, FEAT-0~4) |
| 02-trd.md | 기술 요구사항 정의서 (4레이어 아키텍처, API) |
| 03-user-flow.md | 사용자 흐름도 (7 Mermaid 다이어그램) |
| 04-database-design.md | DB 설계서 (ERD, 13 테이블, 인덱스) |
| 05-design-system.md | 디자인 시스템 (Kakao Work 스타일) |
| 07-coding-convention.md | 코딩 컨벤션 (TypeScript, Git, 테스트) |

## 컨벤션

- 커밋 메시지: Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
- 브랜치 전략: `main` <- `phase/{N}-{feature}`
- 코드 스타일: TypeScript strict mode, ESLint + Prettier
- 상세: docs/planning/07-coding-convention.md 참조

---

## Development History

> 프로젝트 개발 진행 상황과 업데이트 내역을 기록합니다.

### 프로젝트 상태

| 항목 | 상태 | 최종 업데이트 |
|------|------|--------------|
| **현재 버전** | v0.4.0 | 2026-03-18 |
| **현재 Phase** | Phase 5 완료 (코드 작성) | 2026-03-18 |
| **다음 마일스톤** | Docker 환경에서 E2E 실행 검증 | 2026-03-18 |

### Phase 진행 현황

| Phase | 상태 | 시작일 | 완료일 | 비고 |
|-------|------|--------|--------|------|
| Phase 1: 기획 | 완료 | 2026-03-16 | 2026-03-16 | Q1~Q21 + 6개 문서 |
| Phase 2: 셋업 | 완료 | 2026-03-16 | 2026-03-16 | 스캐폴딩 + 에이전트 팀 |
| Phase 3: AGENTS.md + 보안 보강 | 완료 | 2026-03-18 | 2026-03-18 | 거버넌스 규칙 + 보안 하드닝 |
| Phase 4: 인프라 구축 | 완료 | 2026-03-18 | 2026-03-18 | notification, scheduler, error handler |
| Phase 5: Admin + 통합 | 코드 완료 | 2026-03-18 | 2026-03-18 | T5.1~T5.3 코드 작성 완료 (E2E 실행은 Docker 필요) |

### 업데이트 로그

## [2026-03-16] v0.1.0 - 프로젝트 초기 셋업

### Added
- Phase 1 기획 완료: 6개 기획 문서 생성 (PRD, TRD, User Flow, DB Design, Design System, Coding Convention)
- Phase 2 프로젝트 셋업: 모노레포 스캐폴딩 완료
  - apps/: messenger (Next.js 14), admin (Next.js 14)
  - services/: messaging-server, ai-runtime, leave-service, approval-service, notification-service, scheduler (Hono)
  - packages/: shared (타입, 에러), db (Drizzle ORM)
  - .claude/agents/: 5개 specialist 에이전트
  - .claude/commands/: orchestrate 커맨드
  - Docker Compose: PostgreSQL 15 + Redis 7

### Notes
- 다음 작업: Phase 3 AGENTS.md 시스템 생성
- 전체 파일 수: 74+

## [2026-03-18] v0.4.0 - E2E 테스트 완성 (T5.2 + T5.3)

### Added
- T5.2 시나리오 E2E: scenario-a (휴가 신청→승인), scenario-b (대표 호출→DM), scenario-c (Human Takeover)
- T5.3 에러 케이스 E2E: E-01~E-18 (18개 에러 케이스 Playwright 테스트)
- test-data.ts: Page Object Model 셀렉터, 테스트 유저 상수, 타임아웃 설정
- 총 1,874줄 E2E 테스트 코드

### Notes
- Docker 환경에서 실행 필요: `docker compose up -d && pnpm dev && npx playwright test`
- Admin 단위 테스트 39/39 통과 확인 (리그레션 없음)

## [2026-03-18] v0.3.0 - Admin 완성 (T5.1) + 인프라 구축

### Added
- T5.1 Admin 완성: Leave Policy 편집 폼, Dashboard 최근 섹션, Teams CRUD
- notification-service 구현 (알림 CRUD, in-memory MVP)
- scheduler 구현 (auto-approval 5분, leave-accrual 월별)
- 통합 에러 핸들러 (packages/shared)
- Playwright E2E 설정 + smoke test
- 15개 새 Admin 테스트 (TDD RED→GREEN)

## [2026-03-18] v0.2.0 - 문서 보완 + 보안 하드닝

### Added
- 하위 디렉토리 AGENTS.md 생성 (services/, apps/, packages/)
- docker-compose.test.yml (테스트 전용 DB 환경)
- Rate limiting 미들웨어 (전 서비스)

### Fixed
- JWT Secret 하드코딩 폴백 제거 (환경변수 필수화)
- CORS origin '*' → 환경변수 기반 화이트리스트
- ESLint 규칙 누락 (eqeqeq, no-eval) 추가
- Socket 이벤트명 불일치 수정 (typing → typing:start/stop)
- DB 테이블 수 문서 불일치 (12→13) 통일
- 에이전트 Worktree 경로 충돌 위험 해소

### Changed
- 06-tasks.md Quality Gate에 RED 테스트 검증 단계 추가
- .env.example 포트 변수 주석 해제
- Vitest coverage threshold 80% 설정

---

## Lessons Learned

> 에이전트가 난관을 극복하며 발견한 교훈을 기록합니다.

<!-- 아래에 실제 교훈을 기록합니다 -->
