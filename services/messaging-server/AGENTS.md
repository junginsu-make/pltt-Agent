# Messaging Server AGENTS.md

## Module Context

- **Role**: WebSocket 허브 + 메시지 라우팅 엔진. 모든 실시간 통신의 중심점.
- **Dependencies**: packages/shared (타입), packages/db (읽기 전용), ai-runtime (LLM 요청 전달)
- **Data Flow**: Client (Socket.IO) -> Messaging Server -> Route Decision -> (DM: 상대방 전달 | Work: ai-runtime 전달 | System: 직접 처리)
- **Port**: 3000

## Tech Stack & Constraints

- **Framework**: Hono (HTTP) + Socket.IO 4.8+ (WebSocket)
- **Realtime**: Socket.IO (namespace: /, rooms: channel ID)
- **State**: Redis 7 (온라인 상태, 세션, Pub/Sub)
- **Auth**: JWT 토큰 검증 (Socket.IO handshake에서)
- **Constraint**: DB 쓰기는 leave-service, approval-service에 위임. 이 서비스는 메시지 저장 + 채널 관리만 담당.

## Implementation Patterns

### Channel Types (5종)

| Type | 용도 | LLM 관여 |
|------|------|---------|
| direct | 사람 <-> 사람 DM | 없음 |
| work | 직원 -> 담당자(LLM) | 담당자의 LLM 자동 응답 |
| team | 팀 채널 | 팀 LLM 보조 |
| notification | 시스템 알림 | 읽기 전용 |
| company | 전사 공지 | 읽기 전용 |

### Message Routing Logic

```
1. 메시지 수신
2. sender_type 확인 (human / llm / system)
3. channel_type 확인:
   - direct: 상대방에게 직접 전달 (LLM 미관여)
   - work: ai-runtime에 전달 -> LLM 응답 -> 채널에 브로드캐스트
   - notification/company: 채널 구독자에게 브로드캐스트
4. 메시지 DB 저장 (messages 테이블)
5. 읽음 상태 업데이트
```

### Human Takeover Mechanism

```
담당자가 [개입하기] 클릭:
1. channels.is_ai_active = false 설정
2. WsChannelTakeover 이벤트 브로드캐스트
3. 이후 메시지는 LLM 대신 담당자(사람)가 직접 응답

담당자가 [AI에게 넘기기] 클릭:
1. channels.is_ai_active = true 설정
2. WsChannelTakeover 이벤트 브로드캐스트
3. 이후 메시지는 다시 LLM이 응답
```

### Socket.IO Events

| Event | Direction | Payload |
|-------|-----------|---------|
| message:send | Client -> Server | { channelId, content, contentType } |
| message:new | Server -> Client | WsMessageNew |
| typing:start/stop | Bidirectional | WsTyping |
| channel:takeover | Server -> Client | WsChannelTakeover |
| approval:decided | Server -> Client | WsApprovalDecided |
| user:online/offline | Server -> Client | { employeeId, status } |

### File Naming

- Routes: `src/routes/{resource}.ts` (kebab-case)
- Services: `src/services/{resource}-service.ts`
- Schemas: `src/schemas/{resource}.ts` (Zod)
- Socket handlers: `src/socket/handlers/{event}.ts`

## Testing Strategy

```bash
pnpm --filter @palette/messaging-server test
```

- Unit: 라우팅 로직, Human Takeover 상태 전이
- Integration: Socket.IO 연결 + 메시지 송수신
- Mock: ai-runtime 호출은 Mock 처리
- Pattern: describe('{Feature}') -> it('should {behavior}')

## Local Golden Rules

### Do's

- 모든 Socket.IO 이벤트에 JWT 인증 검증
- 메시지 저장 시 sender_type (human/llm/system) 정확히 구분
- Redis Pub/Sub로 다중 인스턴스 대비
- channel.is_ai_active 상태를 항상 확인 후 LLM 전달 여부 결정

### Don'ts

- Socket.IO 핸들러에서 직접 DB 쓰기 금지 (서비스 레이어로 위임)
- 인증 안 된 소켓 연결 허용 금지
- 브로드캐스트 시 발신자에게 중복 전달 금지
- LLM 응답 대기 중 타임아웃 처리 없이 방치 금지 (30초 제한)
