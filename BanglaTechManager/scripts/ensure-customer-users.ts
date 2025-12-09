/**
 * Script to ensure all customers have user accounts with correct password
 * Run with: npx tsx scripts/ensure-customer-users.ts
 */

import { storage } from "../server/storage";
import { MemStorage } from "../server/storage";

async function ensureCustomerUsers() {
  const memStorage = storage as MemStorage;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  console.log("🔧 Ensuring all customers have user accounts with password customer123...\n");

  // Get all customers
  const allCustomers = Array.from(memStorage.customers?.values() || []);
  console.log(`Found ${allCustomers.length} customers\n`);

  for (const customer of allCustomers) {
    try {
      const normalizedEmail = (customer.email || "").trim().toLowerCase();
      
      // Check if user exists
      let user = await memStorage.getUserByEmail(normalizedEmail);
      
      if (user && user.role === "customer" && (user as any).customerId === customer.id) {
        // User exists, check password
        const bcrypt = await import("bcrypt");
        const testPassword = await bcrypt.compare("customer123", user.passwordHash || "");
        
        if (!testPassword) {
          // Password is wrong, update it
          await memStorage.updateUserPassword(user.id, "customer123");
          updated++;
          console.log(`✓ Updated password for ${normalizedEmail}`);
        } else {
          skipped++;
        }
      } else {
        // User doesn't exist or is wrong, create/update it
        if (user && (user.role !== "customer" || (user as any).customerId !== customer.id)) {
          // Delete wrong user
          memStorage.users.delete(user.id);
          console.log(`  Removed incorrect user for ${normalizedEmail}`);
        }
        
        // Create correct user account
        await memStorage.createCustomerUser(
          customer.tenantId,
          customer.id,
          normalizedEmail,
          "customer123",
          customer.name
        );
        created++;
        
        if (created % 10 === 0) {
          console.log(`✓ Created ${created} user accounts...`);
        }
      }
    } catch (error: any) {
      errors++;
      console.error(`Failed for ${customer.email}: ${error.message}`);
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

ensureCustomerUsers().catch(console.error);

