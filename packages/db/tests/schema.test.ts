import { describe, it, expect } from 'vitest';
import * as schema from '../src/schema/index';

describe('schema exports', () => {
  const expectedTables = [
    'teams',
    'employees',
    'userLlmConfigs',
    'leavePolicies',
    'leaveBalances',
    'leaveRequests',
    'approvals',
    'holidays',
    'channels',
    'messages',
    'auditLog',
    'leaveAccrualLog',
  ] as const;

  it.each(expectedTables)('exports %s table', (tableName) => {
    expect(schema[tableName]).toBeDefined();
  });

  it('exports all expected relations', () => {
    expect(schema.teamsRelations).toBeDefined();
    expect(schema.employeesRelations).toBeDefined();
    expect(schema.approvalsRelations).toBeDefined();
  });
});
