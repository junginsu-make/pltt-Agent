import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://palette:palette_dev@localhost:5432/palette_dev',
});

export const db = drizzle(pool, { schema });

export * from './schema/index.js';
export type Database = typeof db;
