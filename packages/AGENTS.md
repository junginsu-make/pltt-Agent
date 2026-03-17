# packages/ - Shared Libraries

## Package Overview

| Package | Purpose | Consumers |担当 Agent |
|---------|---------|-----------|-----------|
| db | Drizzle ORM schemas, migrations, seed | All services | database-specialist |
| shared | Common types, errors, utils, Zod schemas | All services + apps | backend-specialist |

## Change Rules

### Critical: Shared Package Changes Affect Everything

Changes to packages/ require extra caution:

1. **Type changes** in shared/ -> must verify all consumers still compile
2. **Schema changes** in db/ -> must generate new migration + verify seed
3. **Error code changes** -> must update all services using those codes

### Verification After Changes

```bash
# After ANY change to packages/
pnpm type-check          # All packages must pass
pnpm test                # All tests must pass
pnpm build               # All builds must pass
```

## packages/db

### Schema Files

- `src/schema/*.ts` - One file per table (13 tables total)
- `src/schema/relations.ts` - All FK relationships
- `src/schema/index.ts` - Re-exports all schemas

### 13 Tables

teams, employees, user_llm_configs, channels, messages,
leave_policies, leave_balances, leave_requests, approvals,
holidays, audit_log, leave_accrual_log

### Migration Workflow

```bash
pnpm db:generate    # Drizzle schema -> SQL migration
pnpm db:migrate     # Apply migrations to PostgreSQL
pnpm db:seed        # Seed test data (5 employees, policies, holidays)
pnpm db:studio      # Open Drizzle Studio (GUI)
```

### Forbidden

- Manual SQL execution against production DB
- Schema changes without migration
- Deleting existing migration files
- Changing seed data format without updating consumers

## packages/shared

### Structure

```
src/
  types/index.ts        # Core entity types (Employee, Channel, Message, etc.)
  types/api.ts          # API request/response types
  errors/index.ts       # AppError class + ERROR_CODES constant
  utils/date.ts         # Business day calculation, weekend detection
  utils/id-generator.ts # ID generation (EMP-XXX, LV-YYYY-NNNN, etc.)
  schemas/index.ts      # Zod validation schemas
```

### Type Synchronization Rule

```
DB Schema (Drizzle) -> Shared Types -> Zod Schemas -> API Response
```

All must stay in sync. If Drizzle schema changes:
1. Update shared types
2. Update Zod schemas
3. Verify API consumers

### Error Code Registry

| Range | Service | Description |
|-------|---------|-------------|
| LV_001~005 | leave-service | Leave request errors |
| AP_001~002 | approval-service | Approval errors |
| SYS_001~002 | all | System errors |
| AUTH_001~002 | all | Authentication errors |

### Forbidden

- Redefining shared types in service-level code
- Adding service-specific logic to shared package
- Breaking existing type contracts without migration plan
