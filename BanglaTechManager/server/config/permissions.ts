/**
 * Permission Vocabulary
 * Canonical list of all permissions in the system
 * These permission codes are used throughout the application for authorization
 */

export const PERMISSIONS = {
  // Authentication & Session
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_IMPERSONATE: "auth.impersonate",
  
  // User Management
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",
  USERS_INVITE: "users.invite",
  USERS_DEACTIVATE: "users.deactivate",
  
  // Role Management
  ROLES_READ: "roles.read",
  ROLES_CREATE: "roles.create",
  ROLES_UPDATE: "roles.update",
  ROLES_DELETE: "roles.delete",
  ROLES_ASSIGN: "roles.assign",
  ROLES_REVOKE: "roles.revoke",
  
  // Team Management
  TEAMS_READ: "teams.read",
  TEAMS_CREATE: "teams.create",
  TEAMS_UPDATE: "teams.update",
  TEAMS_DELETE: "teams.delete",
  TEAMS_MANAGE_MEMBERS: "teams.manage_members",
  TEAMS_ASSIGN_ROLES: "teams.assign_roles",
  
  // Customer Management
  CUSTOMERS_READ: "customers.read",
  CUSTOMERS_CREATE: "customers.create",
  CUSTOMERS_UPDATE: "customers.update",
  CUSTOMERS_DELETE: "customers.delete",
  CUSTOMERS_EXPORT: "customers.export",
  
  // Ticket Management
  TICKETS_READ: "tickets.read",
  TICKETS_CREATE: "tickets.create",
  TICKETS_UPDATE: "tickets.update",
  TICKETS_DELETE: "tickets.delete",
  TICKETS_ASSIGN: "tickets.assign",
  TICKETS_CLOSE: "tickets.close",
  
  // Message Management
  MESSAGES_READ: "messages.read",
  MESSAGES_CREATE: "messages.create",
  MESSAGES_UPDATE: "messages.update",
  MESSAGES_DELETE: "messages.delete",
  
  // Integration Management
  INTEGRATIONS_READ: "integrations.read",
  INTEGRATIONS_CONNECT: "integrations.connect",
  INTEGRATIONS_DISCONNECT: "integrations.disconnect",
  INTEGRATIONS_MANAGE: "integrations.manage",
  
  // Settings & Configuration
  SETTINGS_READ: "settings.read",
  SETTINGS_UPDATE: "settings.update",
  SETTINGS_BRANDING: "settings.branding",
  SETTINGS_FEATURES: "settings.features",
  
  // Billing & Subscription
  BILLING_READ: "billing.read",
  BILLING_MANAGE: "billing.manage",
  BILLING_UPGRADE: "billing.upgrade",
  BILLING_DOWNGRADE: "billing.downgrade",
  
  // Analytics & Reports
  ANALYTICS_READ: "analytics.read",
  ANALYTICS_EXPORT: "analytics.export",
  REPORTS_CREATE: "reports.create",
  REPORTS_VIEW: "reports.view",
  
  // Tenant Management (Super Admin)
  TENANT_READ: "tenant.read",
  TENANT_CREATE: "tenant.create",
  TENANT_UPDATE: "tenant.update",
  TENANT_DELETE: "tenant.delete",
  TENANT_SUSPEND: "tenant.suspend",
  TENANT_REACTIVATE: "tenant.reactivate",
  TENANT_EXPORT: "tenant.export",
  TENANT_IMPORT: "tenant.import",
  
  // Audit & Logs
  AUDIT_READ: "audit.read",
  AUDIT_EXPORT: "audit.export",
  
  // Files & Attachments
  FILES_READ: "files.read",
  FILES_UPLOAD: "files.upload",
  FILES_DELETE: "files.delete",
  
  // Phone Calls
  CALLS_READ: "calls.read",
  CALLS_CREATE: "calls.create",
  CALLS_UPDATE: "calls.update",
  CALLS_INITIATE: "calls.initiate",
  CALLS_RECORD: "calls.record",
  
  // Notifications
  NOTIFICATIONS_READ: "notifications.read",
  NOTIFICATIONS_SEND: "notifications.send",
  NOTIFICATIONS_MANAGE: "notifications.manage",
} as const;

/**
 * Permission categories for UI grouping
 */
export const PERMISSION_CATEGORIES = {
  AUTH: {
    name: "Authentication",
    permissions: [
      PERMISSIONS.AUTH_LOGIN,
      PERMISSIONS.AUTH_LOGOUT,
      PERMISSIONS.AUTH_IMPERSONATE,
    ],
  },
  USERS: {
    name: "Users",
    permissions: [
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_UPDATE,
      PERMISSIONS.USERS_DELETE,
      PERMISSIONS.USERS_INVITE,
      PERMISSIONS.USERS_DEACTIVATE,
    ],
  },
  ROLES: {
    name: "Roles & Permissions",
    permissions: [
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.ROLES_CREATE,
      PERMISSIONS.ROLES_UPDATE,
      PERMISSIONS.ROLES_DELETE,
      PERMISSIONS.ROLES_ASSIGN,
      PERMISSIONS.ROLES_REVOKE,
    ],
  },
  TEAMS: {
    name: "Teams",
    permissions: [
      PERMISSIONS.TEAMS_READ,
      PERMISSIONS.TEAMS_CREATE,
      PERMISSIONS.TEAMS_UPDATE,
      PERMISSIONS.TEAMS_DELETE,
      PERMISSIONS.TEAMS_MANAGE_MEMBERS,
      PERMISSIONS.TEAMS_ASSIGN_ROLES,
    ],
  },
  CUSTOMERS: {
    name: "Customers",
    permissions: [
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.CUSTOMERS_CREATE,
      PERMISSIONS.CUSTOMERS_UPDATE,
      PERMISSIONS.CUSTOMERS_DELETE,
      PERMISSIONS.CUSTOMERS_EXPORT,
    ],
  },
  TICKETS: {
    name: "Tickets",
    permissions: [
      PERMISSIONS.TICKETS_READ,
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_UPDATE,
      PERMISSIONS.TICKETS_DELETE,
      PERMISSIONS.TICKETS_ASSIGN,
      PERMISSIONS.TICKETS_CLOSE,
    ],
  },
  MESSAGES: {
    name: "Messages",
    permissions: [
      PERMISSIONS.MESSAGES_READ,
      PERMISSIONS.MESSAGES_CREATE,
      PERMISSIONS.MESSAGES_UPDATE,
      PERMISSIONS.MESSAGES_DELETE,
    ],
  },
  INTEGRATIONS: {
    name: "Integrations",
    permissions: [
      PERMISSIONS.INTEGRATIONS_READ,
      PERMISSIONS.INTEGRATIONS_CONNECT,
      PERMISSIONS.INTEGRATIONS_DISCONNECT,
      PERMISSIONS.INTEGRATIONS_MANAGE,
    ],
  },
  SETTINGS: {
    name: "Settings",
    permissions: [
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_UPDATE,
      PERMISSIONS.SETTINGS_BRANDING,
      PERMISSIONS.SETTINGS_FEATURES,
    ],
  },
  BILLING: {
    name: "Billing",
    permissions: [
      PERMISSIONS.BILLING_READ,
      PERMISSIONS.BILLING_MANAGE,
      PERMISSIONS.BILLING_UPGRADE,
      PERMISSIONS.BILLING_DOWNGRADE,
    ],
  },
  ANALYTICS: {
    name: "Analytics",
    permissions: [
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.ANALYTICS_EXPORT,
      PERMISSIONS.REPORTS_CREATE,
      PERMISSIONS.REPORTS_VIEW,
    ],
  },
  TENANT: {
    name: "Tenant Management",
    permissions: [
      PERMISSIONS.TENANT_READ,
      PERMISSIONS.TENANT_CREATE,
      PERMISSIONS.TENANT_UPDATE,
      PERMISSIONS.TENANT_DELETE,
      PERMISSIONS.TENANT_SUSPEND,
      PERMISSIONS.TENANT_REACTIVATE,
      PERMISSIONS.TENANT_EXPORT,
      PERMISSIONS.TENANT_IMPORT,
    ],
  },
  AUDIT: {
    name: "Audit & Logs",
    permissions: [
      PERMISSIONS.AUDIT_READ,
      PERMISSIONS.AUDIT_EXPORT,
    ],
  },
  FILES: {
    name: "Files",
    permissions: [
      PERMISSIONS.FILES_READ,
      PERMISSIONS.FILES_UPLOAD,
      PERMISSIONS.FILES_DELETE,
    ],
  },
  CALLS: {
    name: "Phone Calls",
    permissions: [
      PERMISSIONS.CALLS_READ,
      PERMISSIONS.CALLS_CREATE,
      PERMISSIONS.CALLS_UPDATE,
      PERMISSIONS.CALLS_INITIATE,
      PERMISSIONS.CALLS_RECORD,
    ],
  },
  NOTIFICATIONS: {
    name: "Notifications",
    permissions: [
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.NOTIFICATIONS_SEND,
      PERMISSIONS.NOTIFICATIONS_MANAGE,
    ],
  },
} as const;

/**
 * Get all permission codes as an array
 */
export function getAllPermissions(): string[] {
  return Object.values(PERMISSIONS);
}

/**
 * Get permissions by category
 */
export function getPermissionsByCategory(category: keyof typeof PERMISSION_CATEGORIES): string[] {
  return PERMISSION_CATEGORIES[category].permissions;
}

/**
 * Check if a permission code is valid
 */
export function isValidPermission(permission: string): boolean {
  return Object.values(PERMISSIONS).includes(permission as any);
}

/**
 * Default role permissions mapping
 * Used when seeding default roles
 */
export const DEFAULT_ROLE_PERMISSIONS = {
  // Tenant Admin - Full access within tenant
  Admin: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.USERS_INVITE,
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.ROLES_CREATE,
    PERMISSIONS.ROLES_UPDATE,
    PERMISSIONS.ROLES_DELETE,
    PERMISSIONS.ROLES_ASSIGN,
    PERMISSIONS.TEAMS_READ,
    PERMISSIONS.TEAMS_CREATE,
    PERMISSIONS.TEAMS_UPDATE,
    PERMISSIONS.TEAMS_DELETE,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.CUSTOMERS_DELETE,
    PERMISSIONS.TICKETS_READ,
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_UPDATE,
    PERMISSIONS.TICKETS_DELETE,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.AUDIT_READ,
  ],
  // Manager - Can manage customers and tickets, view analytics
  Manager: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.TICKETS_READ,
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_UPDATE,
    PERMISSIONS.TICKETS_ASSIGN,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.REPORTS_VIEW,
  ],
  // Agent - Can work with customers and tickets
  Agent: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.TICKETS_READ,
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_UPDATE,
    PERMISSIONS.MESSAGES_READ,
    PERMISSIONS.MESSAGES_CREATE,
  ],
  // Viewer - Read-only access
  Viewer: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.TICKETS_READ,
    PERMISSIONS.MESSAGES_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],
} as const;

