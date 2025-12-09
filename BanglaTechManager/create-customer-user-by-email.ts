/**
 * Script to create a customer user account for an existing customer by email
 * Usage: npx tsx create-customer-user-by-email.ts customer@email.com
 */

import { storage } from "./server/storage.js";

async function createCustomerUserByEmail(customerEmail: string) {
  try {
    console.log(`🔍 Looking for customer with email: ${customerEmail}...\n`);
    
    // Get all customers from all tenants
    const tenants = Array.from((storage as any).tenants?.values() || []);
    
    if (tenants.length === 0) {
      console.log("❌ No tenants found. Please start the server first to initialize data.");
      return;
    }

    // Search for customer by email across all tenants
    let foundCustomer = null;
    let foundTenant = null;

    for (const tenant of tenants) {
      const customers = await storage.getCustomersByTenant(tenant.id);
      const customer = customers.find((c: any) => 
        c.email.toLowerCase().trim() === customerEmail.toLowerCase().trim()
      );
      
      if (customer) {
        foundCustomer = customer;
        foundTenant = tenant;
        break;
      }
    }

    if (!foundCustomer) {
      console.log(`❌ Customer with email "${customerEmail}" not found.`);
      console.log("\n💡 Available customers:");
      
      // Show some sample customers
      for (const tenant of tenants.slice(0, 2)) {
        const customers = await storage.getCustomersByTenant(tenant.id);
        console.log(`\n   Tenant: ${tenant.name}`);
        customers.slice(0, 5).forEach((c: any) => {
          console.log(`   - ${c.email}`);
        });
        if (customers.length > 5) {
          console.log(`   ... and ${customers.length - 5} more`);
        }
      }
      return;
    }

    // Check if user account already exists
    const existingUser = await storage.getUserByEmail(foundCustomer.email);
    if (existingUser) {
      if ((existingUser as any).customerId === foundCustomer.id) {
        console.log(`\n✅ Customer user account already exists!`);
        console.log(`\n📧 CUSTOMER LOGIN CREDENTIALS:`);
        console.log(`   Email: ${foundCustomer.email}`);
        console.log(`   Password: demo123`);
        console.log(`   Tenant: ${foundTenant.name}`);
        console.log(`\n🌐 Login at: http://localhost:5000/login\n`);
        return;
      } else {
        console.log(`⚠️  A user account with email "${customerEmail}" already exists but is not linked to this customer.`);
        console.log(`   User role: ${existingUser.role}`);
        return;
      }
    }

    // Create customer user account
    const customerUser = await storage.createCustomerUser(
      foundCustomer.tenantId,
      foundCustomer.id,
      foundCustomer.email,
      "demo123",
      foundCustomer.name
    );

    console.log(`\n✅ Customer user account created successfully!`);
    console.log(`\n📧 CUSTOMER LOGIN CREDENTIALS:`);
    console.log(`   Email: ${foundCustomer.email}`);
    console.log(`   Password: demo123`);
    console.log(`   Name: ${foundCustomer.name}`);
    console.log(`   Tenant: ${foundTenant.name}`);
    console.log(`\n🌐 Login at: http://localhost:5000/login`);
    console.log(`   You will be redirected to: /customer/dashboard\n`);
  } catch (error: any) {
    console.error(`\n❌ Error creating customer user account:`, error.message);
    if (error.message.includes("unique")) {
      console.log("ℹ️  A user account with this email may already exist.");
    }
  }
}

// Get email from command line argument
const customerEmail = process.argv[2];

if (!customerEmail) {
  console.log("❌ Please provide a customer email address.");
  console.log("\n📖 Usage:");
  console.log("   npx tsx create-customer-user-by-email.ts customer@email.com");
  console.log("\n💡 Example:");
  console.log("   npx tsx create-customer-user-by-email.ts rahim.khan1@company.com\n");
  process.exit(1);
}

createCustomerUserByEmail(customerEmail);

