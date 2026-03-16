import { createHash } from 'crypto';
import { desc } from 'drizzle-orm';
import { auditLog } from '@palette/db';
import type { Database } from '../db.js';

export function computeHash(prevHash: string | null, data: object): string {
  const input = JSON.stringify({ prevHash, ...data });
  return createHash('sha256').update(input).digest('hex');
}

export interface AuditEntry {
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
}

export async function createAuditLogEntry(db: Database, entry: AuditEntry) {
  // Get the latest audit log entry for the hash chain
  const latest = await db
    .select({ hash: auditLog.hash })
    .from(auditLog)
    .orderBy(desc(auditLog.timestamp));

  const prevHash = latest.length > 0 ? latest[0].hash : null;

  const hash = computeHash(prevHash, {
    actor: entry.actor,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    details: entry.details,
    timestamp: new Date().toISOString(),
  });

  const result = await db
    .insert(auditLog)
    .values({
      actor: entry.actor,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      details: entry.details,
      prevHash,
      hash,
    })
    .returning();

  return result[0];
}
