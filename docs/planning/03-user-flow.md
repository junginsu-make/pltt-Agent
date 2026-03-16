# 03. 사용자 플로우 (User Flow)

> Palette AI - 회사 메신저 + AI 통합 플랫폼
> MVP 범위: 경영지원팀 휴가 관리

---

## MVP 캡슐 요약

| # | 항목 | 내용 |
|---|------|------|
| 1 | **목표** | AI가 HR 반복 업무를 자동 처리하는 회사 메신저 구축 |
| 2 | **페르소나** | 대표, 경영지원팀장, 휴가 담당자, 직원 A(정인수), 상사(김민준) |
| 3 | **핵심 기능** | FEAT-1: 메신저+AI 자동응답, FEAT-2: 휴가 신청/결재 시스템 |
| 4 | **성공 지표** | 시나리오 A/B/C 전체 E2E 동작 |
| 5 | **입력 지표** | AI 자동 처리율, 평균 처리 시간 |
| 6 | **비기능 요구** | 실시간 메시지 전달 < 500ms, 웹+모바일 반응형 |
| 7 | **Out-of-scope** | 네이티브 앱, B2B SaaS 멀티테넌시, Google Calendar 연동 |
| 8 | **Top 리스크** | LLM 할루시네이션으로 잘못된 업무 처리 |
| 9 | **완화/실험** | Tool 호출 강제 + 응답 검증 + Human Takeover |
| 10 | **다음 단계** | Phase 2 프로젝트 셋업 |

---

## 1. 전체 사용자 여정 (Overall User Journey)

사용자가 앱에 진입하여 주요 기능에 도달하기까지의 흐름입니다.

```mermaid
flowchart TD
    START([앱 진입]) --> CHECK_AUTH{JWT 토큰 존재?}

    CHECK_AUTH -->|없음| LOGIN[S-01: 로그인 화면]
    CHECK_AUTH -->|있음| VALIDATE{토큰 유효?}

    VALIDATE -->|만료/무효| LOGIN
    VALIDATE -->|유효| WS_CONNECT[WebSocket 연결]

    LOGIN -->|로그인 성공| TOKEN_SAVE[JWT 토큰 저장]
    TOKEN_SAVE --> WS_CONNECT

    WS_CONNECT --> LOAD_CHANNELS[채널 목록 로드]
    LOAD_CHANNELS --> MAIN[S-02: 메인 화면\n채널 목록 + 대화창]

    MAIN --> BRANCH{사용자 액션 선택}

    BRANCH -->|DM 클릭| DM[S-03: DM 대화\n사람 <-> 사람]
    BRANCH -->|업무 채널 클릭| WORK[S-04: 업무 채널\nAI 자동 응답]
    BRANCH -->|알림 클릭| NOTI[알림 확인\n결재 요청 / 승인 결과]
    BRANCH -->|새 대화 시작| NEW_MSG[사용자 검색 -> DM\n또는 업무 메시지 입력]
    BRANCH -->|Admin| ADMIN[S-08: Admin 대시보드]

    DM --> MAIN
    WORK --> AI_FLOW{AI 응답 플로우}
    AI_FLOW -->|휴가 관련| LEAVE[FEAT-2: 휴가 신청/결재]
    AI_FLOW -->|일반 질문| AI_RESP[AI 자동 응답]
    AI_FLOW -->|담당자 개입| TAKEOVER[FEAT-3: Human Takeover]

    NOTI -->|결재 요청 카드| APPROVAL[S-06: 결재 요청 카드\n승인/반려/질문하기]
    APPROVAL --> MAIN

    LEAVE --> MAIN
    AI_RESP --> MAIN
    TAKEOVER --> MAIN
    NEW_MSG --> MAIN
    ADMIN --> MAIN

    style START fill:#4CAF50,color:#fff
    style MAIN fill:#2196F3,color:#fff
    style LOGIN fill:#FF9800,color:#fff
    style DM fill:#9C27B0,color:#fff
    style WORK fill:#9C27B0,color:#fff
    style LEAVE fill:#E91E63,color:#fff
    style TAKEOVER fill:#FF5722,color:#fff
    style ADMIN fill:#607D8B,color:#fff
```

---

## 2. FEAT-0: 로그인 플로우

JWT 기반 이메일/비밀번호 인증 후 WebSocket 연결까지의 흐름입니다.

```mermaid
flowchart TD
    START([앱 진입]) --> HAS_TOKEN{localStorage에\nJWT 토큰 존재?}

    HAS_TOKEN -->|없음| SHOW_LOGIN[로그인 화면 표시\nS-01]
    HAS_TOKEN -->|있음| VERIFY_TOKEN{토큰 검증\nGET /auth/me}

    VERIFY_TOKEN -->|200 OK| RESTORE_SESSION[세션 복원\ncurrentUser 설정]
    VERIFY_TOKEN -->|401 만료| CLEAR_TOKEN[토큰 삭제] --> SHOW_LOGIN

    SHOW_LOGIN --> INPUT[이메일 + 비밀번호 입력]
    INPUT --> SUBMIT[POST /auth/login]

    SUBMIT --> AUTH_RESULT{인증 결과}
    AUTH_RESULT -->|실패 AUTH_001| ERROR[에러 메시지 표시\n이메일 또는 비밀번호가 올바르지 않습니다]
    ERROR --> INPUT

    AUTH_RESULT -->|성공 200| SAVE_TOKEN[JWT 토큰 저장\nlocalStorage]
    SAVE_TOKEN --> SET_USER[currentUser 상태 설정\nid, name, email, team, position]

    RESTORE_SESSION --> WS_INIT
    SET_USER --> WS_INIT

    WS_INIT[WebSocket 연결 초기화\nSocket.IO + auth token] --> WS_RESULT{연결 결과}

    WS_RESULT -->|성공 connect| ONLINE[사용자 온라인 상태 설정\nRedis 업데이트]
    WS_RESULT -->|실패| WS_RETRY[재연결 시도\n1s -> 2s -> 4s ... 30s]
    WS_RETRY --> WS_INIT

    ONLINE --> LOAD_CHANNELS[GET /messenger/channels\n채널 목록 로드]
    LOAD_CHANNELS --> LOAD_UNREAD[미읽은 메시지 카운트 로드]
    LOAD_UNREAD --> READY([메인 화면 진입\nS-02])

    style START fill:#4CAF50,color:#fff
    style READY fill:#2196F3,color:#fff
    style ERROR fill:#f44336,color:#fff
    style SHOW_LOGIN fill:#FF9800,color:#fff
```

### 로그인 데이터 흐름

| 단계 | 엔드포인트 | 설명 |
|------|-----------|------|
| 1 | `POST /auth/login` | 이메일+비밀번호 -> JWT 토큰 + 사용자 정보 |
| 2 | localStorage | JWT 토큰 영속 저장 |
| 3 | Socket.IO `auth: { token }` | WebSocket 핸드셰이크 시 JWT 전달 |
| 4 | `GET /messenger/channels` | 내 채널 목록 (DM, 업무, 팀, 알림) |

---

## 3. FEAT-1: 메신저 + AI 자동응답 플로우

모든 메시지가 messaging-server를 거치며, 채널 유형에 따라 라우팅됩니다.

```mermaid
flowchart TD
    USER_INPUT([직원이 메시지 입력\nSendButton 클릭]) --> WS_EMIT["WebSocket emit\nmessage:send\n{channelId, content}"]

    WS_EMIT --> MSG_SERVER[messaging-server\n메시지 수신]

    MSG_SERVER --> SAVE_DB[(DB 저장\nmessages 테이블)]
    SAVE_DB --> ROUTE{라우팅 판단\nchannel.type?}

    %% DM 경로
    ROUTE -->|"type = direct\n(DM)"| DM_FORWARD["상대방 WebSocket으로 전달\nmessage:new"]
    DM_FORWARD --> DM_RECEIVE([상대방 대화창에 표시\nTextBubble])

    %% 업무 채널 경로
    ROUTE -->|"type = work/company\n(업무 채널)"| TAKEOVER_CHECK{channel.human_takeover?}

    TAKEOVER_CHECK -->|"true\n(담당자 개입 중)"| HUMAN_FORWARD["담당자에게 전달\nLLM 호출 안 함"]
    HUMAN_FORWARD --> HUMAN_RESPOND([담당자가 직접 타이핑\n직접 응답 뱃지])

    TAKEOVER_CHECK -->|"false\n(AI 모드)"| SENDER_CHECK{발신자가 LLM?}

    SENDER_CHECK -->|"LLM이 보낸 메시지"| JUST_DELIVER["무한루프 방지\n그냥 전달"]

    SENDER_CHECK -->|"사람이 보낸 메시지"| AI_RUNTIME["ai-runtime에 위임\nHTTP POST"]

    AI_RUNTIME --> LOAD_CONFIG[사용자 LLM 설정 로드\nuser_llm_configs]
    LOAD_CONFIG --> LOAD_CONTEXT["컨텍스트 로드\n대화 상대 정보 + 연차 잔여\n+ 최근 메시지 20개"]

    LOAD_CONTEXT --> LLM_CALL["LLM 호출\nClaude API\nsystem_prompt + tools + messages"]

    LLM_CALL --> LLM_RESULT{응답 유형}

    LLM_RESULT -->|"텍스트 응답"| TEXT_RESP[텍스트 메시지 생성]
    LLM_RESULT -->|"tool_use\n(Tool 호출 필요)"| TOOL_EXEC["Tool 실행\nleave-service / approval-service\nHTTP 호출"]

    TOOL_EXEC --> TOOL_RESULT[Tool 결과 수신]
    TOOL_RESULT --> LLM_FINAL["LLM 재호출\nTool 결과 포함하여 최종 응답 생성"]
    LLM_FINAL --> FINAL_RESP[최종 응답 메시지 생성\ntext 또는 card]

    TEXT_RESP --> WS_DELIVER
    FINAL_RESP --> WS_DELIVER

    WS_DELIVER["messaging-server 경유\nWebSocket broadcast\nmessage:new"] --> USER_RECEIVE([직원 대화창에 AI 응답 표시\nTextBubble 또는 CardMessage])

    style USER_INPUT fill:#4CAF50,color:#fff
    style DM_RECEIVE fill:#9C27B0,color:#fff
    style USER_RECEIVE fill:#2196F3,color:#fff
    style HUMAN_RESPOND fill:#FF5722,color:#fff
    style AI_RUNTIME fill:#673AB7,color:#fff
    style LLM_CALL fill:#E91E63,color:#fff
    style TOOL_EXEC fill:#FF9800,color:#fff
```

### 라우팅 규칙 요약

| 조건 | 라우팅 | LLM 관여 |
|------|--------|---------|
| `channel.type = 'direct'` | 상대방에게 직접 전달 | 없음 |
| `channel.human_takeover = true` | 담당자에게 전달, LLM 중지 | 없음 |
| `sender.type = 'llm'` | 무한루프 방지, 그냥 전달 | 없음 |
| `channel.type = 'work'/'company'` + 사람 발신 | ai-runtime에 위임 | LLM 응답 |

### LLM 파이프라인 단계

| 단계 | 처리 | 비고 |
|------|------|------|
| 1 | LLM 설정 로드 | `user_llm_configs` 테이블에서 system_prompt, tools 조회 |
| 2 | 컨텍스트 주입 | 대화 상대 정보, 연차 잔여, 최근 대화 20건 |
| 3 | Claude API 호출 | model, system, messages, tools 전달 |
| 4 | Tool 실행 (선택) | `tool_use` 응답 시 내부 API 호출 |
| 5 | 최종 응답 생성 | Tool 결과를 포함하여 LLM 재호출 |
| 6 | WebSocket 전달 | messaging-server를 통해 클라이언트로 push |

---

## 4. FEAT-2: 휴가 신청/결재 플로우 (시나리오 A 기반)

직원 A(정인수)가 휴가를 신청하고 상사(김민준)가 승인하는 전체 흐름입니다.

```mermaid
flowchart TD
    %% Step 1: 연차 조회
    subgraph STEP1["Step 1: 연차 잔여 조회"]
        A1([직원 A: 휴가 몇개 남았어?]) --> A2[messaging-server 수신]
        A2 --> A3["라우터 LLM 호출\nanalyze_intent"]
        A3 --> A4["의도: leave_inquiry\nroute_to: leave_agent"]
        A4 --> A5[휴가 담당 채널 연결\nassigned_llm = EMP-HR-001]
    end

    %% Step 2: 잔여 응답
    subgraph STEP2["Step 2: 연차 잔여 응답"]
        A5 --> B1["휴가 담당 LLM 호출\nsystem_prompt + tools"]
        B1 --> B2["Tool: query_leave_balance\nGET /leave/balance/EMP-001"]
        B2 --> B3["결과: total=15, used=1\nremaining=14"]
        B3 --> B4["LLM 최종 응답 생성\n15개 중 14개 남았습니다"]
        B4 --> B5([S-05: 연차 현황 카드 표시\nLeaveBalanceCard])
    end

    %% Step 3: 휴가 신청 시작
    subgraph STEP3["Step 3: 날짜 검증 + 사유 확인"]
        B5 --> C1([직원 A: 나 3월 18일에 휴가 쓰고 싶어])
        C1 --> C2["휴가 담당 LLM\nTool: validate_date\nPOST /leave/validate-date\n{employee_id, date: 2026-03-18}"]
        C2 --> C3{날짜 유효?}
        C3 -->|"valid: true\n수요일"| C4["LLM: 어떤 이유로 휴가를\n쓰실 예정이신가요?"]
        C3 -->|"valid: false\n주말/공휴일"| C5["LLM: 대안 날짜 제시\nE-02 처리"]
        C5 --> C1
        C4 --> C6([직원 A: 개인사정이야])
    end

    %% Step 4: 신청 확정
    subgraph STEP4["Step 4: 휴가 신청 확정"]
        C6 --> D1["LLM: 네 휴가 올려드릴게요~"]
        D1 --> D2["Tool: submit_leave_request\nPOST /leave/request\n{EMP-001, 2026-03-18, 1일, 개인사정}"]
        D2 --> D3["DB 처리:\n1. leave_requests INSERT (LV-2026-0001)\n2. approvals INSERT (APR-2026-0031)\n3. leave_balances.pending_days += 1"]
        D3 --> D4["LLM: 신청 완료!\n승인자: 김민준 팀장님"]
    end

    %% Step 5: 상사 알림
    subgraph STEP5["Step 5: 상사에게 결재 요청"]
        D4 --> E1["messaging-server\n상사(김민준)에게 알림 전송\nWebSocket approval:new"]
        E1 --> E2["상사 LLM 자동 분석\ncheck_team_schedule\ncheck_team_leaves"]
        E2 --> E3([S-06: ApprovalCard 표시\n신청자/날짜/사유/AI 검토 결과\n승인 반려 질문하기])
    end

    %% Step 6: 승인
    subgraph STEP6["Step 6: 상사 승인 처리"]
        E3 --> F1{상사 액션}
        F1 -->|"승인 클릭"| F2["POST /approvals/APR-2026-0031/decide\n{decision: approved}"]
        F1 -->|"반려 클릭"| F3["사유 입력 모달\nPOST /approvals/decide\n{decision: rejected, comment}"]
        F1 -->|"질문하기"| F4["텍스트 입력 활성화\n결재 상태 reviewing\n자동승인 타이머 일시정지"]

        F2 --> F5["DB 업데이트:\n1. leave_requests.status = approved\n2. leave_balances.used_days += 1\n3. leave_balances.pending_days -= 1\n4. 캘린더 이벤트 등록"]

        F5 --> F6["알림 전송:\n1. 정인수: 휴가 승인되었습니다!\n2. 휴가 담당자: 승인 완료\n3. 경영지원팀장: 승인 완료"]

        F6 --> F7["감사 로그 기록\naudit_log INSERT"]
        F7 --> F8([직원 A 대화창:\n휴가가 승인되었습니다!])

        F3 --> F9["DB: status = rejected\npending_days 원복"]
        F9 --> F10([직원 A: 반려 알림\n사유 + 날짜 변경 안내])
    end

    style A1 fill:#4CAF50,color:#fff
    style B5 fill:#2196F3,color:#fff
    style C1 fill:#4CAF50,color:#fff
    style C6 fill:#4CAF50,color:#fff
    style E3 fill:#FF9800,color:#fff
    style F8 fill:#2196F3,color:#fff
    style F10 fill:#f44336,color:#fff
```

### 휴가 신청 데이터 흐름 요약

| Step | 사용자 액션 | Tool / API | DB 변경 |
|------|-----------|-----------|---------|
| 1 | "휴가 몇개 남았어?" | `analyze_intent` (라우터) | - |
| 2 | - | `query_leave_balance` -> `GET /leave/balance/EMP-001` | - |
| 3 | "3월 18일 휴가" | `validate_date` -> `POST /leave/validate-date` | - |
| 4 | "개인사정" + 확인 | `submit_leave_request` -> `POST /leave/request` | leave_requests, approvals, leave_balances |
| 5 | - | messaging-server 알림 | - |
| 6 | 상사 [승인] | `POST /approvals/:id/decide` | leave_requests, leave_balances, audit_log |

### 자동 승인 타임아웃 (E-10)

```mermaid
flowchart LR
    REQ[결재 요청 생성\nauto_approve_at 설정\n2시간 후] --> WAIT{2시간 경과?}
    WAIT -->|아직| CHECK{상사 응답?}
    CHECK -->|승인/반려| DONE([정상 처리])
    CHECK -->|질문하기| PAUSE["reviewing 상태\n타이머 일시정지"]
    PAUSE --> CHECK
    CHECK -->|미응답| WAIT
    WAIT -->|2시간 초과| AUTO["scheduler 감지\n자동 승인 처리"]
    AUTO --> NOTIFY["알림:\n상사에게 자동 승인 알림\n직원에게 승인 알림"]
    NOTIFY --> LOG["감사 로그\nactor=system\naction=auto_approved"]

    style AUTO fill:#FF9800,color:#fff
    style DONE fill:#4CAF50,color:#fff
```

---

## 5. FEAT-3: Human Takeover 플로우

담당자(사람)가 AI 자동 응답을 모니터링하다가 직접 개입하는 흐름입니다.

```mermaid
flowchart TD
    %% 모니터링
    subgraph MONITOR["AI 대화 모니터링"]
        M1[담당자 사이드바\nAI가 처리 중인 대화 섹션] --> M2["대화 클릭\nLLM 자동 응답 내용\n실시간 확인"]
        M2 --> M3{개입 필요?}
    end

    %% 개입
    subgraph TAKEOVER["담당자 개입"]
        M3 -->|"예: 개입하기 클릭"| T1["POST /messenger/takeover\n{channel_id, action: takeover}"]
        T1 --> T2["DB: channel.human_takeover = true\nchannel.takeover_by = EMP-HR-001"]
        T2 --> T3["WebSocket broadcast\nchannel:takeover"]
        T3 --> T4["LLM 자동 응답 즉시 중지"]
        T4 --> T5["S-07: 담당자 개입 화면\n직접 타이핑 활성화"]
    end

    %% 직접 응답
    subgraph DIRECT["담당자 직접 응답"]
        T5 --> D1["담당자가 메시지 입력"]
        D1 --> D2["messaging-server 전달\nsender_type = human\nis_llm_auto = false"]
        D2 --> D3["직원 대화창에 표시\n직접 응답 뱃지\n초록 배경"]
        D3 --> D4{추가 응답?}
        D4 -->|예| D1
    end

    %% AI 복귀
    subgraph RELEASE["AI에게 넘기기"]
        D4 -->|"아니오: AI에게 넘기기 클릭"| R1["POST /messenger/takeover\n{channel_id, action: release}"]
        R1 --> R2["DB: channel.human_takeover = false\nchannel.takeover_by = null"]
        R2 --> R3["WebSocket broadcast\nchannel:released"]
        R3 --> R4["LLM 자동 응답 재개"]
        R4 --> R5([이후 직원 메시지는\nAI가 다시 응답])
    end

    M3 -->|"아니오: AI 계속"| M2

    style M1 fill:#607D8B,color:#fff
    style T1 fill:#FF5722,color:#fff
    style T5 fill:#FF5722,color:#fff
    style D3 fill:#4CAF50,color:#fff
    style R5 fill:#2196F3,color:#fff
```

### Human Takeover 상태 전환

```mermaid
stateDiagram-v2
    [*] --> AI_MODE: 채널 생성

    AI_MODE: AI 자동 응답 모드
    AI_MODE: human_takeover = false
    AI_MODE: LLM이 자동 응답

    HUMAN_MODE: 담당자 직접 응답 모드
    HUMAN_MODE: human_takeover = true
    HUMAN_MODE: LLM 중지, 사람이 응답

    AI_MODE --> HUMAN_MODE: 개입하기 클릭\ntakeover:start
    HUMAN_MODE --> AI_MODE: AI에게 넘기기 클릭\ntakeover:end
```

### WebSocket 이벤트 시퀀스

| 순서 | 이벤트 | 방향 | 내용 |
|------|--------|------|------|
| 1 | `takeover:start` | 클라이언트 -> 서버 | 담당자가 개입 요청 |
| 2 | `channel:takeover` | 서버 -> 모든 참여자 | 채널 상태 변경 알림 |
| 3 | `message:new` | 서버 -> 직원 | 담당자 직접 응답 (직접 응답 뱃지) |
| 4 | `takeover:end` | 클라이언트 -> 서버 | 담당자가 AI에게 넘기기 |
| 5 | `channel:released` | 서버 -> 모든 참여자 | 채널 상태 복원 알림 |

---

## 6. 에러 처리 플로우

### 6-1. 휴가 신청 에러 (E-01 ~ E-04)

```mermaid
flowchart TD
    REQ([직원 휴가 관련 메시지]) --> LLM[휴가 담당 LLM 처리]

    LLM --> BALANCE_CHECK["Tool: query_leave_balance"]
    BALANCE_CHECK --> E01{연차 잔여 확인}

    E01 -->|"remaining = 0\nE-01: 연차 부족"| E01_MSG["LLM: 올해 연차를 모두 사용하셨어요\n잔여: 0일\n병가나 특별휴가가 필요하시면\n말씀해주세요!"]
    E01_MSG --> BLOCK1[신청 차단]

    E01 -->|"remaining > 0"| DATE_CHECK["Tool: validate_date"]

    DATE_CHECK --> E02{날짜 유효성}

    E02 -->|"주말\nE-02: 주말/공휴일"| E02_MSG["LLM: X요일이에요!\nY일(Z요일)은 어떠세요?\n대안 날짜 suggestions 제시"]
    E02_MSG --> RETRY([직원이 날짜 재입력])
    RETRY --> DATE_CHECK

    E02 -->|유효| DUP_CHECK{중복 확인}

    DUP_CHECK -->|"기존 pending/approved 존재\nE-03: 중복 신청"| E03_MSG["LLM: 이미 해당 날짜에\n신청이 있어요!\n번호: LV-XXXX, 상태: 승인대기"]
    E03_MSG --> BLOCK3[신청 차단]

    DUP_CHECK -->|중복 없음| PAST_CHECK{과거 날짜?}

    PAST_CHECK -->|"date < today\nE-04: 과거 날짜"| E04_MSG["LLM: 이미 지난 날짜예요\n오늘 이후로 알려주세요!"]
    E04_MSG --> RETRY

    PAST_CHECK -->|미래 날짜| SUCCESS([정상 신청 진행\nStep 3~6])

    style REQ fill:#4CAF50,color:#fff
    style E01_MSG fill:#f44336,color:#fff
    style E02_MSG fill:#FF9800,color:#fff
    style E03_MSG fill:#f44336,color:#fff
    style E04_MSG fill:#FF9800,color:#fff
    style SUCCESS fill:#2196F3,color:#fff
    style BLOCK1 fill:#9E9E9E,color:#fff
    style BLOCK3 fill:#9E9E9E,color:#fff
```

### 6-2. LLM 실패 (E-14)

```mermaid
flowchart TD
    MSG([사용자 메시지 수신]) --> LLM_CALL["Claude API 호출\n1차 시도"]

    LLM_CALL --> RESULT1{응답?}
    RESULT1 -->|성공| NORMAL([정상 응답])
    RESULT1 -->|"실패 (타임아웃/5xx)"| RETRY1["1초 대기\n2차 시도"]

    RETRY1 --> RESULT2{응답?}
    RESULT2 -->|성공| NORMAL
    RESULT2 -->|실패| RETRY2["2초 대기\n3차 시도"]

    RETRY2 --> RESULT3{응답?}
    RESULT3 -->|성공| NORMAL
    RESULT3 -->|실패| FAIL["3회 모두 실패"]

    FAIL --> USER_MSG["사용자에게 안내:\n일시적으로 응답이 어려워요\n잠시 후 다시 시도해주세요"]
    FAIL --> AUDIT_LOG["감사 로그 기록\naction: llm_failure"]
    FAIL --> ADMIN_ALERT["관리자 알림\nSYS_001"]

    style MSG fill:#4CAF50,color:#fff
    style NORMAL fill:#2196F3,color:#fff
    style FAIL fill:#f44336,color:#fff
    style USER_MSG fill:#FF9800,color:#fff
```

### 6-3. WebSocket 끊김 (E-17)

```mermaid
flowchart TD
    CONNECTED([WebSocket 연결 중]) --> DISCONNECT{연결 끊김 감지}

    DISCONNECT --> BANNER["UI 배너 표시:\n연결이 끊어졌습니다.\n재연결 중..."]

    BANNER --> R1["재연결 시도 1\n1초 대기"]
    R1 --> CHECK1{성공?}
    CHECK1 -->|성공| RESTORE
    CHECK1 -->|실패| R2["재연결 시도 2\n2초 대기"]

    R2 --> CHECK2{성공?}
    CHECK2 -->|성공| RESTORE
    CHECK2 -->|실패| R3["재연결 시도 3\n4초 대기"]

    R3 --> CHECK3{성공?}
    CHECK3 -->|성공| RESTORE
    CHECK3 -->|실패| RN["계속 재시도...\n8s -> 16s -> 30s (최대)"]
    RN --> CHECKN{성공?}
    CHECKN -->|성공| RESTORE
    CHECKN -->|실패| RN

    RESTORE["재연결 성공"] --> FETCH_MISSED["놓친 메시지 조회\nGET /messenger/channels/:id/messages\n?after={lastMessageTimestamp}"]
    FETCH_MISSED --> SYNC["메시지 동기화\n누락분 화면에 반영"]
    SYNC --> HIDE_BANNER["배너 숨김"]
    HIDE_BANNER --> RECONNECTED([정상 연결 복구])

    style CONNECTED fill:#4CAF50,color:#fff
    style BANNER fill:#FF9800,color:#fff
    style RECONNECTED fill:#2196F3,color:#fff
```

### 에러 코드 빠른 참조

| 코드 | ID | HTTP | 상황 | 사용자 메시지 |
|------|-----|------|------|-------------|
| E-01 | LV_001 | 400 | 연차 부족 | 연차가 부족합니다 |
| E-02 | LV_002 | 400 | 주말/공휴일 | 해당 날짜는 주말/공휴일입니다 |
| E-03 | LV_003 | 409 | 중복 신청 | 이미 신청이 있습니다 |
| E-04 | LV_004 | 400 | 과거 날짜 | 과거 날짜는 신청 불가 |
| E-14 | SYS_001 | 503 | LLM 호출 실패 | 잠시 후 재시도해주세요 |
| E-17 | - | - | WebSocket 끊김 | 연결이 끊어졌습니다. 재연결 중... |

---

## 7. 화면 목록 (Screen Inventory)

| Screen | FEAT | 화면명 | 설명 | 주요 컴포넌트 |
|--------|------|--------|------|-------------|
| S-01 | FEAT-0 | 로그인 | 이메일 + 비밀번호 JWT 인증 | LoginForm, EmailInput, PasswordInput |
| S-02 | FEAT-1 | 메인 (채널목록 + 대화창) | 앱의 기본 레이아웃 | Sidebar, ChannelList, ChatPanel |
| S-03 | FEAT-1 | DM 대화 | 사람과 사람의 1:1 대화 | MessageList, TextBubble, MessageInput |
| S-04 | FEAT-1 | 업무 채널 (AI 응답) | AI가 자동 응답하는 업무 대화 | TextBubble([AI] 뱃지), TypingIndicator |
| S-05 | FEAT-2 | 연차 현황 카드 | 연차 잔여 현황 카드 표시 | LeaveBalanceCard(total, used, remaining) |
| S-06 | FEAT-2 | 결재 요청 카드 | 상사에게 표시되는 승인/반려 카드 | ApprovalCard, [승인], [반려], [질문하기] |
| S-07 | FEAT-3 | 담당자 개입 화면 | 담당자가 AI 대화에 직접 개입 | TakeoverButton, [직접 응답] 뱃지 |
| S-08 | FEAT-4 | Admin 대시보드 | 직원 관리, 연차 설정, 감사 로그 | DataTable, Charts, SettingsForms |

### 화면별 FEAT 매핑

```mermaid
flowchart LR
    subgraph FEAT0["FEAT-0\n인증"]
        S01[S-01\n로그인]
    end

    subgraph FEAT1["FEAT-1\n메신저 + AI"]
        S02[S-02\n메인 화면]
        S03[S-03\nDM 대화]
        S04[S-04\n업무 채널]
    end

    subgraph FEAT2["FEAT-2\n휴가 신청/결재"]
        S05[S-05\n연차 현황]
        S06[S-06\n결재 요청]
    end

    subgraph FEAT3["FEAT-3\nHuman Takeover"]
        S07[S-07\n담당자 개입]
    end

    subgraph FEAT4["FEAT-4\nAdmin"]
        S08[S-08\n대시보드]
    end

    S01 --> S02
    S02 --> S03
    S02 --> S04
    S04 --> S05
    S04 --> S06
    S04 --> S07
    S02 --> S08

    style FEAT0 fill:#FF9800,color:#fff
    style FEAT1 fill:#2196F3,color:#fff
    style FEAT2 fill:#E91E63,color:#fff
    style FEAT3 fill:#FF5722,color:#fff
    style FEAT4 fill:#607D8B,color:#fff
```

### 화면 상세 와이어프레임 참조

#### S-01: 로그인 화면

```
+----------------------------------+
|         Palette AI               |
|                                  |
|   +----------------------------+ |
|   | Email                      | |
|   +----------------------------+ |
|   | Password                   | |
|   +----------------------------+ |
|   |        [로그인]             | |
|   +----------------------------+ |
|                                  |
+----------------------------------+
```

#### S-02: 메인 화면 (채널목록 + 대화창)

```
+------------+-------------------------+
| [Profile]  | # 휴가 상담         [...] |
|------------|--------------------------|
| DM         | +----------------------+ |
|  김민준  2  | | 정인수: 휴가 몇개    | |
|  대표       | | 남았어?              | |
|------------|  |                      | |
| 업무    AI  | | [AI] 휴가 담당:      | |
|  휴가 상담  | | 15개 중 14개         | |
|  일정 조회  | | 남았습니다           | |
|------------|  |  [연차 현황 카드]    | |
| AI 처리중   | |                      | |
|  직원B 상담 | +----------------------+ |
|            | +----------------------+ |
|            | | 메시지 입력...  [>]  | |
|            | +----------------------+ |
+------------+-------------------------+
```

#### S-06: 결재 요청 카드 (ApprovalCard)

```
+-------------------------------+
| 휴가 승인 요청                 |
|-------------------------------|
| 신청자: 정인수 (개발팀)        |
| 날짜: 3/18(수) 연차 1일       |
| 사유: 개인사정                 |
|-------------------------------|
| AI 검토:                       |
|  - 팀 일정 충돌 없음           |
|  - 동일 날짜 팀원 휴가 없음    |
|  -> 승인 추천                  |
|-------------------------------|
| 2시간 후 자동승인              |
|                               |
| [승인] [반려] [질문하기]       |
+-------------------------------+
```

---

## 부록: 시나리오 B/C 요약 플로우

### 시나리오 B: 대표 일정 조회 + 팀장 호출

```mermaid
flowchart TD
    B1([대표: 직원 A 일정 알려줘]) --> B2["대표 LLM(비서)\nTool: query_employee_schedule\nGET /leave/requests?employee_id=EMP-001"]
    B2 --> B3["LLM: 직원 A는 3월 18일\n개인사정으로 휴가 예정입니다"]

    B3 --> B4([대표: 경영지원팀장 호출해줘])
    B4 --> B5["대표 LLM\nTool: call_person\nPOST /messenger/call\n{callee_id: EMP-MGMT-LEADER}"]
    B5 --> B6["DM 채널 생성\n경영지원팀장에게 호출 알림"]
    B6 --> B7([경영지원팀장 대화창:\n대표님이 호출하셨습니다\n대화 열기])

    B7 --> B8["DM 채널 진입\ntype = direct\nLLM 관여 없음"]
    B8 --> B9([대표 <-> 경영지원팀장\n직접 대화])

    style B1 fill:#4CAF50,color:#fff
    style B4 fill:#4CAF50,color:#fff
    style B7 fill:#FF9800,color:#fff
    style B9 fill:#9C27B0,color:#fff
```

### 시나리오 C: 담당자 직접 개입

```mermaid
flowchart TD
    C1([직원 B: 다음주에 3일 연속 휴가 쓸 수 있어?]) --> C2["휴가 담당 LLM\nquery_leave_balance + validate_date"]
    C2 --> C3["AI: 잔여 5일이라 3일 가능합니다\n월~수 3/23~25로 할까요?"]

    C3 --> C4["휴가 담당자(사람)가\n개입하기 클릭"]
    C4 --> C5["channel.human_takeover = true\nLLM 자동 응답 중지"]

    C5 --> C6["담당자: 잠깐, 직원 B님!\n수요일에 전사 회의가 있어서\n월~화 또는 목~금으로\n변경하시는 게 좋을 것 같아요\n(직접 응답 뱃지)"]

    C6 --> C7([직원 B: 그럼 목금으로 할게요])
    C7 --> C8["담당자: 네, 목금 2일로\n올려드릴게요!"]

    C8 --> C9["담당자가 AI에게 넘기기 클릭"]
    C9 --> C10["channel.human_takeover = false\nLLM 자동 응답 재개"]

    style C1 fill:#4CAF50,color:#fff
    style C4 fill:#FF5722,color:#fff
    style C6 fill:#FF5722,color:#fff
    style C10 fill:#2196F3,color:#fff
```

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-03-16 | v1.0 | 최초 작성 - 전체 사용자 플로우 7개 섹션 |
