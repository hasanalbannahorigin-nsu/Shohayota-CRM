/**
 * Quick fix for customer login issues
 * This ensures all customer accounts are created with correct passwords
 */

import { storage } from "./server/storage.js";

async function fixCustomerLogins() {
  console.log("\n🔧 Fixing Customer Login Accounts...\n");

  try {
    // Initialize storage if needed
    const memStorage = storage as any;
    
    // Get all customers
    const allCustomers = Array.from(memStorage.customers?.values() || []);
    
    if (allCustomers.length === 0) {
      console.log("❌ No customers found. Server may not be initialized.");
      console.log("   Please start the server first: npm run dev\n");
      process.exit(1);
    }

    console.log(`Found ${allCustomers.length} customers.\n`);

    let created = 0;
    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const customer of allCustomers) {
      try {
        const normalizedEmail = (customer.email || "").trim().toLowerCase();
        
        // Check if user account exists
        let user = await storage.getUserByEmail(normalizedEmail);
        
        // Check if account is correct
        const isCorrect = user && 
          user.role === "customer" && 
          (user as any).customerId === customer.id && 
          user.passwordHash;

        if (isCorrect) {
          skipped++;
          continue;
        }

        // Fix incorrect account
        if (user) {
          memStorage.users.delete(user.id);
          fixed++;
          console.log(`🔧 Fixed: ${normalizedEmail}`);
        }

        // Create correct account
        await storage.createCustomerUser(
          customer.tenantId,
          customer.id,
          normalizedEmail,
          "demo123",
          customer.name
        );
        created++;
        
        if (created <= 5 || created % 10 === 0) {
          console.log(`✅ Created: ${normalizedEmail}`);
        }
      } catch (error: any) {
        errors++;
        if (errors <= 3) {
          console.error(`❌ Error for ${customer.email}:`, error.message);
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Created: ${created} accounts`);
    console.log(`   🔧 Fixed: ${fixed} accounts`);
    console.log(`   ⏭️  Skipped: ${skipped} (already correct)`);
    console.log(`   ❌ Errors: ${errors}\n`);

    // Test a sample login
    console.log("🧪 Testing sample customer login...");
    const testEmail = allCustomers[0]?.email?.trim().toLowerCase();
    if (testEmail) {
      const testUser = await storage.getUserByEmail(testEmail);
      if (testUser && testUser.passwordHash) {
        console.log(`✅ Test account ready: ${testEmail}`);
        console.log(`   Password: demo123\n`);
      } else {
        console.log(`❌ Test account failed: ${testEmail}\n`);
      }
    }

    console.log("🎉 Customer accounts are ready!");
    console.log("   All customers can login with password: demo123\n");
  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixCustomerLogins();

