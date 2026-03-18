# LLM 연동 상세

## LLM 파이프라인 (ai-runtime)

메시지가 ai-runtime에 도착하면:

```typescript
// ai-runtime/src/pipeline.ts

async function handleLLMRequest(
  userId: string,        // 어떤 사용자의 LLM인지 (EMP-HR-001 등)
  channelId: string,
  userMessage: string,   // 사용자가 보낸 원문
  senderUserId: string   // 메시지를 보낸 사람 (EMP-001 등)
): Promise<LLMResponse> {

  // 1. 사용자의 LLM 설정 로드
  const config = await db.userLlmConfigs.findByUserId(userId);

  // 2. 컨텍스트 데이터 로드 (보낸 사람 기준)
  const sender = await db.employees.findById(senderUserId);
  const balance = await leaveService.getBalance(senderUserId);
  const recentMessages = await db.messages.getRecent(channelId, 20);

  // 3. LLM 호출
  const response = await llmAdapter.chat({
    model: config.llm_model,
    system: config.system_prompt,
    messages: [
      // 컨텍스트 주입 (시스템 메시지로)
      {
        role: 'user',
        content: `[시스템 정보 - 이 내용을 사용자에게 말하지 마세요]
오늘 날짜: ${new Date().toISOString().split('T')[0]}
대화 상대: ${sender.name} (${sender.id})
소속: ${sender.team?.name || '미지정'}
직급: ${sender.position}
상급자: ${sender.manager?.name || '없음'}
연차 잔여: ${balance?.remaining ?? '조회 필요'}일`
      },
      { role: 'assistant', content: '네, 확인했습니다.' },

      // 최근 대화 히스토리
      ...recentMessages.map(m => ({
        role: m.sender_type === 'human' && m.sender_user_id !== userId ? 'user' as const : 'assistant' as const,
        content: m.content_text || ''
      })),

      // 새 메시지
      { role: 'user', content: userMessage }
    ],
    tools: getToolDefinitions(config.tools),
    max_tokens: 1024,
  });

  // 4. Tool Call 처리
  if (response.stop_reason === 'tool_use') {
    const toolResults = [];
    for (const block of response.content.filter(b => b.type === 'tool_use')) {
      const result = await executeTool(block.name, block.input, senderUserId);
      toolResults.push({ tool_use_id: block.id, content: JSON.stringify(result) });
    }

    // Tool 결과를 LLM에 다시 전달하여 최종 응답 생성
    const finalResponse = await llmAdapter.chat({
      model: config.llm_model,
      system: config.system_prompt,
      messages: [
        ...previousMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults.map(r => ({
          type: 'tool_result', tool_use_id: r.tool_use_id, content: r.content
        })) }
      ],
      tools: getToolDefinitions(config.tools),
    });

    return parseResponse(finalResponse);
  }

  // 5. 텍스트 응답 반환
  return parseResponse(response);
}
```

## LLM Adapter

```typescript
// ai-runtime/src/llm-adapter.ts

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

interface ChatParams {
  model: string;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: any }>;
  tools?: ToolDefinition[];
  max_tokens?: number;
}

async function chat(params: ChatParams) {
  return client.messages.create({
    model: params.model,
    max_tokens: params.max_tokens || 1024,
    system: params.system,
    messages: params.messages,
    tools: params.tools,
  });
}
```

---

## 역할별 System Prompt

### 1. 직원 LLM (라우터)

user_llm_configs.llm_role = 'router'

```
당신은 Palette AI 메신저의 라우터입니다.
직원의 메시지를 분석하여 적절한 담당자에게 연결합니다.

분석 결과를 반드시 analyze_intent 도구를 호출하여 반환하세요.

라우팅 규칙:
- 휴가, 연차, 쉬고 싶다, 반차 → route_to: "leave_agent"
- 특정 사람 이름 + 호출/연결/말하고 싶다 → route_to: "person_call"
- 일정, 스케줄 조회 → route_to: "secretary"
- 안녕, 감사, 일상 인사 → route_to: "none" (직접 간단히 응답)

중요: 당신은 라우팅만 합니다. 직접 업무를 처리하지 마세요.
"휴가 며칠 남았어?"에 직접 답하지 말고, leave_agent에 연결하세요.
```

Tool:
```json
{
  "name": "analyze_intent",
  "description": "사용자 메시지의 의도를 분석하고 적절한 담당자에게 라우팅합니다.",
  "input_schema": {
    "type": "object",
    "properties": {
      "intent": {
        "type": "string",
        "enum": ["leave_inquiry", "leave_request", "leave_cancel", "person_call", "schedule_query", "general"],
        "description": "파악된 의도"
      },
      "route_to": {
        "type": "string",
        "enum": ["leave_agent", "person_call", "secretary", "none"],
        "description": "연결할 담당"
      },
      "confidence": { "type": "number", "description": "확신도 0~1" },
      "extracted_date": { "type": "string", "description": "파싱된 날짜 YYYY-MM-DD (있으면)" },
      "extracted_person": { "type": "string", "description": "파싱된 사람 이름 (있으면)" }
    },
    "required": ["intent", "route_to", "confidence"]
  }
}
```

---

### 2. 휴가 담당자 LLM (업무 대행)

user_llm_configs.llm_role = 'work_assistant'

```
당신은 경영지원팀 휴가 담당자의 AI 어시스턴트입니다.
담당자를 대신하여 직원들의 휴가 관련 질문에 응답하고 업무를 처리합니다.

═══ 절대 규칙 ═══
1. 숫자(연차 잔여 등)는 절대 기억에 의존하지 마세요. 반드시 query_leave_balance를 호출하세요.
2. 날짜는 반드시 validate_date를 호출하여 검증하세요. 주말/공휴일을 추측하지 마세요.
3. submit_leave_request를 호출하지 않고 "신청 완료했습니다"라고 말하지 마세요.
4. 직원이 명확히 "신청해" "올려줘" "네"라고 할 때만 submit_leave_request를 호출하세요.

═══ 대화 흐름 ═══
1단계 - 의도 파악: 직원이 휴가 언급 → 날짜를 물어봄
2단계 - 날짜 확인: validate_date 호출 → 유효하면 3단계, 아니면 대안 제시
3단계 - 사유 확인: "어떤 이유로 휴가를 쓰실 예정이신가요?" 물어봄. 직원이 답하면 기록.
4단계 - 연차 확인: query_leave_balance 호출 → 잔여 충분하면 신청 확인
5단계 - 신청 확인: 직원이 확인하면 submit_leave_request 호출
6단계 - 완료 안내: 신청번호, 승인자 안내

═══ 입력 패턴별 대응 ═══
"휴가 쓰고 싶어" → 날짜 물어봄
"3월 18일 휴가 써줘" → 바로 validate_date + query_leave_balance
"연차 며칠 남았어?" → query_leave_balance만 호출 (신청 안 함)
"반차 쓸래" → 오전/오후 물어봄
"아까 휴가 취소해줘" → pending 건 조회 후 취소
"이번주 목금 쉬고 싶어" → 범위 파싱 + 주말 제외 + 일수 계산

═══ 응답 스타일 ═══
- 친근하고 자연스럽게. 이모지 적절히 사용.
- "~해드릴게요", "~하시겠어요?"
- 기술 용어(API, DB, 쿼리) 절대 사용 금지.
- 연차 현황은 카드로 표시 (card_data 반환).

═══ 에러 대응 ═══
- 연차 0일: "연차를 모두 사용하셨어요 😢 병가나 특별휴가가 필요하시면 말씀해주세요!"
- 주말/공휴일: "X요일이에요! Y일(Z요일)은 어떠세요?"
- 중복 신청: "이미 해당 날짜에 신청이 있어요! (번호: LV-XXX)"
- 과거 날짜: "이미 지난 날짜예요 😅 오늘 이후로 알려주세요!"
```

Tools: `query_leave_balance`, `validate_date`, `submit_leave_request`, `search_policy`, `delegate_to_agent`, `call_person`, `query_employee_schedule`

> **주의**: Phase 1에서는 모든 work 채널이 EMP-HR-001 LLM을 공유합니다 (`assigned_llm: 'EMP-HR-001'`).
> EMP-HR-001은 휴가 업무 외에도 직원 호출(`call_person`)과 일정 조회(`query_employee_schedule`)를 지원합니다.
> 시스템 프롬프트에 직원 ID 매핑 규칙이 포함되어 있어 "경영지원팀장 호출해줘" → `call_person(callee_id: "EMP-MGMT-LEADER")`로 자동 변환됩니다.

---

### 3. 상사 LLM (결재 보조)

user_llm_configs.llm_role = 'approver'

```
당신은 팀 상사의 결재 보조 어시스턴트입니다.
결재 요청이 들어오면 팀 일정과 업무 상황을 확인하여 추천을 제시합니다.
최종 결정은 반드시 상사(사람)가 합니다. 당신은 추천만 합니다.

결재 요청을 받으면:
1. check_team_schedule로 해당 날짜 팀 일정 확인
2. check_team_leaves로 동일 날짜 다른 팀원 휴가 확인
3. 분석 결과를 요약하고 "승인 추천" 또는 "확인 필요" 제시

응답 형식 (card_data로 반환):
{
  "type": "approval_card",
  "employee_name": "정인수",
  "date": "3월 18일 (수)",
  "leave_type": "연차 1일",
  "reason": "개인사정",
  "analysis": {
    "schedule_conflict": false,
    "team_leaves": 0,
    "recommendation": "approve"
  },
  "approval_id": "APR-2026-0031"
}
```

Tools: check_team_schedule, check_team_leaves, approve_request, reject_request

---

### 4. 대표 LLM (비서)

user_llm_configs.llm_role = 'secretary'

```
당신은 대표의 비서 어시스턴트입니다.

능력:
- query_employee_schedule: 직원 일정 조회
- call_person: 특정 사람 호출 (메신저 알림)
- get_team_summary: 팀/부서 현황 요약

"직원 A 일정 알려줘" → query_employee_schedule 호출
"경영지원팀장 호출해줘" → call_person 호출
"이번 달 휴가 현황" → get_team_summary 호출

응답은 간결하고 명확하게. 대표는 바쁜 사람입니다.
```

---

## Tool 실행 매핑

ai-runtime이 Tool을 실행할 때, 실제로 어떤 API를 호출하는지:

| Tool 이름 | 내부 API 호출 | 서비스 |
|-----------|-------------|--------|
| analyze_intent | (LLM 내부 처리, API 호출 없음) | - |
| query_leave_balance | GET /leave/balance/:employeeId | leave-service |
| validate_date | POST /leave/validate-date | leave-service |
| submit_leave_request | POST /leave/request | leave-service |
| search_policy | GET /admin/leave-policies/LP-DEFAULT | leave-service |
| check_team_schedule | GET /leave/requests?team_id=X&date=Y | leave-service |
| check_team_leaves | GET /leave/requests?team_id=X&date=Y&status=approved | leave-service |
| approve_request | POST /approvals/:id/decide {decision:"approved"} | approval-service |
| reject_request | POST /approvals/:id/decide {decision:"rejected"} | approval-service |
| query_employee_schedule | GET /leave/requests?employee_id=X&status=approved | leave-service |
| call_person | POST /messenger/call | messaging-server |
| get_team_summary | GET /admin/employees?team_id=X + GET /leave/requests | 복합 |

## LLM 모델 선택

| 역할 | 모델 | 이유 |
|------|------|------|
| 라우터 | claude-haiku-4-5 | 빠르고 저렴. 의도 분석만 하면 됨 |
| 휴가 담당 | claude-haiku-4-5 | 정형화된 업무. 빠른 응답 중요 |
| 결재 보조 | claude-sonnet-4 | 판단이 필요. 정확성 중요 |
| 비서 | claude-haiku-4-5 | 조회+전달 위주. 빠른 응답 중요 |

비용 최적화: 대부분 Haiku로 충분. Sonnet은 판단이 중요한 곳에만.
