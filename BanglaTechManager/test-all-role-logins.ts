/**
 * Test all role-based logins programmatically
 * This script tests login for all user roles in the system
 */

import { storage } from "./server/storage.js";

const BASE_URL = "http://localhost:5000";

interface LoginCredential {
  email: string;
  password: string;
  role: string;
  tenant?: string;
  description: string;
}

const credentials: LoginCredential[] = [
  // Super Admin
  {
    email: "superadmin@sohayota.com",
    password: "demo123",
    role: "super_admin",
    description: "Super Administrator - Full system access",
  },
  // Tenant Admins
  {
    email: "admin@dhakatech.com",
    password: "demo123",
    role: "tenant_admin",
    tenant: "Dhaka Tech Solutions",
    description: "Tenant Admin - Dhaka Tech Solutions",
  },
  {
    email: "admin@chittagong.tech.com",
    password: "demo123",
    role: "tenant_admin",
    tenant: "Chittagong Tech Hub",
    description: "Tenant Admin - Chittagong Tech Hub",
  },
  {
    email: "admin@sylhet.software.com",
    password: "demo123",
    role: "tenant_admin",
    tenant: "Sylhet Software House",
    description: "Tenant Admin - Sylhet Software House",
  },
  {
    email: "admin@khulna.it.com",
    password: "demo123",
    role: "tenant_admin",
    tenant: "Khulna IT Systems",
    description: "Tenant Admin - Khulna IT Systems",
  },
  // Support Agents
  {
    email: "support@dhaka.com",
    password: "demo123",
    role: "support_agent",
    tenant: "Dhaka Tech Solutions",
    description: "Support Agent - Dhaka Tech Solutions",
  },
  {
    email: "support@chittagong.com",
    password: "demo123",
    role: "support_agent",
    tenant: "Chittagong Tech Hub",
    description: "Support Agent - Chittagong Tech Hub",
  },
  {
    email: "support@sylhet.com",
    password: "demo123",
    role: "support_agent",
    tenant: "Sylhet Software House",
    description: "Support Agent - Sylhet Software House",
  },
  {
    email: "support@khulna.com",
    password: "demo123",
    role: "support_agent",
    tenant: "Khulna IT Systems",
    description: "Support Agent - Khulna IT Systems",
  },
  // Sample Customers
  {
    email: "rahim.khan1@company.com",
    password: "demo123",
    role: "customer",
    tenant: "Dhaka Tech Solutions",
    description: "Customer - Rahim Khan (Dhaka Tech)",
  },
  {
    email: "fatema.khan2@company.com",
    password: "demo123",
    role: "customer",
    tenant: "Dhaka Tech Solutions",
    description: "Customer - Fatema Khan (Dhaka Tech)",
  },
  {
    email: "priya.sharma19@company.com",
    password: "demo123",
    role: "customer",
    tenant: "Chittagong Tech Hub",
    description: "Customer - Priya Sharma (Chittagong)",
  },
  {
    email: "majid.hassan85@company.com",
    password: "demo123",
    role: "customer",
    tenant: "Sylhet Software House",
    description: "Customer - Majid Hassan (Sylhet)",
  },
];

async function testLogin(credential: LoginCredential): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: credential.email,
        password: credential.password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.log(`  ❌ Failed: ${error.error || "Unknown error"}`);
      return false;
    }

    const data = await response.json();
    
    // Verify role matches
    if (data.user.role !== credential.role) {
      console.log(`  ⚠️  Role mismatch: expected ${credential.role}, got ${data.user.role}`);
      return false;
    }

    // Verify tenant if specified
    if (credential.tenant && data.user.tenantName !== credential.tenant) {
      console.log(`  ⚠️  Tenant mismatch: expected ${credential.tenant}, got ${data.user.tenantName}`);
      return false;
    }

    console.log(`  ✅ Success! Role: ${data.user.role}, Tenant: ${data.user.tenantName || "N/A"}`);
    return true;
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function testAllLogins() {
  console.log("\n" + "=".repeat(70));
  console.log("  TESTING ALL ROLE-BASED LOGINS");
  console.log("=".repeat(70) + "\n");

  console.log(`Testing ${credentials.length} login credentials...\n`);
  console.log(`Server URL: ${BASE_URL}\n`);

  let successCount = 0;
  let failCount = 0;

  // Group by role
  const byRole: Record<string, LoginCredential[]> = {};
  for (const cred of credentials) {
    if (!byRole[cred.role]) {
      byRole[cred.role] = [];
    }
    byRole[cred.role].push(cred);
  }

  // Test each role group
  for (const [role, creds] of Object.entries(byRole)) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`  ${role.toUpperCase().replace("_", " ")} (${creds.length} accounts)`);
    console.log("─".repeat(70));

    for (const cred of creds) {
      console.log(`\n📧 ${cred.email}`);
      console.log(`   ${cred.description}`);
      const success = await testLogin(cred);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("  SUMMARY");
  console.log("=".repeat(70));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total: ${credentials.length}`);
  console.log(`📈 Success Rate: ${((successCount / credentials.length) * 100).toFixed(1)}%`);
  console.log("=".repeat(70) + "\n");

  if (failCount === 0) {
    console.log("🎉 All logins successful!");
  } else {
    console.log("⚠️  Some logins failed. Check the errors above.");
  }
}

// Check if server is running
async function checkServer(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    try {
      // Try a simple GET to root
      const response = await fetch(BASE_URL, { method: "GET" });
      return response.status !== 0;
    } catch {
      return false;
    }
  }
}

async function main() {
  console.log("\n🔍 Checking if server is running...");
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log("\n❌ Server is not running!");
    console.log("   Please start the server first:");
    console.log("   cd BanglaTechManager");
    console.log("   npm run dev\n");
    process.exit(1);
  }

  console.log("✅ Server is running!\n");
  await testAllLogins();
}

main().catch(console.error);

