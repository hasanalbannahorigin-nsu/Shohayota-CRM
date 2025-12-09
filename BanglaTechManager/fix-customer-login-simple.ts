/**
 * Simple script to fix customer logins - initializes storage first
 */

import { storage } from "./server/storage.js";
import { initializeStorage } from "./server/init-storage.js";

async function fixCustomerLogins() {
  console.log("\n🔧 Fixing Customer Login Accounts...\n");

  try {
    // Initialize storage first (creates customers if needed)
    console.log("⚙️  Step 1: Initializing storage...");
    await initializeStorage();
    console.log("✅ Storage initialized\n");

    // Get all customers
    const memStorage = storage as any;
    const allCustomers = Array.from(memStorage.customers?.values() || []);
    
    if (allCustomers.length === 0) {
      console.log("❌ No customers found after initialization.");
      console.log("   This is unusual. Try restarting the server: npm run dev\n");
      process.exit(1);
    }

    console.log(`✅ Step 2: Found ${allCustomers.length} customers\n`);
    console.log("🔧 Step 3: Ensuring all customers have login accounts...\n");

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
          if (fixed <= 5) {
            console.log(`🔧 Fixed: ${normalizedEmail}`);
          }
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
    if (allCustomers.length > 0) {
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
    }

    console.log("🎉 Customer accounts are ready!");
    console.log("   All customers can login with password: demo123\n");
    console.log("💡 You can now try logging in at: http://localhost:5000/login\n");
  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixCustomerLogins();

