/**
 * Test customer login to diagnose issues
 */

import { storage } from "./server/storage.js";
import bcrypt from "bcrypt";

async function testCustomerLogin() {
  try {
    console.log("\n🔍 Testing Customer Login System...\n");
    
    // Check if storage is initialized
    const memStorage = storage as any;
    const tenantCount = memStorage.tenants?.size || 0;
    const userCount = memStorage.users?.size || 0;
    const customerCount = memStorage.customers?.size || 0;
    
    console.log(`📊 Storage Status:`);
    console.log(`   Tenants: ${tenantCount}`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Customers: ${customerCount}\n`);
    
    if (tenantCount === 0) {
      console.log("❌ Storage not initialized!");
      console.log("💡 The server needs to run and initialize storage first.");
      console.log("   Make sure the server is running with: npm run dev\n");
      return;
    }
    
    // Get all customer users
    const allUsers = Array.from(memStorage.users?.values() || []);
    const customerUsers = allUsers.filter((u: any) => u.role === "customer" && u.customerId);
    
    console.log(`👥 Customer Users Found: ${customerUsers.length}\n`);
    
    if (customerUsers.length === 0) {
      console.log("❌ No customer user accounts found!");
      console.log("\n💡 This means customer user accounts weren't created during initialization.");
      console.log("   Possible causes:");
      console.log("   1. Server hasn't finished initializing");
      console.log("   2. Customer user creation failed");
      console.log("   3. Storage was cleared\n");
      
      // Show first few customers that should have accounts
      const tenants = Array.from(memStorage.tenants?.values() || []);
      if (tenants.length > 0) {
        const firstTenant = tenants[0];
        const customers = await storage.getCustomersByTenant(firstTenant.id);
        console.log(`📋 First 5 customers from ${firstTenant.name} (should have user accounts):\n`);
        for (let i = 0; i < Math.min(customers.length, 5); i++) {
          const customer = customers[i];
          const existingUser = await storage.getUserByEmail(customer.email);
          console.log(`   ${i + 1}. ${customer.email}`);
          if (existingUser) {
            console.log(`      ✅ User account exists (role: ${existingUser.role})`);
          } else {
            console.log(`      ❌ No user account - creating now...`);
            try {
              await storage.createCustomerUser(
                customer.tenantId,
                customer.id,
                customer.email,
                "demo123",
                customer.name
              );
              console.log(`      ✅ User account created!`);
            } catch (error: any) {
              console.log(`      ❌ Failed: ${error.message}`);
            }
          }
        }
      }
      return;
    }
    
    // Test login for first customer user
    const testUser = customerUsers[0];
    console.log(`🧪 Testing login for: ${testUser.email}\n`);
    
    // Test password validation
    const testPassword = "demo123";
    const isValid = await bcrypt.compare(testPassword, testUser.passwordHash);
    
    console.log(`   Password validation: ${isValid ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`   User role: ${testUser.role}`);
    console.log(`   Customer ID: ${(testUser as any).customerId || "MISSING"}`);
    console.log(`   Tenant ID: ${testUser.tenantId}\n`);
    
    if (!isValid) {
      console.log("❌ Password validation failed!");
      console.log("   The password hash might be incorrect.");
      console.log("   Expected password: demo123\n");
    }
    
    if (!(testUser as any).customerId) {
      console.log("⚠️  WARNING: Customer user missing customerId!");
      console.log("   This will cause issues with customer routes.\n");
    }
    
    if (isValid && (testUser as any).customerId) {
      console.log("✅ Customer login should work!");
      console.log(`\n📧 Test Credentials:`);
      console.log(`   Email: ${testUser.email}`);
      console.log(`   Password: demo123`);
      console.log(`   Login URL: http://localhost:5000/login\n`);
    }
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
  }
}

testCustomerLogin();

