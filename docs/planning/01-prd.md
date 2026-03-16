# PRD: Palette AI - 회사 메신저 + AI 통합 플랫폼

> **상태**: Draft
> **작성일**: 2026-03-16
> **작성자**: Palette AI Team
> **버전**: v1.0

---

## 1. 한줄 요약

모든 직원에게 AI 비서가 붙은 회사 메신저 -- AI가 HR 반복 업무를 자동 처리하는 내부 커뮤니케이션 플랫폼.

---

## 2. 배경 및 동기

### 2.1 동기
실제 회사 도입을 위한 제품 개발. 경영지원팀의 반복적인 HR 업무(휴가 조회, 신청, 결재 등)를 AI가 자동 처리하여 업무 효율을 극대화한다.

### 2.2 해결 과제
| # | 과제 | 현재 상태 | 목표 상태 |
|---|------|----------|----------|
| 1 | HR 반복업무 경감 | 담당자가 수동으로 모든 휴가 문의/신청 처리 | AI가 자동으로 처리, 담당자는 예외 상황만 개입 |
| 2 | 대기시간 단축 | 담당자 부재 시 응답 지연 | AI 즉시 응답 (24/7) |
| 3 | 메신저/업무 통합 | 메신저와 HR 시스템이 분리 | 메신저 안에서 대화하듯 업무 처리 |

### 2.3 안티패턴 (지양할 것)
- AI 없는 단순 메신저 (차별점 없음)
- 복잡한 HR 전용 UI (학습 곡선 높음)
- 딱딱한 챗봇 (정해진 메뉴만 선택하는 방식 지양)

### 2.4 UI 분위기
- Kakao Work 스타일 (깔끔/심플)
- 톤: 친근하고 자연스럽게 (~해드릴게요, 이모지 적절히)

### 2.5 수익 모델
- 내부 도구 (비용 절감 효과로 ROI 산출)

### 2.6 검증 방법
- 내부 데모 후 실사용 전환

---

## 3. 목표

**MVP 목표**: AI가 HR 반복 업무를 자동 처리하는 회사 메신저 구축

### 3.1 성공 지표 (Output Metrics)
| 지표 | 기준 | 측정 방법 |
|------|------|----------|
| E2E 동작 | 시나리오 A/B/C 전체 통과 | 수동 QA + 통합 테스트 |

### 3.2 입력 지표 (Input Metrics)
| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| AI 자동 처리율 | 추후 설정 | LLM 응답 건수 / 전체 업무 메시지 |
| 평균 처리 시간 | 추후 설정 | 메시지 수신 ~ LLM 응답 완료 시간 |

---

## 4. 페르소나

### 4.1 대표 (EMP-CEO)
- **역할**: 회사 대표이사
- **LLM 역할**: 비서 (secretary)
- **LLM 기능**: 일정 조회, 사람 호출, 팀 현황 요약
- **사용 도구**: `query_employee_schedule`, `call_person`, `get_team_summary`
- **LLM 모델**: claude-haiku-4-5
- **주요 니즈**: 빠르게 직원 일정 확인, 필요한 사람 즉시 호출

### 4.2 경영지원팀장 (EMP-MGMT-LEADER)
- **역할**: 경영지원팀 팀장
- **LLM 역할**: 팀 현황 보조 (team_assistant)
- **LLM 기능**: 팀 요약 정보 제공, 팀원 휴가 현황 조회
- **사용 도구**: `get_team_summary`, `get_team_leaves`
- **LLM 모델**: claude-haiku-4-5
- **주요 니즈**: 팀 운영 현황 파악, 대표와의 커뮤니케이션

### 4.3 휴가 담당자 (EMP-HR-001)
- **역할**: 경영지원팀 인사담당 (대리)
- **LLM 역할**: 휴가 업무 자동 처리 (work_assistant)
- **LLM 기능**: 연차 조회, 날짜 검증, 휴가 신청, 규정 검색
- **사용 도구**: `query_leave_balance`, `validate_date`, `submit_leave_request`, `search_policy`
- **LLM 모델**: claude-haiku-4-5
- **주요 니즈**: 반복 문의 자동 처리 + 필요시 본인이 직접 개입 가능
- **특이사항**: Human Takeover 기능의 주 사용자

### 4.4 직원 A - 정인수 (EMP-001)
- **역할**: 개발팀 프론트엔드 개발자 (사원)
- **LLM 역할**: 의도 파악 + 라우팅 (router)
- **LLM 기능**: 메시지 의도 분석 후 적절한 담당 LLM으로 연결
- **사용 도구**: `analyze_intent`
- **LLM 모델**: claude-haiku-4-5
- **주요 니즈**: 자연어로 편하게 휴가 신청, 빠른 응답
- **상급자**: 김민준 (EMP-DEV-LEADER)

### 4.5 상사 - 김민준 (EMP-DEV-LEADER)
- **역할**: 개발팀 팀장
- **LLM 역할**: 결재 보조 (approver)
- **LLM 기능**: 결재 요청 분석, 팀 일정 확인, 승인/반려 추천
- **사용 도구**: `check_team_schedule`, `check_team_leaves`, `approve_request`, `reject_request`
- **LLM 모델**: claude-sonnet-4 (판단 정확성 중요)
- **주요 니즈**: 결재 요청에 대한 빠른 판단 보조, 팀 일정 충돌 자동 확인

---

## 5. 기능 정의

### FEAT-0: 공통 흐름 (로그인/JWT 인증)
| 항목 | 내용 |
|------|------|
| 설명 | 이메일/비밀번호 로그인, JWT 토큰 발급 및 인증 |
| 우선순위 | P0 (필수) |
| MVP 포함 | Yes |
| API | `POST /auth/login` |
| 주요 흐름 | 사용자 로그인 -> JWT 발급 -> 이후 모든 API에 `Authorization: Bearer {token}` 헤더 포함 |

### FEAT-1: 메신저 + AI 자동응답
| 항목 | 내용 |
|------|------|
| 설명 | DM(사람-사람 직접 대화) + 업무 채널(LLM 자동 응답) 지원 메신저 |
| 우선순위 | P0 (필수) |
| MVP 포함 | Yes |
| 채널 유형 | direct (DM), work (업무), team (팀), notification (알림), company (전사) |

#### 상세 기능
1. **DM (Direct Message)**: 사람 <-> 사람 직접 대화. LLM 관여 없음. 순수 메신저.
2. **업무 채널**: 직원이 업무 관련 메시지 전송 시, 라우터 LLM이 의도 분석 후 해당 담당자 LLM이 자동 응답.
3. **채널 자동 생성**: 직원이 처음 업무 메시지를 보내면 messaging-server가 의도 분석 후 적절한 업무 채널을 자동 생성/연결.
4. **실시간 통신**: WebSocket (Socket.IO) 기반 실시간 메시지 전달.
5. **타이핑 인디케이터**: 사람 또는 AI가 입력 중일 때 표시.
6. **온라인 상태 관리**: Redis 기반 사용자 온라인/오프라인 상태 관리.
7. **메시지 유형**: 텍스트 버블, 카드 메시지(연차 현황), 승인 요청 카드, 시스템 알림.

#### 메시지 라우팅 로직
```
1. DM 채널 -> 직접 전달 (LLM 없음)
2. 담당자 개입 중 (human_takeover) -> LLM 자동 응답 중지
3. 발신자가 LLM -> 무한루프 방지, 그냥 전달
4. 업무/전사 채널 + 사람 메시지 -> 해당 채널 담당 LLM 응답
5. 그 외 -> 그냥 전달
```

### FEAT-2: 휴가 신청/결재 시스템
| 항목 | 내용 |
|------|------|
| 설명 | 대화형 휴가 신청 -> AI 분석 -> 상사 승인/반려 전체 워크플로우 |
| 우선순위 | P0 (필수) |
| MVP 포함 | Yes |

#### 상세 기능
1. **대화형 휴가 신청**: 자연어로 휴가 신청 ("나 3월 18일에 쉬고 싶어")
2. **연차 잔여 조회**: DB에서 실시간 조회 (카드 UI로 표시)
3. **날짜 검증**: 주말, 공휴일, 팀 충돌 자동 확인
4. **휴가 유형 지원**: 연차, 오전 반차, 오후 반차, 병가, 특별휴가
5. **결재 요청 자동 생성**: 신청 시 상급자에게 결재 카드 자동 전송
6. **AI 결재 분석**: 팀 일정 충돌, 동일 날짜 팀원 휴가 확인 후 승인/검토 추천
7. **상사 결재**: 승인/반려/질문하기 버튼
8. **자동 승인**: 2시간 미응답 시 자동 승인 처리
9. **취소 처리**: pending 상태 직접 취소, approved 상태 취소 결재 요청
10. **알림 전송**: 신청자, 상사, 담당자, 팀장에게 적절한 알림

#### 대화 흐름 (휴가 담당 LLM)
```
1단계 - 의도 파악: 직원 휴가 언급 -> 날짜 물어봄
2단계 - 날짜 확인: validate_date 호출 -> 유효하면 3단계
3단계 - 사유 확인: 이유 물어봄
4단계 - 연차 확인: query_leave_balance 호출 -> 잔여 충분한지 확인
5단계 - 신청 확인: 직원 확인 시 submit_leave_request 호출
6단계 - 완료 안내: 신청번호, 승인자 안내
```

### FEAT-3: Human Takeover (담당자 직접 개입)
| 항목 | 내용 |
|------|------|
| 설명 | 담당자(사람)가 AI 자동 대화에 개입하여 직접 응답하고, 완료 후 AI에게 다시 넘기는 기능 |
| 우선순위 | P0 (필수) |
| MVP 포함 | Yes |

#### 상세 기능
1. **AI 처리 중 대화 모니터링**: 담당자 사이드바에 "AI가 처리 중인 대화" 섹션
2. **[개입하기] 버튼**: 클릭 시 `channel.human_takeover = true`, LLM 자동 응답 즉시 중지
3. **담당자 직접 응답**: `sender_type="human"`, [직접 응답] 뱃지 표시
4. **[AI에게 넘기기] 버튼**: 클릭 시 `channel.human_takeover = false`, LLM 자동 응답 재개
5. **WebSocket 이벤트**: `channel:takeover`, `channel:released` 실시간 알림

### FEAT-4: Admin 관리 페이지 (v2 이후)
| 항목 | 내용 |
|------|------|
| 설명 | 직원 관리, 연차 설정, 공휴일, 감사 로그 등 관리자 기능 |
| 우선순위 | P2 |
| MVP 포함 | No (v2 이후) |

#### 계획된 페이지
- 대시보드 (오늘 휴가자, 대기 결재, 이번 달 통계)
- 직원 목록/등록/상세
- 휴가 신청 목록, 휴가 캘린더 (월간 뷰)
- 결재 현황
- 연차 규정 설정, 공휴일 관리, 조직도, AI/LLM 설정
- 감사 로그, 대화 기록 조회

---

## 6. 시나리오

### 시나리오 A: 직원 휴가 신청 전체 흐름

> 이 시나리오는 프로젝트의 기준 대화. 반드시 이 흐름대로 동작해야 한다.

```
직원 A(정인수): "나 휴가 몇개 남았어?"
  -> [직원 LLM(라우터)] 의도: leave_inquiry -> leave_agent 연결
  -> [휴가 담당자 LLM] query_leave_balance(EMP-001) -> {total:15, used:1, remaining:14}
  -> 휴가 담당자 LLM: "15개 중 14개 남았습니다."

직원 A: "나 3월 18일에 휴가를 쓰고 싶어"
  -> [휴가 담당자 LLM] validate_date(EMP-001, 2026-03-18) -> {valid:true, day:"수요일"}
  -> 휴가 담당자 LLM: "어떤 이유로 휴가를 쓰실 예정이신가요?"

직원 A: "개인사정이야"
  -> 휴가 담당자 LLM: "네 휴가 올려드릴게요~"
  -> submit_leave_request(EMP-001, 2026-03-18, 1일, "개인사정")
  -> DB: leave_requests INSERT (LV-2026-0001)
  -> DB: approvals INSERT (APR-2026-0031, 승인자=김민준)

[상사(김민준) 대화창에 알림]
  -> 시스템: "직원 A가 휴가 신청을 하였습니다."
  -> [상사 LLM] 자동 분석: 팀 일정 + 팀원 휴가 확인
  -> ApprovalCard 표시: [승인] [반려] [질문하기]

상사(김민준): [승인] 클릭
  -> POST /approvals/APR-2026-0031/decide {decision: "approved"}
  -> leave_requests.status = 'approved'
  -> leave_balances 업데이트
  -> 캘린더 등록
  -> 알림: 정인수("휴가가 승인되었습니다!"), 휴가 담당자, 경영지원팀장
  -> 감사 로그 기록
```

### 시나리오 B: 대표 일정 조회 + 팀장 호출

```
대표: "직원 A 일정에 대해서 알려줘"
  -> [대표 LLM(비서)] query_employee_schedule(EMP-001) -> {3/18 연차}
  -> 대표 LLM: "직원 A는 3월 18일 개인사정으로 휴가 일정이 있습니다."

대표: "경영지원팀장 호출해줘"
  -> [대표 LLM] call_person(EMP-MGMT-LEADER)
  -> messaging-server가 DM 채널 생성 + 호출 알림
  -> 대표 LLM: "네, 경영지원팀장님께 호출 알림을 보냈습니다."

[경영지원팀장 대화창]
  -> 시스템: "대표님이 호출하셨습니다. [대화 열기]"

[DM 채널 - 순수 메신저, LLM 관여 없음]
  대표: "이번 달 인력 현황 어때?"
  경영지원팀장: (직접 타이핑) "현재 전원 정상 근무 중이고, 직원 A만 18일 휴가 예정입니다."
```

### 시나리오 C: 담당자 직접 개입 (Human Takeover)

```
직원 B: "나 다음주에 3일 연속 휴가 쓸 수 있어?"
  -> [휴가 담당 LLM] query_leave_balance, validate_date
  -> 휴가 담당 AI: "잔여 5일이라 3일 가능합니다. 월~수(3/23~25)로 할까요?"

[휴가 담당자(사람)가 [개입하기] 클릭]
  -> channel.human_takeover = true
  -> LLM 자동 응답 중지

휴가 담당자(사람): "잠깐, 직원 B님! 수요일에 전사 회의가 있어서 월~화(2일)로 조정하시거나, 목~금으로 변경하시는 게 좋을 것 같아요."
  -> sender_type="human", [직접 응답] 뱃지 표시

직원 B: "아 그렇군요, 그럼 목금으로 할게요."
휴가 담당자(사람): "네, 목금 2일로 올려드릴게요!"

[휴가 담당자(사람)가 [AI에게 넘기기] 클릭]
  -> channel.human_takeover = false
  -> LLM 자동 응답 재개
```

---

## 7. 비기능 요구사항 (NFR)

| # | 항목 | 요구사항 | 비고 |
|---|------|---------|------|
| NFR-1 | 실시간 메시지 전달 | < 500ms (메시지 전송 ~ 상대방 수신) | WebSocket 기반 |
| NFR-2 | 반응형 UI | 웹 + 모바일 반응형 지원 | Kakao Work 스타일 |
| NFR-3 | LLM 응답 시간 | < 3초 (Tool 호출 포함) | Haiku 모델 기준 |
| NFR-4 | 동시 접속 | 5명 동시 접속 (MVP 기준) | Phase 1 범위 |
| NFR-5 | 인증 | JWT 토큰 기반 인증 | 모든 API |
| NFR-6 | 감사 로그 | 모든 업무 행위 기록 (변조 불가) | INSERT-only 테이블 |

---

## 8. Out-of-Scope (MVP에서 제외)

| # | 항목 | 이유 | 향후 계획 |
|---|------|------|----------|
| 1 | 네이티브 앱 (iOS/Android) | MVP 범위 초과 | 웹 반응형으로 대체, 추후 검토 |
| 2 | B2B SaaS 멀티테넌시 | 내부 도구로 시작 | 외부 확장 시 검토 |
| 3 | Google Calendar 연동 | Phase 1 에서는 자체 캘린더 | Phase 2에서 선택적 연동 |
| 4 | Admin 관리 페이지 (FEAT-4) | v2 이후 | Phase 2 구현 |

---

## 9. 리스크 및 완화 전략

### Top 리스크
| # | 리스크 | 영향도 | 발생 가능성 | 완화 전략 |
|---|--------|-------|------------|----------|
| R-1 | LLM 할루시네이션으로 잘못된 업무 처리 | 높음 | 중간 | Tool 호출 강제 + 응답 검증 + Human Takeover |
| R-2 | LLM API 장애 | 높음 | 낮음 | 3회 재시도(1초/2초/4초) + 폴백 메시지 + 관리자 알림 |
| R-3 | 사용자가 AI 응답을 신뢰하지 않음 | 중간 | 중간 | 모든 숫자 데이터는 DB 기반 + [직접 응답] 뱃지로 사람/AI 구분 |

### 완화/실험
1. **Tool 호출 강제**: 숫자 데이터(연차 잔여 등)는 반드시 Tool 호출로만 응답 (System Prompt에 명시)
2. **응답 검증**: Tool 결과와 LLM 응답의 숫자 비교 (post-processing)
3. **액션 검증**: `submit_leave_request` 없이 "완료"라고 말하면 무효 처리
4. **Human Takeover**: 담당자가 언제든 AI 대화에 개입 가능 (FEAT-3)

---

## 10. 기술 아키텍처 요약

### 4개 레이어
```
Layer 4: 메신저 프론트엔드  <- 사용자가 보는 화면
Layer 3: 메시징 서버       <- 모든 메시지의 허브 (라우팅 판단)
Layer 2: AI 런타임         <- LLM 호출, Tool 실행
Layer 1: 비즈니스 서비스    <- DB, 휴가 CRUD, 결재, Admin
```

### 기술 스택
| 카테고리 | 기술 |
|---------|------|
| Runtime | Node.js 20+ / TypeScript (strict mode) |
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui |
| Backend | Hono 또는 Express |
| DB | PostgreSQL 15 (Supabase) + pgvector |
| 실시간 | Socket.IO |
| LLM | Anthropic Claude API (claude-haiku-4-5 기본, claude-sonnet-4 결재) |
| 상태관리 | Zustand |
| ORM | Drizzle ORM |
| 인증 | JWT |
| 캐시/메시징 | Redis 7 |
| 모노레포 | pnpm workspace |

### 서비스 구성
| 서비스 | 포트 | 역할 |
|--------|------|------|
| messenger (frontend) | 3010 | 메신저 UI |
| admin (frontend) | 3020 | Admin UI |
| messaging-server | 3000 | WebSocket 허브 + 메시지 라우팅 |
| ai-runtime | 3100 | LLM 호출 + Tool 실행 |
| leave-service | 3001 | 휴가 CRUD API |
| approval-service | 3002 | 결재 워크플로우 |
| notification-service | 3003 | 알림 |
| scheduler | 3004 | 정기 작업 |

---

## 11. 에러 케이스

### 휴가 신청 단계
| 코드 | 상황 | LLM 응답 | 시스템 처리 |
|------|------|---------|-----------|
| E-01 | 연차 0일 | "올해 연차를 모두 사용하셨어요. 병가나 특별휴가가 필요하시면 말씀해주세요!" | 신청 차단 |
| E-02 | 신청 일수 > 잔여 | "잔여 연차가 N일이라 X일은 어려워요. N일까지 가능한데 조정하시겠어요?" | 신청 차단 |
| E-03 | 중복 신청 | "해당 날짜는 이미 신청되어 있어요! (번호)" | DB UNIQUE 제약 |
| E-04 | 과거 날짜 | "이미 지난 날짜예요. 오늘 이후로 알려주세요!" | 신청 차단 |
| E-05 | 너무 먼 미래 (90일+) | "꽤 먼 미래네요. 맞으시죠?" + 공휴일이면 대안 제시 | 확인 요청 |
| E-06 | 같은 날 팀원 다수 휴가 | "해당 날짜에 팀원 N명이 이미 휴가예요. 신청은 가능하지만 반려될 수 있어요." | 경고 + 팀장 전달 |
| E-07 | 반차 오전/오후 미지정 | "오전 반차(09~13시)와 오후 반차(14~18시) 중 어떤 걸 원하세요?" | 추가 질문 |
| E-08 | 범위에 주말 포함 | "주말 제외하면 평일 N일이에요. 확인해 주세요." | 자동 계산 |

### 결재 단계
| 코드 | 상황 | 처리 |
|------|------|------|
| E-09 | 팀장 반려 | 직원에게 반려 알림 + 사유 전달 + 날짜 변경 제안 |
| E-10 | 자동승인 타임아웃 (2시간) | scheduler 감지 -> 자동 승인 -> 감사 로그(actor=system) |
| E-11 | 팀장 질문 후 승인/반려 | 결재 상태 'reviewing', 자동승인 타이머 일시정지 |
| E-12 | 승인 전 직원 취소 | pending 상태만 가능, 직접 취소 |
| E-13 | 승인 후 직원 취소 | 취소 결재 요청 생성 -> 팀장 승인 후 취소 |

### 시스템/기술
| 코드 | 상황 | 처리 |
|------|------|------|
| E-14 | LLM API 실패 | 3회 재시도(1초/2초/4초) -> 실패 시 폴백 메시지 + 관리자 알림 |
| E-15 | LLM 할루시네이션 방어 | Tool 호출 강제 + 숫자 비교 + submit 없이 완료 말하면 무효 |
| E-16 | DB 연결 실패 | 폴백 메시지 + Redis 큐 임시 저장 -> 복구 후 재처리 |
| E-17 | WebSocket 끊김 | 자동 재연결(1초/2초/4초...최대 30초) + 놓친 메시지 조회 |
| E-18 | 동시 요청 (Race Condition) | DB UNIQUE 제약 + 트랜잭션 -> E-03으로 처리 |

### 에러 코드 참조표
| 코드 | HTTP | 상황 | 사용자 메시지 |
|------|------|------|-------------|
| LV_001 | 400 | 연차 부족 | 연차가 부족합니다 |
| LV_002 | 400 | 주말/공휴일 | 해당 날짜는 주말/공휴일입니다 |
| LV_003 | 409 | 중복 신청 | 이미 신청이 있습니다 |
| LV_004 | 400 | 과거 날짜 | 과거 날짜는 신청 불가 |
| LV_005 | 400 | 신청 불가 상태 | 신청할 수 없는 상태 |
| AP_001 | 400 | 이미 처리된 결재 | 이미 처리된 건입니다 |
| AP_002 | 403 | 결재 권한 없음 | 승인 권한이 없습니다 |
| SYS_001 | 503 | LLM 실패 | 잠시 후 재시도해주세요 |
| SYS_002 | 503 | DB 실패 | 시스템 점검 중 |
| AUTH_001 | 401 | 인증 실패 | 로그인이 필요합니다 |
| AUTH_002 | 403 | 권한 없음 | 접근 권한이 없습니다 |

---

## 12. 의사결정 로그 (Decision Log)

| ID | 질문 | 결정 | 근거 |
|----|------|------|------|
| D-01 | 핵심 공식은? | 사용자 = 사람 + LLM. 모든 사용자에게 LLM이 할당됨 | 메신저와 AI를 자연스럽게 통합하기 위해 |
| D-02 | LLM은 누구의 소유인가? | 각 사용자에게 할당. user_llm_configs 테이블로 관리 | 역할별 System Prompt와 Tool 세트가 다르기 때문 |
| D-03 | 메시지 라우팅은 어디서? | messaging-server (Layer 3)가 모든 라우팅 판단 | 중앙 허브 역할, 단일 책임 |
| D-04 | 사람-사람 DM에 LLM 관여? | 관여 없음. 순수 메신저 | 불필요한 AI 개입 방지 |
| D-05 | 라우터 LLM 모델은? | claude-haiku-4-5 | 빠르고 저렴. 의도 분석만 수행 |
| D-06 | 결재 보조 LLM 모델은? | claude-sonnet-4 | 판단 정확성이 중요한 영역 |
| D-07 | Human Takeover 방식은? | 채널 단위 toggle (human_takeover flag) | 단순하고 직관적 |
| D-08 | 자동 승인 정책은? | 2시간 미응답 시 자동 승인 | 업무 지연 방지 |
| D-09 | 할루시네이션 방어는? | Tool 호출 강제 + 응답 검증 + submit 없이 완료 불가 | 정확성이 핵심인 HR 업무 |
| D-10 | DB는? | PostgreSQL 15 + Drizzle ORM | 타입 안전성, 마이그레이션 관리 |
| D-11 | 실시간 통신은? | Socket.IO (WebSocket) | 양방향 실시간 메시지 + 이벤트 |
| D-12 | 프론트엔드 프레임워크는? | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui | 모던 스택, 빠른 개발 |
| D-13 | 상태 관리는? | Zustand | 가볍고 직관적 |
| D-14 | 모노레포 도구는? | pnpm workspace | 빠르고 디스크 효율적 |
| D-15 | 인증 방식은? | JWT | 무상태 인증, 마이크로서비스 호환 |
| D-16 | 캐시/세션은? | Redis 7 | 온라인 상태, 세션, Pub/Sub |
| D-17 | 캘린더 연동은? | Phase 1: DB 자체 캘린더, Phase 2: Google Calendar | MVP 범위 제한 |
| D-18 | 감사 로그 정책은? | INSERT-only 테이블 (UPDATE/DELETE 차단) | 변조 불가 감사 추적 |
| D-19 | 에러 처리 방식은? | 커스텀 AppError + 에러 코드 체계 (LV, AP, SYS, AUTH) | 일관된 에러 응답 |
| D-20 | LLM 응답 톤은? | 친근하고 자연스럽게. 이모지 적절히. 기술 용어 금지 | 사용자 친화적 경험 |
| D-21 | 백엔드 프레임워크는? | Hono 또는 Express | 경량 + TypeScript 친화 |

---

## 13. 다음 단계

### Phase 2 계획
1. **프로젝트 셋업**: 모노레포 초기화, 개발 환경 구성
2. **Step 1**: DB + 비즈니스 서비스 (leave-service, approval-service)
3. **Step 2**: 메시징 서버 (Socket.IO, 채널 관리, 라우팅)
4. **Step 3**: AI 런타임 (LLM 연동, Tool 실행)
5. **Step 4**: 메신저 프론트엔드 (Next.js)
6. **Step 5**: Admin + 알림 + 스케줄러

### 개발 순서 의존성
```
Step 1 (DB + API) -> Step 2 (메시징) -> Step 3 (AI) -> Step 4 (프론트) -> Step 5 (Admin)
```

---

## 부록 A: 프로젝트 구조

```
palette-platform/
  apps/
    messenger/              # Next.js 메신저 UI (포트 3010)
    admin/                  # Next.js Admin UI (포트 3020)
  services/
    messaging-server/       # WebSocket 허브 + 메시지 라우팅 (포트 3000)
    ai-runtime/             # LLM 호출 + Tool 실행 (포트 3100)
    leave-service/          # 휴가 CRUD API (포트 3001)
    approval-service/       # 결재 워크플로우 (포트 3002)
    notification-service/   # 알림 (포트 3003)
    scheduler/              # 정기 작업 (포트 3004)
  packages/
    shared/                 # 공통 타입, 유틸, 에러 코드
    db/                     # Drizzle 스키마, 마이그레이션, seed
  docs/
    planning/
      01-prd.md             # 이 문서
    ARCHITECTURE.md
    DATABASE.md
    API.md
    LLM.md
    FRONTEND.md
    SCENARIOS.md
  docker-compose.yml
  pnpm-workspace.yaml
  CLAUDE.md
```

## 부록 B: 데이터 모델 요약

| 테이블 | 역할 | ID 형식 |
|--------|------|---------|
| teams | 팀/부서 | TEAM-XXX |
| employees | 직원 (5명) | EMP-XXX |
| user_llm_configs | 사용자별 LLM 설정 | user_id FK |
| leave_policies | 연차 정책 | LP-XXX |
| leave_balances | 연차 잔여 | UUID |
| leave_requests | 휴가 신청 | LV-YYYY-NNNN |
| approvals | 결재 | APR-YYYY-NNNN |
| holidays | 공휴일 | DATE PK |
| channels | 채널 | ch-{uuid} |
| messages | 메시지 | UUID |
| audit_log | 감사 로그 | UUID |
| leave_accrual_log | 연차 발생 이력 | UUID |

## 부록 C: LLM 모델 선택 기준

| 역할 | 모델 | 이유 |
|------|------|------|
| 라우터 (router) | claude-haiku-4-5 | 빠르고 저렴. 의도 분석만 수행 |
| 휴가 담당 (work_assistant) | claude-haiku-4-5 | 정형화된 업무. 빠른 응답 중요 |
| 결재 보조 (approver) | claude-sonnet-4 | 판단이 필요. 정확성 중요 |
| 비서 (secretary) | claude-haiku-4-5 | 조회+전달 위주. 빠른 응답 중요 |
| 팀 보조 (team_assistant) | claude-haiku-4-5 | 현황 조회 위주 |
