/**
 * Permanent seed script - Creates fixed accounts for all users
 * 4 Tenants, 1 Super Admin, 4 Support Agents, 250 Customers
 */

import { storage } from "./server/storage.js";
import { initializeRoleTemplates } from "./server/role-service.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// Fixed tenant configuration
const TENANTS = [
  { name: "Dhaka Tech Solutions", email: "admin@dhakatech.com", city: "Dhaka" },
  { name: "Chittagong Tech Hub", email: "admin@chittagong.tech.com", city: "Chittagong" },
  { name: "Sylhet Software House", email: "admin@sylhet.software.com", city: "Sylhet" },
  { name: "Khulna IT Systems", email: "admin@khulna.it.com", city: "Khulna" },
];

// Fixed first names for customers
const FIRST_NAMES = [
  "Rahim", "Karim", "Hassan", "Ahmed", "Ali", "Mohammad", "Ibrahim", "Abdullah", "Khalid", "Samir",
  "Fatema", "Nadia", "Ayesha", "Hana", "Samira", "Amina", "Leila", "Yasmin", "Zainab", "Rania",
  "Ravi", "Deepak", "Arjun", "Vikram", "Anil", "Priya", "Anita", "Geeta", "Meena", "Lakshmi",
  "Sohel", "Hasan", "Nasir", "Kamal", "Iqbal", "Wahid", "Majid", "Rashid", "Tariq", "Sufia",
  "Jasmine", "Mehwish", "Salma", "Richa", "Divya", "Pooja", "Kiran", "Sneha", "Jahan", "Rashida"
];

// Fixed last names for customers
const LAST_NAMES = [
  "Khan", "Ahmed", "Hassan", "Ali", "Hossain", "Islam", "Rahman", "Begum", "Shah", "Malik",
  "Singh", "Kumar", "Patel", "Sharma", "Verma", "Gupta", "Nair", "Reddy", "Iyer", "Menon"
];

function generatePhone(): string {
  const prefixes = ["1711", "1712", "1713", "1714", "1715"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  return `+880-${prefix}-${number}`;
}

async function seedPermanentAccounts() {
  console.log("\n🌱 Seeding Permanent Accounts...\n");
  console.log("Creating: 4 Tenants, 1 Super Admin, 4 Support Agents, 250 Customers\n");

  try {
    const memStorage = storage as any;

    // Initialize role templates
    await initializeRoleTemplates();
    console.log("✓ Role templates initialized\n");

    // Clear existing data (optional - comment out if you want to keep existing data)
    // memStorage.tenants.clear();
    // memStorage.users.clear();
    // memStorage.customers.clear();
    // memStorage.tickets.clear();
    // memStorage.messages.clear();
    // console.log("✓ Cleared existing data\n");

    // Create tenants
    const tenantMap: Record<string, any> = {};
    console.log("📦 Creating Tenants...");
    
    for (const tenantConfig of TENANTS) {
      let tenant = await storage.getTenantByName(tenantConfig.name);
      
      if (!tenant) {
        tenant = await storage.createTenant({
          name: tenantConfig.name,
          slug: tenantConfig.name.toLowerCase().replace(/\s+/g, "-"),
          contactEmail: tenantConfig.email,
          status: "active",
          plan: "premium",
          settings: {
            branding: {},
            features: {
              voice: true,
              whatsapp: true,
              analytics: true,
              ai: true,
            },
            customFields: {},
            notificationChannels: ["email", "in_app"],
          },
          quotaMaxUsers: 1000,
          quotaMaxCustomers: 10000,
          quotaMaxStorage: 100000,
          quotaMaxApiCalls: 1000000,
          billingState: "active",
        });
        console.log(`  ✅ Created: ${tenantConfig.name}`);
      } else {
        console.log(`  ⏭️  Exists: ${tenantConfig.name}`);
      }
      tenantMap[tenantConfig.name] = tenant;
    }

    // Create system tenant for super admin
    let systemTenant = await storage.getTenantByName("System");
    if (!systemTenant) {
      systemTenant = await storage.createTenant({
        name: "System",
        slug: "system",
        contactEmail: "system@sohayota.com",
        status: "active",
        plan: "enterprise",
      });
    }

    // Create Super Admin
    console.log("\n👑 Creating Super Admin...");
    let superAdmin = await storage.getUserByEmail("superadmin@sohayota.com");
    if (!superAdmin) {
      superAdmin = await storage.createUser({
        name: "Super Admin",
        tenantId: systemTenant.id,
        email: "superadmin@sohayota.com",
        password: "demo123",
        role: "super_admin",
      } as any);
      (superAdmin as any).isSuperAdmin = true;
      console.log(`  ✅ Created: superadmin@sohayota.com / demo123`);
    } else {
      console.log(`  ⏭️  Exists: superadmin@sohayota.com`);
    }

    // Create Tenant Admins and Support Agents
    console.log("\n👥 Creating Tenant Admins and Support Agents...");
    const supportEmails = [
      "support@dhaka.com",
      "support@chittagong.com",
      "support@sylhet.com",
      "support@khulna.com",
    ];

    for (let i = 0; i < TENANTS.length; i++) {
      const tenant = tenantMap[TENANTS[i].name];
      
      // Create Tenant Admin
      let admin = await storage.getUserByEmail(TENANTS[i].email);
      if (!admin) {
        admin = await storage.createUser({
          name: `${TENANTS[i].name} Admin`,
          tenantId: tenant.id,
          email: TENANTS[i].email,
          password: "demo123",
          role: "tenant_admin",
        } as any);
        console.log(`  ✅ Created admin: ${TENANTS[i].email} / demo123`);
      } else {
        console.log(`  ⏭️  Admin exists: ${TENANTS[i].email}`);
      }

      // Create Support Agent
      let support = await storage.getUserByEmail(supportEmails[i]);
      if (!support) {
        support = await storage.createUser({
          name: `${TENANTS[i].name} Support`,
          tenantId: tenant.id,
          email: supportEmails[i],
          password: "demo123",
          role: "support_agent",
        } as any);
        console.log(`  ✅ Created support: ${supportEmails[i]} / demo123`);
      } else {
        console.log(`  ⏭️  Support exists: ${supportEmails[i]}`);
      }
    }

    // Create 250 Customers (distributed: 63, 63, 63, 61)
    console.log("\n👤 Creating 250 Customers...");
    const customersPerTenant = [63, 63, 63, 61]; // Total: 250
    let totalCreated = 0;

    for (let tenantIdx = 0; tenantIdx < TENANTS.length; tenantIdx++) {
      const tenant = tenantMap[TENANTS[tenantIdx].name];
      const numCustomers = customersPerTenant[tenantIdx];
      
      console.log(`\n  📍 ${TENANTS[tenantIdx].name} (${numCustomers} customers):`);

      for (let i = 0; i < numCustomers; i++) {
        const customerNum = totalCreated + i + 1;
        const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
        const lastName = LAST_NAMES[i % LAST_NAMES.length];
        
        // Fixed email format: firstname.lastname{number}@company.com
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${customerNum}@company.com`;
        const name = `${firstName} ${lastName}`;

        try {
          // Check if customer exists
          let customer = await storage.getCustomerByEmail(email);
          
          if (!customer) {
            customer = await storage.createCustomer({
              tenantId: tenant.id,
              name,
              email,
              phone: generatePhone(),
              company: `${TENANTS[tenantIdx].name} Customer ${customerNum}`,
              status: "active",
            });
          }

          // Create user account
          let user = await storage.getUserByEmail(email);
          if (!user) {
            await storage.createCustomerUser(
              tenant.id,
              customer.id,
              email,
              "demo123",
              name
            );
          } else if (user.role !== "customer" || (user as any).customerId !== customer.id || !user.passwordHash) {
            // Fix incorrect account
            memStorage.users.delete(user.id);
            await storage.createCustomerUser(
              tenant.id,
              customer.id,
              email,
              "demo123",
              name
            );
          }

          if ((i + 1) % 20 === 0 || i === 0) {
            console.log(`    ✅ ${i + 1}/${numCustomers}: ${email}`);
          }
        } catch (error: any) {
          if (!error.message?.includes("already exists")) {
            console.error(`    ❌ Error creating ${email}: ${error.message}`);
          }
        }
      }

      totalCreated += numCustomers;
      console.log(`  ✅ Completed: ${TENANTS[tenantIdx].name} - ${numCustomers} customers`);
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 SEEDING COMPLETE!");
    console.log("=".repeat(60));
    console.log(`✅ Tenants: ${TENANTS.length}`);
    console.log(`✅ Super Admin: 1`);
    console.log(`✅ Tenant Admins: ${TENANTS.length}`);
    console.log(`✅ Support Agents: ${TENANTS.length}`);
    console.log(`✅ Customers: 250`);
    console.log(`✅ Total Users: ${1 + TENANTS.length * 2 + 250} (1 super + ${TENANTS.length} admins + ${TENANTS.length} support + 250 customers)`);
    console.log("\n🔑 All passwords: demo123");
    console.log("\n📧 Sample Customer Emails:");
    console.log("   - rahim.khan1@company.com");
    console.log("   - fatema.khan2@company.com");
    console.log("   - karim.ahmed3@company.com");
    console.log("   - ... up to customer 250");
    console.log("\n🎉 Permanent accounts created successfully!\n");
  } catch (error: any) {
    console.error("❌ Error seeding:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

seedPermanentAccounts();

