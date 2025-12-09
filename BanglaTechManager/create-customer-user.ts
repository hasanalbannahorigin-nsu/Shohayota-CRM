/**
 * Script to create a customer user account for testing customer login
 * Run this after the server is initialized to create a customer user account
 */

import { storage } from "./server/storage.js";

async function createCustomerUser() {
  try {
    console.log("🔍 Finding first customer to create user account...");
    
    // Get all tenants
    const tenants = Array.from((storage as any).tenants?.values() || []);
    if (tenants.length === 0) {
      console.log("❌ No tenants found. Please start the server first to initialize data.");
      return;
    }

    // Get customers from first tenant
    const firstTenant = tenants[0];
    const customers = await storage.getCustomersByTenant(firstTenant.id);
    
    if (customers.length === 0) {
      console.log("❌ No customers found. Please ensure data is initialized.");
      return;
    }

    // Find first customer without a user account
    let customerToUse = null;
    for (const customer of customers) {
      const existingUser = await storage.getUserByEmail(customer.email);
      if (!existingUser || existingUser.role !== "customer") {
        customerToUse = customer;
        break;
      }
    }

    if (!customerToUse) {
      customerToUse = customers[0];
    }

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(customerToUse.email);
    if (existingUser && (existingUser as any).customerId === customerToUse.id) {
      console.log(`\n✅ Customer user account already exists!`);
      console.log(`\n📧 CUSTOMER LOGIN CREDENTIALS:`);
      console.log(`   Email: ${customerToUse.email}`);
      console.log(`   Password: demo123`);
      console.log(`   Tenant: ${firstTenant.name}`);
      console.log(`\n🌐 Login at: http://localhost:5000/login\n`);
      return;
    }

    // Create customer user account
    const customerUser = await storage.createCustomerUser(
      customerToUse.tenantId,
      customerToUse.id,
      customerToUse.email,
      "demo123",
      customerToUse.name
    );

    console.log(`\n✅ Customer user account created successfully!`);
    console.log(`\n📧 CUSTOMER LOGIN CREDENTIALS:`);
    console.log(`   Email: ${customerToUse.email}`);
    console.log(`   Password: demo123`);
    console.log(`   Tenant: ${firstTenant.name}`);
    console.log(`\n🌐 Login at: http://localhost:5000/login\n`);
  } catch (error: any) {
    console.error("❌ Error creating customer user:", error.message);
    if (error.message.includes("unique")) {
      console.log("ℹ️  Customer user account may already exist. Check the console for credentials.");
    }
  }
}

createCustomerUser();

