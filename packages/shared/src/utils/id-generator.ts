import { randomUUID } from 'crypto';

/**
 * Generate a leave request ID in the format LV-YYYY-NNNN.
 * @param year - The year (e.g. 2026)
 * @param sequence - The sequence number
 */
export function generateLeaveRequestId(year: number, sequence: number): string {
  return `LV-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Generate an approval ID in the format APR-YYYY-NNNN.
 * @param year - The year (e.g. 2026)
 * @param sequence - The sequence number
 */
export function generateApprovalId(year: number, sequence: number): string {
  return `APR-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Generate a channel ID in the format ch-{uuid}.
 */
export function generateChannelId(): string {
  return `ch-${randomUUID()}`;
}

/**
 * Generate a message ID (UUID v4).
 */
export function generateMessageId(): string {
  return randomUUID();
}
