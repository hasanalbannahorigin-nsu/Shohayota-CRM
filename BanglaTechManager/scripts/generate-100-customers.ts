/**
 * Script to generate 100 customer accounts with login credentials
 * Run with: npx tsx scripts/generate-100-customers.ts
 */

import { storage } from "../server/storage";
import { MemStorage } from "../server/storage";

const firstNames = [
  "Rahim", "Karim", "Hassan", "Ahmed", "Ali", "Mohammad", "Ibrahim", "Abdullah", "Khalid", "Samir",
  "Fatema", "Nadia", "Ayesha", "Hana", "Samira", "Amina", "Leila", "Yasmin", "Zainab", "Rania",
  "Ravi", "Deepak", "Arjun", "Vikram", "Anil", "Priya", "Anita", "Geeta", "Meena", "Lakshmi",
  "Sohel", "Hasan", "Nasir", "Kamal", "Iqbal", "Wahid", "Majid", "Rashid", "Tariq", "Samir",
  "Sufia", "Jasmine", "Mehwish", "Salma", "Richa", "Divya", "Pooja", "Kiran", "Sneha", "Riya",
  "Aman", "Rohan", "Siddharth", "Karan", "Rahul", "Vishal", "Aditya", "Sagar", "Nikhil", "Raj"
];

const lastNames = [
  "Khan", "Ahmed", "Hassan", "Ali", "Hossain", "Islam", "Rahman", "Begum", "Shah", "Malik",
  "Singh", "Kumar", "Patel", "Sharma", "Verma", "Gupta", "Nair", "Reddy", "Iyer", "Menon",
  "Chowdhury", "Miah", "Uddin", "Haque", "Sarkar", "Das", "Roy", "Biswas", "Dutta", "Bose"
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

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

interface CustomerCredential {
  email: string;
  password: string;
  name: string;
  tenant: string;
  customerId: string;
}

async function generate100Customers(): Promise<CustomerCredential[]> {
  const memStorage = storage as MemStorage;
  const credentials: CustomerCredential[] = [];

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
      // Create tenant if doesn't exist - use simpler method
      const newTenant = await memStorage.createTenant({
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
        quotaMaxUsers: 100,
        quotaMaxCustomers: 1000,
        quotaMaxStorage: 100,
        quotaMaxApiCalls: 10000,
        billingState: "trial",
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      tenant = newTenant;
    }
    tenants.push({ id: tenant.id, name: tenant.name });
  }

  // Generate 100 customers (25 per tenant)
  const customersPerTenant = 25;
  let customerNumber = 1;

  for (const tenant of tenants) {
    for (let i = 0; i < customersPerTenant; i++) {
      const firstName = getRandomElement(firstNames);
      const lastName = getRandomElement(lastNames);
      const name = `${firstName} ${lastName}`;
      
      // Generate unique email
      const emailBase = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${customerNumber}`;
      const domain = getRandomElement(domains);
      const email = `${emailBase}@${domain}`;
      
      // Use consistent password: customer123
      const password = "customer123";
      
      // Create customer
      const customer = await memStorage.createCustomer({
        tenantId: tenant.id,
        name,
        email,
        phone: generatePhone(),
        status: "active",
      });

      // Create user account for customer
      try {
        await memStorage.createCustomerUser(
          tenant.id,
          customer.id,
          email,
          password,
          name
        );

        credentials.push({
          email,
          password,
          name,
          tenant: tenant.name,
          customerId: customer.id,
        });

        customerNumber++;
      } catch (error: any) {
        console.error(`Failed to create user for ${email}: ${error.message}`);
      }
    }
  }

  return credentials;
}

async function main() {
  console.log("🚀 Generating 100 customer accounts...\n");
  
  try {
    const credentials = await generate100Customers();
    
    console.log(`\n✅ Successfully created ${credentials.length} customer accounts!\n`);
    console.log("=" .repeat(80));
    console.log("CUSTOMER LOGIN CREDENTIALS");
    console.log("=" .repeat(80));
    console.log("\nAll passwords: customer123\n");
    
    // Group by tenant
    const byTenant: Record<string, CustomerCredential[]> = {};
    for (const cred of credentials) {
      if (!byTenant[cred.tenant]) {
        byTenant[cred.tenant] = [];
      }
      byTenant[cred.tenant].push(cred);
    }

    // Print grouped by tenant
    for (const [tenant, creds] of Object.entries(byTenant)) {
      console.log(`\n${tenant} (${creds.length} customers):`);
      console.log("-".repeat(80));
      for (const cred of creds) {
        console.log(`  Email: ${cred.email.padEnd(40)} Password: ${cred.password}`);
      }
    }

    // Also save to file
    const fs = await import("fs");
    const path = await import("path");
    const outputPath = path.join(process.cwd(), "100-customer-credentials.txt");
    
    let output = "=".repeat(80) + "\n";
    output += "100 CUSTOMER LOGIN CREDENTIALS\n";
    output += "=".repeat(80) + "\n\n";
    output += "All passwords: customer123\n\n";
    
    for (const [tenant, creds] of Object.entries(byTenant)) {
      output += `\n${tenant} (${creds.length} customers):\n`;
      output += "-".repeat(80) + "\n";
      for (const cred of creds) {
        output += `Email: ${cred.email.padEnd(40)} Password: ${cred.password}\n`;
      }
    }
    
    fs.writeFileSync(outputPath, output);
    console.log(`\n\n✅ Credentials also saved to: ${outputPath}`);
    
  } catch (error: any) {
    console.error("❌ Error generating customers:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { generate100Customers };

