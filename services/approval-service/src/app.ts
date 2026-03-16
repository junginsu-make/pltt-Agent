import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import approvalRoutes from './routes/approvals.js';
import { errorHandler } from './middleware/error-handler.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok', service: 'approval-service' }));

// Mount approval routes
app.route('/api/v1/approvals', approvalRoutes);

// Error handler
app.onError(errorHandler);

export default app;
