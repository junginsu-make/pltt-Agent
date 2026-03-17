import type { CreateNotificationInput, GetNotificationsQuery, Notification } from '../schemas/notification.js';

// TODO: Move to a notifications table in PostgreSQL for production.
// In-memory storage is used for MVP phase only.
const notifications = new Map<string, Notification>();
let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `NTF-${Date.now()}-${String(idCounter).padStart(4, '0')}`;
}

export interface CreateNotificationResult {
  notification: Notification;
}

export interface GetNotificationsResult {
  notifications: readonly Notification[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function createNotification(input: CreateNotificationInput): CreateNotificationResult {
  const id = generateId();
  const now = new Date().toISOString();

  const notification: Notification = {
    id,
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    data: input.data,
    sourceUserId: input.sourceUserId,
    isRead: false,
    readAt: null,
    createdAt: now,
  };

  notifications.set(id, notification);

  // TODO: Emit via Socket.IO if user is online
  // e.g., socketIO.to(input.userId).emit('notification:new', notification);

  return { notification };
}

export function getUserNotifications(
  userId: string,
  query: GetNotificationsQuery,
): GetNotificationsResult {
  const { page, limit, type, unreadOnly } = query;

  let userNotifications = Array.from(notifications.values())
    .filter((n) => n.userId === userId);

  if (type) {
    userNotifications = userNotifications.filter((n) => n.type === type);
  }

  if (unreadOnly) {
    userNotifications = userNotifications.filter((n) => !n.isRead);
  }

  // Sort by createdAt descending (newest first)
  userNotifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const total = userNotifications.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const paginated = userNotifications.slice(start, start + limit);

  return {
    notifications: paginated,
    meta: { page, limit, total, totalPages },
  };
}

export function markAsRead(notificationId: string): Notification {
  const notification = notifications.get(notificationId);
  if (!notification) {
    throw new NotificationNotFoundError(notificationId);
  }

  // Immutability: create a new object instead of mutating
  const updated: Notification = {
    ...notification,
    isRead: true,
    readAt: new Date().toISOString(),
  };

  notifications.set(notificationId, updated);
  return updated;
}

export function markAllAsRead(userId: string): number {
  const now = new Date().toISOString();
  let count = 0;

  for (const [id, notification] of notifications) {
    if (notification.userId === userId && !notification.isRead) {
      const updated: Notification = {
        ...notification,
        isRead: true,
        readAt: now,
      };
      notifications.set(id, updated);
      count += 1;
    }
  }

  return count;
}

export function getUnreadCount(userId: string): number {
  let count = 0;
  for (const notification of notifications.values()) {
    if (notification.userId === userId && !notification.isRead) {
      count += 1;
    }
  }
  return count;
}

// Exposed for testing: reset in-memory store
export function _resetStore(): void {
  notifications.clear();
  idCounter = 0;
}

export class NotificationNotFoundError extends Error {
  public readonly notificationId: string;

  constructor(notificationId: string) {
    super(`알림을 찾을 수 없습니다: ${notificationId}`);
    this.name = 'NotificationNotFoundError';
    this.notificationId = notificationId;
  }
}
