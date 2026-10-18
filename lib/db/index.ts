import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

try {
  process.loadEnvFile?.('.env');
} catch {
  // Ignore if .env is not present (e.g. injected via environment in production)
}

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/buddy';

declare global {
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

const pgClient =
  globalThis.__pgClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === 'production' ? 10 : 5,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pgClient = pgClient;
}

export const db = drizzle(pgClient, { schema });
export { pgClient };
