import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/app.js';
import { _resetStore } from '../src/services/notification-service.js';

function createRequest(method: string, path: string, body?: unknown): Request {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  return new Request(`http://localhost${path}`, options);
}

describe('notification-service', () => {
  beforeEach(() => {
    _resetStore();
  });

  describe('GET /health', () => {
    it('should respond to health check', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ status: 'ok', service: 'notification-service' });
    });
  });

  describe('POST /api/v1/notifications', () => {
    it('should create a notification successfully', async () => {
      const payload = {
        userId: 'EMP-001',
        type: 'leave_approved',
        title: '휴가 승인',
        message: '3월 18일 휴가가 승인되었습니다.',
        data: { leaveRequestId: 'LV-2026-0001' },
        sourceUserId: 'EMP-MGR-001',
      };

      const res = await app.request(createRequest('POST', '/api/v1/notifications', payload));
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.userId).toBe('EMP-001');
      expect(json.data.type).toBe('leave_approved');
      expect(json.data.title).toBe('휴가 승인');
      expect(json.data.message).toBe('3월 18일 휴가가 승인되었습니다.');
      expect(json.data.isRead).toBe(false);
      expect(json.data.readAt).toBeNull();
      expect(json.data.id).toMatch(/^NTF-/);
      expect(json.data.createdAt).toBeDefined();
    });

    it('should reject invalid input - missing required fields', async () => {
      const payload = {
        userId: '',
        type: 'invalid_type',
        title: '',
        message: '',
      };

      const res = await app.request(createRequest('POST', '/api/v1/notifications', payload));
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.details).toBeDefined();
      expect(json.error.details.length).toBeGreaterThan(0);
    });

    it('should reject notification with missing body fields', async () => {
      const res = await app.request(createRequest('POST', '/api/v1/notifications', {}));
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/notifications/:userId', () => {
    it('should return empty list for user with no notifications', async () => {
      const res = await app.request('/api/v1/notifications/EMP-001');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toEqual([]);
      expect(json.meta.total).toBe(0);
      expect(json.meta.page).toBe(1);
    });

    it('should return notifications with pagination', async () => {
      // Create 3 notifications
      for (let i = 1; i <= 3; i++) {
        await app.request(
          createRequest('POST', '/api/v1/notifications', {
            userId: 'EMP-001',
            type: 'system',
            title: `알림 ${i}`,
            message: `메시지 ${i}`,
          }),
        );
      }

      // Get page 1 with limit 2
      const res = await app.request('/api/v1/notifications/EMP-001?page=1&limit=2');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.length).toBe(2);
      expect(json.meta.total).toBe(3);
      expect(json.meta.totalPages).toBe(2);
      expect(json.meta.page).toBe(1);
      expect(json.meta.limit).toBe(2);

      // Get page 2
      const res2 = await app.request('/api/v1/notifications/EMP-001?page=2&limit=2');
      const json2 = await res2.json();
      expect(json2.data.length).toBe(1);
      expect(json2.meta.page).toBe(2);
    });

    it('should filter by type', async () => {
      await app.request(
        createRequest('POST', '/api/v1/notifications', {
          userId: 'EMP-001',
          type: 'leave_approved',
          title: '휴가 승인',
          message: '승인됨',
        }),
      );
      await app.request(
        createRequest('POST', '/api/v1/notifications', {
          userId: 'EMP-001',
          type: 'system',
          title: '시스템',
          message: '시스템 알림',
        }),
      );

      const res = await app.request('/api/v1/notifications/EMP-001?type=leave_approved');
      const json = await res.json();
      expect(json.data.length).toBe(1);
      expect(json.data[0].type).toBe('leave_approved');
    });

    it('should filter unread only', async () => {
      // Create 2 notifications
      const res1 = await app.request(
        createRequest('POST', '/api/v1/notifications', {
          userId: 'EMP-001',
          type: 'system',
          title: '알림 1',
          message: '메시지 1',
        }),
      );
      const n1 = await res1.json();

      await app.request(
        createRequest('POST', '/api/v1/notifications', {
          userId: 'EMP-001',
          type: 'system',
          title: '알림 2',
          message: '메시지 2',
        }),
      );

      // Mark first as read
      await app.request(createRequest('PATCH', `/api/v1/notifications/${n1.data.id}/read`));

      // Get unread only
      const res = await app.request('/api/v1/notifications/EMP-001?unreadOnly=true');
      const json = await res.json();
      expect(json.data.length).toBe(1);
      expect(json.data[0].title).toBe('알림 2');
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      const createRes = await app.request(
        createRequest('POST', '/api/v1/notifications', {
          userId: 'EMP-001',
          type: 'approval_needed',
          title: '결재 요청',
          message: '결재가 필요합니다.',
        }),
      );
      const created = await createRes.json();
      const notificationId = created.data.id;

      const res = await app.request(
        createRequest('PATCH', `/api/v1/notifications/${notificationId}/read`),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.isRead).toBe(true);
      expect(json.data.readAt).toBeDefined();
      expect(json.data.readAt).not.toBeNull();
    });

    it('should return 404 for non-existent notification', async () => {
      const res = await app.request(
        createRequest('PATCH', '/api/v1/notifications/NTF-nonexistent/read'),
      );
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/notifications/read-all', () => {
    it('should mark all notifications as read for a user', async () => {
      // Create 3 unread notifications
      for (let i = 0; i < 3; i++) {
        await app.request(
          createRequest('POST', '/api/v1/notifications', {
            userId: 'EMP-002',
            type: 'system',
            title: `알림 ${i}`,
            message: `메시지 ${i}`,
          }),
        );
      }

      const res = await app.request(
        createRequest('PATCH', '/api/v1/notifications/read-all', { userId: 'EMP-002' }),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.updatedCount).toBe(3);

      // Verify all are read now
      const checkRes = await app.request('/api/v1/notifications/EMP-002?unreadOnly=true');
      const checkJson = await checkRes.json();
      expect(checkJson.data.length).toBe(0);
    });

    it('should return 0 count when no unread notifications exist', async () => {
      const res = await app.request(
        createRequest('PATCH', '/api/v1/notifications/read-all', { userId: 'EMP-EMPTY' }),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.updatedCount).toBe(0);
    });

    it('should reject missing userId', async () => {
      const res = await app.request(
        createRequest('PATCH', '/api/v1/notifications/read-all', {}),
      );
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/notifications/:userId/unread-count', () => {
    it('should return unread count', async () => {
      // Create 3 notifications, mark 1 as read
      const responses = [];
      for (let i = 0; i < 3; i++) {
        const res = await app.request(
          createRequest('POST', '/api/v1/notifications', {
            userId: 'EMP-003',
            type: 'system',
            title: `알림 ${i}`,
            message: `메시지 ${i}`,
          }),
        );
        responses.push(await res.json());
      }

      // Mark first as read
      await app.request(
        createRequest('PATCH', `/api/v1/notifications/${responses[0].data.id}/read`),
      );

      const res = await app.request('/api/v1/notifications/EMP-003/unread-count');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.count).toBe(2);
    });

    it('should return 0 for user with no notifications', async () => {
      const res = await app.request('/api/v1/notifications/EMP-NONE/unread-count');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.count).toBe(0);
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await app.request('/api/v1/unknown');
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });
});
