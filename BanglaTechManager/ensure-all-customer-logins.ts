import { storage } from "./server/storage.js";
import { initializeStorage } from "./server/init-storage.js";

async function ensureAllCustomerLogins() {
  console.log("🔧 Ensuring all customers have login accounts...\n");

  // CRITICAL: Initialize storage first (this creates customers if they don't exist)
  console.log("⚙️  Initializing storage...");
  await initializeStorage();
  console.log("✅ Storage initialized\n");

  const memStorage = storage as any;
  const allCustomers = Array.from(memStorage.customers?.values() || []);
  
  if (allCustomers.length === 0) {
    console.log("❌ No customers found after initialization.");
    console.log("   This might mean storage initialization failed.");
    console.log("   Try starting the server first: npm run dev");
    return;
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
      
      if (user && user.role === "customer" && (user as any).customerId === customer.id && user.passwordHash) {
        skipped++;
        continue;
      }

      // User doesn't exist or is misconfigured - fix it
      if (user && (user.role !== "customer" || (user as any).customerId !== customer.id || !user.passwordHash)) {
        // Delete incorrect user account
        memStorage.users.delete(user.id);
        fixed++;
        console.log(`🔧 Fixed incorrect user account for: ${customer.email}`);
      }

      // Create correct user account
      await storage.createCustomerUser(
        customer.tenantId,
        customer.id,
        normalizedEmail,
        "demo123",
        customer.name
      );
      created++;
      
      if (created % 10 === 0 || created === 1) {
        console.log(`✅ Created account ${created}/${allCustomers.length}: ${normalizedEmail}`);
      }
    } catch (error: any) {
      errors++;
      if (errors <= 5) {
        console.error(`❌ Error for ${customer.email}:`, error.message);
      }
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   Created: ${created} accounts`);
  console.log(`   Fixed: ${fixed} accounts`);
  console.log(`   Skipped: ${skipped} (already correct)`);
  console.log(`   Errors: ${errors}\n`);
  console.log(`📧 All customers can now login with password: demo123\n`);
}

ensureAllCustomerLogins().catch(console.error);

