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
          <TabsTrigger value="all" data-testid="tab-all">
            All Tickets
          </TabsTrigger>
          <TabsTrigger value="open" data-testid="tab-open">
            Open
          </TabsTrigger>
          <TabsTrigger value="in_progress" data-testid="tab-in-progress">
            In Progress
          </TabsTrigger>
          <TabsTrigger value="closed" data-testid="tab-closed">
            Closed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-6">
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">Loading tickets...</div>
          ) : tickets && tickets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tickets.map((ticket) => (
                <TicketCard key={ticket.id} {...formatTicketForCard(ticket)} />
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-muted-foreground">No tickets found</div>
          )}
        </TabsContent>

        <TabsContent value="open" className="space-y-4 mt-6">
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">Loading tickets...</div>
          ) : tickets && tickets.filter((t) => t.status === "open").length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tickets
                .filter((t) => t.status === "open")
                .map((ticket) => (
                  <TicketCard key={ticket.id} {...formatTicketForCard(ticket)} />
                ))}
            </div>
          ) : (
            <div className="text-center p-8 text-muted-foreground">No open tickets</div>
          )}
        </TabsContent>

        <TabsContent value="in_progress" className="space-y-4 mt-6">
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">Loading tickets...</div>
          ) : tickets && tickets.filter((t) => t.status === "in_progress").length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tickets
                .filter((t) => t.status === "in_progress")
                .map((ticket) => (
                  <TicketCard key={ticket.id} {...formatTicketForCard(ticket)} />
                ))}
            </div>
          ) : (
            <div className="text-center p-8 text-muted-foreground">No tickets in progress</div>
          )}
        </TabsContent>

        <TabsContent value="closed" className="space-y-4 mt-6">
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">Loading tickets...</div>
          ) : tickets && tickets.filter((t) => t.status === "closed").length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tickets
                .filter((t) => t.status === "closed")
                .map((ticket) => (
                  <TicketCard key={ticket.id} {...formatTicketForCard(ticket)} />
                ))}
            </div>
          ) : (
            <div className="text-center p-8 text-muted-foreground">No closed tickets</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
