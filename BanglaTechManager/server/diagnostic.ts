import { storage } from "./storage";

export async function diagnoseCustomerLogin(email: string) {
  const memStorage = storage as any;
  const normalizedEmail = email.toLowerCase().trim();
  
  const diagnostics = {
    email: email,
    normalizedEmail: normalizedEmail,
    customer: null as any,
    user: null as any,
    issues: [] as string[],
    recommendations: [] as string[],
  };

  // Check if customer exists
  const allCustomers = Array.from(memStorage.customers?.values() || []);
  diagnostics.customer = allCustomers.find(
    (c: any) => c.email?.toLowerCase().trim() === normalizedEmail
  );

  if (!diagnostics.customer) {
    diagnostics.issues.push(`No customer found with email: ${email}`);
    // Try to find similar emails
    const similarEmails = allCustomers
      .filter((c: any) => {
        const cEmail = (c.email || "").toLowerCase().trim();
        return cEmail.includes(normalizedEmail.split("@")[0]) || 
               normalizedEmail.includes(cEmail.split("@")[0]);
      })
      .slice(0, 5)
      .map((c: any) => c.email);
    
    if (similarEmails.length > 0) {
      diagnostics.recommendations.push(
        `Did you mean one of these? ${similarEmails.join(", ")}`
      );
    }
    return diagnostics;
  }

  // Check if user account exists
  diagnostics.user = await storage.getUserByEmail(normalizedEmail);
  
  if (!diagnostics.user) {
    diagnostics.issues.push(`No user account found for customer email: ${email}`);
    diagnostics.recommendations.push(
      `User account needs to be created. Customer ID: ${diagnostics.customer.id}`
    );
  } else {
    // Check if user has passwordHash
    if (!diagnostics.user.passwordHash) {
      diagnostics.issues.push(`User account exists but has no password hash`);
      diagnostics.recommendations.push(`Password hash needs to be set`);
    }
    
    // Check if user role is customer
    if (diagnostics.user.role !== "customer") {
      diagnostics.issues.push(
        `User account exists but role is "${diagnostics.user.role}" not "customer"`
      );
    }
    
    // Check if customerId matches
    if ((diagnostics.user as any).customerId !== diagnostics.customer.id) {
      diagnostics.issues.push(
        `User account customerId (${(diagnostics.user as any).customerId}) doesn't match customer ID (${diagnostics.customer.id})`
      );
    }
  }

  // Check tenant match
  if (diagnostics.customer && diagnostics.user) {
    if (diagnostics.customer.tenantId !== diagnostics.user.tenantId) {
      diagnostics.issues.push(
        `Customer tenant (${diagnostics.customer.tenantId}) doesn't match user tenant (${diagnostics.user.tenantId})`
      );
    }
  }

  return diagnostics;
}

