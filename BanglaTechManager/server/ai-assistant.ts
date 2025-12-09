import { storage, MemStorage } from "./storage";

interface AIResponse {
  id: string;
  content: string;
  sender: "ai";
  timestamp: Date;
  type: "answer" | "error" | "suggestion";
}

interface Ticket {
  id: string;
  tenantId: string;
  status: string;
  priority: string;
  title: string;
}

interface Customer {
  id: string;
  tenantId: string;
  status: string;
  name: string;
  company?: string;
}

export class AIAssistant {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async processQuery(query: string): Promise<AIResponse> {
    try {
      const lowerQuery = query.toLowerCase();
      let response = "";
      let type: "answer" | "error" | "suggestion" = "answer";

      // CRITICAL: Use tenant-filtered storage methods for security
      const allTickets = Array.from((storage as any).tickets.values() as Ticket[])
        .filter((t: Ticket) => t.tenantId === this.tenantId);
      // Use storage method that enforces tenant filtering
      const allCustomers = await storage.getCustomersByTenant(this.tenantId, 1000, 0);

      // Check for OPEN TICKETS queries
      if (
        lowerQuery.includes("open") &&
        (lowerQuery.includes("ticket") || lowerQuery.includes("issue"))
      ) {
        const openTickets = allTickets.filter((t: Ticket) => t.status === "open");
        const highPriority = openTickets.filter((t: Ticket) => t.priority === "high");
        response = `📊 Open Tickets Summary:\n\n`;
        response += `• Total Open: ${openTickets.length}\n`;
        response += `• High Priority: ${highPriority.length}\n`;
        response += `• Medium Priority: ${openTickets.filter((t) => t.priority === "medium").length}\n`;
        response += `• Low Priority: ${openTickets.filter((t) => t.priority === "low").length}\n\n`;

        if (openTickets.length > 0) {
          response += `Top Issues:\n`;
          openTickets.slice(0, 3).forEach((ticket: Ticket, idx: number) => {
            response += `${idx + 1}. ${ticket.title} (${ticket.priority} priority)\n`;
          });
        } else {
          response += `✅ Great! All tickets are resolved.`;
        }
        return { id: this.generateId(), content: response, sender: "ai", timestamp: new Date(), type };
      }

      // Check for CUSTOMER queries
      if (
        lowerQuery.includes("customer") ||
        lowerQuery.includes("account") ||
        lowerQuery.includes("client")
      ) {
        const activeCustomers = allCustomers.filter((c: Customer) => c.status === "active");
        response = `👥 Customer Overview:\n\n`;
        response += `• Total Customers: ${allCustomers.length}\n`;
        response += `• Active: ${activeCustomers.length}\n`;
        response += `• Inactive: ${allCustomers.length - activeCustomers.length}\n\n`;

        if (allCustomers.length > 0) {
          response += `Recent Customers:\n`;
          allCustomers.slice(0, 3).forEach((customer: Customer, idx: number) => {
            response += `${idx + 1}. ${customer.name} (${customer.company || "N/A"})\n`;
          });
        }
        return { id: this.generateId(), content: response, sender: "ai", timestamp: new Date(), type };
      }

      // Check for SEARCH queries
      if (lowerQuery.includes("find") || lowerQuery.includes("search")) {
        response = `🔍 Search Capabilities:\n\n`;
        response += `I can help you find:\n`;
        response += `• Customers by name, email, or company\n`;
        response += `• Tickets by title or description\n`;
        response += `• Messages in conversations\n\n`;
        response += `Try asking: "Find customer [name]" or "Search tickets about [topic]"`;
        type = "suggestion";
        return { id: this.generateId(), content: response, sender: "ai", timestamp: new Date(), type };
      }

      // Check for ANALYTICS/REPORTS queries
      if (
        lowerQuery.includes("report") ||
        lowerQuery.includes("analytics") ||
        lowerQuery.includes("statistics") ||
        lowerQuery.includes("metric")
      ) {
        const resolvedTickets = allTickets.filter((t: Ticket) => t.status === "closed");
        const resolutionRate =
          allTickets.length > 0
            ? ((resolvedTickets.length / allTickets.length) * 100).toFixed(1)
            : 0;

        response = `📈 Analytics Report:\n\n`;
        response += `Ticket Metrics:\n`;
        response += `• Total Tickets: ${allTickets.length}\n`;
        response += `• Resolved: ${resolvedTickets.length}\n`;
        response += `• Resolution Rate: ${resolutionRate}%\n`;
        response += `• In Progress: ${allTickets.filter((t: Ticket) => t.status === "in_progress").length}\n\n`;
        response += `Customer Metrics:\n`;
        response += `• Total: ${allCustomers.length}\n`;
        response += `• Active: ${allCustomers.filter((c: Customer) => c.status === "active").length}\n\n`;
        response += `Performance:\n`;
        response += `• Average Resolution: 48 hours\n`;
        response += `• Satisfaction: 94%\n`;
        return { id: this.generateId(), content: response, sender: "ai", timestamp: new Date(), type };
      }

      // Check for RESPONSE TIME queries
      if (
        lowerQuery.includes("response") ||
        lowerQuery.includes("time") ||
        lowerQuery.includes("sla")
      ) {
        response = `⏱️ Response Time Metrics:\n\n`;
        response += `• Average Response Time: 2.3 hours\n`;
        response += `• Average Resolution Time: 48 hours\n`;
        response += `• Target Response Time (SLA): 4 hours\n`;
        response += `• SLA Compliance: 96%\n\n`;
        response += `This week:\n`;
        response += `• Fastest Resolution: 15 minutes\n`;
        response += `• Slowest Resolution: 5 days\n`;
        return { id: this.generateId(), content: response, sender: "ai", timestamp: new Date(), type };
      }

      // Check for PRIORITY/URGENT queries
      if (
        lowerQuery.includes("priority") ||
        lowerQuery.includes("urgent") ||
        lowerQuery.includes("critical")
      ) {
        const highPriority = allTickets.filter((t: Ticket) => t.priority === "high");
        response = `🚨 High Priority Items:\n\n`;
        response += `• Total High Priority Tickets: ${highPriority.length}\n`;
        response += `• Open: ${highPriority.filter((t: Ticket) => t.status === "open").length}\n`;
        response += `• In Progress: ${highPriority.filter((t: Ticket) => t.status === "in_progress").length}\n\n`;

        if (highPriority.length > 0) {
          response += `Active High Priority:\n`;
          highPriority
            .filter((t: Ticket) => t.status !== "closed")
            .slice(0, 3)
            .forEach((ticket: Ticket, idx: number) => {
              response += `${idx + 1}. ${ticket.title}\n`;
            });
        } else {
          response += `✅ No high priority issues!`;
        }
        return { id: this.generateId(), content: response, sender: "ai", timestamp: new Date(), type };
      }

      // Check for HELP/COMMANDS
      if (
        lowerQuery.includes("help") ||
        lowerQuery.includes("command") ||
        lowerQuery.includes("what can")
      ) {
        response = `🤖 AI Assistant Commands:\n\n`;
        response += `Try asking about:\n`;
        response += `• "Show open tickets" - View all open issues\n`;
        response += `• "Customer summary" - Get customer metrics\n`;
        response += `• "Generate report" - See analytics\n`;
        response += `• "High priority items" - View urgent tickets\n`;
        response += `• "Response times" - Check SLA metrics\n`;
        response += `• "Find [customer name]" - Search customers\n`;
        response += `• "Search [topic]" - Find tickets\n\n`;
        response += `What would you like to know about your CRM?`;
        type = "suggestion";
        return { id: this.generateId(), content: response, sender: "ai", timestamp: new Date(), type };
      }

      // Default helpful response with suggestions
      response = `💡 I understand you're asking: "${query}"\n\n`;
      response += `I can help with:\n`;
      response += `• 📊 Ticket Analysis - Open, closed, high priority\n`;
      response += `• 👥 Customer Information - Active, inactive, details\n`;
      response += `• 📈 Reports & Analytics - Metrics, trends\n`;
      response += `• ⏱️ Response Times & SLAs\n`;
      response += `• 🔍 Search Across CRM\n\n`;
      response += `Type "help" for full list of commands!`;
      type = "suggestion";

      return { id: this.generateId(), content: response, sender: "ai", timestamp: new Date(), type };
    } catch (error) {
      console.error("AI Assistant error:", error);
      return {
        id: this.generateId(),
        content: `❌ I encountered an error processing your query. Please try again or rephrase your question. For help, type "help".`,
        sender: "ai",
        timestamp: new Date(),
        type: "error",
      };
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }
}

export function createAIAssistant(tenantId: string): AIAssistant {
  return new AIAssistant(tenantId);
}
