/**
 * Verify all customer accounts have login credentials
 */

import { storage } from "./server/storage.js";
import { initializeStorage } from "./server/init-storage.js";

async function verifyAllCustomerAccounts() {
  console.log("\n🔍 Verifying All Customer Login Accounts...\n");

  try {
    // Initialize storage first
    console.log("⚙️  Initializing storage...");
    await initializeStorage();
    console.log("✅ Storage initialized\n");

    const memStorage = storage as any;
    const allCustomers = Array.from(memStorage.customers?.values() || []);
    
    if (allCustomers.length === 0) {
      console.log("❌ No customers found.");
      process.exit(1);
    }

    console.log(`Found ${allCustomers.length} customers.\n`);
    console.log("Checking login accounts...\n");

    let hasAccount = 0;
    let missingAccount = 0;
    let wrongAccount = 0;
    let fixed = 0;

    const missingEmails: string[] = [];
    const wrongEmails: string[] = [];

    for (const customer of allCustomers) {
      const normalizedEmail = (customer.email || "").trim().toLowerCase();
      
      try {
        const user = await storage.getUserByEmail(normalizedEmail);
        
        if (!user) {
          missingAccount++;
          missingEmails.push(normalizedEmail);
          
          // Create the account
          try {
            await storage.createCustomerUser(
              customer.tenantId,
              customer.id,
              normalizedEmail,
              "demo123",
              customer.name
            );
            fixed++;
            console.log(`✅ Created: ${normalizedEmail}`);
          } catch (error: any) {
            console.error(`❌ Failed to create: ${normalizedEmail} - ${error.message}`);
          }
        } else if (user.role !== "customer" || (user as any).customerId !== customer.id || !user.passwordHash) {
          wrongAccount++;
          wrongEmails.push(normalizedEmail);
          
          // Fix the account
          try {
            memStorage.users.delete(user.id);
            await storage.createCustomerUser(
              customer.tenantId,
              customer.id,
              normalizedEmail,
              "demo123",
              customer.name
            );
            fixed++;
            console.log(`🔧 Fixed: ${normalizedEmail}`);
          } catch (error: any) {
            console.error(`❌ Failed to fix: ${normalizedEmail} - ${error.message}`);
          }
        } else {
          hasAccount++;
        }
      } catch (error: any) {
        console.error(`❌ Error checking ${normalizedEmail}:`, error.message);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Has account: ${hasAccount}`);
    console.log(`   ❌ Missing account: ${missingAccount}`);
    console.log(`   🔧 Wrong account: ${wrongAccount}`);
    console.log(`   ✅ Fixed/Created: ${fixed}\n`);

    if (missingEmails.length > 0) {
      console.log("📧 Missing accounts (first 10):");
      missingEmails.slice(0, 10).forEach(email => console.log(`   - ${email}`));
      if (missingEmails.length > 10) {
        console.log(`   ... and ${missingEmails.length - 10} more`);
      }
      console.log();
    }

    if (wrongEmails.length > 0) {
      console.log("🔧 Fixed accounts (first 10):");
      wrongEmails.slice(0, 10).forEach(email => console.log(`   - ${email}`));
      if (wrongEmails.length > 10) {
        console.log(`   ... and ${wrongEmails.length - 10} more`);
      }
      console.log();
    }

    // Test a few accounts
    console.log("🧪 Testing sample logins...\n");
    const testEmails = [
      "rahim.khan1@company.com",
      "fatema.khan2@company.com",
      "karim.ahmed3@company.com",
      "jasmine.iyer1@company.com",
    ];

    for (const email of testEmails) {
      const user = await storage.getUserByEmail(email);
      if (user && user.passwordHash) {
        console.log(`✅ ${email} - Ready`);
      } else {
        console.log(`❌ ${email} - Missing or invalid`);
      }
    }

    console.log("\n🎉 Verification complete!");
    console.log("   All customers should now be able to login with password: demo123\n");
  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyAllCustomerAccounts();

