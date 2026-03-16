# Database (packages/db) AGENTS.md

## Module Context

- **Role**: Drizzle ORM 스키마 정의, 마이그레이션, seed 데이터. 모든 서비스의 DB 스키마 단일 소스.
- **Dependencies**: drizzle-orm, drizzle-kit, pg (node-postgres)
- **Data Flow**: 서비스 -> packages/db (스키마 import) -> PostgreSQL 15
- **Exports**: db (drizzle 인스턴스), schema (모든 테이블)

## Tech Stack & Constraints

- **ORM**: Drizzle ORM (PostgreSQL dialect)
- **Migration**: Drizzle Kit (`drizzle-kit generate`, `drizzle-kit migrate`)
- **DB**: PostgreSQL 15 (Supabase 클라우드, 로컬은 Docker)
- **Connection**: node-postgres Pool (`DATABASE_URL` 환경 변수)
- **Constraint**: 스키마 변경은 반드시 이 패키지에서만. 서비스에서 직접 DDL 실행 금지.

## Implementation Patterns

### Schema Structure

```
src/
  schema/
    index.ts                # 모든 테이블 barrel export
    teams.ts                # teams 테이블
    employees.ts            # employees 테이블
    user-llm-configs.ts     # user_llm_configs 테이블
    channels.ts             # channels 테이블
    messages.ts             # messages 테이블
    leave-policies.ts       # leave_policies 테이블
    leave-balances.ts       # leave_balances 테이블
    leave-requests.ts       # leave_requests 테이블
    approvals.ts            # approvals 테이블
    holidays.ts             # holidays 테이블
    audit-log.ts            # audit_log 테이블
    leave-accrual-log.ts    # leave_accrual_log 테이블
    relations.ts            # 모든 테이블 간 관계 정의
  index.ts                  # db 인스턴스 + schema export
  seed.ts                   # seed 데이터 (5명 + 정책 + 공휴일)
```

### 13 Tables Overview

| Table | 소유 서비스 | 비고 |
|-------|-----------|------|
| teams | shared | TEAM-XXX |
| employees | shared | EMP-XXX, bcrypt 해싱 |
| user_llm_configs | ai-runtime | LLM 역할별 설정 |
| channels | messaging-server | ch-{uuid}, 5종 타입 |
| messages | messaging-server | sender_type: human/llm/system |
| leave_policies | leave-service | 연차 정책 |
| leave_balances | leave-service | remaining_days GENERATED |
| leave_requests | leave-service | LV-YYYY-NNNN |
| approvals | approval-service | APR-YYYY-NNNN |
| holidays | leave-service | 공휴일 |
| audit_log | shared | 감사 추적 |
| leave_accrual_log | scheduler | 연차 자동 발생 |

### ID Generation Rules

| Entity | Pattern | Example |
|--------|---------|---------|
| Team | TEAM-XXX | TEAM-001 |
| Employee | EMP-XXX | EMP-001 |
| Leave Request | LV-YYYY-NNNN | LV-2026-0001 |
| Approval | APR-YYYY-NNNN | APR-2026-0001 |
| Channel | ch-{uuid} | ch-550e8400-... |
| Message | msg-{uuid} | msg-6ba7b810-... |

### Drizzle Schema Pattern

```typescript
import { pgTable, varchar, timestamp, text } from 'drizzle-orm/pg-core';

export const tableName = pgTable('table_name', {
  id: varchar('id', { length: 50 }).primaryKey(),
  // columns...
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### PostgreSQL-Specific Features Used

- **GENERATED ALWAYS AS STORED**: leave_balances.remaining_days = total_days - used_days
- **JSONB**: messages.metadata, user_llm_configs.tools
- **pgcrypto**: gen_random_uuid() for channel/message IDs
- **Partial Index**: 활성 상태 레코드만 인덱싱

### Migration Commands

```bash
pnpm db:generate    # drizzle-kit generate
pnpm db:migrate     # drizzle-kit migrate
pnpm db:seed        # tsx src/seed.ts
pnpm db:studio      # drizzle-kit studio (DB 브라우저)
```

### Seed Data (Phase 1)

- **Teams**: 경영지원팀 (TEAM-001)
- **Employees**: 5명 (대표, 팀장, 휴가담당자, 직원A 정인수, 상사 김민준)
- **Leave Policies**: 기본 연차 15일
- **Holidays**: 2026년 대한민국 공휴일
- **Channels**: 기본 채널 (알림, 전사, 업무)
- **User LLM Configs**: 5명 각각의 LLM 역할 설정

## Testing Strategy

```bash
pnpm --filter @palette/db test
```

- Unit: 스키마 타입 검증 (Drizzle infer types)
- Integration: 마이그레이션 실행 + seed 데이터 검증
- 테스트 DB: Docker PostgreSQL (테스트 전용 DB)

## Local Golden Rules

### Do's

- 스키마 변경 시 반드시 drizzle-kit generate로 마이그레이션 생성
- 모든 테이블에 created_at, updated_at 타임스탬프 포함
- FK 관계는 relations.ts에서 일괄 정의
- seed 데이터는 docs/DATABASE.md의 INSERT 문 기반으로 작성
- GENERATED 컬럼은 Drizzle 스키마에 명시 (`.generatedAlwaysAs()`)

### Don'ts

- 서비스 코드에서 직접 DDL 실행 금지
- 마이그레이션 파일 수동 편집 금지 (drizzle-kit으로만 생성)
- seed 데이터에 실제 비밀번호 사용 금지 (bcrypt 해시 사용)
- leave_balances.remaining_days 직접 UPDATE 금지 (GENERATED 컬럼)
- drizzle/meta/ 폴더 커밋 금지 (.gitignore에 포함)
