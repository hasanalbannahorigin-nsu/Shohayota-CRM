/**
 * MCP Layout Component
 * Provides sidebar and layout for MCP admin console
 */

import { Outlet, Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Plus, 
  Settings, 
  Activity,
  ArrowLeft,
  List,
  BarChart3
} from "lucide-react";

export default function McpLayout() {
  const { user } = useAuth();
  const [location] = useLocation();

  // Check if user has access
  const roles = (user as any)?.roles || (user?.role ? [user.role] : []);
  const isPlatformAdmin = roles.includes("platform_admin") || user?.role === "platform_admin" || user?.role === "super_admin";
  const isTenantAdmin = roles.includes("tenant_admin") || user?.role === "tenant_admin";

  if (!user || (!isPlatformAdmin && !isTenantAdmin)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Card className="p-8">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You need platform_admin or tenant_admin role to access MCP.
          </p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      <aside className="w-64 border-r bg-muted/40 p-4">
        <div className="mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Master Control Plane
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isPlatformAdmin ? "Platform Administration" : "Tenant Administration"}
          </p>
        </div>
        
        <nav className="space-y-2">
          {isPlatformAdmin && (
            <>
              <Link href="/mcp/tenants">
                <Button
                  variant={location.startsWith("/mcp/tenants") ? "default" : "ghost"}
                  className="w-full justify-start"
                >
                  <List className="h-4 w-4 mr-2" />
                  Tenants
                </Button>
              </Link>
              <Link href="/mcp/new-tenant">
                <Button
                  variant={location === "/mcp/new-tenant" ? "default" : "ghost"}
                  className="w-full justify-start"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Tenant
                </Button>
              </Link>
              <Link href="/mcp/jobs">
                <Button
                  variant={location === "/mcp/jobs" ? "default" : "ghost"}
                  className="w-full justify-start"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Background Jobs
                </Button>
              </Link>
            </>
          )}
          
          {isTenantAdmin && (
            <Link href={`/mcp/tenants/${user.tenantId}`}>
              <Button
                variant={location === `/mcp/tenants/${user.tenantId}` ? "default" : "ghost"}
                className="w-full justify-start"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                My Tenant
              </Button>
            </Link>
          )}
        </nav>
      </aside>
      
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}

