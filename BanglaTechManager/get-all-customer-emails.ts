/**
 * Script to display ALL customer emails that can be used for login
 * Run: npx tsx get-all-customer-emails.ts
 */

import { storage } from "./server/storage.js";

async function getAllCustomerEmails() {
  try {
    console.log("\n🔍 Fetching all customer emails that can be used for login...\n");
    
    // Get all tenants
    const tenants = Array.from((storage as any).tenants?.values() || []);
    
    if (tenants.length === 0) {
      console.log("❌ No tenants found. Please start the server first to initialize data.");
      return;
    }

    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║     CUSTOMER LOGIN EMAILS (Password: demo123)         ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    let totalCustomers = 0;
    let totalWithAccounts = 0;

    for (const tenant of tenants) {
      const customers = await storage.getCustomersByTenant(tenant.id);
      totalCustomers += customers.length;

      // Get all users with customer role for this tenant
      const allUsers = Array.from((storage as any).users?.values() || []);
      const customerUsers = allUsers.filter((u: any) => 
        u.role === "customer" && 
        u.tenantId === tenant.id &&
        u.customerId
      );

      totalWithAccounts += customerUsers.length;

      console.log(`🏢 Tenant: ${tenant.name}`);
      console.log(`   Total Customers: ${customers.length}`);
      console.log(`   Customers with Login: ${customerUsers.length}`);
      
      if (customerUsers.length > 0) {
        console.log(`\n   📧 Customer Emails (can login with password: demo123):\n`);
        
        // Show first 10 customer emails
        for (let i = 0; i < Math.min(customerUsers.length, 10); i++) {
          const user = customerUsers[i];
          const customer = await storage.getCustomer((user as any).customerId, tenant.id);
          if (customer) {
            console.log(`   ${i + 1}. ${user.email} (${customer.name})`);
          }
        }
        
        if (customerUsers.length > 10) {
          console.log(`   ... and ${customerUsers.length - 10} more customers`);
        }
      } else {
        console.log(`   ⚠️  No customer user accounts found for this tenant`);
        console.log(`   💡 First 5 customer emails (user accounts will be created on next init):\n`);
        for (let i = 0; i < Math.min(customers.length, 5); i++) {
          console.log(`   ${i + 1}. ${customers[i].email} (${customers[i].name})`);
        }
      }
      
      console.log("\n" + "─".repeat(60) + "\n");
    }

    console.log(`📊 Summary:`);
    console.log(`   Total Customers: ${totalCustomers}`);
    console.log(`   Customers with Login Accounts: ${totalWithAccounts}`);
    
    if (totalWithAccounts > 0) {
      console.log(`\n✅ You can login with ANY of the customer emails above!`);
      console.log(`   Password for all: demo123`);
      console.log(`   Login URL: http://localhost:5000/login\n`);
    } else {
      console.log(`\n⚠️  No customer user accounts found.`);
      console.log(`   User accounts are created automatically during server initialization.`);
      console.log(`   Please restart the server or wait for initialization to complete.\n`);
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
  }
}

getAllCustomerEmails();

