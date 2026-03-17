# services/ - Backend Microservices

## Service Ownership

| Service | Port | DB Tables Owned |担当 Agent |
|---------|------|-----------------|-----------|
| messaging-server | 3000 | channels, messages | backend-specialist |
| ai-runtime | 3100 | user_llm_configs (READ ONLY) | backend-specialist |
| leave-service | 3001 | leave_requests, leave_balances, leave_policies, holidays, leave_accrual_log | backend-specialist |
| approval-service | 3002 | approvals, audit_log | backend-specialist |
| notification-service | 3003 | (none - event-driven) | backend-specialist |
| scheduler | 3004 | (none - job runner) | backend-specialist |

## Inter-Service Communication Rules

### Allowed

- Service -> Service: HTTP REST only (no direct DB access)
- messaging-server -> ai-runtime: POST /api/v1/runtime/chat
- ai-runtime -> leave-service: GET/POST /api/v1/leave/*
- ai-runtime -> approval-service: GET/POST/PATCH /api/v1/approvals/*
- leave-service -> approval-service: POST /api/v1/approvals (create on leave request)

### Forbidden

- Direct DB access across service boundaries
- Circular dependencies (A -> B -> A)
- Synchronous calls in hot paths without timeout
- Hardcoded service URLs (use environment variables)

## Service URL Configuration

```typescript
// CORRECT: Environment variable with NO fallback in production
const LEAVE_SERVICE_URL = process.env.LEAVE_SERVICE_URL;
if (!LEAVE_SERVICE_URL) throw new Error('LEAVE_SERVICE_URL is required');

// WRONG: Hardcoded fallback
const LEAVE_SERVICE_URL = process.env.LEAVE_SERVICE_URL || 'http://localhost:3001';
```

## Common Patterns

### API Response Format

```typescript
// Success
{ data: T }

// Error
{ error: { code: string, message: string, details?: unknown } }
```

### Error Codes by Service

| Service | Codes | Description |
|---------|-------|-------------|
| leave-service | LV_001~005 | Leave-specific errors |
| approval-service | AP_001~002 | Approval-specific errors |
| all | SYS_001~002 | System errors |
| all | AUTH_001~002 | Authentication errors |

### Middleware Stack (all services)

1. CORS (environment-based whitelist)
2. Logger (Hono built-in)
3. Rate Limiting
4. JWT Auth (on protected routes)
5. Zod Input Validation
6. Error Handler (AppError -> JSON response)

### Health Check

Every service must expose `GET /health` returning `{ status: 'ok' }`.

## Testing

- Unit tests: `services/{name}/tests/*.test.ts`
- Run: `pnpm --filter @palette/{name} test`
- Coverage target: >= 80%
- Mock other services via `vi.mock()` or MSW
