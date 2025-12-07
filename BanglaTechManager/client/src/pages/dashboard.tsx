import { StatsCard } from "@/components/stats-card";
import { Users, Ticket, MessageSquare, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketCard } from "@/components/ticket-card";
import { NLQBox } from "@/components/nlq-box";
import { useQuery } from "@tanstack/react-query";
import type { Customer, Ticket as TicketType } from "@shared/schema";

export default function DashboardPage() {
  const { data: customers = [], isLoading: customersLoading } = useQuery<
    Customer[]
  >({
    queryKey: ["/api/customers"],
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<
    TicketType[]
  >({
    queryKey: ["/api/tickets"],
  });

  const openTickets = tickets.filter((t) => t.status === "open").length;
  const highPriorityCount = tickets.filter((t) => t.priority === "high").length;

  const recentTickets = tickets.slice(0, 3).map((ticket) => ({
    id: ticket.id.substring(0, 8),
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    createdAt: new Date(ticket.createdAt).toLocaleDateString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here's what's happening with your CRM.
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Customers"
          value={customers.length.toString()}
          icon={Users}
          trend={`${customers.filter((c) => c.status === "active").length} active`}
        />
        <StatsCard
          title="Open Tickets"
          value={openTickets.toString()}
          icon={Ticket}
          trend={`${highPriorityCount} high priority`}
        />
        <StatsCard
          title="Total Tickets"
          value={tickets.length.toString()}
          icon={MessageSquare}
          trend={`${tickets.filter((t) => t.status === "closed").length} resolved`}
        />
        <StatsCard
          title="Resolution Rate"
          value={
            tickets.length > 0
              ? (
                  (tickets.filter((t) => t.status === "closed").length /
                    tickets.length) *
                  100
                ).toFixed(0) + "%"
              : "0%"
          }
          icon={TrendingUp}
          trend="This month"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">New customers registered</p>
                    <p className="text-xs text-muted-foreground">
                      {customers.length} total customers on platform
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Tickets being processed</p>
                    <p className="text-xs text-muted-foreground">
                      {openTickets} open tickets requiring attention
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">System status</p>
                    <p className="text-xs text-muted-foreground">
                      All systems operational and running smoothly
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Recent Tickets</h2>
              {ticketsLoading ? (
                <div className="text-center p-4 text-muted-foreground">
                  Loading...
                </div>
              ) : recentTickets.length > 0 ? (
                recentTickets.map((ticket) => (
                  <TicketCard key={ticket.id} {...ticket} />
                ))
              ) : (
                <div className="text-center p-4 text-muted-foreground">
                  No tickets yet
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <NLQBox />
        </div>
      </div>
    </div>
  );
}
