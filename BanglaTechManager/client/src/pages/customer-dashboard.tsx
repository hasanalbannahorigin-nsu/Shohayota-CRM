import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Phone, MessageSquare, Ticket } from "lucide-react";
import type { Ticket as TicketType } from "@shared/schema";
import { CustomerTicketList } from "@/components/customer-ticket-list";
import { CustomerTicketThread } from "@/components/customer-ticket-thread";
import { CallRequestForm } from "@/components/call-request-form";
import { AddTicketDialog } from "./customer-ticket-form";

export default function CustomerDashboard() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showCallForm, setShowCallForm] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const queryClient = useQueryClient();

  // Fetch customer profile
  const { data: customer } = useQuery({
    queryKey: ["/api/customers/me"],
  });

  // Fetch customer tickets
  const { data: tickets, isLoading } = useQuery<TicketType[]>({
    queryKey: ["/api/customers/me/tickets"],
  });

  const selectedTicket = tickets?.find((t) => t.id === selectedTicketId);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">My Support Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your tickets and contact support
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowCallForm(true)}
            variant="outline"
          >
            <Phone className="h-4 w-4 mr-2" />
            Request Call
          </Button>
          <Button onClick={() => setShowCreateTicket(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                My Tickets
              </CardTitle>
              <CardDescription>
                {tickets?.length || 0} ticket{tickets?.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomerTicketList
                tickets={tickets || []}
                isLoading={isLoading}
                selectedTicketId={selectedTicketId}
                onSelectTicket={setSelectedTicketId}
              />
            </CardContent>
          </Card>
        </div>

        {/* Ticket Thread */}
        <div className="lg:col-span-2">
          {selectedTicket ? (
            <CustomerTicketThread
              ticket={selectedTicket}
              onClose={() => setSelectedTicketId(null)}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Select a ticket to view messages
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Call Request Dialog */}
      {showCallForm && (
        <CallRequestForm
          open={showCallForm}
          onClose={() => setShowCallForm(false)}
          ticketId={selectedTicketId || undefined}
        />
      )}

      {/* Create Ticket Dialog */}
      {showCreateTicket && (
        <AddTicketDialog
          open={showCreateTicket}
          onClose={() => {
            setShowCreateTicket(false);
            queryClient.invalidateQueries({ queryKey: ["/api/customers/me/tickets"] });
          }}
        />
      )}
    </div>
  );
}

