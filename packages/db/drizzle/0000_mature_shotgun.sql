CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'leave_request' NOT NULL,
	"related_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"approver_id" text NOT NULL,
	"status" text DEFAULT 'pending',
	"request_summary" text NOT NULL,
	"llm_reasoning" text,
	"review_comment" text,
	"auto_approve_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prev_hash" text,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text,
	"work_domain" text,
	"assigned_llm" text,
	"human_takeover" boolean DEFAULT false,
	"takeover_by" text,
	"participants" text[] NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"team_id" text,
	"position" text,
	"grade" text,
	"manager_id" text,
	"hire_date" date NOT NULL,
	"leave_policy_id" text DEFAULT 'LP-DEFAULT',
	"status" text DEFAULT 'active',
	"messenger_status" text DEFAULT 'offline',
	"telegram_id" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"date" date PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_accrual_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" text NOT NULL,
	"accrual_type" text NOT NULL,
	"days" numeric(4, 1) NOT NULL,
	"reason" text NOT NULL,
	"balance_after" numeric(4, 1),
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leave_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" text NOT NULL,
	"year" integer NOT NULL,
	"leave_type" text DEFAULT 'annual',
	"total_days" numeric(4, 1) NOT NULL,
	"used_days" numeric(4, 1) DEFAULT '0',
	"pending_days" numeric(4, 1) DEFAULT '0',
	"remaining_days" numeric(4, 1) GENERATED ALWAYS AS (total_days - used_days - pending_days) STORED,
	"expires_at" date,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "leave_balances_employee_year_type" UNIQUE("employee_id","year","leave_type")
);
--> statement-breakpoint
CREATE TABLE "leave_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rules" jsonb NOT NULL,
	"leave_types" jsonb NOT NULL,
	"auto_approve" jsonb DEFAULT '{"enabled":true,"timeout_hours":2}'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"leave_type" text DEFAULT 'annual' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" numeric(4, 1) NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending',
	"approval_id" text,
	"conversation_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" text NOT NULL,
	"sender_type" text NOT NULL,
	"sender_user_id" text,
	"display_name" text NOT NULL,
	"content_type" text DEFAULT 'text',
	"content_text" text,
	"card_data" jsonb,
	"tool_calls" jsonb DEFAULT '[]'::jsonb,
	"tool_results" jsonb DEFAULT '[]'::jsonb,
	"is_llm_auto" boolean DEFAULT false,
	"read_by" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"leader_id" text,
	"parent_id" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_llm_configs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"llm_role" text NOT NULL,
	"system_prompt" text NOT NULL,
	"llm_model" text DEFAULT 'claude-haiku-4-5-20251001',
	"auto_respond" boolean DEFAULT true,
	"tools" jsonb DEFAULT '[]'::jsonb,
	"work_domains" text[] DEFAULT '{}',
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_messages_channel" ON "messages" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_sender" ON "messages" USING btree ("sender_user_id");