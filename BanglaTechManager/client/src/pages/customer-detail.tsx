import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Phone, Mail, Building, Tag, Clock, Ticket, PhoneCall } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import type { Customer } from "@shared/schema";

interface Activity {
  id: string;
  type: "ticket" | "call" | "message" | "note";
  title: string;
  description: string;
  timestamp: string;
}

export default function CustomerDetailPage() {
  const [, navigate] = useLocation();
  const customerId = new URLSearchParams(window.location.search).get("id") || "";

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ["/api/customers", customerId],
    enabled: !!customerId,
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/customers", customerId, "timeline"],
    enabled: !!customerId,
  });

  const { data: tickets = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "tickets"],
    enabled: !!customerId,
  });

  const { data: calls = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "calls"],
    enabled: !!customerId,
  });

  if (isLoading) {
    return <div className="p-6">Loading customer...</div>;
  }

  if (!customer) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/customers")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        <div className="text-center py-8 text-muted-foreground">Customer not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate("/customers")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Customers
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{customer.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Customer ID: {customer.id.substring(0, 8)}
                  </p>
                </div>
                <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                  {customer.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{customer.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{customer.phone || "N/A"}</span>
                </div>
                {(customer as any).companyName && (
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{(customer as any).companyName}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="timeline" className="space-y-4">
            <TabsList>
              <TabsTrigger value="timeline">
                <Clock className="h-4 w-4 mr-2" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="tickets">
                <Ticket className="h-4 w-4 mr-2" />
                Tickets ({tickets.length})
              </TabsTrigger>
              <TabsTrigger value="calls">
                <PhoneCall className="h-4 w-4 mr-2" />
                Calls ({calls.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  {activities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No activity yet
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activities.map((activity) => (
                        <div key={activity.id} className="flex gap-4 pb-4 border-b last:border-0">
                          <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{activity.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {activity.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {activity.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(activity.timestamp), "MMM d, yyyy HH:mm")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tickets" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  {tickets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No tickets for this customer
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="p-3 border rounded-lg hover:bg-muted cursor-pointer"
                          onClick={() => navigate(`/tickets/detail?id=${ticket.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{ticket.title}</span>
                            <Badge variant="outline">{ticket.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {ticket.description?.substring(0, 100)}...
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calls" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  {calls.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No calls for this customer
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {calls.map((call) => (
                        <div key={call.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <PhoneCall className="h-4 w-4" />
                              <span className="font-medium">{call.direction || "Call"}</span>
                            </div>
                            <Badge variant="outline">{call.status}</Badge>
                          </div>
                          {call.duration && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Duration: {Math.floor(call.duration / 60)}m {call.duration % 60}s
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(call.startTime || call.createdAt), "MMM d, yyyy HH:mm")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Phone className="h-4 w-4 mr-2" />
                Call Customer
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Ticket className="h-4 w-4 mr-2" />
                Create Ticket
              </Button>
            </CardContent>
          </Card>

          {customer.tags && Array.isArray(customer.tags) && customer.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {customer.tags.map((tag, i) => (
                    <Badge key={i} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

