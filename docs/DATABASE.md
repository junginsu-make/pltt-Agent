# 데이터베이스 스키마

PostgreSQL 15 + pgvector. Drizzle ORM 사용.

## 전체 DDL

아래 SQL을 순서대로 실행하면 전체 스키마가 생성됩니다.

```sql
-- ═══ 1. 확장 ═══
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ═══ 2. teams ═══
CREATE TABLE teams (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  leader_id   TEXT,
  parent_id   TEXT REFERENCES teams(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ═══ 3. employees ═══
CREATE TABLE employees (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  team_id         TEXT REFERENCES teams(id),
  position        TEXT,
  grade           TEXT,
  manager_id      TEXT REFERENCES employees(id),
  hire_date       DATE NOT NULL,
  leave_policy_id TEXT DEFAULT 'LP-DEFAULT',
  status          TEXT DEFAULT 'active',
  messenger_status TEXT DEFAULT 'offline',
  telegram_id     TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- teams.leader_id FK (employees 생성 후)
ALTER TABLE teams ADD CONSTRAINT fk_team_leader FOREIGN KEY (leader_id) REFERENCES employees(id);

-- ═══ 4. user_llm_configs ═══
CREATE TABLE user_llm_configs (
  user_id         TEXT REFERENCES employees(id) PRIMARY KEY,
  llm_role        TEXT NOT NULL,
  system_prompt   TEXT NOT NULL,
  llm_model       TEXT DEFAULT 'claude-haiku-4-5-20251001',
  auto_respond    BOOLEAN DEFAULT true,
  tools           JSONB DEFAULT '[]',
  work_domains    TEXT[] DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ═══ 5. leave_policies ═══
CREATE TABLE leave_policies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  rules       JSONB NOT NULL,
  leave_types JSONB NOT NULL,
  auto_approve JSONB DEFAULT '{"enabled": true, "timeout_hours": 2}',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ═══ 6. leave_balances ═══
CREATE TABLE leave_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     TEXT REFERENCES employees(id) NOT NULL,
  year            INTEGER NOT NULL,
  leave_type      TEXT DEFAULT 'annual',
  total_days      NUMERIC(4,1) NOT NULL,
  used_days       NUMERIC(4,1) DEFAULT 0,
  pending_days    NUMERIC(4,1) DEFAULT 0,
  remaining_days  NUMERIC(4,1) GENERATED ALWAYS AS (total_days - used_days - pending_days) STORED,
  expires_at      DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, year, leave_type)
);

-- ═══ 7. leave_requests ═══
CREATE TABLE leave_requests (
  id              TEXT PRIMARY KEY,
  employee_id     TEXT REFERENCES employees(id) NOT NULL,
  leave_type      TEXT NOT NULL DEFAULT 'annual',
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  days            NUMERIC(4,1) NOT NULL,
  reason          TEXT,
  status          TEXT DEFAULT 'pending',
  approval_id     TEXT,
  conversation_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ═══ 8. approvals ═══
CREATE TABLE approvals (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL DEFAULT 'leave_request',
  related_id      TEXT NOT NULL,
  requested_by    TEXT REFERENCES employees(id) NOT NULL,
  approver_id     TEXT REFERENCES employees(id) NOT NULL,
  status          TEXT DEFAULT 'pending',
  request_summary TEXT NOT NULL,
  llm_reasoning   TEXT,
  review_comment  TEXT,
  auto_approve_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- ═══ 9. holidays ═══
CREATE TABLE holidays (
  date  DATE PRIMARY KEY,
  name  TEXT NOT NULL,
  year  INTEGER NOT NULL
);

-- ═══ 10. channels ═══
CREATE TABLE channels (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  name            TEXT,
  work_domain     TEXT,
  assigned_llm    TEXT,
  human_takeover  BOOLEAN DEFAULT false,
  takeover_by     TEXT REFERENCES employees(id),
  participants    TEXT[] NOT NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ═══ 11. messages ═══
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      TEXT REFERENCES channels(id) NOT NULL,
  sender_type     TEXT NOT NULL,
  sender_user_id  TEXT REFERENCES employees(id),
  display_name    TEXT NOT NULL,
  content_type    TEXT DEFAULT 'text',
  content_text    TEXT,
  card_data       JSONB,
  tool_calls      JSONB DEFAULT '[]',
  tool_results    JSONB DEFAULT '[]',
  is_llm_auto     BOOLEAN DEFAULT false,
  read_by         TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_channel ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_user_id);

-- ═══ 12. audit_log ═══
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp   TIMESTAMPTZ DEFAULT now() NOT NULL,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB NOT NULL DEFAULT '{}',
  prev_hash   TEXT,
  hash        TEXT NOT NULL
);

-- audit_log: INSERT만 허용, UPDATE/DELETE 차단
CREATE RULE audit_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- ═══ 13. leave_accrual_log ═══
CREATE TABLE leave_accrual_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     TEXT REFERENCES employees(id) NOT NULL,
  accrual_type    TEXT NOT NULL,
  days            NUMERIC(4,1) NOT NULL,
  reason          TEXT NOT NULL,
  balance_after   NUMERIC(4,1),
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

## Seed 데이터 (초기 데이터)

```sql
-- ═══ 팀 ═══
INSERT INTO teams (id, name) VALUES
  ('TEAM-EXEC', '경영진'),
  ('TEAM-MGMT', '경영지원팀'),
  ('TEAM-DEV', '개발팀');

-- ═══ 직원 (비밀번호는 모두 'password123'의 bcrypt 해시) ═══
INSERT INTO employees (id, name, email, password_hash, team_id, position, grade, manager_id, hire_date) VALUES
  ('EMP-CEO', '대표', 'ceo@palette.ai', '$2b$10$dummy_hash_ceo', 'TEAM-EXEC', '대표이사', '대표', NULL, '2023-01-01'),
  ('EMP-MGMT-LEADER', '경영지원팀장', 'mgmt.leader@palette.ai', '$2b$10$dummy_hash_mgmt', 'TEAM-MGMT', '경영지원팀장', '팀장', 'EMP-CEO', '2023-03-01'),
  ('EMP-HR-001', '휴가 담당자', 'hr@palette.ai', '$2b$10$dummy_hash_hr', 'TEAM-MGMT', '인사담당', '대리', 'EMP-MGMT-LEADER', '2023-06-01'),
  ('EMP-DEV-LEADER', '김민준', 'minjun@palette.ai', '$2b$10$dummy_hash_dev_leader', 'TEAM-DEV', '개발팀장', '팀장', 'EMP-CEO', '2023-01-15'),
  ('EMP-001', '정인수', 'jinsu@palette.ai', '$2b$10$dummy_hash_jinsu', 'TEAM-DEV', '프론트엔드 개발자', '사원', 'EMP-DEV-LEADER', '2024-03-01');

-- 팀장 연결
UPDATE teams SET leader_id = 'EMP-CEO' WHERE id = 'TEAM-EXEC';
UPDATE teams SET leader_id = 'EMP-MGMT-LEADER' WHERE id = 'TEAM-MGMT';
UPDATE teams SET leader_id = 'EMP-DEV-LEADER' WHERE id = 'TEAM-DEV';

-- ═══ 연차 정책 ═══
INSERT INTO leave_policies (id, name, rules, leave_types) VALUES (
  'LP-DEFAULT',
  '기본 연차 정책',
  '{
    "first_year": { "type": "monthly_accrual", "condition": "full_month_worked", "days_per_month": 1, "max_days": 11 },
    "after_one_year": { "type": "annual_grant", "min_attendance_rate": 0.8, "base_days": 15 },
    "seniority_bonus": { "start_after_years": 3, "bonus_days": 1, "every_years": 2, "max_total_days": 25 },
    "expiry": { "duration_months": 12, "allow_carryover": false }
  }',
  '[
    { "code": "annual", "name": "연차", "deducts_balance": true, "needs_approval": true },
    { "code": "half_am", "name": "오전 반차", "deducts_balance": true, "deduction": 0.5, "needs_approval": true },
    { "code": "half_pm", "name": "오후 반차", "deducts_balance": true, "deduction": 0.5, "needs_approval": true },
    { "code": "sick", "name": "병가", "deducts_balance": false, "needs_approval": true },
    { "code": "special", "name": "특별휴가", "deducts_balance": false, "needs_approval": true }
  ]'
);

-- ═══ 연차 잔여 (정인수: 2년차 15일, 사용 1일) ═══
INSERT INTO leave_balances (employee_id, year, leave_type, total_days, used_days, expires_at) VALUES
  ('EMP-001', 2026, 'annual', 15, 1, '2027-03-01'),
  ('EMP-CEO', 2026, 'annual', 15, 0, '2027-01-01'),
  ('EMP-MGMT-LEADER', 2026, 'annual', 17, 2, '2027-03-01'),
  ('EMP-HR-001', 2026, 'annual', 16, 1, '2027-06-01'),
  ('EMP-DEV-LEADER', 2026, 'annual', 17, 3, '2027-01-15');

-- ═══ 2026년 공휴일 (한국) ═══
INSERT INTO holidays (date, name, year) VALUES
  ('2026-01-01', '신정', 2026),
  ('2026-02-16', '설날 전날', 2026),
  ('2026-02-17', '설날', 2026),
  ('2026-02-18', '설날 다음날', 2026),
  ('2026-03-01', '삼일절', 2026),
  ('2026-05-05', '어린이날', 2026),
  ('2026-05-24', '부처님오신날', 2026),
  ('2026-06-06', '현충일', 2026),
  ('2026-08-15', '광복절', 2026),
  ('2026-09-24', '추석 전날', 2026),
  ('2026-09-25', '추석', 2026),
  ('2026-09-26', '추석 다음날', 2026),
  ('2026-10-03', '개천절', 2026),
  ('2026-10-09', '한글날', 2026),
  ('2026-12-25', '크리스마스', 2026);

-- ═══ LLM 설정 (System Prompt는 docs/LLM.md 참조) ═══
INSERT INTO user_llm_configs (user_id, llm_role, system_prompt, tools, work_domains) VALUES
  ('EMP-001', 'router', '직원 라우터 (docs/LLM.md 참조)', '["analyze_intent"]', '{}'),
  ('EMP-DEV-LEADER', 'approver', '상사 결재 보조 (docs/LLM.md 참조)', '["check_team_schedule","check_team_leaves","approve_request","reject_request"]', '{}'),
  ('EMP-HR-001', 'work_assistant', '휴가 담당자 AI (docs/LLM.md 참조)', '["query_leave_balance","validate_date","submit_leave_request","search_policy"]', '{"leave"}'),
  ('EMP-MGMT-LEADER', 'team_assistant', '팀장 보조 (docs/LLM.md 참조)', '["get_team_summary","get_team_leaves"]', '{}'),
  ('EMP-CEO', 'secretary', '대표 비서 (docs/LLM.md 참조)', '["query_employee_schedule","call_person","get_team_summary"]', '{}');
```

## ID 생성 규칙

| 테이블 | 형식 | 예시 |
|--------|------|------|
| employees | EMP-XXX | EMP-001, EMP-CEO |
| teams | TEAM-XXX | TEAM-DEV |
| leave_requests | LV-YYYY-NNNN | LV-2026-0001 |
| approvals | APR-YYYY-NNNN | APR-2026-0031 |
| channels | ch-{uuid} | ch-a1b2c3d4 |
| messages | {uuid} | 자동 생성 |
| audit_log | {uuid} | 자동 생성 |
