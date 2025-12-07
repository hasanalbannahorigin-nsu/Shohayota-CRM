/**
 * Seed Default Permissions
 * Seeds the canonical list of permissions into the database
 */

import { db } from "../db";
import { permissions } from "@shared/schema";
import { PERMISSIONS, PERMISSION_CATEGORIES } from "../config/permissions";
import { sql } from "drizzle-orm";

export async function seedPermissions(): Promise<void> {
  if (!db) {
    console.warn("⚠️  Database not configured. Skipping permission seeding.");
    return;
  }

  try {
    console.log("🌱 Seeding permissions...");

    // Get all permission codes
    const allPermissions = Object.values(PERMISSIONS);

    // Insert permissions
    for (const permissionCode of allPermissions) {
      // Find category
      let category: string | undefined;
      for (const [catKey, catData] of Object.entries(PERMISSION_CATEGORIES)) {
        if (catData.permissions.includes(permissionCode)) {
          category = catKey.toLowerCase();
          break;
        }
      }

      // Insert or update permission
      await db.execute(sql`
        INSERT INTO permissions (code, description, category)
        VALUES (${permissionCode}, ${getPermissionDescription(permissionCode)}, ${category || null})
        ON CONFLICT (code) DO UPDATE
        SET description = EXCLUDED.description,
            category = EXCLUDED.category
      `);
    }

    console.log(`✅ Seeded ${allPermissions.length} permissions`);
  } catch (error) {
    console.error("❌ Error seeding permissions:", error);
    throw error;
  }
}

function getPermissionDescription(code: string): string {
  const descriptions: Record<string, string> = {
    [PERMISSIONS.AUTH_LOGIN]: "Allow user to login",
    [PERMISSIONS.AUTH_LOGOUT]: "Allow user to logout",
    [PERMISSIONS.AUTH_IMPERSONATE]: "Allow super-admin to impersonate users",
    [PERMISSIONS.USERS_READ]: "View users",
    [PERMISSIONS.USERS_CREATE]: "Create new users",
    [PERMISSIONS.USERS_UPDATE]: "Update user information",
    [PERMISSIONS.USERS_DELETE]: "Delete users",
    [PERMISSIONS.USERS_INVITE]: "Invite new users",
    [PERMISSIONS.USERS_DEACTIVATE]: "Deactivate users",
    [PERMISSIONS.ROLES_READ]: "View roles",
    [PERMISSIONS.ROLES_CREATE]: "Create new roles",
    [PERMISSIONS.ROLES_UPDATE]: "Update role permissions",
    [PERMISSIONS.ROLES_DELETE]: "Delete roles",
    [PERMISSIONS.ROLES_ASSIGN]: "Assign roles to users",
    [PERMISSIONS.ROLES_REVOKE]: "Revoke roles from users",
    [PERMISSIONS.TEAMS_READ]: "View teams",
    [PERMISSIONS.TEAMS_CREATE]: "Create new teams",
    [PERMISSIONS.TEAMS_UPDATE]: "Update team information",
    [PERMISSIONS.TEAMS_DELETE]: "Delete teams",
    [PERMISSIONS.TEAMS_MANAGE_MEMBERS]: "Add/remove team members",
    [PERMISSIONS.TEAMS_ASSIGN_ROLES]: "Assign roles to teams",
    [PERMISSIONS.CUSTOMERS_READ]: "View customers",
    [PERMISSIONS.CUSTOMERS_CREATE]: "Create new customers",
    [PERMISSIONS.CUSTOMERS_UPDATE]: "Update customer information",
    [PERMISSIONS.CUSTOMERS_DELETE]: "Delete customers",
    [PERMISSIONS.CUSTOMERS_EXPORT]: "Export customer data",
    [PERMISSIONS.TICKETS_READ]: "View tickets",
    [PERMISSIONS.TICKETS_CREATE]: "Create new tickets",
    [PERMISSIONS.TICKETS_UPDATE]: "Update ticket information",
    [PERMISSIONS.TICKETS_DELETE]: "Delete tickets",
    [PERMISSIONS.TICKETS_ASSIGN]: "Assign tickets to users",
    [PERMISSIONS.TICKETS_CLOSE]: "Close tickets",
    [PERMISSIONS.MESSAGES_READ]: "View messages",
    [PERMISSIONS.MESSAGES_CREATE]: "Send messages",
    [PERMISSIONS.MESSAGES_UPDATE]: "Edit messages",
    [PERMISSIONS.MESSAGES_DELETE]: "Delete messages",
    [PERMISSIONS.INTEGRATIONS_READ]: "View integrations",
    [PERMISSIONS.INTEGRATIONS_CONNECT]: "Connect integrations",
    [PERMISSIONS.INTEGRATIONS_DISCONNECT]: "Disconnect integrations",
    [PERMISSIONS.INTEGRATIONS_MANAGE]: "Manage integration settings",
    [PERMISSIONS.SETTINGS_READ]: "View settings",
    [PERMISSIONS.SETTINGS_UPDATE]: "Update settings",
    [PERMISSIONS.SETTINGS_BRANDING]: "Update branding settings",
    [PERMISSIONS.SETTINGS_FEATURES]: "Update feature settings",
    [PERMISSIONS.BILLING_READ]: "View billing information",
    [PERMISSIONS.BILLING_MANAGE]: "Manage billing",
    [PERMISSIONS.BILLING_UPGRADE]: "Upgrade plan",
    [PERMISSIONS.BILLING_DOWNGRADE]: "Downgrade plan",
    [PERMISSIONS.ANALYTICS_READ]: "View analytics",
    [PERMISSIONS.ANALYTICS_EXPORT]: "Export analytics data",
    [PERMISSIONS.REPORTS_CREATE]: "Create reports",
    [PERMISSIONS.REPORTS_VIEW]: "View reports",
    [PERMISSIONS.TENANT_READ]: "View tenant information",
    [PERMISSIONS.TENANT_CREATE]: "Create new tenants",
    [PERMISSIONS.TENANT_UPDATE]: "Update tenant information",
    [PERMISSIONS.TENANT_DELETE]: "Delete tenants",
    [PERMISSIONS.TENANT_SUSPEND]: "Suspend tenants",
    [PERMISSIONS.TENANT_REACTIVATE]: "Reactivate tenants",
    [PERMISSIONS.TENANT_EXPORT]: "Export tenant data",
    [PERMISSIONS.TENANT_IMPORT]: "Import tenant data",
    [PERMISSIONS.AUDIT_READ]: "View audit logs",
    [PERMISSIONS.AUDIT_EXPORT]: "Export audit logs",
    [PERMISSIONS.FILES_READ]: "View files",
    [PERMISSIONS.FILES_UPLOAD]: "Upload files",
    [PERMISSIONS.FILES_DELETE]: "Delete files",
    [PERMISSIONS.CALLS_READ]: "View call logs",
    [PERMISSIONS.CALLS_INITIATE]: "Initiate phone calls",
    [PERMISSIONS.CALLS_RECORD]: "Record phone calls",
    [PERMISSIONS.NOTIFICATIONS_READ]: "View notifications",
    [PERMISSIONS.NOTIFICATIONS_SEND]: "Send notifications",
    [PERMISSIONS.NOTIFICATIONS_MANAGE]: "Manage notification settings",
  };

  return descriptions[code] || `Permission: ${code}`;
}

