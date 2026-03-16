# AGENTS.md

## Project Context

- **Project**: Palette AI - 모든 직원에게 AI 비서가 붙은 회사 메신저
- **Goal**: HR 반복 업무 자동 처리 + 사내 메신저 통합 (Phase 1: 경영지원팀 휴가 관리)
- **Tech Stack**: Hono (TypeScript) + Next.js 14 (App Router) + PostgreSQL 15 + Redis 7
- **Architecture**: 4-Layer (Frontend -> Messaging Server -> AI Runtime -> Business Services)
- **Monorepo**: pnpm workspace (apps/, services/, packages/)
- **Target Users**: 5명 (대표, 경영지원팀장, 휴가 담당자, 직원 A, 직원 A 상사)

## Operational Commands

```bash
# Infrastructure
docker compose up -d                              # PostgreSQL 15 + Redis 7

# Install
pnpm install                                      # All workspace dependencies

# Database
pnpm db:generate                                  # Drizzle schema -> SQL
pnpm db:migrate                                   # Run migrations
pnpm db:seed                                      # Seed 5 users + policies + holidays

# Development (all services)
pnpm dev                                          # Run all services concurrently

# Individual services
pnpm --filter @palette/messaging-server dev       # Port 3000
pnpm --filter @palette/ai-runtime dev             # Port 3100
pnpm --filter @palette/leave-service dev          # Port 3001
pnpm --filter @palette/approval-service dev       # Port 3002
pnpm --filter @palette/messenger dev              # Port 3010
pnpm --filter @palette/admin dev                  # Port 3020

# Testing
pnpm test                                         # All tests (Vitest)
pnpm --filter @palette/<service> test             # Per-service tests

# Quality
pnpm lint                                         # ESLint all packages
pnpm type-check                                   # TypeScript strict check
pnpm build                                        # Build all packages
```

## Golden Rules

### Immutable

- API 키, JWT 시크릿 등 credentials 하드코딩 절대 금지. 반드시 환경 변수 사용.
- 프로덕션 DB에 직접 SQL 실행 금지. 반드시 Drizzle ORM 사용.
- 인증 없이 민감 API 접근 금지. 모든 비즈니스 API에 JWT 미들웨어 적용.
- LLM 응답을 검증 없이 사용자에게 전달 금지. Tool 호출 결과 기반 응답 강제.
- packages/shared의 타입을 서비스별로 재정의 금지. 반드시 공유 타입 import.

### Do's

- 모든 API 엔드포인트에 Zod 스키마 입력 검증 적용
- 새 기능은 TDD로 개발 (RED -> GREEN -> REFACTOR)
- 커밋 전 반드시 lint + type-check 통과
- 에러는 AppError 클래스 사용, 에러 코드는 ERROR_CODES 상수 참조
- API 응답 형식: `{ data: T }` (성공), `{ error: { code, message } }` (실패)
- 함수/변수 camelCase, 타입 PascalCase, 상수 UPPER_SNAKE_CASE
- 모든 함수에 return type 명시
- ID 생성 규칙: EMP-XXX, TEAM-XXX, LV-YYYY-NNNN, APR-YYYY-NNNN, ch-{uuid}

### Don'ts

- SQL 직접 문자열 조합 금지 (Drizzle 쿼리 빌더 사용)
- console.log 프로덕션 코드에 남기지 않음 (로거 사용)
- 테스트 없이 PR 생성 금지
- any 타입 사용 금지 (unknown + 타입 가드 사용)
- node_modules, .env, dist 파일 커밋 금지
- 서비스 간 직접 DB 접근 금지 (반드시 HTTP API 통신)
- 컴포넌트 내 직접 API 호출 금지 (커스텀 훅으로 분리)

## Standards

### Coding Convention

- 상세: docs/planning/07-coding-convention.md 참조
- TypeScript strict mode 필수
- interface 우선 (type은 union/intersection일 때만)
- Drizzle ORM 쿼리 패턴: 항상 트랜잭션 사용 (상태 변경 시)

### Git Strategy

- Branch: `main` <- `phase/{N}-{feature}`
- Commit: Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`)
- Phase 0 작업은 main 직접 커밋, Phase 1+ 작업은 worktree에서 작업 후 merge

### Maintenance Policy

규칙과 코드의 괴리가 발생하면 이 문서의 업데이트를 제안하세요.
CLAUDE.md의 Lessons Learned에 난관 극복 교훈을 기록하세요.

## Context Map

- **[Messaging Server (WebSocket Hub)](./services/messaging-server/AGENTS.md)** -- Socket.IO 서버, 메시지 라우팅, Human Takeover 구현 시
- **[AI Runtime (LLM Pipeline)](./services/ai-runtime/AGENTS.md)** -- LLM Adapter, Tool Executor, System Prompt 관리 시
- **[Leave Service (HR API)](./services/leave-service/AGENTS.md)** -- 휴가 CRUD, 연차 계산, 날짜 검증 로직 시
- **[Approval Service (Workflow)](./services/approval-service/AGENTS.md)** -- 결재 워크플로우, 자동승인, 상태 전이 시
- **[Messenger UI (Frontend)](./apps/messenger/AGENTS.md)** -- 메신저 UI, Socket.IO 클라이언트, Zustand 상태 관리 시
- **[Database Schema (Drizzle)](./packages/db/AGENTS.md)** -- Drizzle 스키마, 마이그레이션, seed 데이터 작업 시
