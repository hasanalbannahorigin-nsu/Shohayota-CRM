import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Clock, User, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";

interface CallDetail {
  id: string;
  customerId: string;
  agentRef: string;
  direction: "incoming" | "outgoing";
  status: string;
  disposition?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  recordingUrl?: string;
  transcript?: string;
  notes?: string;
}

export default function CallDetailPage() {
  const [, navigate] = useLocation();
  const callId = new URLSearchParams(window.location.search).get("id") || "";

  const { data: call, isLoading } = useQuery<CallDetail>({
    queryKey: ["/api/calls", callId],
    enabled: !!callId,
  });

  const { data: customer } = useQuery({
    queryKey: ["/api/customers", call?.customerId],
    enabled: !!call?.customerId,
  });

  if (isLoading) {
    return <div className="p-6">Loading call details...</div>;
  }

  if (!call) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/phone-calls")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Calls
        </Button>
        <div className="text-center py-8 text-muted-foreground">Call not found</div>
      </div>
    );
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate("/phone-calls")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Calls
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Call Details
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Call ID: {call.id.substring(0, 8)}
                  </p>
                </div>
                <Badge variant={call.direction === "incoming" ? "default" : "secondary"}>
                  {call.direction}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Duration</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(call.duration)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Agent</p>
                    <p className="text-xs text-muted-foreground">
                      {call.agentRef.substring(0, 8)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Start Time</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(call.startTime), "MMM d, yyyy HH:mm:ss")}
                </p>
              </div>

              {call.endTime && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">End Time</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(call.endTime), "MMM d, yyyy HH:mm:ss")}
                  </p>
                </div>
              )}

              {call.disposition && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Disposition</p>
                  <Badge variant="outline">{call.disposition}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {call.transcript && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Transcript
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{call.transcript}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {call.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{call.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {customer && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{customer.name}</p>
                <p className="text-sm text-muted-foreground">{customer.email}</p>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => navigate(`/customers/detail?id=${customer.id}`)}
                >
                  View Customer
                </Button>
              </CardContent>
            </Card>
          )}

          {call.recordingUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recording</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" />
                    Download Recording
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full">
                <Ticket className="h-4 w-4 mr-2" />
                Create Ticket from Call
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

