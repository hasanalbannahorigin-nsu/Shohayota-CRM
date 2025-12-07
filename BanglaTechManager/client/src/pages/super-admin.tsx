import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Building2, Plus, Download, Trash2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { getToken } from "@/lib/auth";

export default function SuperAdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [provisionDialogOpen, setProvisionDialogOpen] = useState(false);
  const [provisionForm, setProvisionForm] = useState({
    name: "",
    contactEmail: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    plan: "basic",
    slug: "",
  });

  // Fetch all tenants
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["/api/admin/tenants"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tenants", {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch tenants");
      return res.json();
    },
  });

  // Provision tenant mutation
  const provisionMutation = useMutation({
    mutationFn: async (data: typeof provisionForm) => {
      const res = await apiRequest("POST", "/api/admin/tenants/provision", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Tenant provisioned",
        description: `Tenant "${data.tenant.name}" created successfully. Admin token: ${data.adminToken.substring(0, 20)}...`,
      });
      setProvisionDialogOpen(false);
      setProvisionForm({
        name: "",
        contactEmail: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
        plan: "basic",
        slug: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
    },
    onError: (error: any) => {
      toast({
        title: "Provisioning failed",
        description: error.message || "Failed to provision tenant",
        variant: "destructive",
      });
    },
  });

  // Update tenant status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ tenantId, status }: { tenantId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/tenants/${tenantId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: "Tenant status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update tenant status",
        variant: "destructive",
      });
    },
  });

  // Export tenant data mutation
  const exportMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await fetch(`/api/tenants/export?tenantId=${tenantId}`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tenant-${tenantId}-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Export successful",
        description: "Tenant data exported successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export failed",
        description: error.message || "Failed to export tenant data",
        variant: "destructive",
      });
    },
  });

  const handleProvision = () => {
    if (!provisionForm.name || !provisionForm.contactEmail || !provisionForm.adminName || !provisionForm.adminEmail || !provisionForm.adminPassword) {
      toast({
        title: "Validation error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }
    provisionMutation.mutate(provisionForm);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trialing: "secondary",
      suspended: "destructive",
      canceled: "outline",
      deleted: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Super Admin - Tenant Management</h1>
          <p className="text-muted-foreground mt-2">Manage all tenants, provisioning, and system-wide settings</p>
        </div>
        <Dialog open={provisionDialogOpen} onOpenChange={setProvisionDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Provision New Tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Provision New Tenant</DialogTitle>
              <DialogDescription>
                Create a new tenant with default settings and an admin user
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tenant Name *</Label>
                  <Input
                    id="name"
                    value={provisionForm.name}
                    onChange={(e) => setProvisionForm({ ...provisionForm, name: e.target.value })}
                    placeholder="Acme Corporation"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (optional)</Label>
                  <Input
                    id="slug"
                    value={provisionForm.slug}
                    onChange={(e) => setProvisionForm({ ...provisionForm, slug: e.target.value })}
                    placeholder="acme-corp"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={provisionForm.contactEmail}
                  onChange={(e) => setProvisionForm({ ...provisionForm, contactEmail: e.target.value })}
                  placeholder="contact@acme.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminName">Admin Name *</Label>
                  <Input
                    id="adminName"
                    value={provisionForm.adminName}
                    onChange={(e) => setProvisionForm({ ...provisionForm, adminName: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Admin Email *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={provisionForm.adminEmail}
                    onChange={(e) => setProvisionForm({ ...provisionForm, adminEmail: e.target.value })}
                    placeholder="admin@acme.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Admin Password *</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    value={provisionForm.adminPassword}
                    onChange={(e) => setProvisionForm({ ...provisionForm, adminPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan">Plan</Label>
                  <Select
                    value={provisionForm.plan}
                    onValueChange={(value) => setProvisionForm({ ...provisionForm, plan: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProvisionDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleProvision} disabled={provisionMutation.isPending}>
                {provisionMutation.isPending ? "Provisioning..." : "Provision Tenant"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>Manage tenant lifecycle and settings</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading tenants...</div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No tenants found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Contact Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant: any) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>{tenant.slug || "-"}</TableCell>
                    <TableCell>{tenant.contactEmail}</TableCell>
                    <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{tenant.plan}</Badge>
                    </TableCell>
                    <TableCell>{new Date(tenant.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={tenant.status}
                          onValueChange={(status) =>
                            updateStatusMutation.mutate({ tenantId: tenant.id, status })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="trialing">Trialing</SelectItem>
                            <SelectItem value="suspended">Suspend</SelectItem>
                            <SelectItem value="canceled">Cancel</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportMutation.mutate(tenant.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

