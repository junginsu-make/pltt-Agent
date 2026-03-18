# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Palette AI** — 모든 직원에게 AI 비서가 붙은 회사 메신저. 각 사용자에게 LLM이 할당되어 HR 업무(휴가 관리)를 자동 처리하고, 사람 간 직접 대화도 지원한다. Phase 1 범위: 경영지원팀 휴가 관리 (5명 참여자).

## Commands

```bash
# Infrastructure
docker compose up -d          # PostgreSQL 15 + Redis 7
pnpm install                  # All workspace dependencies

# Database
pnpm db:generate              # Drizzle schema → SQL migrations
pnpm db:push                  # Apply migrations to database (NOT db:migrate)
pnpm db:seed                  # Seed 5 users + teams + policies + holidays
pnpm db:studio                # Web UI for DB inspection

# Development
pnpm dev                      # All services in parallel
pnpm --filter @palette/<pkg> dev  # Single service (see ports below)

# Testing
pnpm test                     # All unit tests (Vitest)
pnpm --filter @palette/<pkg> test # Single package tests
pnpm test:coverage            # Tests with coverage report
npx playwright test           # E2E tests (requires running services)
npx playwright test tests/e2e/scenario-a.spec.ts  # Single E2E file

# Quality
pnpm lint                     # ESLint all packages
pnpm type-check               # TypeScript strict check
pnpm build                    # Build all packages
```

## Architecture

4-Layer model — each layer only calls the layer below it:

```
Layer 4: Frontend (messenger:3010, admin:3020)
    ↓ HTTP + WebSocket (Socket.IO)
Layer 3: Messaging Server (:3000) — message routing hub
    ↓ HTTP
Layer 2: AI Runtime (:3100) — LLM orchestration (Claude Haiku)
    ↓ HTTP
Layer 1: Business Services — leave-service(:3001), approval-service(:3002),
         notification-service(:3003), scheduler(:3004)
```

**Critical rule**: Services never access each other's DB directly. All inter-service communication is HTTP API calls.

### Message Flow

1. User sends message via Socket.IO → **messaging-server** receives it
2. messaging-server checks channel type:
   - DM channel → deliver directly to recipient (no LLM)
   - Work channel → forward to **ai-runtime**
3. ai-runtime loads user's LLM config (system_prompt, tools) from DB → calls Claude API
4. Claude may invoke tools (query_leave_balance, submit_leave_request, etc.) → ai-runtime calls **business services**
5. Response flows back: business service → ai-runtime → messaging-server → user via Socket.IO

### Human Takeover

담당자(사람)가 LLM 자동 응답 중인 대화에 개입할 수 있음. 개입 시 LLM 응답 중지, 담당자가 직접 응답. 이후 AI에게 다시 넘기기 가능.

## Monorepo Structure

pnpm workspace (`pnpm-workspace.yaml`): `apps/*`, `services/*`, `packages/*`

- **packages/db** (`@palette/db`): Drizzle ORM schema (13 tables), seed, migrations
- **packages/shared** (`@palette/shared`): Common types, AppError, middleware (JWT, rate limiting, error handler), Zod schemas
- **apps/messenger**: Next.js 14 App Router, Zustand state, Socket.IO client, KakaoTalk-style UI
- **apps/admin**: Next.js 14, TanStack Table/Query, leave policy management, teams CRUD
- **services/messaging-server**: Hono + Socket.IO, message routing, channel management, online status (Redis)
- **services/ai-runtime**: Hono, Claude Adapter, LLM pipeline, tool executor
- **services/leave-service**: Hono, leave CRUD, balance calculation
- **services/approval-service**: Hono, approval workflow
- **services/notification-service**: Hono, in-memory notification store (MVP)
- **services/scheduler**: Hono, auto-approval timeout, monthly leave accrual

Internal dependencies use `workspace:*`. Shared package is transpiled via Next.js `transpilePackages: ['@palette/shared']`.

## Design Documents

| Document | Content | Read When |
|----------|---------|-----------|
| docs/ARCHITECTURE.md | 4-layer model, message routing, Human Takeover | Always |
| docs/DATABASE.md | 13 tables DDL + seed SQL + ERD | DB work |
| docs/API.md | All REST API endpoints with Request/Response | API work |
| docs/LLM.md | System prompts, tool definitions, pipeline code | AI runtime work |
| docs/FRONTEND.md | Component tree, Socket.IO events, Zustand stores | Frontend work |
| docs/SCENARIOS.md | Scenarios A/B/C + 18 error cases | Testing |
| docs/planning/ | 6 planning docs (PRD, TRD, user flow, DB design, design system, coding convention) | Reference |

## Conventions

### API Response Format
```typescript
// Success: { "data": T, "meta"?: { pagination } }
// Error:   { "error": { "code": "LV_001", "message": "연차가 부족합니다", "details"?: any } }
```

### Error Codes
`LV_001~005` (leave), `AP_001~002` (approval), `SYS_001~002` (system). Use AppError class from `@palette/shared`.

### ID Patterns
`EMP-XXX`, `TEAM-XXX`, `LV-YYYY-NNNN`, `APR-YYYY-NNNN`, `ch-{uuid}`

### TypeScript
- strict mode, interface over type (type only for unions), explicit return types, no `any` (use `unknown` + type guards)
- Functions/variables: `camelCase`, Types: `PascalCase`, Constants: `UPPER_SNAKE_CASE`

### Testing
- TDD: RED → GREEN → REFACTOR
- Coverage thresholds: 80% lines/functions/statements, 75% branches
- Unit tests colocated: `services/*/tests/`, `packages/*/tests/`
- E2E tests: `tests/e2e/` (Playwright, base URL `http://localhost:3010`)

### Git
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Branch: `main` ← `phase/{N}-{feature}`

### Database
- Always use Drizzle ORM query builder (never raw SQL strings)
- Transactions required for state-changing operations
- All inputs validated with Zod schemas before DB operations

## Environment Variables

See `.env.example`. Required:
- `DATABASE_URL` — PostgreSQL connection (default: `postgresql://palette:palette_dev@localhost:5432/palette_dev`)
- `REDIS_URL` — Redis connection
- `JWT_SECRET` — Must be set, no fallback
- `ANTHROPIC_API_KEY` — Claude API key
- `CORS_ORIGINS` — Comma-separated allowed origins
- Service URLs: `LEAVE_SERVICE_URL`, `APPROVAL_SERVICE_URL`, `AI_RUNTIME_URL`, `MESSAGING_SERVER_URL`
