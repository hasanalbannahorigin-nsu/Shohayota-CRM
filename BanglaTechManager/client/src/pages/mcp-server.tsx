/**
 * MCP Server Management Page
 * 
 * Allows users to configure and manage their MCP (Model Context Protocol) server
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Server, Play, Square, Settings, CheckCircle2, XCircle, Loader2, Plus, Rocket } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MCPServerStatus {
  enabled: boolean;
  running: boolean;
  port?: number;
  host?: string;
  tenantId?: string;
  resources: number;
  tools: number;
  prompts: number;
}

interface MCPConfig {
  enabled: boolean;
  port?: number;
  host?: string;
  authentication?: {
    type: 'jwt' | 'api_key' | 'none';
    secret?: string;
  };
}

interface MCPServerCreationForm {
  name: string;
  description: string;
  port: number;
  host: string;
  authenticationType: 'jwt' | 'api_key' | 'none';
  apiKey?: string;
}

export default function MCPServerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [config, setConfig] = useState<MCPConfig>({
    enabled: false,
    port: 3001,
    host: '0.0.0.0',
    authentication: {
      type: 'jwt',
    },
  });
  const [createForm, setCreateForm] = useState<MCPServerCreationForm>({
    name: '',
    description: '',
    port: 3001,
    host: '0.0.0.0',
    authenticationType: 'jwt',
    apiKey: '',
  });

  // Fetch server status
  const { data: status, isLoading: statusLoading } = useQuery<MCPServerStatus>({
    queryKey: ['/api/mcp/status'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch configuration
  useEffect(() => {
    if (status) {
      setConfig({
        enabled: status.enabled,
        port: status.port,
        host: status.host,
        authentication: {
          type: 'jwt',
        },
      });
    }
  }, [status]);

  // Start server mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/mcp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to start server');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Server Started",
        description: "MCP server has been started successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mcp/status'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Stop server mutation
  const stopMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/mcp/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to stop server');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Server Stopped",
        description: "MCP server has been stopped successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mcp/status'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: MCPConfig) => {
      const response = await fetch('/api/mcp/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (!response.ok) throw new Error('Failed to update configuration');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Updated",
        description: "MCP server configuration has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mcp/status'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create MCP server mutation
  const createServerMutation = useMutation({
    mutationFn: async (formData: MCPServerCreationForm) => {
      const response = await fetch('/api/mcp/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          port: formData.port,
          host: formData.host,
          authentication: {
            type: formData.authenticationType,
            ...(formData.authenticationType === 'api_key' && formData.apiKey ? { secret: formData.apiKey } : {}),
          },
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create MCP server');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "MCP Server Created",
        description: "Your MCP server has been created and configured successfully.",
      });
      setCreateDialogOpen(false);
      setCreateForm({
        name: '',
        description: '',
        port: 3001,
        host: '0.0.0.0',
        authenticationType: 'jwt',
        apiKey: '',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mcp/status'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch resources
  const { data: resources } = useQuery({
    queryKey: ['/api/mcp/resources'],
    enabled: status?.running || false,
  });

  // Fetch tools
  const { data: tools } = useQuery({
    queryKey: ['/api/mcp/tools'],
    enabled: status?.running || false,
  });

  // Fetch prompts
  const { data: prompts } = useQuery({
    queryKey: ['/api/mcp/prompts'],
    enabled: status?.running || false,
  });

  const handleSaveConfig = () => {
    updateConfigMutation.mutate(config);
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const handleCreateServer = () => {
    if (!createForm.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Server name is required",
        variant: "destructive",
      });
      return;
    }
    createServerMutation.mutate(createForm);
  };

  const serverExists = status !== undefined && status !== null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">MCP Server</h1>
          <p className="text-muted-foreground mt-1">
            Manage your Model Context Protocol server for AI integrations
          </p>
        </div>
        <div className="flex gap-2">
          {!serverExists && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create MCP Server
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5" />
                    Create New MCP Server
                  </DialogTitle>
                  <DialogDescription>
                    Set up a new Model Context Protocol server to connect AI assistants with your CRM data
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="server-name">Server Name</Label>
                    <Input
                      id="server-name"
                      placeholder="My MCP Server"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      A descriptive name for your MCP server instance
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="server-description">Description</Label>
                    <Textarea
                      id="server-description"
                      placeholder="Describe what this MCP server will provide access to..."
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="server-host">Host</Label>
                      <Input
                        id="server-host"
                        placeholder="0.0.0.0"
                        value={createForm.host}
                        onChange={(e) => setCreateForm({ ...createForm, host: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Listen on all interfaces</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="server-port">Port</Label>
                      <Input
                        id="server-port"
                        type="number"
                        placeholder="3001"
                        value={createForm.port}
                        onChange={(e) => setCreateForm({ ...createForm, port: parseInt(e.target.value) || 3001 })}
                      />
                      <p className="text-xs text-muted-foreground">Available port number</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auth-type">Authentication Type</Label>
                    <Select
                      value={createForm.authenticationType}
                      onValueChange={(value: 'jwt' | 'api_key' | 'none') =>
                        setCreateForm({ ...createForm, authenticationType: value })
                      }
                    >
                      <SelectTrigger id="auth-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jwt">JWT Token (Recommended)</SelectItem>
                        <SelectItem value="api_key">API Key</SelectItem>
                        <SelectItem value="none">None (Development Only)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose how clients will authenticate with your MCP server
                    </p>
                  </div>
                  {createForm.authenticationType === 'api_key' && (
                    <div className="space-y-2">
                      <Label htmlFor="api-key">API Key</Label>
                      <Input
                        id="api-key"
                        type="password"
                        placeholder="Enter a secure API key"
                        value={createForm.apiKey}
                        onChange={(e) => setCreateForm({ ...createForm, apiKey: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Store this key securely - you won't be able to view it again
                      </p>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCreateDialogOpen(false)}
                      disabled={createServerMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateServer}
                      disabled={createServerMutation.isPending || !createForm.name.trim()}
                    >
                      {createServerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Rocket className="mr-2 h-4 w-4" />
                          Create Server
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {serverExists && status?.running && (
            <Button
              variant="destructive"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
            >
              <Square className="mr-2 h-4 w-4" />
              Stop Server
            </Button>
          )}
          {serverExists && !status?.running && (
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending || !status?.enabled}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Server
            </Button>
          )}
        </div>
      </div>

      {/* No Server State */}
      {!serverExists && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No MCP Server Configured</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Create a Model Context Protocol server to enable AI assistants to access your CRM data,
              tickets, customers, and other resources through a standardized interface.
            </p>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Create MCP Server
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5" />
                    Create New MCP Server
                  </DialogTitle>
                  <DialogDescription>
                    Set up a new Model Context Protocol server to connect AI assistants with your CRM data
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="server-name">Server Name</Label>
                    <Input
                      id="server-name"
                      placeholder="My MCP Server"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      A descriptive name for your MCP server instance
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="server-description">Description</Label>
                    <Textarea
                      id="server-description"
                      placeholder="Describe what this MCP server will provide access to..."
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="server-host">Host</Label>
                      <Input
                        id="server-host"
                        placeholder="0.0.0.0"
                        value={createForm.host}
                        onChange={(e) => setCreateForm({ ...createForm, host: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Listen on all interfaces</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="server-port">Port</Label>
                      <Input
                        id="server-port"
                        type="number"
                        placeholder="3001"
                        value={createForm.port}
                        onChange={(e) => setCreateForm({ ...createForm, port: parseInt(e.target.value) || 3001 })}
                      />
                      <p className="text-xs text-muted-foreground">Available port number</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auth-type">Authentication Type</Label>
                    <Select
                      value={createForm.authenticationType}
                      onValueChange={(value: 'jwt' | 'api_key' | 'none') =>
                        setCreateForm({ ...createForm, authenticationType: value })
                      }
                    >
                      <SelectTrigger id="auth-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jwt">JWT Token (Recommended)</SelectItem>
                        <SelectItem value="api_key">API Key</SelectItem>
                        <SelectItem value="none">None (Development Only)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose how clients will authenticate with your MCP server
                    </p>
                  </div>
                  {createForm.authenticationType === 'api_key' && (
                    <div className="space-y-2">
                      <Label htmlFor="api-key">API Key</Label>
                      <Input
                        id="api-key"
                        type="password"
                        placeholder="Enter a secure API key"
                        value={createForm.apiKey}
                        onChange={(e) => setCreateForm({ ...createForm, apiKey: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Store this key securely - you won't be able to view it again
                      </p>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCreateDialogOpen(false)}
                      disabled={createServerMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateServer}
                      disabled={createServerMutation.isPending || !createForm.name.trim()}
                    >
                      {createServerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Rocket className="mr-2 h-4 w-4" />
                          Create Server
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Status Card */}
      {serverExists && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Server Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  {status?.running ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Running
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="mr-1 h-3 w-3" />
                      Stopped
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Port</Label>
                <div className="mt-1 font-mono">{status?.port || 'N/A'}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Resources</Label>
                <div className="mt-1 font-semibold">{status?.resources || 0}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Tools</Label>
                <div className="mt-1 font-semibold">{status?.tools || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {serverExists && (
        <Tabs defaultValue="config" className="space-y-4">
          <TabsList>
            <TabsTrigger value="config">
              <Settings className="mr-2 h-4 w-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
          </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Server Configuration</CardTitle>
              <CardDescription>
                Configure your MCP server settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable MCP Server</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable the Model Context Protocol server
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, enabled: checked })
                  }
                />
              </div>

              {config.enabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="host">Host</Label>
                      <Input
                        id="host"
                        value={config.host}
                        onChange={(e) =>
                          setConfig({ ...config, host: e.target.value })
                        }
                        placeholder="0.0.0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        type="number"
                        value={config.port}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            port: parseInt(e.target.value) || 3001,
                          })
                        }
                        placeholder="3001"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Authentication Type</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      value={config.authentication?.type || 'jwt'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          authentication: {
                            type: e.target.value as 'jwt' | 'api_key' | 'none',
                          },
                        })
                      }
                    >
                      <option value="jwt">JWT Token</option>
                      <option value="api_key">API Key</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </>
              )}

              <Button
                onClick={handleSaveConfig}
                disabled={updateConfigMutation.isPending}
              >
                {updateConfigMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Configuration'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Resources</CardTitle>
              <CardDescription>
                MCP resources available for AI assistants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resources?.resources?.length > 0 ? (
                <div className="space-y-2">
                  {resources.resources.map((resource: any) => (
                    <div
                      key={resource.uri}
                      className="p-3 border rounded-lg hover:bg-accent"
                    >
                      <div className="font-semibold">{resource.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {resource.description}
                      </div>
                      <div className="text-xs font-mono text-muted-foreground mt-1">
                        {resource.uri}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No resources available. Start the server to see resources.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Tools</CardTitle>
              <CardDescription>
                MCP tools available for AI assistants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tools?.tools?.length > 0 ? (
                <div className="space-y-2">
                  {tools.tools.map((tool: any) => (
                    <div
                      key={tool.name}
                      className="p-3 border rounded-lg hover:bg-accent"
                    >
                      <div className="font-semibold">{tool.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {tool.description}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No tools available. Start the server to see tools.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Prompts</CardTitle>
              <CardDescription>
                MCP prompts available for AI assistants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {prompts?.prompts?.length > 0 ? (
                <div className="space-y-2">
                  {prompts.prompts.map((prompt: any) => (
                    <div
                      key={prompt.name}
                      className="p-3 border rounded-lg hover:bg-accent"
                    >
                      <div className="font-semibold">{prompt.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {prompt.description}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No prompts available. Start the server to see prompts.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

