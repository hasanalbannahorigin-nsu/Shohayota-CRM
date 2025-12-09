/**
 * Customer Enrichment Utilities
 * 
 * Enriches customer data with tenant information, specifically
 * adding companyName from the tenant's name.
 */

import { storage } from "./storage";
import type { Customer } from "@shared/schema";

/**
 * Customer with enriched tenant information
 */
export interface EnrichedCustomer extends Customer {
  companyName?: string; // From tenant.name
}

/**
 * Enrich a single customer with tenant company name
 */
export async function enrichCustomerWithTenant(customer: Customer): Promise<EnrichedCustomer> {
  if (!customer || !customer.tenantId) {
    return customer as EnrichedCustomer;
  }

  const tenant = await storage.getTenant(customer.tenantId);
  if (!tenant) {
    return customer as EnrichedCustomer;
  }

  return {
    ...customer,
    companyName: tenant.name, // Use tenant's official name as company name
  };
}

/**
 * Enrich multiple customers with tenant company names
 */
export async function enrichCustomersWithTenant(customers: Customer[]): Promise<EnrichedCustomer[]> {
  if (!customers || customers.length === 0) {
    return [];
  }

  // Get all unique tenant IDs
  const tenantIds = [...new Set(customers.map(c => c.tenantId).filter(Boolean))];
  
  // Fetch all tenants at once
  const tenants = await Promise.all(
    tenantIds.map(id => storage.getTenant(id))
  );
  
  // Create a map of tenantId -> tenant name
  const tenantMap = new Map<string, string>();
  tenants.forEach(tenant => {
    if (tenant) {
      tenantMap.set(tenant.id, tenant.name);
    }
  });

  // Enrich customers with tenant names
  return customers.map(customer => ({
    ...customer,
    companyName: tenantMap.get(customer.tenantId) || undefined,
  }));
}

