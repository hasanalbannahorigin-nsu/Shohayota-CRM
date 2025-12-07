import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Users, BarChart3, Lock, Download } from "lucide-react";
import { getToken } from "@/lib/auth";
import { QuotaMonitoring } from "@/components/quota-monitoring";
import { TenantConfiguration } from "@/components/tenant-configuration";
import { DataExport } from "@/components/data-export";
import { AuditLogViewer } from "@/components/audit-log-viewer";

interface TenantInfo {
  id: string;
  name: string;
  contactEmail: string;
  createdAt: string;
}

interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface TenantStats {
  totalCustomers: number;
  totalTickets: number;
  totalUsers: number;
  openTickets: number;
  closedTickets: number;
  inProgressTickets: number;
}

const addUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["support_agent", "tenant_admin"]),
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

export default function TenantSettingsPage() {
  const { toast } = useToast();
  const [showAddUser, setShowAddUser] = useState(false);

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "support_agent",
    },
  });

  // Fetch tenant info
  const { data: tenantInfo, isLoading: tenantLoading } = useQuery<TenantInfo>({
    queryKey: ["/api/tenants/current"],
  });

  // Fetch tenant users
  const { data: tenantUsers = [], isLoading: usersLoading } = useQuery<TenantUser[]>({
    queryKey: ["/api/tenants/users"],
  });

  // Fetch tenant stats
  const { data: stats, isLoading: statsLoading } = useQuery<TenantStats>({
    queryKey: ["/api/tenants/stats"],
  });

  // Add user mutation
  const addUserMutation = useMutation({
    mutationFn: (data: AddUserFormValues) =>
      apiRequest("POST", "/api/tenants/users", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants/users"] });
      form.reset();
      setShowAddUser(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add user",
        variant: "destructive",
      });
    },
  });

  const onAddUserSubmit = (data: AddUserFormValues) => {
    addUserMutation.mutate(data);
  };

  if (tenantLoading || statsLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Tenant Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your tenant, users, and organization settings
        </p>
      </div>

      {/* Tenant Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Tenant Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Tenant Name</label>
            <p className="text-lg font-semibold mt-1">{tenantInfo?.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Contact Email</label>
            <p className="text-lg font-semibold mt-1">{tenantInfo?.contactEmail}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Tenant ID</label>
            <p className="text-sm font-mono text-muted-foreground mt-1 break-all">
              {tenantInfo?.id}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tenant Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">In your tenant</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground">Active accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTickets || 0}</div>
            <p className="text-xs text-muted-foreground">Support issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Ticket Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-3 bg-muted rounded">
              <p className="text-sm text-muted-foreground">Open</p>
              <p className="text-2xl font-bold text-orange-600">
                {stats?.openTickets || 0}
              </p>
            </div>
            <div className="p-3 bg-muted rounded">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats?.inProgressTickets || 0}
              </p>
            </div>
            <div className="p-3 bg-muted rounded">
              <p className="text-sm text-muted-foreground">Closed</p>
              <p className="text-2xl font-bold text-green-600">
                {stats?.closedTickets || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setShowAddUser(!showAddUser)}
            data-testid="button-add-user"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add User
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddUser && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onAddUserSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Doe"
                            {...field}
                            data-testid="input-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            {...field}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••"
                            {...field}
                            data-testid="input-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full px-3 py-2 border rounded-md"
                            data-testid="select-role"
                          >
                            <option value="support_agent">Support Agent</option>
                            <option value="tenant_admin">Tenant Admin</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={addUserMutation.isPending}
                      data-testid="button-create-user"
                    >
                      {addUserMutation.isPending ? "Adding..." : "Create User"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddUser(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {usersLoading ? (
            <p className="text-muted-foreground">Loading users...</p>
          ) : tenantUsers.length === 0 ? (
            <p className="text-muted-foreground">No users in this tenant</p>
          ) : (
            <div className="space-y-3">
              {tenantUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded"
                  data-testid={`user-row-${user.id}`}
                >
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge
                    variant={user.role === "tenant_admin" ? "default" : "secondary"}
                  >
                    {user.role.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quota Monitoring */}
      <Card>
        <CardHeader>
          <CardTitle>Quota & Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <QuotaMonitoring />
        </CardContent>
      </Card>

      {/* Tenant Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <TenantConfiguration />
        </CardContent>
      </Card>

      {/* Export Data */}
      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
        </CardHeader>
        <CardContent>
          <DataExport />
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditLogViewer />
        </CardContent>
      </Card>

      {/* Tenant Isolation Info */}
      <Card>
        <CardHeader>
          <CardTitle>Data Isolation & Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
            <p className="font-medium text-green-900 dark:text-green-100">
              Strict Tenant Isolation
            </p>
            <p className="text-sm text-green-800 dark:text-green-200 mt-1">
              All data (customers, tickets, messages) is isolated per tenant and cannot be accessed by other tenants
            </p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Role-Based Access Control
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              Users have specific roles (support_agent, tenant_admin) with different permissions
            </p>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded">
            <p className="font-medium text-purple-900 dark:text-purple-100">
              Secure Authentication
            </p>
            <p className="text-sm text-purple-800 dark:text-purple-200 mt-1">
              JWT tokens include tenant context and are verified on every request
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
