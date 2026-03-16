# AI Runtime AGENTS.md

## Module Context

- **Role**: LLM 호출 + Tool 실행 엔진. 사용자별 System Prompt로 LLM을 호출하고, Tool 결과를 기반으로 응답 생성.
- **Dependencies**: packages/shared (타입), packages/db (user_llm_configs 읽기), leave-service (Tool 호출), approval-service (Tool 호출)
- **Data Flow**: messaging-server -> ai-runtime -> LLM API -> Tool Executor -> Business Service API -> LLM API -> messaging-server
- **Port**: 3100

## Tech Stack & Constraints

- **Framework**: Hono (HTTP API)
- **LLM**: Anthropic Claude API (@anthropic-ai/sdk)
- **LLM Adapter Pattern**: LLM 제공자(Claude, GPT 등) 교체 가능한 어댑터 구조
- **Constraint**: DB 직접 접근은 user_llm_configs 읽기만. 비즈니스 데이터는 반드시 Tool -> HTTP API 호출.

## Implementation Patterns

### LLM Pipeline

```
1. messaging-server에서 요청 수신 (employeeId, message, channelId)
2. user_llm_configs에서 해당 사용자의 LLM 설정 로드 (llm_role, system_prompt, tools, model)
3. Anthropic SDK로 LLM 호출:
   - system: system_prompt
   - messages: 대화 히스토리
   - tools: 사용 가능한 Tool 목록
4. LLM 응답 처리:
   - text: 바로 반환
   - tool_use: Tool Executor 호출 -> 결과를 다시 LLM에 전달 -> 최종 텍스트 반환
5. 응답을 messaging-server에 반환
```

### LLM Adapter Interface

```typescript
interface LLMAdapter {
  chat(params: LLMChatParams): Promise<LLMChatResponse>;
  streamChat(params: LLMChatParams): AsyncIterable<LLMStreamChunk>;
}

interface LLMChatParams {
  model: string;
  systemPrompt: string;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  maxTokens?: number;
}
```

### LLM Roles (5종)

| Role | 사용자 | System Prompt 핵심 |
|------|--------|-------------------|
| router | 직원 A | 의도 파악 -> 업무 채널 라우팅 |
| work_assistant | 휴가 담당자 | 휴가 조회/신청/결재 자동 처리 |
| approver | 상사 (김민준) | 결재 요청 분석 + 승인/반려 추천 |
| secretary | 대표 | 일정 조회, 사람 호출, 회사 현황 |
| team_assistant | 팀장 | 팀 현황 보조 |

### Tool Definitions (6개)

| Tool | 역할 | 호출 대상 |
|------|------|----------|
| analyze_intent | 사용자 의도 분석 | 내부 처리 |
| query_leave_balance | 연차 잔여 조회 | leave-service |
| validate_date | 날짜 유효성 검증 (주말, 공휴일) | leave-service |
| submit_leave_request | 휴가 신청 | leave-service |
| search_policy | 사내 규정 검색 | leave-service |
| get_team_schedule | 팀 일정 조회 | leave-service |

### File Naming

- Adapters: `src/adapters/{provider}-adapter.ts` (e.g., claude-adapter.ts)
- Tools: `src/tools/{tool-name}.ts` (kebab-case)
- Pipeline: `src/pipeline/llm-pipeline.ts`
- Prompts: `src/prompts/{role}.ts`

## Testing Strategy

```bash
pnpm --filter @palette/ai-runtime test
```

- Unit: LLM Adapter Mock으로 파이프라인 로직 테스트
- Unit: Tool Executor 개별 테스트 (비즈니스 서비스 Mock)
- Integration: 실제 LLM 호출 테스트 (ANTHROPIC_API_KEY 필요)
- Pattern: Given-When-Then (주어진 사용자 메시지 -> LLM 호출 시 -> 예상 Tool 호출 확인)

## Local Golden Rules

### Do's

- LLM 응답에 tool_use가 있으면 반드시 Tool Executor로 처리 후 재호출
- Tool 호출 실패 시 사용자에게 "처리 중 오류" 메시지 반환 (할루시네이션 방지)
- LLM 호출 시 max_tokens 제한 (4096)
- 대화 히스토리는 최근 20개 메시지로 제한 (토큰 관리)
- LLM Adapter는 인터페이스 기반으로 구현 (향후 GPT, Gemini 등 확장)

### Don'ts

- LLM 응답을 검증 없이 사용자에게 직접 전달 금지
- Tool 호출 없이 비즈니스 데이터를 LLM이 "추측"하게 하지 않음
- System Prompt를 코드에 하드코딩 금지 (DB의 user_llm_configs에서 로드)
- API 키를 로그에 출력 금지
