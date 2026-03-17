import { Hono } from 'hono';
import { z } from 'zod';
import {
  createNotificationSchema,
  getNotificationsQuerySchema,
  markAllReadSchema,
} from '../schemas/notification.js';
import {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  NotificationNotFoundError,
} from '../services/notification-service.js';

const notifications = new Hono();

// POST /api/v1/notifications - Create notification
notifications.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createNotificationSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: '입력값이 올바르지 않습니다',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      400,
    );
  }

  const result = createNotification(parsed.data);

  return c.json({ data: result.notification }, 201);
});

// GET /api/v1/notifications/:userId - Get user's notifications
notifications.get('/:userId', async (c) => {
  const userId = c.req.param('userId');
  const rawQuery = c.req.query();
  const parsed = getNotificationsQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: '쿼리 파라미터가 올바르지 않습니다',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      400,
    );
  }

  const result = getUserNotifications(userId, parsed.data);

  return c.json({
    data: result.notifications,
    meta: result.meta,
  });
});

// GET /api/v1/notifications/:userId/unread-count - Get unread count
notifications.get('/:userId/unread-count', async (c) => {
  const userId = c.req.param('userId');
  const count = getUnreadCount(userId);

  return c.json({ data: { count } });
});

// PATCH /api/v1/notifications/read-all - Mark all as read for user
notifications.patch('/read-all', async (c) => {
  const body = await c.req.json();
  const parsed = markAllReadSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: '입력값이 올바르지 않습니다',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      400,
    );
  }

  const count = markAllAsRead(parsed.data.userId);

  return c.json({ data: { updatedCount: count } });
});

// PATCH /api/v1/notifications/:id/read - Mark as read
notifications.patch('/:id/read', async (c) => {
  const notificationId = c.req.param('id');

  try {
    const notification = markAsRead(notificationId);
    return c.json({ data: notification });
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return c.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        },
        404,
      );
    }
    throw error;
  }
});

export default notifications;
