// ─── Auto-Approval Timeout Job ───────────────────────────────────────────────
// Think of this like a receptionist checking a pile of unsigned documents:
// every 5 minutes, she checks if any document has been waiting longer than
// the allowed time, and if so, stamps it "auto-approved" on behalf of the
// absent approver.
//
// Scenario E-10: If a manager hasn't responded within auto_approve_hours (2h
// by default), the system auto-approves the leave request.

import type { JobDefinition } from './job-runner.js';
import { createServiceToken } from '@palette/shared/middleware/service-auth';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function getSchedulerHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${createServiceToken('scheduler')}`,
  };
}

interface ExpiredApproval {
  id: string;
  auto_approve_at: string;
  approver_id: string;
  related_id: string;
  requested_by: string;
}

interface ApprovalServiceResponse {
  data?: {
    approval_id: string;
    status: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

function getApprovalServiceUrl(): string {
  const url = process.env.APPROVAL_SERVICE_URL;
  if (!url) {
    throw new Error('APPROVAL_SERVICE_URL environment variable is required');
  }
  return url;
}

export async function fetchExpiredApprovals(): Promise<ExpiredApproval[]> {
  const baseUrl = getApprovalServiceUrl();
  const response = await fetch(`${baseUrl}/api/v1/approvals/expired`, {
    headers: getSchedulerHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch expired approvals: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { data: { approvals: ExpiredApproval[] } };
  return json.data.approvals;
}

export async function autoApprove(approvalId: string): Promise<ApprovalServiceResponse> {
  const baseUrl = getApprovalServiceUrl();
  const response = await fetch(`${baseUrl}/api/v1/approvals/${approvalId}/decide`, {
    method: 'PATCH',
    headers: getSchedulerHeaders(),
    body: JSON.stringify({
      decision: 'approved',
      decided_by: 'system',
      comment: '자동 승인 (시간 초과)',
    }),
  });

  const json = (await response.json()) as ApprovalServiceResponse;

  if (!response.ok) {
    console.error(`[auto-approval] Failed to auto-approve ${approvalId}:`, json.error);
  }

  return json;
}

export async function runAutoApprovalJob(): Promise<void> {
  console.log('[auto-approval] Checking for expired approvals...');

  const expiredApprovals = await fetchExpiredApprovals();

  if (expiredApprovals.length === 0) {
    console.log('[auto-approval] No expired approvals found');
    return;
  }

  console.log(`[auto-approval] Found ${expiredApprovals.length} expired approval(s)`);

  let successCount = 0;
  let failCount = 0;

  for (const approval of expiredApprovals) {
    try {
      const result = await autoApprove(approval.id);

      if (result.data) {
        successCount += 1;
        console.log(`[auto-approval] Auto-approved: ${approval.id} (requested by ${approval.requested_by})`);
      } else {
        failCount += 1;
        console.error(`[auto-approval] Failed: ${approval.id} — ${result.error?.message ?? 'Unknown error'}`);
      }
    } catch (error) {
      failCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[auto-approval] Error processing ${approval.id}:`, message);
    }
  }

  console.log(`[auto-approval] Done: ${successCount} approved, ${failCount} failed`);
}

export function createAutoApprovalJob(): JobDefinition {
  return {
    name: 'auto-approval',
    description: 'Auto-approve pending approvals that have exceeded the timeout (E-10)',
    intervalMs: FIVE_MINUTES_MS,
    handler: runAutoApprovalJob,
  };
}
