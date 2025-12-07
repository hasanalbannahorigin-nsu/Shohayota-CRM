import bcrypt from "bcrypt";
import { storage, MemStorage } from "./storage";
import { initializeRoleTemplates } from "./role-service";

const SALT_ROUNDS = 10;

// Bangladeshi names and companies for realistic data
const firstNames = [
  "Rahim", "Karim", "Hassan", "Ahmed", "Ali", "Mohammad", "Ibrahim", "Abdullah", "Khalid", "Samir",
  "Fatema", "Nadia", "Ayesha", "Hana", "Samira", "Amina", "Leila", "Yasmin", "Zainab", "Rania",
  "Ravi", "Deepak", "Arjun", "Vikram", "Anil", "Priya", "Anita", "Geeta", "Meena", "Lakshmi",
  "Sohel", "Hasan", "Nasir", "Kamal", "Iqbal", "Wahid", "Majid", "Rashid", "Tariq", "Samir",
  "Sufia", "Jasmine", "Mehwish", "Salma", "Richa", "Priya", "Divya", "Pooja", "Kiran", "Sneha"
];

const lastNames = [
  "Khan", "Ahmed", "Hassan", "Ali", "Hossain", "Islam", "Rahman", "Begum", "Shah", "Malik",
  "Singh", "Kumar", "Patel", "Sharma", "Verma", "Gupta", "Nair", "Reddy", "Iyer", "Menon"
];

const companies = [
  "Dhaka Digital Solutions", "Chittagong Tech Hub", "Sylhet Software House", "Khulna IT Systems",
  "Rajshahi Digital", "Mymensingh Tech Services", "Barisal IT Consultancy", "Comilla Online",
  "Gazipur Tech Park", "Narayanganj Solutions", "Bogra Innovation Center", "Dinajpur Services",
  "Jessore Digital", "Jhenaidah Tech", "Faridpur Online", "Madaripur Services", "Tangail IT",
  "Pabna Solutions", "Sirajganj Tech", "Kishoreganj Digital", "Sherpur Online", "Netrokona IT",
  "Habiganj Tech", "Moulvibazar Services", "Sunamganj Digital", "Brahmanbaria Online"
];

const issueTypes = [
  "Email notification not working",
  "Login timeout issues",
  "Dashboard performance slow",
  "Data export failing",
  "Mobile app crashes",
  "Report generation error",
  "User permission issues",
  "API integration problem",
  "Password reset not working",
  "Account synchronization issue",
  "Calendar sync error",
  "File upload failed",
  "Search functionality broken",
  "Notification settings not saving",
  "Two-factor authentication error",
  "Database connection timeout",
  "Backup restoration failed",
  "User profile update issue",
  "Invoice generation error",
  "Subscription renewal problem"
];

const issueDescriptions = [
  "Customer unable to complete action",
  "Feature is not functioning as expected",
  "Performance degradation observed",
  "Integration with third-party service failed",
  "Urgent: Customer is blocked from working",
  "System showing error message",
  "Data inconsistency detected",
  "Service unavailable in certain regions",
  "Configuration needs adjustment",
  "Version compatibility issue"
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

export async function initializeStorage() {
  console.log("⚙️  Initializing storage...");

  try {
    const memStorage = storage as MemStorage;
    
    // Initialize role templates first
    await initializeRoleTemplates();
    console.log("✓ Role templates initialized");
    
    // Check if already seeded
    if (memStorage.users.size > 0) {
      console.log("✓ Storage already initialized");
      return;
    }

    // Define multiple tenants with different companies
    const tenantConfigs = [
      { name: "Dhaka Tech Solutions", email: "admin@dhakatech.com", city: "Dhaka" },
      { name: "Chittagong Tech Hub", email: "admin@chittagong.tech.com", city: "Chittagong" },
      { name: "Sylhet Software House", email: "admin@sylhet.software.com", city: "Sylhet" },
      { name: "Khulna IT Systems", email: "admin@khulna.it.com", city: "Khulna" },
    ];

    const statuses: ("active" | "inactive")[] = ["active", "inactive"];
    const priorities: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
    const ticketStatuses: ("open" | "in_progress" | "closed")[] = ["open", "in_progress", "closed"];
    const categories: ("bug" | "feature" | "support")[] = ["bug", "feature", "support"];

    let totalCustomersCreated = 0;
    const customersPerTenant = 38; // 150 / 4 = 37.5, round to 38 for first 3, 36 for last

    // Create tenants and their data
    for (let t = 0; t < tenantConfigs.length; t++) {
      const tenantConfig = tenantConfigs[t];
      
      // Create tenant
      const slug = tenantConfig.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 100);
      const tenant = await memStorage.createTenant({
        name: tenantConfig.name,
        slug: slug,
        contactEmail: tenantConfig.email,
      });

      // Create users for this tenant
      const adminUser = await memStorage.createUser({
        name: `Admin ${tenantConfig.city}`,
        tenantId: tenant.id,
        email: tenantConfig.email,
        password: "demo123",
        role: "tenant_admin",
      } as any);

      const supportUser = await memStorage.createUser({
        name: `Support ${tenantConfig.city}`,
        tenantId: tenant.id,
        email: `support@${tenantConfig.city.toLowerCase()}.com`,
        password: "demo123",
        role: "support_agent",
      } as any);

      // Create customers for this tenant
      const numCustomers = t === tenantConfigs.length - 1 ? 36 : customersPerTenant;
      const createdCustomers = [];

      for (let i = 1; i <= numCustomers; i++) {
        const firstName = getRandomElement(firstNames);
        const lastName = getRandomElement(lastNames);
        const company = getRandomElement(companies);
        
        const customer = await memStorage.createCustomer({
          tenantId: tenant.id,
          name: `${firstName} ${lastName}`,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${totalCustomersCreated + i}@company.com`,
          phone: generatePhone(),
          company: `${company} (${tenantConfig.city} Div ${i % 5 + 1})`,
          status: getRandomElement(statuses),
        });
        createdCustomers.push(customer);
      }

      // Create tickets for each customer
      for (let i = 0; i < createdCustomers.length; i++) {
        const customer = createdCustomers[i];
        
        // First ticket
        await memStorage.createTicket({
          tenantId: tenant.id,
          customerId: customer.id,
          title: getRandomElement(issueTypes),
          description: getRandomElement(issueDescriptions),
          status: getRandomElement(ticketStatuses),
          priority: getRandomElement(priorities),
          category: getRandomElement(categories),
          createdBy: i % 2 === 0 ? adminUser.id : supportUser.id,
        });

        // Second ticket for some customers (70% chance)
        if (Math.random() < 0.7) {
          await memStorage.createTicket({
            tenantId: tenant.id,
            customerId: customer.id,
            title: getRandomElement(issueTypes),
            description: getRandomElement(issueDescriptions),
            status: getRandomElement(ticketStatuses),
            priority: getRandomElement(priorities),
            category: getRandomElement(categories),
            createdBy: i % 2 === 1 ? adminUser.id : supportUser.id,
          });
        }
      }

      totalCustomersCreated += numCustomers;
    }

    // Create super-admin user (no tenant_id for super-admin)
    // Note: For super-admin, we need to create a dummy tenant or handle null tenantId
    // Let's create a system tenant for super-admin
    const systemTenant = await memStorage.createTenant({
      name: "System",
      slug: "system",
      contactEmail: "system@sohayota.com",
    });

    const superAdminUser = await memStorage.createUser({
      name: "Super Admin",
      tenantId: systemTenant.id, // Super-admin still needs a tenantId for schema, but we'll handle it in auth
      email: "superadmin@sohayota.com",
      password: "demo123",
      role: "super_admin",
    } as any);

    // Store super-admin flag in user metadata (hack for in-memory storage)
    (superAdminUser as any).isSuperAdmin = true;

    console.log("✓ Storage initialized with 150 customers across 4 tenants");
    console.log(`✓ Total customers: 150`);
    console.log(`✓ Total tenants: 4`);
    console.log(`✓ Total service tickets: ~250-350`);
    console.log("✓ Login credentials:");
    console.log("  Tenant 1: admin@dhakatech.com / demo123");
    console.log("  Tenant 2: admin@chittagong.tech.com / demo123");
    console.log("  Tenant 3: admin@sylhet.software.com / demo123");
    console.log("  Tenant 4: admin@khulna.it.com / demo123");
    console.log("  Super Admin: superadmin@sohayota.com / demo123");
  } catch (error) {
    console.error("❌ Error initializing storage:", error);
    throw error;
  }
}
