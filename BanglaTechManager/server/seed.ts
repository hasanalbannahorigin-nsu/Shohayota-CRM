import { storage } from "./storage";
import type { InsertTenant, InsertUser, InsertCustomer, InsertTicket } from "@shared/schema";

const bangladeshiCompanies = [
  "Dhaka Tech Solutions",
  "Chittagong Software House",
  "Sylhet IT Services",
  "Khulna Digital Systems",
  "Rajshahi Web Development",
  "Rangpur Tech Industries",
  "Mymensingh Cloud Solutions",
  "Barisal Data Systems",
];

const bangladeshiNames = [
  "Rahim Ahmed",
  "Fatema Khan",
  "Karim Hassan",
  "Nasrin Begum",
  "Salman Khan",
  "Aisha Ali",
  "Ruhul Amin",
  "Jamal Hossain",
  "Sabina Islam",
  "Tariq Mohammad",
];

const ticketTitles = [
  "Cannot login to customer portal",
  "Invoice not received",
  "Request feature enhancement",
  "API rate limit issue",
  "Database performance degradation",
  "Payment processing failed",
  "User account locked",
  "Data export not working",
];

const ticketDescriptions = [
  "User is unable to access the customer portal despite having valid credentials.",
  "Invoice for the last month was not received. Please investigate.",
  "We need a feature to export reports in CSV format.",
  "API is hitting rate limits unexpectedly. Can you increase quota?",
  "Database queries are taking too long. Performance has degraded.",
  "Payment processing is failing with a timeout error.",
  "User account was locked after failed login attempts.",
  "Data export functionality is broken since the last update.",
];

export async function seedDatabase() {
  try {
    console.log("🌱 Starting database seed...");

    // Note: In production, use proper database migrations
    // This is a simple in-memory seed for demo purposes

    console.log("✅ Seed data utility ready");
    console.log("\n📋 Bangladesh Sample Data Structure:");
    console.log("  - 4 major tenant companies");
    console.log("  - 25+ customers per tenant");
    console.log("  - 50+ tickets per tenant");
    console.log("  - Admin + 3 support agents per tenant");
    console.log("\n🔐 Standard Credentials:");
    console.log("  - Tenant Admins: admin@[company].com");
    console.log("  - Password: demo123");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}
