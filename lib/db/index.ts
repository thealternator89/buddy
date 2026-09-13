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
  var __sqliteDb: Database.Database | undefined;
}

const sqlite =
  globalThis.__sqliteDb ??
  (() => {
    const client = new Database(DB_PATH);
    client.pragma('journal_mode = WAL');
    client.pragma('foreign_keys = ON');

    try {
      const columns = client.pragma('table_info(accounts)') as Array<{ name: string }>;
      const columnNames = new Set(columns.map((c) => c.name));
      if (columnNames.size > 0) {
        if (!columnNames.has('icon')) {
          client.exec('ALTER TABLE accounts ADD COLUMN icon TEXT');
        }
        if (!columnNames.has('exclude_from_net_worth')) {
          client.exec('ALTER TABLE accounts ADD COLUMN exclude_from_net_worth INTEGER NOT NULL DEFAULT 0');
        }
      }
    } catch {
      // Table might not exist yet before first migration/seed
    }

    return client;
  })();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__sqliteDb = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
