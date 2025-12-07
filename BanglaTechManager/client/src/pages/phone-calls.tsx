import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneMissed, Clock, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";

interface CallRecord {
  id: string;
  customerId: string;
  status: string;
  duration?: number;
  transcript?: string;
  startTime?: string;
  timestamp?: string;
}

export default function PhoneCallsPage() {
  const { data: calls = [], isLoading } = useQuery<CallRecord[]>({
    queryKey: ["/api/calls"],
  });

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-600">Completed</Badge>;
      case "missed":
        return <Badge variant="destructive">Missed</Badge>;
      case "incoming":
        return <Badge className="bg-blue-600">Incoming</Badge>;
      case "outgoing":
        return <Badge className="bg-purple-600">Outgoing</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Phone Calls & Voice</h1>
          <p className="text-muted-foreground mt-1">
            Track call history, transcripts, and customer interactions
          </p>
        </div>
        <div className="text-center py-8 text-muted-foreground">Loading calls...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Phone Calls & Voice</h1>
        <p className="text-muted-foreground mt-1">
          Track call history, transcripts, and customer interactions
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calls.length}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {calls.filter((c) => c.status === "completed").length}
            </div>
            <p className="text-xs text-muted-foreground">Successfully handled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Missed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {calls.filter((c) => c.status === "missed").length}
            </div>
            <p className="text-xs text-muted-foreground">Require follow-up</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {calls.map((call) => (
              <div
                key={call.id}
                className="flex items-start justify-between p-4 border rounded-lg"
                data-testid={`call-record-${call.id}`}
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    {call.status === "missed" ? (
                      <PhoneMissed className="h-5 w-5 text-red-500" />
                    ) : (
                      <Phone className="h-5 w-5 text-green-500" />
                    )}
                    {getStatusBadge(call.status)}
                  </div>
                  <p className="text-sm font-medium">Customer {call.customerId}</p>
                  {call.transcript && (
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        {call.transcript}
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-right space-y-1">
                  {call.duration && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground justify-end">
                      <Clock className="h-4 w-4" />
                      {formatDuration(call.duration)}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {call.startTime ? format(new Date(call.startTime), "MMM d, yyyy HH:mm") : call.timestamp || "N/A"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voice Integration Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded">
            <div>
              <p className="font-medium">Twilio Integration</p>
              <p className="text-sm text-muted-foreground">
                Voice calls and SMS support
              </p>
            </div>
            <Badge className="bg-blue-600">Connected</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded">
            <div>
              <p className="font-medium">Call Transcription</p>
              <p className="text-sm text-muted-foreground">
                Automatic speech-to-text conversion
              </p>
            </div>
            <Badge variant="outline">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded">
            <div>
              <p className="font-medium">Call Recording</p>
              <p className="text-sm text-muted-foreground">
                Secure storage and playback
              </p>
            </div>
            <Badge variant="outline">Active</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
