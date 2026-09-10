import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'fs';
import path from 'path';
import * as schema from './schema';

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'buddy.db');

// Ensure the directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

declare global {
  // eslint-disable-next-line no-var
  var __sqliteDb: Database.Database | undefined;
}

const sqlite =
  globalThis.__sqliteDb ??
  (() => {
    const client = new Database(DB_PATH);
    client.pragma('journal_mode = WAL');
    client.pragma('foreign_keys = ON');
    return client;
  })();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__sqliteDb = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
