/**
 * Script to automatically create 150 customer accounts
 * Run with: npx tsx scripts/create-150-customers.ts
 */

import { storage } from "../server/storage";
import { MemStorage } from "../server/storage";
import fs from "fs";
import path from "path";

const firstNames = [
  "Rahim", "Karim", "Hassan", "Ahmed", "Ali", "Mohammad", "Ibrahim", "Abdullah", "Khalid", "Samir",
  "Fatema", "Nadia", "Ayesha", "Hana", "Samira", "Amina", "Leila", "Yasmin", "Zainab", "Rania",
  "Ravi", "Deepak", "Arjun", "Vikram", "Anil", "Priya", "Anita", "Geeta", "Meena", "Lakshmi",
  "Sohel", "Hasan", "Nasir", "Kamal", "Iqbal", "Wahid", "Majid", "Rashid", "Tariq", "Samir",
  "Sufia", "Jasmine", "Mehwish", "Salma", "Richa", "Divya", "Pooja", "Kiran", "Sneha", "Riya",
  "Aman", "Rohan", "Siddharth", "Karan", "Rahul", "Vishal", "Aditya", "Sagar", "Nikhil", "Raj",
  "Arif", "Bashar", "Chowdhury", "Dilip", "Emon", "Fahim", "Golam", "Habib", "Imran", "Jamil",
  "Kabir", "Liton", "Mamun", "Nazrul", "Omar", "Parvez", "Qadir", "Rafiq", "Sajid", "Tanvir"
];

const lastNames = [
  "Khan", "Ahmed", "Hassan", "Ali", "Hossain", "Islam", "Rahman", "Begum", "Shah", "Malik",
  "Singh", "Kumar", "Patel", "Sharma", "Verma", "Gupta", "Nair", "Reddy", "Iyer", "Menon",
  "Chowdhury", "Miah", "Uddin", "Haque", "Sarkar", "Das", "Roy", "Biswas", "Dutta", "Bose",
  "Alam", "Bhuiyan", "Chakraborty", "Dey", "Ghosh", "Hossain", "Jahan", "Khatun", "Mondal", "Nath"
];

const domains = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "mail.com",
  "company.com", "business.com", "corp.com", "enterprise.com", "org.com"
];

function generatePhone(): string {
  const prefixes = ["1711", "1712", "1713", "1714", "1715", "1716", "1717", "1718", "1719"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  return `+880-${prefix}-${number}`;
}

async function create150Customers() {
  const memStorage = storage as MemStorage;
  const credentials: Array<{ email: string; password: string; name: string; tenant: string }> = [];

  // Get or create tenants
  const tenantConfigs = [
    { name: "Dhaka Tech Solutions", email: "admin@dhakatech.com" },
    { name: "Chittagong Tech Hub", email: "admin@chittagong.tech.com" },
    { name: "Sylhet Software House", email: "admin@sylhet.software.com" },
    { name: "Khulna IT Systems", email: "admin@khulna.it.com" },
  ];

  const tenants: { id: string; name: string }[] = [];
  
  for (const config of tenantConfigs) {
    let tenant = await memStorage.getTenantByName(config.name);
    if (!tenant) {
      tenant = await memStorage.createTenant({
        name: config.name,
        contactEmail: config.email,
        slug: config.name.toLowerCase().replace(/\s+/g, "-"),
        status: "active",
        plan: "basic",
        settings: {
          branding: {},
          features: { voice: true, whatsapp: false, analytics: true, ai: true },
          customFields: {},
          notificationChannels: ["email", "in_app"],
        },
        quotaMaxUsers: 200,
        quotaMaxCustomers: 1000,
        quotaMaxStorage: 100,
        quotaMaxApiCalls: 10000,
        billingState: "trial",
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }
    tenants.push({ id: tenant.id, name: tenant.name });
  }

  // Generate 150 customers (38 per tenant, last tenant gets 36)
  const customersPerTenant = 38;
  let customerNumber = 1;
  let nameIndex = 0;
  let totalCreated = 0;
  const maxCustomers = 150;

  for (const tenant of tenants) {
    if (totalCreated >= maxCustomers) break;
    
    const remaining = maxCustomers - totalCreated;
    const toCreate = Math.min(customersPerTenant, remaining);
    
    for (let i = 0; i < toCreate; i++) {
      const firstName = firstNames[nameIndex % firstNames.length];
      const lastName = lastNames[Math.floor(nameIndex / firstNames.length) % lastNames.length];
      const name = `${firstName} ${lastName}`;
      
      const emailBase = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${customerNumber}`;
      const domain = domains[customerNumber % domains.length];
      const email = `${emailBase}@${domain}`;
      
      const password = "customer123";
      
      nameIndex++;
      
      try {
        const existingUser = await memStorage.getUserByEmail(email);
        if (existingUser && existingUser.role === "customer") {
          credentials.push({ email, password, name, tenant: tenant.name });
          customerNumber++;
          totalCreated++;
          continue;
        }

        const customer = await memStorage.createCustomer({
          tenantId: tenant.id,
          name,
          email,
          phone: generatePhone(),
          status: "active",
        });

        await memStorage.createCustomerUser(
          tenant.id,
          customer.id,
          email,
          password,
          name
        );

        credentials.push({ email, password, name, tenant: tenant.name });
        customerNumber++;
        totalCreated++;
        
        if (totalCreated % 10 === 0) {
          console.log(`✓ Created ${totalCreated}/150 customers...`);
        }
      } catch (error: any) {
        console.error(`Failed to create ${email}: ${error.message}`);
        customerNumber++;
        nameIndex++;
      }
    }
  }

  return credentials;
}

async function main() {
  console.log("🚀 Creating 150 customer accounts...\n");
  
  try {
    const credentials = await create150Customers();
    
    console.log(`\n✅ Successfully created ${credentials.length} customer accounts!\n`);
    
    // Group by tenant
    const byTenant: Record<string, typeof credentials> = {};
    for (const cred of credentials) {
      if (!byTenant[cred.tenant]) {
        byTenant[cred.tenant] = [];
      }
      byTenant[cred.tenant].push(cred);
    }

    // Save to file
    let output = "=".repeat(80) + "\n";
    output += "150 CUSTOMER LOGIN CREDENTIALS\n";
    output += "=".repeat(80) + "\n\n";
    output += "ALL PASSWORDS: customer123\n\n";
    
    for (const [tenant, creds] of Object.entries(byTenant)) {
      output += `\n${tenant} (${creds.length} customers):\n`;
      output += "-".repeat(80) + "\n";
      for (const cred of creds) {
        output += `Email: ${cred.email.padEnd(45)} Password: ${cred.password}\n`;
      }
    }
    
    const outputPath = path.join(process.cwd(), "150-customer-credentials.txt");
    fs.writeFileSync(outputPath, output);
    
    // Also create JSON file
    const jsonPath = path.join(process.cwd(), "150-customer-credentials.json");
    fs.writeFileSync(jsonPath, JSON.stringify({
      total: credentials.length,
      password: "customer123",
      credentials: credentials,
      groupedByTenant: byTenant
    }, null, 2));
    
    console.log("=".repeat(80));
    console.log("CUSTOMER LOGIN CREDENTIALS");
    console.log("=".repeat(80));
    console.log("\nALL PASSWORDS: customer123\n");
    
    for (const [tenant, creds] of Object.entries(byTenant)) {
      console.log(`\n${tenant} (${creds.length} customers):`);
      console.log("-".repeat(80));
      for (const cred of creds) {
        console.log(`  ${cred.email.padEnd(45)} ${cred.password}`);
      }
    }
    
    console.log(`\n\n✅ Credentials saved to:`);
    console.log(`   - ${outputPath}`);
    console.log(`   - ${jsonPath}`);
    
  } catch (error: any) {
    console.error("❌ Error creating customers:", error);
    process.exit(1);
  }
}

// Run if executed directly
main().catch(console.error);

export { create150Customers };

