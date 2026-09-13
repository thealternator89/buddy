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
      // 1. Accounts column migrations
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

      // 2. Categories hierarchy migration (from category_groups to parent_id)
      const catSql = client
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='categories'")
        .pluck()
        .get() as string | undefined;

      if (catSql && (catSql.includes('group_id') || !catSql.includes('parent_id'))) {
        client.pragma('foreign_keys = OFF');
        client.exec(`
          CREATE TABLE IF NOT EXISTS \`categories_new\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`parent_id\` text,
            \`name\` text NOT NULL,
            \`sort_order\` integer DEFAULT 0 NOT NULL,
            \`is_archived\` integer DEFAULT 0 NOT NULL,
            \`created_at\` integer NOT NULL,
            FOREIGN KEY (\`parent_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade
          );
        `);

        // Check if category_groups exists to migrate them as root categories
        const hasGroups = client
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='category_groups'")
          .all().length > 0;

        if (hasGroups) {
          client.exec(`
            INSERT OR IGNORE INTO \`categories_new\` (\`id\`, \`parent_id\`, \`name\`, \`sort_order\`, \`is_archived\`, \`created_at\`)
            SELECT \`id\`, NULL, \`name\` , \`sort_order\`, 0, \`created_at\` FROM \`category_groups\`;
          `);
        }

        // Migrate existing categories
        const catCols = client.pragma('table_info(categories)') as Array<{ name: string }>;
        const catColNames = new Set(catCols.map((c) => c.name));
        const parentExpr = catColNames.has('group_id')
          ? 'coalesce(parent_id, group_id)'
          : 'parent_id';

        client.exec(`
          INSERT OR REPLACE INTO \`categories_new\` (\`id\`, \`parent_id\`, \`name\`, \`sort_order\`, \`is_archived\`, \`created_at\`)
          SELECT \`id\`, ${parentExpr}, \`name\`, \`sort_order\`, \`is_archived\`, \`created_at\` FROM \`categories\`;
          DROP TABLE \`categories\`;
          ALTER TABLE \`categories_new\` RENAME TO \`categories\`;
          DROP TABLE IF EXISTS \`category_groups\`;
        `);
        client.pragma('foreign_keys = ON');
      }
    } catch (e) {
      console.error('Database auto-migration note:', e);
    }

    return client;
  })();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__sqliteDb = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
