import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X, Send } from "lucide-react";
import type { Ticket, Message } from "@shared/schema";
import { format } from "date-fns";

interface CustomerTicketThreadProps {
  ticket: Ticket;
  onClose: () => void;
}

export function CustomerTicketThread({
  ticket,
  onClose,
}: CustomerTicketThreadProps) {
  const [messageBody, setMessageBody] = useState("");
  const queryClient = useQueryClient();

  // Fetch messages for this ticket
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/tickets", ticket.id, "messages"],
    queryFn: async () => {
      const response = await fetch(`/api/tickets/${ticket.id}/messages`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (body: string) => {
      const response = await fetch(`/api/customers/me/tickets/${ticket.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: () => {
      setMessageBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", ticket.id, "messages"] });
    },
  });

  const handleSendMessage = () => {
    if (!messageBody.trim()) return;
    sendMessageMutation.mutate(messageBody);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {ticket.title}
              <Badge variant={ticket.status === "open" ? "default" : "secondary"}>
                {ticket.status}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Created {format(new Date(ticket.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <ScrollArea className="flex-1 mb-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading messages...
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg ${
                    message.senderId
                      ? "bg-muted ml-auto max-w-[80%]"
                      : "bg-background border"
                  }`}
                >
                  <p className="text-sm">{message.body || (message as any).content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(message.timestamp || message.createdAt), "MMM d, h:mm a")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No messages yet. Start the conversation below.
            </div>
          )}
        </ScrollArea>

        {/* Message Input */}
        <div className="flex-shrink-0 space-y-2">
          <Textarea
            placeholder="Type your message..."
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={3}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageBody.trim() || sendMessageMutation.isPending}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

