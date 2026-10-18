import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile?.('.env');
} catch {
  // Ignore if .env is not present
}

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/buddy',
  },
});
