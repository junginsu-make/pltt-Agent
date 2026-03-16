# 04. 데이터베이스 설계

> Palette AI Agent -- MVP Phase 1
> 원본 DDL: `docs/DATABASE.md` (13 tables)
> DBMS: PostgreSQL 15 + pgcrypto + pgvector
> ORM: Drizzle ORM (TypeScript strict mode)

---

## 1. 설계 원칙

| 원칙 | 설명 |
|------|------|
| **비즈니스 ID 가독성** | 사람이 읽을 수 있는 텍스트 PK(`EMP-001`, `LV-2026-0001`) 사용. 내부 전용 테이블만 UUID |
| **INSERT-only 감사** | `audit_log`는 UPDATE/DELETE를 PostgreSQL Rule로 원천 차단. 해시 체인으로 무결성 보장 |
| **GENERATED 컬럼** | `leave_balances.remaining_days`는 DB가 자동 계산. 애플리케이션 로직 불일치 방지 |
| **JSONB 유연성** | 정책 규칙(`rules`), 카드 데이터(`card_data`), 도구 호출(`tool_calls`) 등 가변 구조는 JSONB 사용 |
| **배열 타입 활용** | 채널 참여자(`participants`), 읽음 처리(`read_by`), 업무 도메인(`work_domains`)에 PostgreSQL 네이티브 배열 |
| **순환 참조 해결** | `teams.leader_id -> employees` FK는 ALTER TABLE로 테이블 생성 후 추가 |
| **타임스탬프 표준화** | 모든 시간 컬럼은 `TIMESTAMPTZ` 사용. 서버 시간대 무관하게 UTC 저장 |

---

## 2. ER 다이어그램 (Mermaid)

```mermaid
erDiagram
    %% ============================================================
    %% FEAT-0: 사용자/인증 도메인
    %% ============================================================

    teams {
        TEXT id PK "TEAM-XXX"
        TEXT name "팀 이름"
        TEXT leader_id FK "employees.id"
        TEXT parent_id FK "teams.id (자기참조)"
        TIMESTAMPTZ created_at "DEFAULT now()"
    }

    employees {
        TEXT id PK "EMP-XXX"
        TEXT name "이름"
        TEXT email UK "UNIQUE, 로그인 ID"
        TEXT password_hash "bcrypt"
        TEXT team_id FK "teams.id"
        TEXT position "직책"
        TEXT grade "직급"
        TEXT manager_id FK "employees.id (자기참조)"
        DATE hire_date "입사일"
        TEXT leave_policy_id "LP-DEFAULT"
        TEXT status "active/inactive"
        TEXT messenger_status "online/offline/away"
        TEXT telegram_id "Telegram 연동"
        TEXT avatar_url "프로필 이미지"
        TIMESTAMPTZ created_at "DEFAULT now()"
        TIMESTAMPTZ updated_at "DEFAULT now()"
    }

    user_llm_configs {
        TEXT user_id PK_FK "employees.id"
        TEXT llm_role "router/work_assistant/approver/..."
        TEXT system_prompt "시스템 프롬프트"
        TEXT llm_model "claude-haiku-4-5-20251001"
        BOOLEAN auto_respond "자동 응답 여부"
        JSONB tools "사용 가능 도구 배열"
        TEXT_ARRAY work_domains "담당 업무 도메인"
        TIMESTAMPTZ updated_at "DEFAULT now()"
    }

    %% ============================================================
    %% FEAT-1: 메신저 도메인
    %% ============================================================

    channels {
        TEXT id PK "ch-uuid"
        TEXT type "direct/work/team/notification/company"
        TEXT name "채널 이름"
        TEXT work_domain "업무 도메인"
        TEXT assigned_llm "담당 LLM user_id"
        BOOLEAN human_takeover "담당자 개입 중"
        TEXT takeover_by FK "employees.id"
        TEXT_ARRAY participants "참여자 ID 배열"
        JSONB metadata "추가 메타데이터"
        TIMESTAMPTZ created_at "DEFAULT now()"
        TIMESTAMPTZ updated_at "DEFAULT now()"
    }

    messages {
        UUID id PK "gen_random_uuid()"
        TEXT channel_id FK "channels.id"
        TEXT sender_type "human/llm/system"
        TEXT sender_user_id FK "employees.id"
        TEXT display_name "표시 이름"
        TEXT content_type "text/card/approval/notification"
        TEXT content_text "메시지 본문"
        JSONB card_data "카드 렌더링 데이터"
        JSONB tool_calls "LLM 도구 호출 기록"
        JSONB tool_results "도구 실행 결과"
        BOOLEAN is_llm_auto "LLM 자동 응답 여부"
        TEXT_ARRAY read_by "읽은 사용자 ID 배열"
        TIMESTAMPTZ created_at "DEFAULT now()"
    }

    %% ============================================================
    %% FEAT-2: 휴가/결재 도메인
    %% ============================================================

    leave_policies {
        TEXT id PK "LP-DEFAULT"
        TEXT name "정책 이름"
        JSONB rules "연차 발생 규칙"
        JSONB leave_types "휴가 유형 정의"
        JSONB auto_approve "자동 승인 설정"
        BOOLEAN is_active "활성 여부"
        TIMESTAMPTZ created_at "DEFAULT now()"
    }

    leave_balances {
        UUID id PK "gen_random_uuid()"
        TEXT employee_id FK "employees.id"
        INTEGER year "연도"
        TEXT leave_type "annual/sick/special"
        NUMERIC total_days "총 일수 (4,1)"
        NUMERIC used_days "사용 일수 (4,1)"
        NUMERIC pending_days "승인대기 일수 (4,1)"
        NUMERIC remaining_days "잔여 일수 (GENERATED)"
        DATE expires_at "만료일"
        TIMESTAMPTZ created_at "DEFAULT now()"
    }

    leave_requests {
        TEXT id PK "LV-YYYY-NNNN"
        TEXT employee_id FK "employees.id"
        TEXT leave_type "annual/half_am/half_pm/sick/special"
        DATE start_date "시작일"
        DATE end_date "종료일"
        NUMERIC days "신청 일수 (4,1)"
        TEXT reason "사유"
        TEXT status "pending/approved/rejected/cancelled"
        TEXT approval_id "approvals.id"
        TEXT conversation_id "대화 채널 참조"
        TIMESTAMPTZ created_at "DEFAULT now()"
        TIMESTAMPTZ updated_at "DEFAULT now()"
    }

    approvals {
        TEXT id PK "APR-YYYY-NNNN"
        TEXT type "leave_request/leave_cancel/..."
        TEXT related_id "대상 요청 ID"
        TEXT requested_by FK "employees.id"
        TEXT approver_id FK "employees.id"
        TEXT status "pending/approved/rejected/reviewing"
        TEXT request_summary "요약"
        TEXT llm_reasoning "LLM 분석 결과"
        TEXT review_comment "결재자 코멘트"
        TIMESTAMPTZ auto_approve_at "자동 승인 시각"
        TIMESTAMPTZ created_at "DEFAULT now()"
        TIMESTAMPTZ completed_at "결재 완료 시각"
    }

    holidays {
        DATE date PK "공휴일 날짜"
        TEXT name "공휴일 이름"
        INTEGER year "연도"
    }

    %% ============================================================
    %% 공통: 감사/로그 도메인
    %% ============================================================

    audit_log {
        UUID id PK "gen_random_uuid()"
        TIMESTAMPTZ timestamp "DEFAULT now()"
        TEXT actor "수행자 ID 또는 system"
        TEXT action "수행 동작"
        TEXT target_type "대상 테이블"
        TEXT target_id "대상 레코드 ID"
        JSONB details "상세 정보"
        TEXT prev_hash "이전 로그 해시"
        TEXT hash "현재 로그 해시"
    }

    leave_accrual_log {
        UUID id PK "gen_random_uuid()"
        TEXT employee_id FK "employees.id"
        TEXT accrual_type "발생 유형"
        NUMERIC days "발생 일수 (4,1)"
        TEXT reason "사유"
        NUMERIC balance_after "적용 후 잔여 (4,1)"
        TEXT created_by "생성자"
        TIMESTAMPTZ created_at "DEFAULT now()"
    }

    %% ============================================================
    %% 관계 정의
    %% ============================================================

    %% FEAT-0 관계
    teams ||--o{ employees : "team_id"
    teams ||--o| employees : "leader_id"
    teams ||--o| teams : "parent_id (자기참조)"
    employees ||--o| employees : "manager_id (자기참조)"
    employees ||--o| user_llm_configs : "1:1 LLM 설정"

    %% FEAT-1 관계
    channels ||--o{ messages : "channel_id"
    employees ||--o{ messages : "sender_user_id"
    employees ||--o| channels : "takeover_by"

    %% FEAT-2 관계
    employees ||--o{ leave_balances : "employee_id"
    employees ||--o{ leave_requests : "employee_id"
    employees ||--o{ approvals : "requested_by"
    employees ||--o{ approvals : "approver_id"
    leave_requests ||--o| approvals : "approval_id"
    leave_policies ||--o{ employees : "leave_policy_id"

    %% 공통 관계
    employees ||--o{ leave_accrual_log : "employee_id"
```

---

## 3. 테이블 상세 명세

### 3.1 FEAT-0: 사용자/인증 도메인

#### 3.1.1 `teams` -- 팀/부서

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | TEXT | PK | 팀 ID (`TEAM-EXEC`, `TEAM-MGMT`, `TEAM-DEV`) |
| `name` | TEXT | NOT NULL | 팀 이름 |
| `leader_id` | TEXT | FK -> employees(id) | 팀장 (순환 참조, ALTER TABLE로 추가) |
| `parent_id` | TEXT | FK -> teams(id) | 상위 팀 (자기참조, 트리 구조) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | 생성 시각 |

**설계 의도:**
- `leader_id`는 `employees` 테이블 생성 후 `ALTER TABLE`로 FK를 추가하여 순환 참조 해결
- `parent_id` 자기참조로 향후 다계층 조직도 확장 가능 (현재 MVP에서는 1단계만 사용)
- Seed: 경영진, 경영지원팀, 개발팀 (3개)

---

#### 3.1.2 `employees` -- 직원

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | TEXT | PK | 직원 ID (`EMP-CEO`, `EMP-001`) |
| `name` | TEXT | NOT NULL | 이름 |
| `email` | TEXT | UNIQUE NOT NULL | 로그인용 이메일 |
| `password_hash` | TEXT | NOT NULL | bcrypt 해시 |
| `team_id` | TEXT | FK -> teams(id) | 소속 팀 |
| `position` | TEXT | | 직책 (대표이사, 개발팀장, ...) |
| `grade` | TEXT | | 직급 (대표, 팀장, 대리, 사원) |
| `manager_id` | TEXT | FK -> employees(id) | 직속 상사 (자기참조) |
| `hire_date` | DATE | NOT NULL | 입사일 (연차 계산 기준) |
| `leave_policy_id` | TEXT | DEFAULT 'LP-DEFAULT' | 적용 연차 정책 |
| `status` | TEXT | DEFAULT 'active' | active / inactive |
| `messenger_status` | TEXT | DEFAULT 'offline' | online / offline / away |
| `telegram_id` | TEXT | | Telegram 연동 ID |
| `avatar_url` | TEXT | | 프로필 이미지 URL |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | 생성 시각 |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | 수정 시각 |

**설계 의도:**
- `manager_id` 자기참조로 상사 체인 구성. 대표(`EMP-CEO`)는 `manager_id = NULL`
- `hire_date`는 근속 연수 기반 연차 계산의 핵심 필드
- `messenger_status`는 Redis에서 실시간 관리하되, DB에도 마지막 상태 기록
- `leave_policy_id`는 직원별 차등 정책 적용 가능하도록 설계 (MVP에서는 전원 LP-DEFAULT)
- Seed: 5명 (대표, 경영지원팀장, 휴가 담당자, 김민준, 정인수)

---

#### 3.1.3 `user_llm_configs` -- 사용자별 LLM 설정

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `user_id` | TEXT | PK, FK -> employees(id) | 직원 ID (1:1 관계) |
| `llm_role` | TEXT | NOT NULL | 역할 (router, work_assistant, approver, team_assistant, secretary) |
| `system_prompt` | TEXT | NOT NULL | 시스템 프롬프트 전문 |
| `llm_model` | TEXT | DEFAULT 'claude-haiku-4-5-20251001' | 사용 모델 |
| `auto_respond` | BOOLEAN | DEFAULT true | 자동 응답 활성화 |
| `tools` | JSONB | DEFAULT '[]' | 사용 가능한 도구 이름 배열 |
| `work_domains` | TEXT[] | DEFAULT '{}' | 담당 업무 도메인 배열 |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | 수정 시각 |

**설계 의도:**
- `employees`와 1:1 관계. "사용자 = 사람 + LLM" 아키텍처의 핵심 테이블
- `tools` JSONB로 사용자별 도구 세트를 유연하게 구성
- `work_domains` 배열로 업무 채널 라우팅 시 담당자 매칭에 사용
- `llm_model`을 사용자별로 지정 가능하여 향후 모델 차등 적용 대비

**LLM 역할 매핑 (Seed 기준):**

| 직원 | llm_role | 도구 | 업무 도메인 |
|------|----------|------|------------|
| 정인수 (EMP-001) | router | analyze_intent | - |
| 김민준 (EMP-DEV-LEADER) | approver | check_team_schedule, check_team_leaves, approve_request, reject_request | - |
| 휴가 담당자 (EMP-HR-001) | work_assistant | query_leave_balance, validate_date, submit_leave_request, search_policy | leave |
| 경영지원팀장 (EMP-MGMT-LEADER) | team_assistant | get_team_summary, get_team_leaves | - |
| 대표 (EMP-CEO) | secretary | query_employee_schedule, call_person, get_team_summary | - |

---

### 3.2 FEAT-1: 메신저 도메인

#### 3.2.1 `channels` -- 대화 채널

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | TEXT | PK | 채널 ID (`ch-{uuid}`) |
| `type` | TEXT | NOT NULL | direct / work / team / notification / company |
| `name` | TEXT | | 채널 표시 이름 |
| `work_domain` | TEXT | | 업무 도메인 (work 채널용) |
| `assigned_llm` | TEXT | | 담당 LLM의 user_id |
| `human_takeover` | BOOLEAN | DEFAULT false | 담당자 개입 상태 |
| `takeover_by` | TEXT | FK -> employees(id) | 개입 담당자 |
| `participants` | TEXT[] | NOT NULL | 참여자 employee_id 배열 |
| `metadata` | JSONB | DEFAULT '{}' | 추가 메타데이터 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | 생성 시각 |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | 수정 시각 |

**채널 type별 동작:**

| type | LLM 관여 | 생성 시점 | 예시 |
|------|---------|----------|------|
| `direct` | 없음 | 사용자 간 DM 시작 시 | 대표 <-> 경영지원팀장 |
| `work` | 담당자 LLM 자동 응답 | 업무 질문 감지 시 자동 생성 | 정인수 -> 휴가 채널 |
| `team` | 팀장 LLM 보조 | 팀 생성 시 자동 | 경영지원팀 채널 |
| `notification` | 시스템/LLM 발신 전용 | 결재/승인 이벤트 시 | 결재 알림 |
| `company` | 대표 LLM(비서) 보조 | 초기 설정 시 | 전사 채널 |

**설계 의도:**
- `participants` 배열로 채널 참여자를 관리. 조회 시 `@>` 연산자로 "내가 속한 채널" 필터링
- `human_takeover` + `takeover_by` 조합으로 Human Takeover 상태를 명시적으로 관리
- `assigned_llm`은 `user_llm_configs.user_id`와 매칭. 해당 사용자의 LLM 설정이 로드됨
- `work_domain`은 업무 라우팅 시 `user_llm_configs.work_domains`와 매칭

---

#### 3.2.2 `messages` -- 메시지

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | 메시지 고유 ID |
| `channel_id` | TEXT | FK -> channels(id), NOT NULL | 소속 채널 |
| `sender_type` | TEXT | NOT NULL | human / llm / system |
| `sender_user_id` | TEXT | FK -> employees(id) | 발신자 (system이면 NULL 가능) |
| `display_name` | TEXT | NOT NULL | UI 표시 이름 |
| `content_type` | TEXT | DEFAULT 'text' | text / card / approval / notification |
| `content_text` | TEXT | | 텍스트 본문 |
| `card_data` | JSONB | | 카드 렌더링용 JSON |
| `tool_calls` | JSONB | DEFAULT '[]' | LLM 도구 호출 기록 |
| `tool_results` | JSONB | DEFAULT '[]' | 도구 실행 결과 |
| `is_llm_auto` | BOOLEAN | DEFAULT false | LLM 자동 응답 여부 |
| `read_by` | TEXT[] | DEFAULT '{}' | 읽은 사용자 배열 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | 생성 시각 |

**인덱스:**

| 이름 | 정의 | 용도 |
|------|------|------|
| `idx_messages_channel` | `messages(channel_id, created_at DESC)` | 채널별 메시지 시간순 조회 (핵심 쿼리 최적화) |
| `idx_messages_sender` | `messages(sender_user_id)` | 발신자별 메시지 조회 |

**content_type별 데이터 구조:**

```
text:         content_text에 순수 텍스트
card:         card_data에 연차 현황 카드 JSON
approval:     card_data에 결재 요청 카드 JSON (승인/반려/질문 버튼 포함)
notification: content_text에 알림 텍스트
```

**설계 의도:**
- `tool_calls` / `tool_results`를 메시지 단위로 기록하여 LLM 동작의 추적 가능성(traceability) 확보
- `is_llm_auto`로 LLM 자동 응답과 담당자 직접 응답 구분 (UI에서 "[직접 응답]" 뱃지 표시)
- `read_by` 배열로 읽음 확인 구현. 소규모 참여자(5명) 기준 최적
- UUID PK로 메시지의 고유성 보장. 동시 요청에도 충돌 없음

---

### 3.3 FEAT-2: 휴가/결재 도메인

#### 3.3.1 `leave_policies` -- 연차 정책

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | TEXT | PK | 정책 ID (`LP-DEFAULT`) |
| `name` | TEXT | NOT NULL | 정책 이름 |
| `rules` | JSONB | NOT NULL | 연차 발생 규칙 |
| `leave_types` | JSONB | NOT NULL | 휴가 유형 정의 |
| `auto_approve` | JSONB | DEFAULT '{"enabled": true, "timeout_hours": 2}' | 자동 승인 설정 |
| `is_active` | BOOLEAN | DEFAULT true | 활성 여부 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | 생성 시각 |

**`rules` JSONB 구조 (LP-DEFAULT):**

```jsonc
{
  "first_year": {
    "type": "monthly_accrual",      // 1년차: 월별 발생
    "condition": "full_month_worked",
    "days_per_month": 1,
    "max_days": 11
  },
  "after_one_year": {
    "type": "annual_grant",          // 2년차+: 연간 일괄 부여
    "min_attendance_rate": 0.8,
    "base_days": 15
  },
  "seniority_bonus": {
    "start_after_years": 3,          // 3년 이후 근속 보너스
    "bonus_days": 1,
    "every_years": 2,
    "max_total_days": 25
  },
  "expiry": {
    "duration_months": 12,           // 12개월 후 만료
    "allow_carryover": false
  }
}
```

**`leave_types` JSONB 구조:**

| code | 이름 | 잔여 차감 | 차감량 | 승인 필요 |
|------|------|---------|--------|----------|
| `annual` | 연차 | O | 1.0 | O |
| `half_am` | 오전 반차 | O | 0.5 | O |
| `half_pm` | 오후 반차 | O | 0.5 | O |
| `sick` | 병가 | X | - | O |
| `special` | 특별휴가 | X | - | O |

---

#### 3.3.2 `leave_balances` -- 연차 잔여

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | 레코드 ID |
| `employee_id` | TEXT | FK -> employees(id), NOT NULL | 직원 |
| `year` | INTEGER | NOT NULL | 연도 |
| `leave_type` | TEXT | DEFAULT 'annual' | 휴가 유형 |
| `total_days` | NUMERIC(4,1) | NOT NULL | 총 부여 일수 |
| `used_days` | NUMERIC(4,1) | DEFAULT 0 | 사용 일수 |
| `pending_days` | NUMERIC(4,1) | DEFAULT 0 | 승인대기 일수 |
| `remaining_days` | NUMERIC(4,1) | GENERATED ALWAYS AS (total_days - used_days - pending_days) STORED | 잔여 일수 (자동 계산) |
| `expires_at` | DATE | | 만료일 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | 생성 시각 |

**제약조건:** `UNIQUE(employee_id, year, leave_type)` -- 직원/연도/유형 조합 중복 방지

**설계 의도:**
- `remaining_days`는 GENERATED STORED 컬럼. DB 레벨에서 `total - used - pending`을 자동 계산하여 애플리케이션 로직 실수 방지
- 반차(0.5일) 지원을 위해 `NUMERIC(4,1)` 사용 (정수가 아닌 소수점 1자리)
- `pending_days`는 신청 시 증가, 승인 시 `used_days`로 이전 후 감소, 반려/취소 시 원복

**잔여 일수 변동 흐름:**

```
[신청]  pending_days += days     -> remaining_days 감소
[승인]  used_days += days, pending_days -= days  -> remaining_days 변동 없음
[반려]  pending_days -= days     -> remaining_days 복구
[취소]  pending_days -= days (pending일 때)  -> remaining_days 복구
        used_days -= days (approved 취소 승인 시)  -> remaining_days 복구
```

---

#### 3.3.3 `leave_requests` -- 휴가 신청

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | TEXT | PK | 신청 ID (`LV-YYYY-NNNN`) |
| `employee_id` | TEXT | FK -> employees(id), NOT NULL | 신청자 |
| `leave_type` | TEXT | NOT NULL, DEFAULT 'annual' | 휴가 유형 |
| `start_date` | DATE | NOT NULL | 시작일 |
| `end_date` | DATE | NOT NULL | 종료일 |
| `days` | NUMERIC(4,1) | NOT NULL | 실제 사용 일수 (주말/공휴일 제외) |
| `reason` | TEXT | | 사유 |
| `status` | TEXT | DEFAULT 'pending' | pending / approved / rejected / cancelled |
| `approval_id` | TEXT | | 연결된 결재 ID |
| `conversation_id` | TEXT | | 대화가 이루어진 채널 ID |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | 생성 시각 |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | 수정 시각 |

**상태 전이 다이어그램:**

```
                    +-----------+
                    |  pending  |
                    +-----+-----+
                          |
              +-----------+-----------+
              |           |           |
              v           v           v
        +---------+  +----------+  +-----------+
        | approved|  | rejected |  | cancelled |
        +---------+  +----------+  +-----------+
              |
              v
      +---------------+
      | cancel_pending| (승인 후 취소 요청)
      +-------+-------+
              |
        +-----+-----+
        |           |
        v           v
  +-----------+  +---------+
  | cancelled |  | (유지)  |
  +-----------+  +---------+
```

---

#### 3.3.4 `approvals` -- 결재

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | TEXT | PK | 결재 ID (`APR-YYYY-NNNN`) |
| `type` | TEXT | NOT NULL, DEFAULT 'leave_request' | 결재 유형 |
| `related_id` | TEXT | NOT NULL | 대상 요청 ID (leave_requests.id 등) |
| `requested_by` | TEXT | FK -> employees(id), NOT NULL | 요청자 |
| `approver_id` | TEXT | FK -> employees(id), NOT NULL | 결재자 |
| `status` | TEXT | DEFAULT 'pending' | pending / approved / rejected / reviewing |
| `request_summary` | TEXT | NOT NULL | 요청 요약 (LLM 생성) |
| `llm_reasoning` | TEXT | | LLM 분석 결과 (팀 일정, 추천 등) |
| `review_comment` | TEXT | | 결재자 코멘트 |
| `auto_approve_at` | TIMESTAMPTZ | | 자동 승인 예정 시각 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | 생성 시각 |
| `completed_at` | TIMESTAMPTZ | | 결재 완료 시각 |

**상태 전이:**

```
pending --> approved      (결재자 승인)
pending --> rejected      (결재자 반려)
pending --> reviewing     (결재자 질문하기 -> 자동승인 타이머 일시정지)
pending --> approved      (자동승인 타임아웃: 2시간 미응답)
reviewing --> approved    (질문 후 승인)
reviewing --> rejected    (질문 후 반려)
```

**설계 의도:**
- `llm_reasoning`에 상사 LLM이 분석한 팀 일정, 동일 날짜 휴가 현황 등을 저장
- `auto_approve_at`은 `created_at + policy.auto_approve.timeout_hours`로 설정
- `reviewing` 상태 진입 시 `auto_approve_at = NULL`로 타이머 정지
- `type`을 확장하면 휴가 외 다른 결재 유형도 수용 가능

---

#### 3.3.5 `holidays` -- 공휴일

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `date` | DATE | PK | 공휴일 날짜 |
| `name` | TEXT | NOT NULL | 공휴일 이름 |
| `year` | INTEGER | NOT NULL | 연도 (조회 최적화) |

**설계 의도:**
- DATE를 PK로 사용하여 중복 등록 원천 차단
- `year` 컬럼으로 연도별 일괄 조회 최적화
- 날짜 유효성 검증(`validate_date` Tool)에서 주말 + holidays 테이블 조회
- Seed: 2026년 한국 공휴일 15개

---

### 3.4 공통: 감사/로그 도메인

#### 3.4.1 `audit_log` -- 감사 로그

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | 로그 ID |
| `timestamp` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 발생 시각 |
| `actor` | TEXT | NOT NULL | 수행자 (employee_id 또는 "system") |
| `action` | TEXT | NOT NULL | 동작 (create, approve, reject, auto_approved, ...) |
| `target_type` | TEXT | | 대상 테이블 이름 |
| `target_id` | TEXT | | 대상 레코드 ID |
| `details` | JSONB | NOT NULL, DEFAULT '{}' | 상세 정보 (변경 전후 값 등) |
| `prev_hash` | TEXT | | 이전 로그의 해시 (체인 연결) |
| `hash` | TEXT | NOT NULL | 현재 로그의 해시 |

**불변성 보장 (PostgreSQL Rules):**

```sql
CREATE RULE audit_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;
```

- INSERT만 가능. UPDATE/DELETE 시도 시 무시됨 (에러가 아닌 NOTHING)
- `prev_hash` -> `hash` 체인으로 로그 변조 여부 검증 가능

**해시 체인 로직:**

```
hash = SHA256(id + timestamp + actor + action + target_type + target_id + details + prev_hash)
```

**주요 기록 대상:**

| action | 설명 | actor 예시 |
|--------|------|-----------|
| `leave_request_created` | 휴가 신청 | EMP-001 |
| `leave_approved` | 휴가 승인 | EMP-DEV-LEADER |
| `leave_rejected` | 휴가 반려 | EMP-DEV-LEADER |
| `leave_cancelled` | 휴가 취소 | EMP-001 |
| `auto_approved` | 자동 승인 (타임아웃) | system |
| `human_takeover` | 담당자 개입 | EMP-HR-001 |
| `human_release` | AI에게 넘기기 | EMP-HR-001 |
| `balance_adjusted` | 잔여 조정 | system |

---

#### 3.4.2 `leave_accrual_log` -- 연차 발생 이력

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | 로그 ID |
| `employee_id` | TEXT | FK -> employees(id), NOT NULL | 대상 직원 |
| `accrual_type` | TEXT | NOT NULL | 발생 유형 (monthly, annual_grant, seniority_bonus, manual) |
| `days` | NUMERIC(4,1) | NOT NULL | 발생 일수 |
| `reason` | TEXT | NOT NULL | 사유 |
| `balance_after` | NUMERIC(4,1) | | 적용 후 total_days |
| `created_by` | TEXT | | 생성자 (system / 관리자 ID) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | 생성 시각 |

**설계 의도:**
- scheduler 서비스가 매월/매년 연차 발생 시 이력 기록
- 수동 조정(관리자)도 동일하게 기록하여 추적 가능
- `balance_after`로 시점별 잔여 현황 추적

---

## 4. 관계 정의 요약

### 4.1 외래 키 관계 전체 목록

| 출발 테이블 | 컬럼 | 대상 테이블 | 대상 컬럼 | 카디널리티 | 비고 |
|------------|------|-----------|----------|-----------|------|
| teams | leader_id | employees | id | N:1 | ALTER TABLE로 추가 |
| teams | parent_id | teams | id | N:1 | 자기참조 (트리) |
| employees | team_id | teams | id | N:1 | |
| employees | manager_id | employees | id | N:1 | 자기참조 (상사 체인) |
| user_llm_configs | user_id | employees | id | 1:1 | PK이자 FK |
| channels | takeover_by | employees | id | N:1 | |
| messages | channel_id | channels | id | N:1 | |
| messages | sender_user_id | employees | id | N:1 | NULL 가능 (system) |
| leave_balances | employee_id | employees | id | N:1 | |
| leave_requests | employee_id | employees | id | N:1 | |
| approvals | requested_by | employees | id | N:1 | |
| approvals | approver_id | employees | id | N:1 | |
| leave_accrual_log | employee_id | employees | id | N:1 | |

### 4.2 논리적 참조 (FK 미설정)

| 출발 테이블 | 컬럼 | 참조 대상 | 설명 |
|------------|------|----------|------|
| employees | leave_policy_id | leave_policies.id | TEXT 참조 (LP-DEFAULT 고정) |
| leave_requests | approval_id | approvals.id | 생성 순서상 나중에 연결 |
| leave_requests | conversation_id | channels.id | 대화 추적용 |
| approvals | related_id | leave_requests.id | 다형성 참조 (type별 대상 변경) |
| channels | assigned_llm | user_llm_configs.user_id | 채널 담당 LLM |
| audit_log | actor | employees.id 또는 "system" | 다형성 (FK 미설정) |
| audit_log | target_id | 다양한 테이블 | 다형성 (FK 미설정) |

---

## 5. ID 생성 규칙

| 테이블 | 형식 | 생성 방식 | 예시 |
|--------|------|----------|------|
| `employees` | `EMP-XXX` | 애플리케이션에서 수동 지정 | EMP-001, EMP-CEO |
| `teams` | `TEAM-XXX` | 애플리케이션에서 수동 지정 | TEAM-DEV, TEAM-MGMT |
| `leave_policies` | `LP-XXX` | 애플리케이션에서 수동 지정 | LP-DEFAULT |
| `leave_requests` | `LV-YYYY-NNNN` | 연도 + 순번 (leave-service에서 생성) | LV-2026-0001 |
| `approvals` | `APR-YYYY-NNNN` | 연도 + 순번 (approval-service에서 생성) | APR-2026-0031 |
| `channels` | `ch-{uuid}` | `ch-` 접두사 + UUID 단축 | ch-a1b2c3d4 |
| `messages` | `{uuid}` | pgcrypto `gen_random_uuid()` | 자동 생성 |
| `leave_balances` | `{uuid}` | pgcrypto `gen_random_uuid()` | 자동 생성 |
| `audit_log` | `{uuid}` | pgcrypto `gen_random_uuid()` | 자동 생성 |
| `leave_accrual_log` | `{uuid}` | pgcrypto `gen_random_uuid()` | 자동 생성 |
| `holidays` | `DATE` | 날짜 자체가 PK | 2026-03-01 |

**순번 생성 전략 (LV, APR):**
- 해당 연도의 최대 순번을 조회하여 +1 부여
- 트랜잭션 내에서 처리하여 동시 요청 시 중복 방지
- 연도가 바뀌면 0001부터 재시작

---

## 6. 인덱스 전략

### 6.1 명시적 인덱스

| 이름 | 테이블 | 컬럼 | 용도 |
|------|--------|------|------|
| `idx_messages_channel` | messages | (channel_id, created_at DESC) | 채널 메시지 시간순 조회 -- 가장 빈번한 쿼리 |
| `idx_messages_sender` | messages | (sender_user_id) | 발신자별 메시지 검색 |

### 6.2 암시적 인덱스 (PK/UNIQUE 자동 생성)

| 테이블 | 컬럼 | 생성 원인 |
|--------|------|----------|
| 전체 테이블 | PK 컬럼 | PRIMARY KEY |
| employees | email | UNIQUE |
| leave_balances | (employee_id, year, leave_type) | UNIQUE |

### 6.3 Phase 2 권장 인덱스

| 이름 | 테이블 | 컬럼 | 용도 |
|------|--------|------|------|
| `idx_leave_requests_employee` | leave_requests | (employee_id, status) | 직원별 활성 신청 조회 |
| `idx_approvals_approver` | approvals | (approver_id, status) | 결재자 대기 목록 |
| `idx_audit_log_target` | audit_log | (target_type, target_id) | 대상별 이력 조회 |
| `idx_channels_participants` | channels | participants (GIN) | 참여자 배열 검색 |
| `idx_leave_balances_employee_year` | leave_balances | (employee_id, year) | 직원 연도별 잔여 조회 |

---

## 7. 데이터 생명주기

### 7.1 테이블별 CRUD 정책

| 테이블 | Create | Read | Update | Delete | 비고 |
|--------|--------|------|--------|--------|------|
| teams | Admin | All | Admin | X | 초기 seed, 이후 Admin에서만 변경 |
| employees | Admin | All | Self+Admin | X | 비활성화(status=inactive)로 논리 삭제 |
| user_llm_configs | Admin | AI Runtime | Admin | X | LLM 설정 변경은 Admin 전용 |
| channels | System | Participants | System | X | 자동 생성, 참여자만 조회 가능 |
| messages | All | Participants | X (read_by만 갱신) | X | 불변. 읽음 상태만 갱신 |
| leave_policies | Admin | All | Admin | X | 정책 비활성화로 논리 삭제 |
| leave_balances | System/Admin | Employee+Admin | System (days 변경) | X | scheduler, leave-service가 갱신 |
| leave_requests | Employee(via LLM) | Employee+Approver | System (status 변경) | X | 물리 삭제 없음 |
| approvals | System | Approver+Requester | Approver (결재 결정) | X | 물리 삭제 없음 |
| holidays | Admin | All | Admin | Admin | 연도별 관리 |
| audit_log | System | Admin | X (Rule 차단) | X (Rule 차단) | INSERT-only |
| leave_accrual_log | System | Admin | X | X | INSERT-only |

### 7.2 핵심 트랜잭션 흐름

#### 휴가 신청 트랜잭션

```
BEGIN;
  1. leave_balances 조회 (remaining_days >= 요청 일수 확인)
  2. leave_requests INSERT (status=pending)
  3. leave_balances UPDATE (pending_days += days)
  4. approvals INSERT (status=pending, auto_approve_at 설정)
  5. leave_requests UPDATE (approval_id 연결)
  6. audit_log INSERT (leave_request_created)
COMMIT;

-- 후처리 (트랜잭션 외부)
  7. messaging-server로 결재 알림 전송 (상사에게)
  8. 알림 채널에 메시지 생성
```

#### 결재 승인 트랜잭션

```
BEGIN;
  1. approvals UPDATE (status=approved, completed_at=now())
  2. leave_requests UPDATE (status=approved)
  3. leave_balances UPDATE (used_days += days, pending_days -= days)
  4. audit_log INSERT (leave_approved)
COMMIT;

-- 후처리 (트랜잭션 외부)
  5. 신청자에게 승인 알림
  6. 휴가 담당자에게 알림
  7. 경영지원팀장에게 알림
```

#### 결재 반려 트랜잭션

```
BEGIN;
  1. approvals UPDATE (status=rejected, review_comment, completed_at=now())
  2. leave_requests UPDATE (status=rejected)
  3. leave_balances UPDATE (pending_days -= days)
  4. audit_log INSERT (leave_rejected)
COMMIT;

-- 후처리
  5. 신청자에게 반려 알림 (사유 포함)
```

#### 자동 승인 트랜잭션 (scheduler)

```
-- scheduler가 주기적으로 실행
SELECT * FROM approvals
WHERE status = 'pending'
  AND auto_approve_at IS NOT NULL
  AND auto_approve_at <= now();

-- 각 건에 대해:
BEGIN;
  1. approvals UPDATE (status=approved, completed_at=now())
  2. leave_requests UPDATE (status=approved)
  3. leave_balances UPDATE (used_days += days, pending_days -= days)
  4. audit_log INSERT (auto_approved, actor=system)
COMMIT;
```

---

## 8. Seed 데이터 요약

### 8.1 팀 (3건)

| id | name | leader_id |
|----|------|-----------|
| TEAM-EXEC | 경영진 | EMP-CEO |
| TEAM-MGMT | 경영지원팀 | EMP-MGMT-LEADER |
| TEAM-DEV | 개발팀 | EMP-DEV-LEADER |

### 8.2 직원 (5건)

| id | name | email | team | position | grade | manager |
|----|------|-------|------|----------|-------|---------|
| EMP-CEO | 대표 | ceo@palette.ai | TEAM-EXEC | 대표이사 | 대표 | NULL |
| EMP-MGMT-LEADER | 경영지원팀장 | mgmt.leader@palette.ai | TEAM-MGMT | 경영지원팀장 | 팀장 | EMP-CEO |
| EMP-HR-001 | 휴가 담당자 | hr@palette.ai | TEAM-MGMT | 인사담당 | 대리 | EMP-MGMT-LEADER |
| EMP-DEV-LEADER | 김민준 | minjun@palette.ai | TEAM-DEV | 개발팀장 | 팀장 | EMP-CEO |
| EMP-001 | 정인수 | jinsu@palette.ai | TEAM-DEV | 프론트엔드 개발자 | 사원 | EMP-DEV-LEADER |

> 모든 비밀번호: `password123`의 bcrypt 해시

### 8.3 연차 잔여 (5건, 2026년)

| employee_id | total | used | pending | remaining | expires_at |
|-------------|-------|------|---------|-----------|------------|
| EMP-001 (정인수) | 15.0 | 1.0 | 0.0 | 14.0 | 2027-03-01 |
| EMP-CEO | 15.0 | 0.0 | 0.0 | 15.0 | 2027-01-01 |
| EMP-MGMT-LEADER | 17.0 | 2.0 | 0.0 | 15.0 | 2027-03-01 |
| EMP-HR-001 | 16.0 | 1.0 | 0.0 | 15.0 | 2027-06-01 |
| EMP-DEV-LEADER (김민준) | 17.0 | 3.0 | 0.0 | 14.0 | 2027-01-15 |

### 8.4 공휴일 (15건, 2026년)

| 날짜 | 이름 |
|------|------|
| 2026-01-01 | 신정 |
| 2026-02-16 ~ 02-18 | 설날 연휴 |
| 2026-03-01 | 삼일절 |
| 2026-05-05 | 어린이날 |
| 2026-05-24 | 부처님오신날 |
| 2026-06-06 | 현충일 |
| 2026-08-15 | 광복절 |
| 2026-09-24 ~ 09-26 | 추석 연휴 |
| 2026-10-03 | 개천절 |
| 2026-10-09 | 한글날 |
| 2026-12-25 | 크리스마스 |

### 8.5 LLM 설정 (5건)

| user_id | llm_role | auto_respond | 주요 도구 |
|---------|----------|-------------|----------|
| EMP-001 | router | true | analyze_intent |
| EMP-DEV-LEADER | approver | true | check_team_schedule, approve/reject_request |
| EMP-HR-001 | work_assistant | true | query_leave_balance, validate_date, submit_leave_request |
| EMP-MGMT-LEADER | team_assistant | true | get_team_summary, get_team_leaves |
| EMP-CEO | secretary | true | query_employee_schedule, call_person |

---

## 9. PostgreSQL 확장 및 특수 기능

### 9.1 사용 확장

| 확장 | 용도 |
|------|------|
| `pgcrypto` | `gen_random_uuid()` -- UUID 기반 PK 생성 |
| `vector` (pgvector) | Phase 2 임베딩 검색 대비 (MVP에서는 미사용) |

### 9.2 PostgreSQL Rules (audit_log 보호)

```sql
CREATE RULE audit_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;
```

- `DO INSTEAD NOTHING`: 에러를 발생시키지 않고 조용히 무시
- ORM이나 관리 도구에서 실수로 UPDATE/DELETE 해도 데이터 보존

### 9.3 GENERATED STORED 컬럼

```sql
remaining_days NUMERIC(4,1) GENERATED ALWAYS AS (total_days - used_days - pending_days) STORED
```

- DB 엔진이 물리적으로 저장하며 자동 계산
- 직접 UPDATE 불가 (total_days, used_days, pending_days 변경 시 자동 갱신)
- 인덱스 생성 가능 (VIRTUAL과 달리)

---

## 10. 확장 고려사항

### 10.1 Phase 2 확장 테이블 후보

| 테이블 | 용도 | 관련 기능 |
|--------|------|----------|
| `calendar_events` | 캘린더 이벤트 (자체 캘린더) | 휴가 승인 시 자동 등록 |
| `notifications` | 알림 이력 저장 | 현재는 메시지로 처리, 독립 테이블 분리 |
| `file_attachments` | 파일 첨부 | 메시지에 파일 첨부 기능 |
| `embeddings` | pgvector 임베딩 | 유사 질문 검색, 정책 RAG |

### 10.2 멀티테넌시 확장 시 변경점 (Out-of-scope)

현재 MVP는 단일 회사(Palette AI) 전용이나, B2B SaaS 확장 시:
- 모든 테이블에 `tenant_id` 컬럼 추가
- Row Level Security (RLS) 정책 적용
- 테넌트별 격리된 연차 정책 지원
- 커넥션 풀 분리 또는 스키마 분리 전략 결정 필요

### 10.3 성능 확장 고려

| 영역 | 현재 (MVP) | 확장 시 |
|------|-----------|--------|
| messages 테이블 | 인덱스 2개로 충분 | 파티셔닝 (월별 또는 channel_id 기준) |
| audit_log | INSERT-only, 단일 테이블 | 시계열 파티셔닝 (TimescaleDB 또는 월별) |
| channels.participants | TEXT[] 배열 | 별도 channel_members 조인 테이블 |
| read_by | TEXT[] 배열 | 별도 message_reads 조인 테이블 |

### 10.4 데이터 보존 정책

| 테이블 | 보존 기간 | 근거 |
|--------|----------|------|
| audit_log | 영구 | 감사 추적 의무 |
| leave_accrual_log | 영구 | 연차 발생 이력 |
| messages | 3년 | 업무 기록 보존 |
| leave_requests | 5년 | 근로기준법 (근로자 명부 보존) |
| leave_balances | 5년 | 근로기준법 |
| approvals | 5년 | 결재 이력 |

---

## 11. Drizzle ORM 매핑 참고

Drizzle 스키마 정의는 `packages/db`에 위치하며, DDL과 1:1 대응합니다.

**주요 매핑 규칙:**

| PostgreSQL | Drizzle 타입 |
|-----------|-------------|
| TEXT PRIMARY KEY | `text('id').primaryKey()` |
| UUID DEFAULT gen_random_uuid() | `uuid('id').defaultRandom().primaryKey()` |
| TIMESTAMPTZ DEFAULT now() | `timestamp('created_at', { withTimezone: true }).defaultNow()` |
| JSONB | `jsonb('tools')` |
| TEXT[] | `text('participants').array()` |
| NUMERIC(4,1) | `numeric('total_days', { precision: 4, scale: 1 })` |
| GENERATED ALWAYS AS ... STORED | `numeric('remaining_days', ...).generatedAlwaysAs(sql\`...\`)` |
| BOOLEAN DEFAULT false | `boolean('human_takeover').default(false)` |

---

## 12. DDL 실행 순서

테이블 간 FK 의존성을 고려한 생성 순서:

```
1.  CREATE EXTENSION pgcrypto, vector
2.  CREATE TABLE teams              (leader_id FK 없이)
3.  CREATE TABLE employees          (team_id -> teams)
4.  ALTER TABLE teams ADD FK        (leader_id -> employees)
5.  CREATE TABLE user_llm_configs   (user_id -> employees)
6.  CREATE TABLE leave_policies
7.  CREATE TABLE leave_balances     (employee_id -> employees)
8.  CREATE TABLE leave_requests     (employee_id -> employees)
9.  CREATE TABLE approvals          (requested_by, approver_id -> employees)
10. CREATE TABLE holidays
11. CREATE TABLE channels           (takeover_by -> employees)
12. CREATE TABLE messages           (channel_id -> channels, sender_user_id -> employees)
13. CREATE INDEX idx_messages_*
14. CREATE TABLE audit_log + RULES
15. CREATE TABLE leave_accrual_log  (employee_id -> employees)
```

---

> **참조 문서**
> - 원본 DDL + Seed SQL: [`docs/DATABASE.md`](../DATABASE.md)
> - 시스템 아키텍처: [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)
> - LLM 설정 상세: [`docs/LLM.md`](../LLM.md)
> - 시나리오 및 에러 케이스: [`docs/SCENARIOS.md`](../SCENARIOS.md)
