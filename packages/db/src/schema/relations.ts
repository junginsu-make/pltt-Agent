import { relations } from 'drizzle-orm';
import { teams } from './teams';
import { employees } from './employees';
import { userLlmConfigs } from './user-llm-configs';
import { leavePolicies } from './leave-policies';
import { leaveBalances } from './leave-balances';
import { leaveRequests } from './leave-requests';
import { approvals } from './approvals';
import { channels } from './channels';
import { messages } from './messages';
import { leaveAccrualLog } from './leave-accrual-log';

// --- Teams Relations ---
export const teamsRelations = relations(teams, ({ one, many }) => ({
  leader: one(employees, {
    fields: [teams.leaderId],
    references: [employees.id],
    relationName: 'teamLeader',
  }),
  parent: one(teams, {
    fields: [teams.parentId],
    references: [teams.id],
    relationName: 'teamHierarchy',
  }),
  children: many(teams, { relationName: 'teamHierarchy' }),
  members: many(employees, { relationName: 'teamMembers' }),
}));

// --- Employees Relations ---
export const employeesRelations = relations(employees, ({ one, many }) => ({
  team: one(teams, {
    fields: [employees.teamId],
    references: [teams.id],
    relationName: 'teamMembers',
  }),
  manager: one(employees, {
    fields: [employees.managerId],
    references: [employees.id],
    relationName: 'managerSubordinates',
  }),
  subordinates: many(employees, { relationName: 'managerSubordinates' }),
  leavePolicy: one(leavePolicies, {
    fields: [employees.leavePolicyId],
    references: [leavePolicies.id],
  }),
  llmConfig: one(userLlmConfigs, {
    fields: [employees.id],
    references: [userLlmConfigs.userId],
  }),
  leaveBalances: many(leaveBalances),
  leaveRequests: many(leaveRequests),
  leaveAccrualLogs: many(leaveAccrualLog),
}));

// --- User LLM Configs Relations ---
export const userLlmConfigsRelations = relations(userLlmConfigs, ({ one }) => ({
  employee: one(employees, {
    fields: [userLlmConfigs.userId],
    references: [employees.id],
  }),
}));

// --- Leave Balances Relations ---
export const leaveBalancesRelations = relations(leaveBalances, ({ one }) => ({
  employee: one(employees, {
    fields: [leaveBalances.employeeId],
    references: [employees.id],
  }),
}));

// --- Leave Requests Relations ---
export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, {
    fields: [leaveRequests.employeeId],
    references: [employees.id],
  }),
  approval: one(approvals, {
    fields: [leaveRequests.approvalId],
    references: [approvals.id],
  }),
}));

// --- Approvals Relations ---
export const approvalsRelations = relations(approvals, ({ one }) => ({
  requester: one(employees, {
    fields: [approvals.requestedBy],
    references: [employees.id],
    relationName: 'approvalRequester',
  }),
  approver: one(employees, {
    fields: [approvals.approverId],
    references: [employees.id],
    relationName: 'approvalApprover',
  }),
}));

// --- Channels Relations ---
export const channelsRelations = relations(channels, ({ one, many }) => ({
  takeoverEmployee: one(employees, {
    fields: [channels.takeoverBy],
    references: [employees.id],
  }),
  messages: many(messages),
}));

// --- Messages Relations ---
export const messagesRelations = relations(messages, ({ one }) => ({
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  sender: one(employees, {
    fields: [messages.senderUserId],
    references: [employees.id],
  }),
}));

// --- Leave Accrual Log Relations ---
export const leaveAccrualLogRelations = relations(leaveAccrualLog, ({ one }) => ({
  employee: one(employees, {
    fields: [leaveAccrualLog.employeeId],
    references: [employees.id],
  }),
}));
