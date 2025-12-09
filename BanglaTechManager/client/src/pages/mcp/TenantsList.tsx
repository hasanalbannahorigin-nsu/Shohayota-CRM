/**
 * Tenants List Page
 * Lists all tenants with actions (view, suspend, activate, migrate)
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Building2, 
  Play, 
  Pause, 
  RefreshCw, 
  Eye,
  MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface Tenant {
  id: string;
  name: string;
  slug?: string;
  contactEmail?: string;
  status: string;
  plan: string;
  createdAt: string;
}

export default function TenantsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["mcp", "tenants", page],
    queryFn: async () => {
      const res = await fetch(`/mcp/api/tenants?page=${page}&perPage=20`);
      if (!res.ok) throw new Error("Failed to fetch tenants");
      return res.json();
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await fetch(`/mcp/api/tenants/${tenantId}/suspend`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to suspend tenant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "tenants"] });
      toast({ title: "Tenant suspended successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await fetch(`/mcp/api/tenants/${tenantId}/activate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to activate tenant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "tenants"] });
      toast({ title: "Tenant activated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const migrateMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await fetch(`/mcp/api/tenants/${tenantId}/migrate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to run migration");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Migration enqueued", description: `Job ID: ${data.data.jobId}` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="text-muted-foreground">Loading tenants...</div>;
  }

  if (error) {
    return <div className="text-destructive">Error loading tenants</div>;
  }

  const tenants: Tenant[] = data?.data || [];
  const pagination = data?.pagination || { page: 1, perPage: 20, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">Manage all platform tenants</p>
        </div>
        <Link href="/mcp/new-tenant">
          <Button>
            <Building2 className="h-4 w-4 mr-2" />
            New Tenant
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>
            {pagination.total} total tenants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No tenants found
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>
                      <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{tenant.plan}</TableCell>
                    <TableCell>
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/mcp/tenants/${tenant.id}`}>
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </Link>
                          {tenant.status === "active" ? (
                            <DropdownMenuItem
                              onClick={() => suspendMutation.mutate(tenant.id)}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => activateMutation.mutate(tenant.id)}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => migrateMutation.mutate(tenant.id)}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Run Migration
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pagination.total > pagination.perPage && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {Math.ceil(pagination.total / pagination.perPage)}
          </span>
          <Button
            variant="outline"
            disabled={page >= Math.ceil(pagination.total / pagination.perPage)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

