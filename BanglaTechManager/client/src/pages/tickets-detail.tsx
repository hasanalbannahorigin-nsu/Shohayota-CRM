import { useLocation } from "wouter";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Ticket, Message, User } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { AgentAssistPane } from "@/components/agent-assist-pane";
import { TicketSummary } from "@/components/ticket-summary";
import { NLQBox } from "@/components/nlq-box";

interface RouteParams {
  ticketId: string;
}

export default function TicketDetailPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");

  // Get ticketId from URL
  const ticketId = new URLSearchParams(window.location.search).get("id") || "";

  const { data: ticket, isLoading: ticketLoading } = useQuery<Ticket>({
    queryKey: ["/api/tickets", ticketId],
    enabled: !!ticketId,
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/tickets", ticketId, "messages"],
    enabled: !!ticketId,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/tenants/users"],
  });

  const updateTicketMutation = useMutation({
    mutationFn: async (updates: Partial<Ticket>) => {
      const res = await apiRequest("PATCH", `/api/tickets/${ticketId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", ticketId] });
      toast({
        title: "Success",
        description: "Ticket updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update ticket",
        variant: "destructive",
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/messages", {
        ticketId,
        content,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/tickets", ticketId, "messages"],
      });
      setNewComment("");
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add comment",
        variant: "destructive",
      });
    },
  });

  const statusColors = {
    open: "default",
    in_progress: "secondary",
    closed: "outline",
  } as const;

  const priorityColors = {
    low: "secondary",
    medium: "default",
    high: "destructive",
  } as const;

  const categoryColors = {
    support: "default",
    bug: "destructive",
    feature: "secondary",
  } as const;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  if (ticketLoading) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          className="gap-2"
          onClick={() => navigate("/tickets")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tickets
        </Button>
        <div className="text-center p-8 text-muted-foreground">
          Loading ticket...
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          className="gap-2"
          onClick={() => navigate("/tickets")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tickets
        </Button>
        <div className="text-center p-8 text-muted-foreground">
          Ticket not found
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        className="gap-2"
        onClick={() => navigate("/tickets")}
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tickets
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-2xl" data-testid="text-ticket-title">
                    {ticket.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Ticket #{ticket.id.substring(0, 8)}
                  </p>
                </div>
                <Badge variant={priorityColors[ticket.priority]} data-testid="badge-priority">
                  {ticket.priority}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                  Description
                </h3>
                <p className="text-sm" data-testid="text-description">
                  {ticket.description}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusColors[ticket.status]} data-testid="badge-status">
                  {ticket.status.replace("_", " ")}
                </Badge>
                <Badge variant={categoryColors[ticket.category]} data-testid="badge-category">
                  {ticket.category}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground border-t pt-4">
                <p>
                  Created{" "}
                  {formatDistanceToNow(new Date(ticket.createdAt), {
                    addSuffix: true,
                  })}
                </p>
                <p>
                  Updated{" "}
                  {formatDistanceToNow(new Date(ticket.updatedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          <TicketSummary
            ticketId={ticketId}
            sourceType="ticket"
            content={ticket.description}
          />

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Message List */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {messages.length > 0 ? (
                  messages.map((msg) => (
                    <div key={msg.id} className="flex gap-3" data-testid={`comment-${msg.id}`}>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback>
                          {getInitials(msg.senderId)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{msg.senderId}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(msg.timestamp), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {msg.body}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No comments yet
                  </p>
                )}
              </div>

              {/* Add Comment */}
              <div className="space-y-2 border-t pt-4">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="resize-none"
                  rows={3}
                  data-testid="textarea-comment"
                />
                <Button
                  onClick={() => {
                    if (newComment.trim()) {
                      addCommentMutation.mutate(newComment);
                    }
                  }}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  className="gap-2"
                  data-testid="button-add-comment"
                >
                  <Send className="h-4 w-4" />
                  Post Comment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={ticket.status}
                onValueChange={(value) => {
                  updateTicketMutation.mutate({ status: value as any });
                }}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Priority */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={ticket.priority}
                onValueChange={(value) => {
                  updateTicketMutation.mutate({ priority: value as any });
                }}
              >
                <SelectTrigger data-testid="select-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Assignee */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Assigned To</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={ticket.assigneeId || "unassigned"}
                onValueChange={(value) => {
                  updateTicketMutation.mutate({
                    assigneeId: value === "unassigned" ? null : value,
                  });
                }}
              >
                <SelectTrigger data-testid="select-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* AI Agent Assist */}
          <AgentAssistPane
            ticketId={ticketId}
            customerId={ticket.customerId || undefined}
              messages={messages.map((msg) => ({
                role: msg.senderId === user?.id ? "agent" : "user",
                content: msg.body,
                timestamp: new Date(msg.timestamp),
              }))}
            onSuggestionAccepted={(suggestion) => {
              if (suggestion.type === "reply") {
                setNewComment(suggestion.content);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
