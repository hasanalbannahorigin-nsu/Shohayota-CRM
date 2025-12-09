/**
 * Test customer login directly via API
 */

const BASE_URL = "http://localhost:5000";

const testCustomers = [
  "rahim.khan1@company.com",
  "fatema.khan2@company.com",
  "karim.ahmed3@company.com",
  "sufia.begum9@company.com",
  "priya.sharma19@company.com",
];

async function testLogin(email: string, password: string) {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ ${email} - SUCCESS`);
      console.log(`   Role: ${data.user.role}`);
      console.log(`   Name: ${data.user.name}`);
      console.log(`   Tenant: ${data.user.tenantId}\n`);
      return true;
    } else {
      console.log(`❌ ${email} - FAILED`);
      console.log(`   Error: ${data.error || "Unknown error"}`);
      if (data.hint) {
        console.log(`   Hint: ${data.hint}`);
      }
      console.log();
      return false;
    }
  } catch (error: any) {
    console.log(`❌ ${email} - ERROR`);
    console.log(`   ${error.message}\n`);
    return false;
  }
}

async function main() {
  console.log("🧪 Testing Customer Logins\n");
  console.log(`Server: ${BASE_URL}\n`);

  // Check if server is running
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/health`);
    if (!healthCheck.ok) {
      console.log("❌ Server is not responding correctly");
      console.log("   Please start the server: npm run dev\n");
      process.exit(1);
    }
  } catch (error) {
    console.log("❌ Cannot connect to server");
    console.log("   Please start the server: npm run dev\n");
    process.exit(1);
  }

  console.log("✅ Server is running\n");
  console.log("Testing customer logins with password: demo123\n");
  console.log("─".repeat(60) + "\n");

  let successCount = 0;
  let failCount = 0;

  for (const email of testCustomers) {
    const success = await testLogin(email, "demo123");
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log("─".repeat(60));
  console.log(`\n📊 Results: ${successCount} successful, ${failCount} failed\n`);

  if (failCount > 0) {
    console.log("💡 If logins are failing, run:");
    console.log("   npx tsx fix-customer-login-now.ts\n");
  }
}

main().catch(console.error);

