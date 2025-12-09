/**
 * Display customer login credentials
 */

import { storage } from "./server/storage.js";

async function showCustomerCredentials() {
  try {
    console.log("\n🔍 Finding customer user accounts...\n");
    
    // Get all users with customer role
    const allUsers = Array.from((storage as any).users?.values() || []);
    const customerUsers = allUsers.filter((u: any) => u.role === "customer" && u.customerId);
    
    if (customerUsers.length === 0) {
      console.log("❌ No customer user accounts found.");
      console.log("\n💡 To create a customer user account, the server needs to initialize data first.");
      console.log("   The first customer from the first tenant will automatically get a user account.");
      console.log("   Or you can manually create one using the API or storage.createCustomerUser()\n");
      return;
    }

    console.log("╔════════════════════════════════════════════════════╗");
    console.log("║     CUSTOMER LOGIN CREDENTIALS                     ║");
    console.log("╚════════════════════════════════════════════════════╝\n");

    for (const customerUser of customerUsers) {
      const customer = await storage.getCustomer((customerUser as any).customerId, customerUser.tenantId);
      const tenant = await storage.getTenant(customerUser.tenantId);
      
      if (customer && tenant) {
        console.log(`📧 Email:     ${customerUser.email}`);
        console.log(`🔑 Password:  demo123`);
        console.log(`👤 Name:      ${customerUser.name}`);
        console.log(`🏢 Tenant:    ${tenant.name}`);
        console.log(`🌐 Login URL: http://localhost:5000/login`);
        console.log(`─────────────────────────────────────────────────\n`);
      }
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

showCustomerCredentials();

