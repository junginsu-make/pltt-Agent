import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@palette/db';

const { Pool } = pg;

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ??
        'postgresql://palette:palette_dev@localhost:5432/palette_dev',
    });
    _db = drizzle(pool, { schema });
  }
  return _db;
}

export type Database = ReturnType<typeof getDb>;
