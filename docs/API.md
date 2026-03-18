# API 명세

모든 API의 Base URL: `http://localhost:{port}/api/v1`

## 인증

모든 API(로그인 제외)에 JWT 토큰 필요: `Authorization: Bearer {token}`

### POST /auth/login (messaging-server :3000)

```json
// Request
{ "email": "jinsu@palette.ai", "password": "password123" }

// Response 200
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "EMP-001",
    "name": "정인수",
    "email": "jinsu@palette.ai",
    "team": { "id": "TEAM-DEV", "name": "개발팀" },
    "position": "프론트엔드 개발자",
    "manager": { "id": "EMP-DEV-LEADER", "name": "김민준" },
    "avatar_url": null
  }
}
```

---

## 메신저 API (messaging-server :3000)

### POST /messenger/send

메시지 전송. 모든 메시지가 이 API를 거침. 라우팅 판단을 여기서 함.

```json
// Request
{
  "channel_id": "ch-xxx",       // null이면 새 채널 생성 필요
  "content": "나 휴가 몇개 남았어?",
  "content_type": "text"        // "text" | "card_action"
}

// Response 200 (동기: 메시지 저장 확인만. 실제 응답은 WebSocket으로 옴)
{
  "message_id": "uuid",
  "channel_id": "ch-xxx",
  "routing": {
    "llm_will_respond": true,
    "routed_to_llm": "EMP-HR-001",
    "intent": "leave_inquiry"
  }
}
```

### POST /messenger/dm

1:1 다이렉트 메시지 (사람→사람). 기존 DM 채널이 없으면 자동 생성.

```json
// Request
{ "to_user_id": "EMP-MGMT-LEADER", "content": "이번 달 인력 현황 어때?" }

// Response 201
{ "channel_id": "ch-dm-xxx", "message_id": "uuid" }
```

### POST /messenger/call

특정 사람 호출 (알림 전송 + DM 채널 준비). 서비스 토큰으로 호출 시 `caller_id` 필수.

```json
// Request (사용자 토큰)
{ "callee_id": "EMP-MGMT-LEADER" }

// Request (서비스 토큰 — AI tool executor에서 호출 시)
{ "callee_id": "EMP-MGMT-LEADER", "caller_id": "EMP-CEO" }

// Response 200
{ "channel_id": "ch-dm-xxx", "notification_sent": true }
```

DM 채널 생성 시 참여자 이름을 DB에서 조회하여 채널명을 자동 설정합니다 (예: "대표, 경영지원팀장").
호출 후 `notification:new` 소켓 이벤트가 발신되어 callee에게 알림이 전달됩니다.

### POST /messenger/takeover

담당자가 LLM 대화에 개입/복귀.

```json
// 개입
{ "channel_id": "ch-xxx", "action": "takeover" }

// 복귀
{ "channel_id": "ch-xxx", "action": "release" }

// Response 200
{ "channel_id": "ch-xxx", "human_takeover": true, "taken_over_by": "EMP-HR-001" }
```

### GET /messenger/channels

현재 사용자의 채널 목록.

```json
// Response 200
{
  "channels": [
    {
      "id": "ch-xxx",
      "type": "work",
      "name": "휴가 상담",
      "last_message": { "text": "14개 남았습니다.", "sender_name": "휴가 담당 AI", "at": "..." },
      "unread_count": 0,
      "human_takeover": false
    },
    {
      "id": "ch-dm-yyy",
      "type": "direct",
      "name": "김민준",
      "last_message": { "text": "네 알겠습니다", "sender_name": "김민준", "at": "..." },
      "unread_count": 2
    }
  ]
}
```

### GET /messenger/channels/:channelId/messages

특정 채널의 메시지 목록. Query: `?limit=50&before={timestamp}`

```json
// Response 200
{
  "messages": [
    {
      "id": "uuid",
      "sender_type": "human",
      "sender_user_id": "EMP-001",
      "display_name": "정인수",
      "content_type": "text",
      "content_text": "나 휴가 몇개 남았어?",
      "is_llm_auto": false,
      "created_at": "2026-03-12T10:30:00Z"
    },
    {
      "id": "uuid",
      "sender_type": "llm",
      "sender_user_id": "EMP-HR-001",
      "display_name": "휴가 담당 AI",
      "content_type": "card",
      "content_text": "15개 중 14개 남았습니다.",
      "card_data": {
        "type": "leave_balance",
        "total": 15, "used": 1, "pending": 0, "remaining": 14
      },
      "is_llm_auto": true,
      "created_at": "2026-03-12T10:30:02Z"
    }
  ],
  "has_more": false
}
```

---

## 휴가 API (leave-service :3001)

### GET /leave/balance/:employeeId

```json
// Response 200
{
  "employee_id": "EMP-001",
  "year": 2026,
  "balances": [{
    "leave_type": "annual",
    "total_days": 15,
    "used_days": 1,
    "pending_days": 0,
    "remaining_days": 14,
    "expires_at": "2027-03-01"
  }]
}
```

### POST /leave/validate-date

```json
// Request
{ "employee_id": "EMP-001", "date": "2026-03-15", "leave_type": "annual" }

// Response 200 (주말인 경우)
{
  "valid": false,
  "reasons": ["주말 (일요일)"],
  "suggestions": [
    { "date": "2026-03-13", "day": "금요일", "available": true },
    { "date": "2026-03-16", "day": "월요일", "available": true }
  ],
  "team_conflicts": [],
  "is_holiday": false
}

// Response 200 (유효한 경우)
{
  "valid": true,
  "reasons": [],
  "day_of_week": "수요일",
  "team_conflicts": [],
  "is_holiday": false
}
```

### POST /leave/request

```json
// Request
{
  "employee_id": "EMP-001",
  "leave_type": "annual",
  "start_date": "2026-03-18",
  "end_date": "2026-03-18",
  "days": 1,
  "reason": "개인사정",
  "conversation_id": "ch-xxx"
}

// Response 201
{
  "leave_request": { "id": "LV-2026-0001", "status": "pending" },
  "approval": {
    "id": "APR-2026-0031",
    "approver": { "id": "EMP-DEV-LEADER", "name": "김민준" },
    "auto_approve_at": "2026-03-12T12:30:00Z"
  },
  "balance_after": { "remaining": 13, "pending": 1 },
  "notifications_sent_to": ["EMP-DEV-LEADER", "EMP-HR-001", "EMP-MGMT-LEADER"]
}
```

### GET /leave/requests

Query: `?employee_id=EMP-001&status=pending&page=1&limit=20`

### DELETE /leave/request/:id

휴가 취소 (pending 상태에서만 가능).

---

## 결재 API (approval-service :3002)

### GET /approvals/pending/:approverId

```json
// Response 200
{
  "approvals": [{
    "id": "APR-2026-0031",
    "type": "leave_request",
    "requested_by": { "id": "EMP-001", "name": "정인수" },
    "request_summary": "3월 18일 연차 1일 (개인사정)",
    "llm_reasoning": "팀 일정 충돌 없음, 동일 날짜 팀원 휴가 없음. 승인 추천.",
    "auto_approve_at": "2026-03-12T12:30:00Z",
    "created_at": "2026-03-12T10:30:00Z"
  }]
}
```

### PATCH /approvals/:id/decide

```json
// Request
{
  "decision": "approved",
  "comment": "확인함, 승인",
  "decided_by": "EMP-DEV-LEADER"
}

// Response 200
{
  "approval_id": "APR-2026-0031",
  "status": "approved",
  "completed_at": "2026-03-18T10:30:00Z"
}
```

결재 완료 후 approval-service가 messaging-server API를 호출하여 신청자(`requested_by`)의 알림 채널(`ch-notification-{userId}`)에 결과 메시지를 자동 전송합니다.

---

## Admin API (messaging-server :3000/admin 또는 별도)

### GET /admin/employees
### POST /admin/employees
### GET /admin/employees/:id
### PUT /admin/employees/:id
### POST /admin/leave/adjust
### GET /admin/leave-policies/:id
### PUT /admin/leave-policies/:id
### GET/POST/DELETE /admin/holidays
### GET /admin/audit-log

Query: `?actor=EMP-001&action=leave_request&from=2026-03-01&to=2026-03-31&page=1`

---

## 에러 응답 형식

```json
{
  "error": {
    "code": "LV_001",
    "message": "연차가 부족합니다. 잔여: 0일",
    "details": { "remaining": 0, "requested": 1 }
  }
}
```

### 에러 코드표

| 코드 | HTTP | 상황 |
|------|------|------|
| LV_001 | 400 | 연차 부족 |
| LV_002 | 400 | 주말/공휴일 |
| LV_003 | 409 | 중복 신청 |
| LV_004 | 400 | 과거 날짜 |
| LV_005 | 400 | 신청 불가 상태 |
| AP_001 | 400 | 이미 처리된 결재 |
| AP_002 | 403 | 결재 권한 없음 |
| SYS_001 | 503 | LLM 호출 실패 |
| SYS_002 | 503 | DB 연결 실패 |
| AUTH_001 | 401 | 인증 실패 |
| AUTH_002 | 403 | 권한 없음 |
