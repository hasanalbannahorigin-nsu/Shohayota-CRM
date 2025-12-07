import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/stats-card";
import {
  Users,
  Ticket,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Clock,
  Smile,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Analytics {
  totalCustomers: number;
  activeCustomers: number;
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  highPriorityTickets: number;
  mediumPriorityTickets: number;
  averageResolutionTime: string;
  resolutionRate: number;
  customerGrowth: number;
  satisfactionRate: string;
  topAgent?: { name: string; closedTickets: number } | null;
  totalAgents: number;
  categoryBreakdown: { support: number; bug: number; feature: number };
  averageTicketsPerAgent: number;
}

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useQuery<Analytics>({
    queryKey: ["/api/analytics/stats"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">Analytics</h1>
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">Analytics</h1>
        <div className="text-center text-muted-foreground">
          Failed to load analytics
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Analytics & Reports</h1>
        <p className="text-muted-foreground mt-1">
          Performance metrics and insights for your CRM
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Customers"
          value={analytics.totalCustomers.toString()}
          icon={Users}
          trend={`${analytics.activeCustomers} active • +${analytics.customerGrowth}% growth`}
          data-testid="card-total-customers"
        />
        <StatsCard
          title="Open Tickets"
          value={analytics.openTickets.toString()}
          icon={Ticket}
          trend={`${analytics.highPriorityTickets} high • ${analytics.mediumPriorityTickets} medium`}
          data-testid="card-open-tickets"
        />
        <StatsCard
          title="Resolved Tickets"
          value={analytics.resolvedTickets.toString()}
          icon={CheckCircle}
          trend={`${analytics.totalTickets} total • ${analytics.resolutionRate}% rate`}
          data-testid="card-resolved-tickets"
        />
        <StatsCard
          title="Satisfaction Rate"
          value={analytics.satisfactionRate}
          icon={Smile}
          trend="Customer feedback"
          data-testid="card-satisfaction"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Avg Resolution Time</span>
                <span className="text-sm text-muted-foreground">
                  {analytics.averageResolutionTime}
                </span>
              </div>
              <div className="w-full bg-muted rounded h-2">
                <div className="bg-primary h-2 rounded w-3/4" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Resolution Rate</span>
                <span className="text-sm text-muted-foreground" data-testid="text-resolution-rate">
                  {analytics.resolutionRate}%
                </span>
              </div>
              <div className="w-full bg-muted rounded h-2">
                <div
                  className="bg-green-500 h-2 rounded"
                  style={{ width: `${analytics.resolutionRate}%` }}
                  data-testid="bar-resolution"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Avg Tickets per Agent</span>
                <span className="text-sm text-muted-foreground" data-testid="text-avg-tickets">
                  {analytics.averageTicketsPerAgent}
                </span>
              </div>
              <div className="w-full bg-muted rounded h-2">
                <div className="bg-blue-500 h-2 rounded w-3/4" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Customer Growth (MoM)</span>
                <span className="text-sm text-muted-foreground" data-testid="text-growth">
                  +{analytics.customerGrowth}%
                </span>
              </div>
              <div className="w-full bg-muted rounded h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded"
                  style={{ width: `${Math.min(analytics.customerGrowth * 5, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-accent/50 rounded-lg" data-testid="insight-resolution-time">
              <p className="text-sm font-medium">Avg Resolution Time</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.averageResolutionTime} per ticket
              </p>
            </div>

            <div className="p-3 bg-accent/50 rounded-lg" data-testid="insight-top-category">
              <p className="text-sm font-medium">Top Issue Category</p>
              <p className="text-xs text-muted-foreground mt-1">
                Support: {analytics.categoryBreakdown.support} | Bug: {analytics.categoryBreakdown.bug} | Feature: {analytics.categoryBreakdown.feature}
              </p>
            </div>

            <div className="p-3 bg-accent/50 rounded-lg" data-testid="insight-satisfaction">
              <p className="text-sm font-medium">Customer Satisfaction</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.satisfactionRate} satisfaction rate
              </p>
            </div>

            <div className="p-3 bg-accent/50 rounded-lg" data-testid="insight-top-agent">
              <p className="text-sm font-medium">Top Agent Performance</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.topAgent 
                  ? `${analytics.topAgent.name} closed ${analytics.topAgent.closedTickets} tickets`
                  : "No agents with closed tickets yet"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
