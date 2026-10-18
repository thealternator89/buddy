import postgres from 'postgres';

try {
  process.loadEnvFile?.('.env');
} catch {
  // Ignore if .env file does not exist
}

async function ensureDatabaseExists() {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/buddy';

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    console.error('Invalid DATABASE_URL format.');
    return;
  }

  const dbName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
  if (!dbName || !/^[a-zA-Z0-9_-]+$/.test(dbName)) {
    return;
  }

  // Connect to the default 'postgres' maintenance database to check/create the target DB
  const adminUrl = new URL(connectionString);
  adminUrl.pathname = '/postgres';

  const sql = postgres(adminUrl.toString(), { max: 1, connect_timeout: 5 });

  try {
    const existing = await sql`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;

    if (existing.length === 0) {
      console.log(`📦 Database "${dbName}" does not exist. Creating it...`);
      await sql.unsafe(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Created database "${dbName}".`);
    }
  } catch (err) {
    // If connecting to /postgres fails (e.g. restricted cloud user where DB already exists), continue
    console.warn(
      `Note: Could not auto-check/create database "${dbName}" (${
        err instanceof Error ? err.message : String(err)
      }). Proceeding...`
    );
  } finally {
    await sql.end();
  }
}

ensureDatabaseExists();
