import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo, memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";

interface Tenant {
  id: string;
  name: string;
  slug?: string;
}

export const TenantSwitcher = memo(function TenantSwitcher() {
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Memoize user to prevent unnecessary re-renders
  const userId = useMemo(() => user?.id, [user?.id]);
  const userRole = useMemo(() => user?.role, [user?.role]);
  const userTenantId = useMemo(() => user?.tenantId, [user?.tenantId]);

  useEffect(() => {
    const fetchTenants = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // For super_admin, fetch all tenants
        if (userRole === "super_admin") {
          const response = await api.get<Tenant[]>("/admin/tenants");
          const allTenants = Array.isArray(response) 
            ? response 
            : (response as any).data || [];
          setTenants(allTenants);
          
          // Set current tenant from user's tenantId
          const current = allTenants.find((t: Tenant) => t.id === userTenantId) || allTenants[0];
          setSelectedTenant(current);
        } else {
          // For regular users, only show their own tenant
          const response = await api.get<Tenant>("/tenants/current");
          const tenant = response || (response as any).data;
          if (tenant) {
            setTenants([tenant]);
            setSelectedTenant(tenant);
          }
        }
      } catch (error) {
        console.error("Failed to fetch tenants:", error);
        // Fallback: use user's tenantId if available
        if (userTenantId) {
          const fallbackTenant = {
            id: userTenantId,
            name: userTenantId.substring(0, 8) + "...", // Truncated ID as fallback
          };
          setTenants([fallbackTenant]);
          setSelectedTenant(fallbackTenant);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTenants();
  }, [user, userId, userRole, userTenantId]);

  // Show placeholder during loading to prevent layout shift
  if (!user) {
    return null;
  }

  if (loading || !selectedTenant) {
    return (
      <Button
        variant="outline"
        className="w-60 justify-start"
        disabled
        data-testid="button-tenant-switcher"
      >
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="truncate">Loading...</span>
        </div>
      </Button>
    );
  }

  // For non-super-admins, only show current tenant (no switching allowed)
  if (user.role !== "super_admin" && tenants.length === 1) {
    return (
      <Button
        variant="outline"
        className="w-60 justify-start"
        disabled
        data-testid="button-tenant-switcher"
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span className="truncate">{selectedTenant.name}</span>
        </div>
      </Button>
    );
  }

  // For super_admin, allow switching
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-60 justify-between"
          data-testid="button-tenant-switcher"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="truncate">{selectedTenant.name}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0">
        <Command>
          <CommandInput placeholder="Search tenant..." />
          <CommandList>
            <CommandEmpty>No tenant found.</CommandEmpty>
            <CommandGroup>
              {tenants.map((tenant) => (
                <CommandItem
                  key={tenant.id}
                  value={tenant.name}
                  onSelect={() => {
                    setSelectedTenant(tenant);
                    setOpen(false);
                    // NOTE: Actual tenant switching would require re-authentication
                    // For now, this is just UI - backend enforces tenant from JWT
                    console.warn("Tenant switching requires re-authentication. Current tenant:", tenant.name);
                  }}
                  data-testid={`tenant-${tenant.id}`}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      selectedTenant.id === tenant.id
                        ? "opacity-100"
                        : "opacity-0"
                    }`}
                  />
                  {tenant.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
