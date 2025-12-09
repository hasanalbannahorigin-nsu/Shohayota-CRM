/**
 * Tenant Detail Page
 * Shows tenant info, metrics, logs, feature flags, and action buttons
 */

import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Play, Pause, RefreshCw, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function TenantDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ["mcp", "tenant", tenantId],
    queryFn: async () => {
      const res = await fetch(`/mcp/api/tenants/${tenantId}`);
      if (!res.ok) throw new Error("Failed to fetch tenant");
      return res.json();
    },
    enabled: !!tenantId,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["mcp", "tenant", tenantId, "metrics"],
    queryFn: async () => {
      const res = await fetch(`/mcp/api/tenants/${tenantId}/metrics`);
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
    enabled: !!tenantId,
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["mcp", "tenant", tenantId, "logs"],
    queryFn: async () => {
      const res = await fetch(`/mcp/api/tenants/${tenantId}/logs?limit=50`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: !!tenantId,
  });

  const suspendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/mcp/api/tenants/${tenantId}/suspend`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to suspend tenant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "tenant", tenantId] });
      toast({ title: "Tenant suspended successfully" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/mcp/api/tenants/${tenantId}/activate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to activate tenant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "tenant", tenantId] });
      toast({ title: "Tenant activated successfully" });
    },
  });

  const migrateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/mcp/api/tenants/${tenantId}/migrate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to run migration");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Migration enqueued", description: `Job ID: ${data.data.jobId}` });
    },
  });

  const updateFeatureFlagsMutation = useMutation({
    mutationFn: async (flags: Record<string, boolean>) => {
      const res = await fetch(`/mcp/api/tenants/${tenantId}/feature-flags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags }),
      });
      if (!res.ok) throw new Error("Failed to update feature flags");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Feature flags updated successfully" });
    },
  });

  if (tenantLoading) {
    return <div className="text-muted-foreground">Loading tenant details...</div>;
  }

  if (!tenant?.data) {
    return <div className="text-destructive">Tenant not found</div>;
  }

  const tenantData = tenant.data;
  const metricsData = metrics?.data || {};
  const logsData = logs?.data || [];

  const handleFeatureFlagToggle = (flagKey: string, enabled: boolean) => {
    updateFeatureFlagsMutation.mutate({ [flagKey]: enabled });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/mcp/tenants">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tenants
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{tenantData.name}</h1>
            <p className="text-muted-foreground">{tenantData.contactEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={tenantData.status === "active" ? "default" : "secondary"}>
            {tenantData.status}
          </Badge>
          {tenantData.status === "active" ? (
            <Button
              variant="outline"
              onClick={() => suspendMutation.mutate()}
              disabled={suspendMutation.isPending}
            >
              <Pause className="h-4 w-4 mr-2" />
              Suspend
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              Activate
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => migrateMutation.mutate()}
            disabled={migrateMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Run Migration
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="features">Feature Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">ID</Label>
                  <p className="font-mono text-sm">{tenantData.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Slug</Label>
                  <p>{tenantData.slug || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Plan</Label>
                  <p>{tenantData.plan}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p>{new Date(tenantData.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {metricsLoading ? (
            <div className="text-muted-foreground">Loading metrics...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metricsData.users || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Customers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metricsData.customers || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metricsData.tickets || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metricsData.openTickets || 0}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          {logsLoading ? (
            <div className="text-muted-foreground">Loading logs...</div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>Recent MCP actions for this tenant</CardDescription>
              </CardHeader>
              <CardContent>
                {logsData.length === 0 ? (
                  <p className="text-muted-foreground">No logs found</p>
                ) : (
                  <div className="space-y-2">
                    {logsData.map((log: any) => (
                      <div key={log.id} className="border-b pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{log.action}</p>
                            <p className="text-sm text-muted-foreground">
                              {log.actorRole} • {new Date(log.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>Enable or disable features for this tenant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>AI Assistant</Label>
                  <p className="text-sm text-muted-foreground">Enable AI-powered assistance</p>
                </div>
                <Switch
                  onCheckedChange={(enabled) => handleFeatureFlagToggle("ai_assistant", enabled)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Voice Calls</Label>
                  <p className="text-sm text-muted-foreground">Enable voice call functionality</p>
                </div>
                <Switch
                  onCheckedChange={(enabled) => handleFeatureFlagToggle("voice_calls", enabled)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Advanced Analytics</Label>
                  <p className="text-sm text-muted-foreground">Enable advanced analytics features</p>
                </div>
                <Switch
                  onCheckedChange={(enabled) => handleFeatureFlagToggle("advanced_analytics", enabled)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

