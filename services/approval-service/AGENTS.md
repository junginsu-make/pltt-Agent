# Approval Service AGENTS.md

## Module Context

- **Role**: 결재 워크플로우 엔진. 휴가 신청에 대한 승인/반려 처리, 자동 승인 타임아웃.
- **Dependencies**: packages/shared (타입, 에러), packages/db (Drizzle 스키마), leave-service (상태 업데이트 알림)
- **Data Flow**: leave-service (휴가 신청 시 결재 생성) -> approval-service -> 상사 결재 -> leave-service (상태 반영)
- **Port**: 3002

## Tech Stack & Constraints

- **Framework**: Hono
- **ORM**: Drizzle (PostgreSQL 15)
- **Validation**: Zod
- **Constraint**: approvals 테이블의 유일한 소유자. 결재 생성은 leave-service 연동으로만 발생.

## Implementation Patterns

### API Endpoints

```
POST   /approvals                          # 결재 요청 생성 (leave-service에서 호출)
GET    /approvals/:id                      # 결재 상세
GET    /approvals/pending/:approverId      # 대기 중 결재 목록
PATCH  /approvals/:id/decide               # 승인/반려
GET    /approvals/history/:approverId      # 결재 이력
```

### Approval Status Flow

```
pending -> approved (상사 승인)
        -> rejected (상사 반려, reason 필수)
        -> auto_approved (타임아웃: 72시간)
```

### Approval Creation Flow

```
1. leave-service에서 휴가 신청 (leave_request.status = pending)
2. approval-service에 결재 요청 생성
3. approvals 테이블에 INSERT (status: pending, approver_id: 상사)
4. messaging-server에 알림 (상사의 알림 채널로 결재 요청 카드 전송)
```

### Approval Decision Flow

```
1. 상사가 결재 처리 (approve/reject + reason)
2. approvals.status 업데이트
3. leave-service에 결과 통보 (leave_request.status 업데이트)
4. messaging-server에 알림 (신청자에게 결과 알림)
5. audit_log에 기록
```

### Error Codes

| Code | 상황 |
|------|------|
| AP_001 | 이미 처리된 결재 |
| AP_002 | 권한 없음 (결재자가 아님) |

### File Naming

- Routes: `src/routes/approvals.ts`
- Services: `src/services/approval-service.ts`
- Schemas: `src/schemas/approval.ts` (Zod validation)

## Testing Strategy

```bash
pnpm --filter @palette/approval-service test
```

- Unit: 상태 전이 로직, 권한 검증
- Integration: 결재 생성 -> 승인/반려 전체 흐름
- Edge cases: 이미 처리된 결재 재처리 시도, 권한 없는 사용자 결재 시도
- Mock: leave-service, messaging-server 호출 Mock

## Local Golden Rules

### Do's

- 결재 상태 변경은 반드시 트랜잭션 (approvals UPDATE + audit_log INSERT)
- 반려 시 reason 필수 (빈 문자열 불허)
- 결재자 검증: approvals.approver_id == 요청자 employeeId
- 자동 승인 타임아웃(72시간)은 scheduler 서비스에서 처리

### Don'ts

- 결재 레코드 DELETE 금지 (상태 전이로만 관리)
- 이미 approved/rejected인 결재 재처리 금지
- 결재자 외 다른 사용자의 결재 허용 금지
