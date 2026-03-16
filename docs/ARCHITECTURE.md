# 시스템 아키텍처

## 4개 레이어

```
Layer 4: 메신저 프론트엔드  ← 사용자가 보는 화면
Layer 3: 메시징 서버       ← 모든 메시지의 허브 (라우팅 판단)
Layer 2: AI 런타임         ← LLM 호출, Tool 실행
Layer 1: 비즈니스 서비스    ← DB, 휴가 CRUD, 결재, Admin
```

## 메시지 흐름

모든 메시지는 **messaging-server(L3)**를 거칩니다.

### Case 1: 사람 → 사람 (DM)

```
대표(사람) → messaging-server → 경영지원팀장(사람)
```
- LLM 관여 없음
- 순수 메신저. 채널 type = 'direct'
- messaging-server는 메시지를 저장하고, 상대방의 WebSocket으로 전달

### Case 2: 사람 → LLM (업무 질문)

```
직원 A(사람) → messaging-server → [의도 분석: 휴가 관련] → ai-runtime → 휴가 담당자 LLM
                                                                          ↓
                                                        leave-service (DB 조회)
                                                                          ↓
직원 A(사람) ← messaging-server ← ai-runtime ← 휴가 담당자 LLM 응답 생성
```
- messaging-server가 "업무 채널 메시지 + LLM 응답 필요"를 판단
- ai-runtime에 LLM 호출을 위임
- ai-runtime이 해당 사용자의 LLM(system prompt + tools)을 로드하여 응답 생성
- 응답이 messaging-server를 거쳐 사용자에게 전달

### Case 3: 담당자(사람)가 개입

```
직원 A(사람) → messaging-server → ai-runtime → 휴가 담당자 LLM 자동 응답 중...

[휴가 담당자(사람)가 [개입하기] 클릭]

messaging-server: channel.human_takeover = true, LLM 자동 응답 중지
직원 A(사람) ← messaging-server ← 휴가 담당자(사람) 직접 타이핑

[휴가 담당자(사람)가 [AI에게 넘기기] 클릭]

messaging-server: channel.human_takeover = false, LLM 자동 응답 재개
```

### Case 4: LLM → 사람 (자동 알림)

```
leave-service가 휴가 신청 처리 완료
  → approval-service가 결재 요청 생성
  → messaging-server가 상사에게 알림 메시지 전송
  → 상사의 WebSocket으로 결재 요청 카드 표시
```

## 채널 구조

| type | 설명 | LLM 관여 | 예시 |
|------|------|---------|------|
| direct | 1:1 사람↔사람 | 없음 | 대표 ↔ 팀장 |
| work | 업무 주제 채널 | 담당자 LLM 자동 응답 | 직원 → 휴가 채널 |
| team | 팀 공유 채널 | 팀장 LLM 보조 | 경영지원팀 채널 |
| notification | 알림 수신 | LLM/시스템이 발신 | 결재 알림, 승인 알림 |
| company | 전사 | 대표 LLM(비서) 보조 | 대표가 "직원 A 일정 알려줘" |

### 업무 채널 자동 생성

직원이 처음 업무 관련 메시지를 보내면, messaging-server가:
1. 직원의 LLM(라우터)에게 의도 분석 요청
2. 의도에 맞는 업무 채널이 이미 있으면 연결, 없으면 새로 생성
3. 해당 업무 담당자의 LLM을 채널에 할당

## 메시지 라우팅 로직

```typescript
// messaging-server/src/router.ts

interface RouteDecision {
  type: 'direct' | 'llm' | 'takeover_human' | 'broadcast';
  targetChannel: string;
  llmRequired: boolean;
  llmUserId?: string; // 어떤 사용자의 LLM이 응답할지
}

function routeMessage(message: IncomingMessage, channel: Channel): RouteDecision {
  // 1. DM 채널이면 → 직접 전달, LLM 없음
  if (channel.type === 'direct') {
    return { type: 'direct', targetChannel: channel.id, llmRequired: false };
  }

  // 2. 담당자(사람)가 개입 중이면 → LLM 자동 응답 중지
  if (channel.human_takeover) {
    return { type: 'takeover_human', targetChannel: channel.id, llmRequired: false };
  }

  // 3. 메시지 발신자가 LLM이면 → 무한루프 방지, 그냥 전달
  if (message.sender.type === 'llm') {
    return { type: 'direct', targetChannel: channel.id, llmRequired: false };
  }

  // 4. 업무/전사 채널에서 사람이 보낸 메시지 → LLM 응답
  if (['work', 'company'].includes(channel.type) && message.sender.type === 'human') {
    return {
      type: 'llm',
      targetChannel: channel.id,
      llmRequired: true,
      llmUserId: channel.assigned_llm, // 이 채널을 담당하는 LLM의 사용자 ID
    };
  }

  // 5. 그 외 → 그냥 전달
  return { type: 'direct', targetChannel: channel.id, llmRequired: false };
}
```

## Human Takeover 메커니즘

### 담당자 화면에서의 흐름

1. 담당자의 메신저 사이드바에 **"AI가 처리 중인 대화"** 섹션이 있음
2. 각 대화를 클릭하면 LLM이 자동 응답하는 내용을 실시간으로 볼 수 있음
3. 대화 상단에 **[개입하기]** 버튼
4. 클릭하면:
   - API 호출: `POST /messenger/takeover { channel_id, action: "takeover" }`
   - channel.human_takeover = true
   - LLM 자동 응답 즉시 중지
   - 담당자가 직접 타이핑하여 응답
   - 직원에게는 "[직접 응답]" 뱃지가 붙은 메시지로 보임
5. 처리 완료 후 **[AI에게 넘기기]** 버튼 클릭:
   - API 호출: `POST /messenger/takeover { channel_id, action: "release" }`
   - channel.human_takeover = false
   - LLM 자동 응답 재개

### WebSocket 이벤트

```typescript
// messaging-server WebSocket 이벤트 목록

// 서버 → 클라이언트
'message:new'          // 새 메시지 도착
'message:typing'       // 누군가 타이핑 중 (사람 또는 LLM)
'channel:created'      // 새 채널 생성됨
'channel:takeover'     // 담당자가 개입함 (LLM 중지)
'channel:released'     // 담당자가 AI에게 넘김 (LLM 재개)
'approval:new'         // 새 결재 요청 도착
'approval:decided'     // 결재 결과 (승인/반려)
'notification:new'     // 시스템 알림
'user:online'          // 사용자 온라인
'user:offline'         // 사용자 오프라인

// 클라이언트 → 서버
'message:send'         // 메시지 전송
'message:read'         // 메시지 읽음 처리
'channel:join'         // 채널 참여
'channel:leave'        // 채널 퇴장
'takeover:start'       // 담당자 개입 시작
'takeover:end'         // 담당자 AI에게 넘기기
'typing:start'         // 타이핑 시작
'typing:stop'          // 타이핑 종료
```

## 서비스 간 통신

```
messenger-frontend ←WebSocket→ messaging-server
                                    ↓ (HTTP)
                               ai-runtime ←→ Claude API
                                    ↓ (HTTP)
                            leave-service ←→ PostgreSQL
                            approval-service ←→ PostgreSQL
                                    ↓ (HTTP)
                            notification-service → Telegram API
```

- messaging-server ↔ ai-runtime: HTTP 내부 통신 (같은 Docker 네트워크)
- ai-runtime → leave-service: HTTP (Tool 실행 시)
- approval-service → messaging-server: HTTP (결재 결과 알림 시)
- 모든 서비스 → PostgreSQL: Drizzle ORM
- messaging-server ↔ Redis: 세션, 온라인 상태, Pub/Sub

### 캘린더 연동

휴가가 승인되면 leave-service가 캘린더에 자동 등록합니다.
- Phase 1: DB에 별도 calendar_events 테이블로 관리 (자체 캘린더)
- Phase 2: Google Calendar API 연동 (선택)
- Admin 페이지의 /admin/leaves/calendar 에서 월간 뷰로 확인 가능
- 캘린더 이벤트 데이터: 직원명, 날짜, 휴가 유형, 승인 상태
