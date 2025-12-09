/**
 * List all customer emails to see what's actually in the system
 */

import { storage } from "./server/storage.js";
import { initializeStorage } from "./server/init-storage.js";

async function listAllCustomerEmails() {
  console.log("\n📧 Listing All Customer Emails...\n");

  try {
    // Initialize storage
    await initializeStorage();

    const memStorage = storage as any;
    const allCustomers = Array.from(memStorage.customers?.values() || []);
    
    if (allCustomers.length === 0) {
      console.log("❌ No customers found.");
      return;
    }

    console.log(`Found ${allCustomers.length} customers.\n`);

    // Group by tenant
    const byTenant: Record<string, any[]> = {};
    for (const customer of allCustomers) {
      const tenant = await storage.getTenant(customer.tenantId);
      const tenantName = tenant?.name || "Unknown";
      if (!byTenant[tenantName]) {
        byTenant[tenantName] = [];
      }
      byTenant[tenantName].push(customer);
    }

    // List first 20 from each tenant
    for (const [tenantName, customers] of Object.entries(byTenant)) {
      console.log(`\n🏢 ${tenantName} (${customers.length} customers):`);
      console.log("─".repeat(60));
      
      const first20 = customers.slice(0, 20);
      for (const customer of first20) {
        const email = (customer.email || "").trim().toLowerCase();
        const user = await storage.getUserByEmail(email);
        const status = user && user.passwordHash ? "✅" : "❌";
        console.log(`  ${status} ${email}`);
      }
      
      if (customers.length > 20) {
        console.log(`  ... and ${customers.length - 20} more`);
      }
    }

    // Test specific emails
    console.log("\n\n🧪 Testing Specific Emails:");
    console.log("─".repeat(60));
    
    const testEmails = [
      "rahim.khan1@company.com",
      "fatema.khan2@company.com",
      "karim.ahmed3@company.com",
      "jasmine.iyer1@company.com",
    ];

    for (const email of testEmails) {
      const normalized = email.trim().toLowerCase();
      const customer = await storage.getCustomerByEmail(normalized);
      const user = await storage.getUserByEmail(normalized);
      
      if (customer) {
        console.log(`✅ ${email} - Customer found: ${customer.name}`);
        if (user && user.passwordHash) {
          console.log(`   ✅ User account exists and ready`);
        } else {
          console.log(`   ❌ User account missing or invalid`);
        }
      } else {
        console.log(`❌ ${email} - Customer not found`);
      }
    }

    // Find similar emails
    console.log("\n\n🔍 Finding Similar Emails:");
    console.log("─".repeat(60));
    
    const allEmails = allCustomers.map(c => (c.email || "").trim().toLowerCase());
    
    // Look for emails starting with "rahim", "fatema", "karim", "jasmine"
    const searchTerms = ["rahim", "fatema", "karim", "jasmine"];
    
    for (const term of searchTerms) {
      const matches = allEmails.filter(e => e.includes(term));
      if (matches.length > 0) {
        console.log(`\n  "${term}":`);
        matches.slice(0, 5).forEach(email => console.log(`    - ${email}`));
        if (matches.length > 5) {
          console.log(`    ... and ${matches.length - 5} more`);
        }
      }
    }

    console.log("\n");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  }
}

listAllCustomerEmails();

