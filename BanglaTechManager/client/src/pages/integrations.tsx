import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Plug, CheckCircle, XCircle, RefreshCw, Settings, Trash2, Map, BarChart3 } from "lucide-react";

interface Connector {
  id: string;
  displayName: string;
  description: string;
  category: string;
  icon?: string;
  oauthEnabled: boolean;
  apiKeyRequired: boolean;
  webhookSupported: boolean;
  capabilities: {
    inbound?: boolean;
    outbound?: boolean;
    bidirectional?: boolean;
  };
  oauthScopes?: string[];
}

interface Integration {
  id: string;
  connectorId: string;
  displayName: string;
  status: "connected" | "disconnected" | "auth_failed" | "error" | "syncing" | "paused";
  lastSyncAt?: string;
  lastError?: string;
  connector?: {
    id: string;
    displayName: string;
    icon?: string;
    category: string;
  };
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const { data: connectors = [], isLoading: connectorsLoading } = useQuery<Connector[]>({
    queryKey: ["/api/connectors"],
  });

  const { data: integrations = [], isLoading: integrationsLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const connectMutation = useMutation({
    mutationFn: async (data: { connectorId: string; credentials?: Record<string, any>; config?: Record<string, any> }) => {
      const res = await api.post("/api/integrations", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.oauthUrl) {
        // Redirect to OAuth
        window.location.href = data.oauthUrl;
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
        toast({
          title: "Success",
          description: "Integration connected successfully",
        });
        setSelectedConnector(null);
        setCredentials({});
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to connect integration",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const res = await api.post(`/api/integrations/${integrationId}/revoke`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Success",
        description: "Integration disconnected",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect integration",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const res = await api.post(`/api/integrations/${integrationId}/test`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Connection test successful",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Connection test failed",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: Integration["status"]) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-600">Connected</Badge>;
      case "disconnected":
        return <Badge variant="outline">Disconnected</Badge>;
      case "auth_failed":
        return <Badge variant="destructive">Auth Failed</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "syncing":
        return <Badge className="bg-blue-600">Syncing</Badge>;
      case "paused":
        return <Badge variant="outline">Paused</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      email: "📧",
      calendar: "📅",
      messaging: "💬",
      telephony: "☎️",
      dev_tools: "🔧",
      payments: "💳",
      storage: "📁",
    };
    return icons[category] || "🔌";
  };

  const handleConnect = () => {
    if (!selectedConnector) return;

    if (selectedConnector.oauthEnabled) {
      connectMutation.mutate({ connectorId: selectedConnector.id });
    } else if (selectedConnector.apiKeyRequired) {
      connectMutation.mutate({
        connectorId: selectedConnector.id,
        credentials,
      });
    }
  };

  const groupedConnectors = connectors.reduce((acc, connector) => {
    if (!acc[connector.category]) {
      acc[connector.category] = [];
    }
    acc[connector.category].push(connector);
    return acc;
  }, {} as Record<string, Connector[]>);

  if (connectorsLoading || integrationsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Integrations</h1>
          <p className="text-muted-foreground mt-1">Connect external services to your CRM</p>
        </div>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground mt-1">Connect external services to your CRM</p>
      </div>

      {/* Active Integrations */}
      {integrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Integrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{integration.connector?.icon || "🔌"}</div>
                    <div>
                      <div className="font-medium">{integration.displayName || integration.connector?.displayName}</div>
                      <div className="text-sm text-muted-foreground">{integration.connector?.category}</div>
                    </div>
                    {getStatusBadge(integration.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/integrations/mapping?id=${integration.id}`}
                    >
                      <Map className="h-4 w-4 mr-2" />
                      Mapping
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testMutation.mutate(integration.id)}
                      disabled={testMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectMutation.mutate(integration.id)}
                      disabled={disconnectMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connector Catalog */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Available Integrations</h2>
        <div className="space-y-6">
          {Object.entries(groupedConnectors).map(([category, categoryConnectors]) => (
            <div key={category}>
              <h3 className="text-lg font-medium mb-3 capitalize flex items-center gap-2">
                <span>{getCategoryIcon(category)}</span>
                {category.replace("_", " ")}
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categoryConnectors.map((connector) => {
                  const isConnected = integrations.some((i) => i.connectorId === connector.id);
                  
                  return (
                    <Card key={connector.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-2xl">{connector.icon || "🔌"}</span>
                          {connector.displayName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">{connector.description}</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {connector.capabilities.inbound && <Badge variant="outline">Inbound</Badge>}
                          {connector.capabilities.outbound && <Badge variant="outline">Outbound</Badge>}
                          {connector.webhookSupported && <Badge variant="outline">Webhooks</Badge>}
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant={isConnected ? "outline" : "default"}
                              className="w-full"
                              onClick={() => setSelectedConnector(connector)}
                            >
                              {isConnected ? (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Connected
                                </>
                              ) : (
                                <>
                                  <Plug className="h-4 w-4 mr-2" />
                                  Connect
                                </>
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Connect {connector.displayName}</DialogTitle>
                              <DialogDescription>{connector.description}</DialogDescription>
                            </DialogHeader>
                            {connector.oauthEnabled ? (
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-medium mb-2">Required Permissions:</h4>
                                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                    {connector.oauthScopes?.map((scope) => (
                                      <li key={scope}>{scope}</li>
                                    ))}
                                  </ul>
                                </div>
                                <Button
                                  onClick={handleConnect}
                                  disabled={connectMutation.isPending}
                                  className="w-full"
                                >
                                  {connectMutation.isPending ? "Connecting..." : "Authorize with OAuth"}
                                </Button>
                              </div>
                            ) : connector.apiKeyRequired ? (
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="apiKey">API Key / Token</Label>
                                  <Input
                                    id="apiKey"
                                    type="password"
                                    placeholder="Enter API key"
                                    value={credentials.apiKey || ""}
                                    onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
                                  />
                                </div>
                                <Button
                                  onClick={handleConnect}
                                  disabled={connectMutation.isPending || !credentials.apiKey}
                                  className="w-full"
                                >
                                  {connectMutation.isPending ? "Connecting..." : "Connect"}
                                </Button>
                              </div>
                            ) : (
                              <Button
                                onClick={handleConnect}
                                disabled={connectMutation.isPending}
                                className="w-full"
                              >
                                {connectMutation.isPending ? "Connecting..." : "Connect"}
                              </Button>
                            )}
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

