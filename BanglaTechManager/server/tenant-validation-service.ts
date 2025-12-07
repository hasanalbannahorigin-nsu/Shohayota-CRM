/**
 * Tenant Validation Service
 * Ensures all referenced resources belong to the same tenant
 * Implements the principle: Every tenant-scoped record must carry a tenant identifier
 * and no operation should assume a global read across tenants.
 */

import { storage } from "./storage";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a customer belongs to the specified tenant
 */
export async function validateCustomerOwnership(
  customerId: string,
  tenantId: string
): Promise<ValidationResult> {
  if (!customerId) {
    return { valid: true }; // Optional reference
  }

  const customer = await storage.getCustomer(customerId, tenantId);
  if (!customer) {
    return {
      valid: false,
      error: `Customer ${customerId} not found or does not belong to tenant ${tenantId}`,
    };
  }

  if (customer.tenantId !== tenantId) {
    return {
      valid: false,
      error: `Customer ${customerId} belongs to a different tenant`,
    };
  }

  return { valid: true };
}

/**
 * Validate that a user belongs to the specified tenant
 */
export async function validateUserOwnership(
  userId: string,
  tenantId: string
): Promise<ValidationResult> {
  if (!userId) {
    return { valid: true }; // Optional reference
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return {
      valid: false,
      error: `User ${userId} not found`,
    };
  }

  // Super-admins can be from system tenant but can access all tenants
  if (user.role === "super_admin") {
    return { valid: true };
  }

  if (user.tenantId !== tenantId) {
    return {
      valid: false,
      error: `User ${userId} belongs to a different tenant`,
    };
  }

  return { valid: true };
}

/**
 * Validate that a ticket belongs to the specified tenant
 */
export async function validateTicketOwnership(
  ticketId: string,
  tenantId: string
): Promise<ValidationResult> {
  if (!ticketId) {
    return { valid: true }; // Optional reference
  }

  const ticket = await storage.getTicket(ticketId, tenantId);
  if (!ticket) {
    return {
      valid: false,
      error: `Ticket ${ticketId} not found or does not belong to tenant ${tenantId}`,
    };
  }

  if (ticket.tenantId !== tenantId) {
    return {
      valid: false,
      error: `Ticket ${ticketId} belongs to a different tenant`,
    };
  }

  return { valid: true };
}

/**
 * Validate all ticket references (customer, assignee, creator)
 */
export async function validateTicketReferences(data: {
  tenantId: string;
  customerId?: string | null;
  assigneeId?: string | null;
  createdBy: string;
}): Promise<ValidationResult> {
  // Validate customer
  if (data.customerId) {
    const customerValidation = await validateCustomerOwnership(data.customerId, data.tenantId);
    if (!customerValidation.valid) {
      return customerValidation;
    }
  }

  // Validate assignee
  if (data.assigneeId) {
    const assigneeValidation = await validateUserOwnership(data.assigneeId, data.tenantId);
    if (!assigneeValidation.valid) {
      return assigneeValidation;
    }
  }

  // Validate creator
  const creatorValidation = await validateUserOwnership(data.createdBy, data.tenantId);
  if (!creatorValidation.valid) {
    return creatorValidation;
  }

  return { valid: true };
}

/**
 * Validate message references (ticket, sender)
 */
export async function validateMessageReferences(
  ticketId: string,
  senderId: string,
  tenantId: string
): Promise<ValidationResult> {
  // Validate ticket
  const ticketValidation = await validateTicketOwnership(ticketId, tenantId);
  if (!ticketValidation.valid) {
    return ticketValidation;
  }

  // Validate sender
  const senderValidation = await validateUserOwnership(senderId, tenantId);
  if (!senderValidation.valid) {
    return senderValidation;
  }

  return { valid: true };
}

/**
 * Validate phone call references (customer, user, ticket)
 */
export async function validatePhoneCallReferences(
  customerId: string,
  userId: string,
  ticketId: string | null,
  tenantId: string
): Promise<ValidationResult> {
  // Validate customer
  const customerValidation = await validateCustomerOwnership(customerId, tenantId);
  if (!customerValidation.valid) {
    return customerValidation;
  }

  // Validate user
  const userValidation = await validateUserOwnership(userId, tenantId);
  if (!userValidation.valid) {
    return userValidation;
  }

  // Validate ticket (optional)
  if (ticketId) {
    const ticketValidation = await validateTicketOwnership(ticketId, tenantId);
    if (!ticketValidation.valid) {
      return ticketValidation;
    }
  }

  return { valid: true };
}

/**
 * Ensure tenantId is set from context (never from client)
 */
export function ensureTenantIdFromContext(
  clientTenantId: string | undefined,
  contextTenantId: string
): string {
  // Always use context tenantId, ignore client-supplied value
  if (clientTenantId && clientTenantId !== contextTenantId) {
    console.warn(
      `[SECURITY] Tenant ID mismatch detected. Context: ${contextTenantId}, Client: ${clientTenantId}. Using context.`
    );
  }
  return contextTenantId;
}

/**
 * Validate that all referenced resources in a ticket update belong to the tenant
 */
export async function validateTicketUpdateReferences(
  tenantId: string,
  updates: {
    customerId?: string | null;
    assigneeId?: string | null;
  }
): Promise<ValidationResult> {
  // Validate customer if being updated
  if (updates.customerId !== undefined) {
    if (updates.customerId) {
      const customerValidation = await validateCustomerOwnership(updates.customerId, tenantId);
      if (!customerValidation.valid) {
        return customerValidation;
      }
    }
  }

  // Validate assignee if being updated
  if (updates.assigneeId !== undefined) {
    if (updates.assigneeId) {
      const assigneeValidation = await validateUserOwnership(updates.assigneeId, tenantId);
      if (!assigneeValidation.valid) {
        return assigneeValidation;
      }
    }
  }

  return { valid: true };
}

