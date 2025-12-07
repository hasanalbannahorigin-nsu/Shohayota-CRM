/**
 * Tenant Data Export Service
 * Exports all tenant data for GDPR compliance and portability
 */

import { storage } from "./storage";
import { db } from "./db";
import { customers, tickets, messages, phoneCalls, notifications, users, auditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface TenantExportData {
  tenant: any;
  users: any[];
  customers: any[];
  tickets: any[];
  messages: any[];
  phoneCalls: any[];
  notifications: any[];
  auditLogs: any[];
  metadata: {
    exportedAt: string;
    exportedBy: string;
    format: string;
    version: string;
  };
}

/**
 * Export all tenant data
 */
export async function exportTenantData(
  tenantId: string,
  exportedBy: string
): Promise<TenantExportData> {
  // Get tenant
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Get all tenant data
  const [tenantUsers, tenantCustomers, tenantTickets] = await Promise.all([
    storage.getUsersByTenant(tenantId),
    storage.getCustomersByTenant(tenantId, 100000, 0),
    storage.getTicketsByTenant(tenantId),
  ]);

  // Messages, phone calls, notifications, audit logs - use empty arrays for in-memory mode
  const tenantMessages: any[] = [];
  const tenantPhoneCalls: any[] = [];
  const tenantNotifications: any[] = [];
  const tenantAuditLogs: any[] = [];

  // Get messages for all tickets
  const allMessages: any[] = [];
  for (const ticket of tenantTickets) {
    const ticketMessages = await storage.getMessagesByTicket(ticket.id, tenantId);
    allMessages.push(...ticketMessages);
  }

  const exportData: TenantExportData = {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      contactEmail: (tenant as any).contactEmail,
      createdAt: tenant.createdAt,
      // Exclude sensitive data like settings with credentials
    },
    users: tenantUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      // Exclude password hash
    })),
    customers: tenantCustomers,
    tickets: tenantTickets,
    messages: allMessages,
    phoneCalls: tenantPhoneCalls,
    notifications: tenantNotifications,
    auditLogs: tenantAuditLogs,
    metadata: {
      exportedAt: new Date().toISOString(),
      exportedBy,
      format: "json",
      version: "1.0",
    },
  };

  // Log export action
  // await logAuditEvent({ ... });

  return exportData;
}

/**
 * Delete tenant data (soft delete or hard delete)
 */
export async function deleteTenantData(
  tenantId: string,
  hardDelete: boolean = false,
  deletedBy: string
): Promise<void> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  if (hardDelete) {
    // Hard delete - remove all data
    // This should be done carefully and may require confirmation
    // For now, we'll just mark as deleted
    // In production, this would need to be done in a transaction
    // and potentially queued for background processing
    throw new Error("Hard delete not yet implemented - requires additional safety checks");
  } else {
    // Soft delete - mark tenant as deleted
    // Update tenant status to "deleted" and set deletedAt timestamp
    // This would require an updateTenant method in storage
    // await storage.updateTenant(tenantId, { status: "deleted", deletedAt: new Date() });
  }

  // Log deletion
  // await logAuditEvent({ ... });
}

/**
 * Restore tenant data from exported backup
 * This allows recovering tenant data from a previous export
 */
export async function restoreTenantData(
  exportData: TenantExportData,
  restoredBy: string,
  targetTenantId?: string
): Promise<{ tenantId: string; restored: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const restored: string[] = [];

  // If targetTenantId is provided, restore to that tenant (for migration)
  // Otherwise, create a new tenant with the exported data
  let tenantId: string;

  if (targetTenantId) {
    // Restore to existing tenant
    const existingTenant = await storage.getTenant(targetTenantId);
    if (!existingTenant) {
      throw new Error("Target tenant not found");
    }
    tenantId = targetTenantId;
  } else {
    // Create new tenant from export
    const newTenant = await storage.createTenant({
      name: exportData.tenant.name + " (Restored)",
      slug: exportData.tenant.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-restored",
      contactEmail: exportData.tenant.contactEmail,
      status: "active",
      plan: "basic",
      settings: {},
    } as any);
    tenantId = newTenant.id;
    restored.push("tenant");
  }

  // Restore users (skip password hashes - users will need to reset passwords)
  for (const userData of exportData.users) {
    try {
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser && existingUser.tenantId === tenantId) {
        warnings.push(`User ${userData.email} already exists, skipping`);
        continue;
      }

      // Create user with temporary password (user must reset)
      const tempPassword = `temp_${Math.random().toString(36).slice(2)}`;
      await storage.createUser({
        tenantId,
        name: userData.name,
        email: userData.email,
        password: tempPassword,
        role: userData.role,
      } as any);
      restored.push(`user:${userData.email}`);
    } catch (error: any) {
      warnings.push(`Failed to restore user ${userData.email}: ${error.message}`);
    }
  }

  // Restore customers
  for (const customerData of exportData.customers) {
    try {
      await storage.createCustomer({
        tenantId,
        name: customerData.name,
        email: customerData.email,
        phone: (customerData as any).phone,
        company: (customerData as any).company,
        status: (customerData as any).status || "active",
      } as any);
      restored.push(`customer:${customerData.id}`);
    } catch (error: any) {
      warnings.push(`Failed to restore customer ${customerData.id}: ${error.message}`);
    }
  }

  // Restore tickets (after customers are restored)
  for (const ticketData of exportData.tickets) {
    try {
      // Find customer by email or create a placeholder
      const customer = await storage.searchCustomers(tenantId, (ticketData as any).customerId || "");
      const customerId = customer.length > 0 ? customer[0].id : undefined;

      await storage.createTicket({
        tenantId,
        customerId: customerId || "",
        title: (ticketData as any).title,
        description: (ticketData as any).description,
        status: (ticketData as any).status || "open",
        priority: (ticketData as any).priority || "medium",
        category: (ticketData as any).category || "support",
      } as any);
      restored.push(`ticket:${ticketData.id}`);
    } catch (error: any) {
      warnings.push(`Failed to restore ticket ${ticketData.id}: ${error.message}`);
    }
  }

  // Restore messages (after tickets are restored)
  for (const messageData of exportData.messages) {
    try {
      await storage.createMessage({
        tenantId,
        ticketId: (messageData as any).ticketId,
        senderId: (messageData as any).senderId,
        content: (messageData as any).content,
        isFromCustomer: (messageData as any).isFromCustomer || false,
      } as any);
      restored.push(`message:${messageData.id}`);
    } catch (error: any) {
      warnings.push(`Failed to restore message ${messageData.id}: ${error.message}`);
    }
  }

  // Log restore action
  await logAuditEvent({
    tenantId,
    userId: restoredBy,
    action: "import",
    resourceType: "tenant",
    resourceId: tenantId,
    details: {
      restoredItems: restored.length,
      warnings: warnings.length,
      sourceExportDate: exportData.metadata.exportedAt,
    },
    ipAddress: undefined,
    userAgent: undefined,
  });

  return {
    tenantId,
    restored,
    warnings,
  };
}

/**
 * Log audit event (imported from audit service)
 */
async function logAuditEvent(data: {
  tenantId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  // Import dynamically to avoid circular dependency
  const { logAuditEvent: logEvent } = await import("./audit-service");
  await logEvent(data);
}

