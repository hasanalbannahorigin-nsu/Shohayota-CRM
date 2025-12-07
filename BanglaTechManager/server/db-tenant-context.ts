/**
 * Database Tenant Context Helper
 * Sets PostgreSQL session variables for Row-Level Security (RLS) policies
 * This ensures database-level tenant isolation even if application layer fails
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

export interface TenantContext {
  tenantId: string;
  userRole: string;
}

/**
 * Execute a database operation with tenant context set
 * This sets PostgreSQL session variables that RLS policies use
 */
export async function withTenantContext<T>(
  context: TenantContext,
  operation: () => Promise<T>
): Promise<T> {
  if (!db) {
    // In-memory mode, just execute the operation
    return operation();
  }

  // Set session variables for RLS policies
  // These variables are used by the RLS policies defined in migrations
  await db.execute(
    sql`SET LOCAL app.current_tenant_id = ${context.tenantId}`
  );
  await db.execute(
    sql`SET LOCAL app.user_role = ${context.userRole}`
  );

  try {
    return await operation();
  } finally {
    // Session variables are automatically cleared at transaction end
    // But we can explicitly clear them for safety
    try {
      await db.execute(sql`RESET app.current_tenant_id`);
      await db.execute(sql`RESET app.user_role`);
    } catch (error) {
      // Ignore errors on reset (variables may not exist)
    }
  }
}

/**
 * Get a database instance with tenant context pre-configured
 * This is a helper for operations that need to set context once
 */
export function getDbWithContext(context: TenantContext) {
  if (!db) {
    return null;
  }

  // Return a wrapper that sets context before operations
  return {
    ...db,
    execute: async (query: any) => {
      await db!.execute(
        sql`SET LOCAL app.current_tenant_id = ${context.tenantId}`
      );
      await db!.execute(
        sql`SET LOCAL app.user_role = ${context.userRole}`
      );
      try {
        return await db!.execute(query);
      } finally {
        try {
          await db!.execute(sql`RESET app.current_tenant_id`);
          await db!.execute(sql`RESET app.user_role`);
        } catch {
          // Ignore
        }
      }
    },
  };
}

