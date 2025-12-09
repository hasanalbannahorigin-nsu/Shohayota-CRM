/**
 * Script to create user accounts for ALL existing customers
 * Run this if customer login is not working
 * Usage: npx tsx create-all-customer-users.ts
 */

import { storage } from "./server/storage.js";

async function createAllCustomerUsers() {
  try {
    console.log("\n🔍 Creating user accounts for all customers...\n");
    
    // Get all tenants
    const tenants = Array.from((storage as any).tenants?.values() || []);
    
    if (tenants.length === 0) {
      console.log("❌ No tenants found. Please start the server first to initialize data.");
      return;
    }

    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const tenant of tenants) {
      const customers = await storage.getCustomersByTenant(tenant.id);
      console.log(`\n🏢 Tenant: ${tenant.name}`);
      console.log(`   Customers: ${customers.length}`);
      
      let tenantCreated = 0;
      let tenantSkipped = 0;
      
      for (const customer of customers) {
        try {
          // Check if user already exists
          const existingUser = await storage.getUserByEmail(customer.email);
          
          if (existingUser) {
            if (existingUser.role === "customer" && (existingUser as any).customerId === customer.id) {
              tenantSkipped++;
              continue; // User account already exists
            } else {
              console.log(`   ⚠️  Email ${customer.email} already used by user with role: ${existingUser.role}`);
              tenantSkipped++;
              continue;
            }
          }
          
          // Create customer user account
          await storage.createCustomerUser(
            customer.tenantId,
            customer.id,
            customer.email,
            "demo123",
            customer.name
          );
          
          tenantCreated++;
          totalCreated++;
          
          if (tenantCreated <= 5 || tenantCreated % 10 === 0) {
            console.log(`   ✅ Created: ${customer.email}`);
          }
        } catch (error: any) {
          totalErrors++;
          if (error.message?.includes("unique") || error.message?.includes("already exists")) {
            tenantSkipped++;
          } else {
            console.log(`   ❌ Error for ${customer.email}: ${error.message}`);
          }
        }
      }
      
      console.log(`   Summary: ${tenantCreated} created, ${tenantSkipped} skipped`);
      totalSkipped += tenantSkipped;
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 FINAL SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Created: ${totalCreated} customer user accounts`);
    console.log(`⏭️  Skipped: ${totalSkipped} (already exist)`);
    if (totalErrors > 0) {
      console.log(`❌ Errors: ${totalErrors}`);
    }
    
    if (totalCreated > 0) {
      console.log(`\n✅ Success! ${totalCreated} customers can now log in.`);
      console.log(`\n📧 Login Credentials:`);
      console.log(`   Email: Any customer email from the list above`);
      console.log(`   Password: demo123`);
      console.log(`   Login URL: http://localhost:5000/login\n`);
    } else if (totalSkipped > 0) {
      console.log(`\n✅ All customers already have user accounts!`);
      console.log(`\n📧 You can login with any customer email + password: demo123\n`);
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
  }
}

createAllCustomerUsers();

