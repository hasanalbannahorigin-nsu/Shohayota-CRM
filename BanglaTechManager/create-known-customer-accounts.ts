/**
 * Create known customer accounts with predictable emails for testing
 */

import { storage } from "./server/storage.js";
import { initializeStorage } from "./server/init-storage.js";

const KNOWN_CUSTOMERS = [
  { email: "rahim.khan1@company.com", name: "Rahim Khan", tenant: "Dhaka Tech Solutions" },
  { email: "fatema.khan2@company.com", name: "Fatema Khan", tenant: "Dhaka Tech Solutions" },
  { email: "karim.ahmed3@company.com", name: "Karim Ahmed", tenant: "Dhaka Tech Solutions" },
  { email: "sufia.begum9@company.com", name: "Sufia Begum", tenant: "Dhaka Tech Solutions" },
  { email: "jasmine.iyer1@company.com", name: "Jasmine Iyer", tenant: "Dhaka Tech Solutions" },
  { email: "priya.sharma19@company.com", name: "Priya Sharma", tenant: "Chittagong Tech Hub" },
  { email: "deepak.singh57@company.com", name: "Deepak Singh", tenant: "Chittagong Tech Hub" },
  { email: "majid.hassan85@company.com", name: "Majid Hassan", tenant: "Sylhet Software House" },
  { email: "ravi.iyer95@company.com", name: "Ravi Iyer", tenant: "Sylhet Software House" },
  { email: "samir.patel123@company.com", name: "Samir Patel", tenant: "Khulna IT Systems" },
];

async function createKnownCustomerAccounts() {
  console.log("\n🔧 Creating Known Customer Accounts for Testing...\n");

  try {
    // Initialize storage first
    await initializeStorage();

    // Get all tenants
    const memStorage = storage as any;
    const allTenants = Array.from(memStorage.tenants?.values() || []);
    
    // Create a map of tenant names to IDs
    const tenantMap: Record<string, string> = {};
    for (const tenant of allTenants) {
      tenantMap[tenant.name] = tenant.id;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const knownCustomer of KNOWN_CUSTOMERS) {
      try {
        const tenantId = tenantMap[knownCustomer.tenant];
        if (!tenantId) {
          console.log(`❌ Tenant not found: ${knownCustomer.tenant}`);
          errors++;
          continue;
        }

        const normalizedEmail = knownCustomer.email.trim().toLowerCase();

        // Check if customer already exists
        let customer = await storage.getCustomerByEmail(normalizedEmail);
        
        if (!customer) {
          // Create customer
          customer = await storage.createCustomer({
            tenantId,
            name: knownCustomer.name,
            email: normalizedEmail,
            phone: `+880-1711-${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`,
            company: `${knownCustomer.tenant} (Test Account)`,
            status: "active",
          });
          console.log(`✅ Created customer: ${normalizedEmail}`);
        } else {
          console.log(`ℹ️  Customer already exists: ${normalizedEmail}`);
        }

        // Check if user account exists
        let user = await storage.getUserByEmail(normalizedEmail);
        
        if (!user) {
          // Create user account
          await storage.createCustomerUser(
            tenantId,
            customer.id,
            normalizedEmail,
            "demo123",
            knownCustomer.name
          );
          created++;
          console.log(`✅ Created user account: ${normalizedEmail}`);
        } else if (user.role !== "customer" || (user as any).customerId !== customer.id || !user.passwordHash) {
          // Fix incorrect account
          memStorage.users.delete(user.id);
          await storage.createCustomerUser(
            tenantId,
            customer.id,
            normalizedEmail,
            "demo123",
            knownCustomer.name
          );
          updated++;
          console.log(`🔧 Fixed user account: ${normalizedEmail}`);
        } else {
          skipped++;
          console.log(`⏭️  User account already correct: ${normalizedEmail}`);
        }
      } catch (error: any) {
        errors++;
        console.error(`❌ Error for ${knownCustomer.email}:`, error.message);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Created: ${created} accounts`);
    console.log(`   🔧 Updated: ${updated} accounts`);
    console.log(`   ⏭️  Skipped: ${skipped} (already correct)`);
    console.log(`   ❌ Errors: ${errors}\n`);

    // Verify all known accounts
    console.log("🧪 Verifying Known Accounts:\n");
    for (const knownCustomer of KNOWN_CUSTOMERS) {
      const normalizedEmail = knownCustomer.email.trim().toLowerCase();
      const user = await storage.getUserByEmail(normalizedEmail);
      if (user && user.passwordHash) {
        console.log(`✅ ${normalizedEmail} - Ready (password: demo123)`);
      } else {
        console.log(`❌ ${normalizedEmail} - Not ready`);
      }
    }

    console.log("\n🎉 Known customer accounts are ready!");
    console.log("   You can now login with any of these emails and password: demo123\n");
  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createKnownCustomerAccounts();

