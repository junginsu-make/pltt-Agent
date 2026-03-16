# Leave Service AGENTS.md

## Module Context

- **Role**: 휴가 CRUD API + 연차 계산 엔진. 직원 연차 조회, 휴가 신청, 날짜 검증, 정책 관리.
- **Dependencies**: packages/shared (타입, 에러), packages/db (Drizzle 스키마)
- **Data Flow**: ai-runtime (Tool 호출) / messenger UI (직접 API) -> leave-service -> DB
- **Port**: 3001

## Tech Stack & Constraints

- **Framework**: Hono
- **ORM**: Drizzle (PostgreSQL 15)
- **Validation**: Zod
- **Constraint**: 이 서비스가 leave_requests, leave_balances, leave_policies, holidays 테이블의 유일한 소유자. 다른 서비스는 반드시 HTTP API로 접근.

## Implementation Patterns

### API Endpoints

```
GET    /leave/balance/:employeeId          # 연차 잔여 조회
GET    /leave/balance/:employeeId/history  # 사용 내역
POST   /leave/requests                     # 휴가 신청
GET    /leave/requests/:id                 # 신청 상세
PATCH  /leave/requests/:id/cancel          # 신청 취소
GET    /leave/policies                     # 정책 조회
GET    /leave/holidays?year=YYYY           # 공휴일 목록
POST   /leave/validate-dates               # 날짜 유효성 검증
GET    /leave/team-schedule                # 팀 휴가 현황
```

### Leave Request Status Flow

```
draft -> pending -> approved -> (used)
                 -> rejected
         pending -> cancelled (본인 취소)
```

### Date Validation Rules

```
1. 시작일 <= 종료일
2. 시작일 > 오늘 (당일 신청 불가)
3. 주말(토, 일) 제외
4. 공휴일(holidays 테이블) 제외
5. 실제 사용일수 = 전체일수 - 주말 - 공휴일
6. 잔여 연차 >= 실제 사용일수
```

### Leave Balance Calculation

```
remaining_days = total_days - used_days (PostgreSQL GENERATED ALWAYS AS STORED)
- total_days: leave_policies.default_days (기본 15일)
- used_days: approved된 leave_requests의 합산
```

### Error Codes

| Code | 상황 |
|------|------|
| LV_001 | 연차 부족 |
| LV_002 | 중복 신청 (기간 겹침) |
| LV_003 | 잘못된 날짜 (주말/공휴일/과거) |
| LV_004 | 존재하지 않는 직원 |
| LV_005 | 이미 처리된 요청 수정 불가 |

### File Naming

- Routes: `src/routes/leave.ts`, `src/routes/balance.ts`
- Services: `src/services/leave-service.ts`, `src/services/balance-service.ts`
- Schemas: `src/schemas/leave.ts` (Zod validation)

## Testing Strategy

```bash
pnpm --filter @palette/leave-service test
```

- Unit: 날짜 검증 로직, 연차 계산 로직
- Integration: API 엔드포인트 전체 CRUD 테스트
- Edge cases: 주말 포함 신청, 공휴일 포함 신청, 연차 초과 신청, 기간 겹침
- Seed data: 5명 사용자, 2026년 공휴일, 기본 연차 15일

## Local Golden Rules

### Do's

- 연차 차감은 반드시 트랜잭션으로 처리 (leave_requests INSERT + leave_balances UPDATE)
- 날짜 검증은 submit 전에 반드시 수행 (validate-dates 엔드포인트)
- leave_balances.remaining_days는 GENERATED 컬럼이므로 직접 UPDATE 금지
- holidays 테이블은 연도별로 관리 (year 컬럼 필터)

### Don'ts

- 연차 잔여를 애플리케이션에서 계산하지 않음 (DB의 GENERATED 컬럼 사용)
- 승인된 휴가를 단순 DELETE 금지 (cancel 상태로 전이)
- 과거 날짜의 휴가 신청 허용 금지
