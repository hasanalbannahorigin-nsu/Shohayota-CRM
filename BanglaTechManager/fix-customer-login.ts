/**
 * Fix Customer Login - Create user accounts for all customers
 * This script connects to the running server's storage instance
 * Run: npx tsx fix-customer-login.ts
 */

import { storage } from "./server/storage.js";

async function fixCustomerLogin() {
  try {
    console.log("\n🔧 Fixing Customer Login...\n");
    
    // Access the storage instance
    const memStorage = storage as any;
    
    // Check if storage is initialized
    const tenantCount = memStorage.tenants?.size || 0;
    const customerCount = memStorage.customers?.size || 0;
    const userCount = memStorage.users?.size || 0;
    
    console.log(`📊 Current Status:`);
    console.log(`   Tenants: ${tenantCount}`);
    console.log(`   Customers: ${customerCount}`);
    console.log(`   Users: ${userCount}\n`);
    
    if (tenantCount === 0 || customerCount === 0) {
      console.log("❌ Storage not initialized!");
      console.log("\n💡 Please make sure the server is running.");
      console.log("   The server initializes storage when it starts.\n");
      return;
    }
    
    // Get all customers
    const tenants = Array.from(memStorage.tenants?.values() || []);
    let totalCreated = 0;
    let totalSkipped = 0;
    
    console.log("🔍 Checking customer user accounts...\n");
    
    for (const tenant of tenants) {
      const customers = await storage.getCustomersByTenant(tenant.id);
      console.log(`🏢 ${tenant.name}: ${customers.length} customers`);
      
      let tenantCreated = 0;
      
      for (const customer of customers) {
        try {
          // Check if user account exists
          const existingUser = await storage.getUserByEmail(customer.email);
          
          if (existingUser && existingUser.role === "customer" && (existingUser as any).customerId === customer.id) {
            // User account already exists
            continue;
          }
          
          if (existingUser && existingUser.role !== "customer") {
            console.log(`   ⚠️  ${customer.email} - email already used by ${existingUser.role} user`);
            continue;
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
          
          if (tenantCreated <= 3) {
            console.log(`   ✅ Created: ${customer.email}`);
          }
        } catch (error: any) {
          if (error.message?.includes("unique") || error.message?.includes("already exists")) {
            totalSkipped++;
          } else {
            console.log(`   ❌ Error for ${customer.email}: ${error.message}`);
          }
        }
      }
      
      if (tenantCreated > 0) {
        console.log(`   ✅ Created ${tenantCreated} customer user accounts\n`);
      } else {
        console.log(`   ✓ All customers already have user accounts\n`);
      }
    }
    
    console.log("=".repeat(60));
    if (totalCreated > 0) {
      console.log(`✅ SUCCESS! Created ${totalCreated} customer user accounts`);
      console.log(`\n📧 Customer Login Credentials:`);
      console.log(`   Email: Any customer email from customers table`);
      console.log(`   Password: demo123`);
      console.log(`   Login URL: http://localhost:5000/login\n`);
    } else {
      console.log(`✅ All customers already have user accounts!`);
      console.log(`\n📧 You can login with any customer email + password: demo123\n`);
    }
    
    // Show sample customer emails
    if (tenants.length > 0) {
      const firstTenant = tenants[0];
      const sampleCustomers = await storage.getCustomersByTenant(firstTenant.id);
      if (sampleCustomers.length > 0) {
        console.log("📋 Sample Customer Emails (you can use any of these):");
        for (let i = 0; i < Math.min(sampleCustomers.length, 5); i++) {
          const customer = sampleCustomers[i];
          const user = await storage.getUserByEmail(customer.email);
          if (user && user.role === "customer") {
            console.log(`   ${i + 1}. ${customer.email} ✅ (has login)`);
          } else {
            console.log(`   ${i + 1}. ${customer.email} ❌ (no login)`);
          }
        }
        console.log("");
      }
    }
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

fixCustomerLogin();

