/**
 * Debug endpoint to generate 100 customer accounts
 * GET /api/debug/generate-100-customers
 */

import { Express, Request, Response } from "express";
import { storage } from "../storage";
import { MemStorage } from "../storage";

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

export function registerDebugCustomerRoutes(app: Express) {
  // Generate 100 customers endpoint
  app.get("/api/debug/generate-100-customers", async (req, res) => {
    try {
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
          // Create tenant if doesn't exist
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
            quotaMaxUsers: 100,
            quotaMaxCustomers: 1000,
            quotaMaxStorage: 100,
            quotaMaxApiCalls: 10000,
            billingState: "trial",
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          });
        }
        tenants.push({ id: tenant.id, name: tenant.name });
      }

      // Generate 150 customers (37-38 per tenant)
      // Use deterministic selection for consistent results
      const customersPerTenant = 38; // 38 per tenant = 152 total, we'll limit to 150
      let customerNumber = 1;
      let nameIndex = 0;

      let totalCreated = 0;
      const maxCustomers = 150;
      
      for (const tenant of tenants) {
        if (totalCreated >= maxCustomers) break;
        
        const remaining = maxCustomers - totalCreated;
        const toCreate = Math.min(customersPerTenant, remaining);
        
        for (let i = 0; i < toCreate; i++) {
          // Use deterministic selection for consistent results
          const firstName = firstNames[nameIndex % firstNames.length];
          const lastName = lastNames[Math.floor(nameIndex / firstNames.length) % lastNames.length];
          const name = `${firstName} ${lastName}`;
          
          // Generate unique email with customer number
          const emailBase = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${customerNumber}`;
          const domain = domains[customerNumber % domains.length];
          const email = `${emailBase}@${domain}`;
          
          // Use consistent password: customer123
          const password = "customer123";
          
          nameIndex++;
          
          try {
            // Check if customer already exists
            const existingUser = await memStorage.getUserByEmail(email);
            if (existingUser && existingUser.role === "customer") {
              // Customer already exists, skip but still add to credentials list
              credentials.push({
                email,
                password,
                name,
                tenant: tenant.name,
              });
              customerNumber++;
              continue;
            }

            // Create customer
            const customer = await memStorage.createCustomer({
              tenantId: tenant.id,
              name,
              email,
              phone: generatePhone(),
              status: "active",
            });

            // Create user account for customer
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
            });

            customerNumber++;
            totalCreated++;
            
            if (totalCreated >= maxCustomers) break;
          } catch (error: any) {
            console.error(`Failed to create customer ${email}: ${error.message}`);
            // Continue with next customer
          }
        }
      }

      res.json({
        success: true,
        message: `Generated ${credentials.length} customer accounts`,
        total: credentials.length,
        password: "customer123", // All use same password
        credentials: credentials,
        groupedByTenant: credentials.reduce((acc, cred) => {
          if (!acc[cred.tenant]) acc[cred.tenant] = [];
          acc[cred.tenant].push(cred);
          return acc;
        }, {} as Record<string, typeof credentials>),
      });
    } catch (error: any) {
      console.error("Error generating customers:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to generate customers",
      });
    }
  });
}

