import { ChatPanel } from "@/components/chat-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Ticket } from "@shared/schema";

interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: string;
  senderName: string;
}

export default function MessagesNewPage() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/tickets", selectedTicketId, "messages"],
    enabled: !!selectedTicketId,
  });

  const messageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/messages", {
        ticketId: selectedTicketId,
        content,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/tickets", selectedTicketId, "messages"],
      });
      setMessageInput("");
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedTicketId) return;
    messageMutation.mutate(messageInput);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Messages</h1>
        <p className="text-muted-foreground mt-1">
          Communicate with customers through tickets
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 max-h-[600px] overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`p-4 cursor-pointer hover-elevate transition ${
                    selectedTicketId === ticket.id ? "bg-accent" : ""
                  }`}
                  data-testid={`ticket-message-${ticket.id}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarFallback>TKT</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate text-sm">
                          {ticket.title}
                        </p>
                        <Badge variant="outline" className="shrink-0">
                          {ticket.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {ticket.description?.substring(0, 50)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col max-h-[600px]">
            {selectedTicket ? (
              <>
                <div className="p-4 border-b">
                  <h3 className="font-semibold">{selectedTicket.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTicket.description}
                  </p>
                </div>

                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages && messages.length > 0 ? (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="flex gap-3"
                        data-testid={`message-${msg.id}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {getInitials(msg.senderName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="bg-muted rounded-lg p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              {msg.senderName}
                            </p>
                            <p className="text-sm mt-1">{msg.content}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground text-sm">
                      No messages yet. Start the conversation!
                    </div>
                  )}
                </CardContent>

                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleSendMessage()
                      }
                      disabled={messageMutation.isPending}
                      data-testid="input-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || messageMutation.isPending}
                      data-testid="button-send-message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <p>Select a ticket to view messages</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
