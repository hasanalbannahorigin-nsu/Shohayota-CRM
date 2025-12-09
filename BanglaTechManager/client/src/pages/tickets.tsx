import { useState } from "react";
import { useLocation } from "wouter";
import { TicketCard } from "@/components/ticket-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import type { Ticket } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { AddTicketDialog } from "./tickets-form";

export default function TicketsPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("all");

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  const tabs: { value: string; label: string }[] = [
    { value: "all", label: "All Tickets" },
    { value: "new", label: "New" },
    { value: "open", label: "Open" },
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In Progress" },
    { value: "resolved", label: "Resolved" },
    { value: "closed", label: "Closed" },
  ];

  const filtered = (status: string | "all") => {
    if (!tickets) return [];
    if (status === "all") return tickets;
    return tickets.filter((t) => t.status === status);
  };

  const formatTicketForCard = (ticket: Ticket) => ({
    id: ticket.id.substring(0, 8),
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    assignee: undefined,
    createdAt: formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true }),
    onClick: () => {
      navigate(`/tickets/detail?id=${ticket.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Tickets</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage customer support tickets
          </p>
        </div>
        <AddTicketDialog />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              data-testid={`tab-${tab.value}`}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-4 mt-6">
            {isLoading ? (
              <div className="text-center p-8 text-muted-foreground">Loading tickets...</div>
            ) : filtered(tab.value as any).length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filtered(tab.value as any).map((ticket) => (
                  <TicketCard key={ticket.id} {...formatTicketForCard(ticket)} />
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                {tab.value === "all" ? "No tickets found" : `No ${tab.label.toLowerCase()} tickets`}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
