// Employee types
export interface Employee {
  id: string;
  email: string;
  name: string;
  nickname: string;
  position: string;
  teamId: string;
  role: 'employee' | 'manager' | 'hr' | 'admin' | 'ceo';
  profileImage: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Channel types
export type ChannelType = 'direct' | 'work' | 'team' | 'notification' | 'company';

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  participants: string[];
  assignedLlm: string | null;
  humanTakeover: boolean;
  createdAt: string;
  updatedAt: string;
}

// Message types
export type SenderType = 'human' | 'llm' | 'system';
export type ContentType = 'text' | 'card' | 'approval' | 'notification';

export interface Message {
  id: string;
  channelId: string;
  senderType: SenderType;
  senderUserId: string;
  displayName: string;
  contentType: ContentType;
  contentText: string | null;
  cardData: Record<string, unknown> | null;
  isLlmAuto: boolean;
  createdAt: string;
}

// Leave types
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveType = 'annual' | 'half_am' | 'half_pm' | 'sick' | 'special';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

// Approval types
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'reviewing' | 'auto_approved';

export interface Approval {
  id: string;
  leaveRequestId: string;
  approverId: string;
  status: ApprovalStatus;
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  data: T;
  meta?: {
    page?: number;
    total?: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

// WebSocket event types
export interface WsMessageNew {
  channelId: string;
  message: Message;
}

export interface WsTyping {
  channelId: string;
  userId: string;
  displayName: string;
  isTyping: boolean;
}

export interface WsChannelTakeover {
  channelId: string;
  humanTakeover: boolean;
  takenOverBy?: string;
}

export interface WsApprovalDecided {
  approvalId: string;
  decision: string;
  leaveRequestId: string;
}
