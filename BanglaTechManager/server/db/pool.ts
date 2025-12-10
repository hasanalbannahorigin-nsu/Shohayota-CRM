// Database pool for database operations
// Uses postgres-js (already in project) to create a pg Pool-compatible interface
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 
  (process.env.PGHOST && process.env.PGPORT && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE
    ? `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`
    : undefined);

let pool: any = null;

if (connectionString) {
  try {
    const sql = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    // Create a pool-like interface compatible with pg Pool API
    pool = {
      query: async (text: string, params?: any[]) => {
        try {
          const result = await sql.unsafe(text, params || []);
          return { rows: Array.isArray(result) ? result : (result ? [result] : []) };
        } catch (error: any) {
          // Check if it's a table doesn't exist error
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            console.warn('[Database] Table does not exist. Run migrations first:', text.substring(0, 50));
          }
          throw error;
        }
      },
      connect: async () => {
        return {
          query: pool.query,
          release: () => {},
        };
      },
      end: () => sql.end(),
    };
    
    // Test connection asynchronously (don't block)
    pool.query('SELECT 1').then(() => {
      console.log('✅ Database pool initialized successfully');
    }).catch((err: any) => {
      console.warn('⚠️  Database pool test failed:', err.message);
    });
  } catch (error: any) {
    console.warn('⚠️  Could not initialize database pool. Will use in-memory storage fallback:', error.message);
    pool = null;
  }
} else {
  console.warn('⚠️  No DATABASE_URL found. Will use in-memory storage fallback.');
}

export default pool;
