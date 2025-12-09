/**
 * Script to fix all customer passwords to customer123
 * Run with: npx tsx scripts/fix-customer-passwords.ts
 */

import { storage } from "../server/storage";
import { MemStorage } from "../server/storage";

async function fixCustomerPasswords() {
  const memStorage = storage as MemStorage;
  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  console.log("🔧 Fixing customer passwords to customer123...\n");

  // Get all users with customer role
  const allUsers = Array.from(memStorage.users.values());
  const customerUsers = allUsers.filter(u => u.role === "customer");

  console.log(`Found ${customerUsers.length} customer user accounts\n`);

  for (const user of customerUsers) {
    try {
      // Update password to customer123
      await memStorage.updateUserPassword(user.id, "customer123");
      fixed++;
      
      if (fixed % 10 === 0) {
        console.log(`✓ Fixed ${fixed}/${customerUsers.length} passwords...`);
      }
    } catch (error: any) {
      errors++;
      console.error(`Failed to fix password for ${user.email}: ${error.message}`);
    }
  }

  console.log(`\n✅ Password fix complete!`);
  console.log(`   Fixed: ${fixed}`);
  console.log(`   Errors: ${errors}`);
}

fixCustomerPasswords().catch(console.error);

