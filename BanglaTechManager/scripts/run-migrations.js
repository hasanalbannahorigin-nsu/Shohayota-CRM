#!/usr/bin/env node

/**
 * Migration Runner
 * Executes all .sql files in migrations/ directory sorted lexicographically
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function runMigrations() {
  try {
    const migrationsDir = join(__dirname, '..', 'migrations');
    const files = await readdir(migrationsDir);
    
    // Filter SQL files and sort lexicographically
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`📦 Found ${sqlFiles.length} migration file(s)`);
    
    if (sqlFiles.length === 0) {
      console.log('✅ No migrations to run');
      await sql.end();
      return;
    }
    
    // Create migrations tracking table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    
    // Get already applied migrations
    const appliedResult = await sql`SELECT version FROM schema_migrations`;
    const applied = new Set(appliedResult.map((r) => r.version));
    
    let appliedCount = 0;
    
    for (const file of sqlFiles) {
      if (applied.has(file)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }
      
      console.log(`🔄 Running ${file}...`);
      
      const sqlContent = await readFile(join(migrationsDir, file), 'utf-8');
      
      // Run migration in a transaction
      try {
        await sql.begin(async (sql) => {
          await sql.unsafe(sqlContent);
          await sql`INSERT INTO schema_migrations (version) VALUES (${file})`;
        });
        console.log(`✅ Applied ${file}`);
        appliedCount++;
      } catch (error) {
        console.error(`❌ Failed to apply ${file}:`, error);
        throw error;
      }
    }
    
    console.log(`\n✅ Migration complete! Applied ${appliedCount} new migration(s)`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();
