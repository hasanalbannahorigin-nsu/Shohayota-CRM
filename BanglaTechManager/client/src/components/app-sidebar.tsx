import {
  Building2,
  Users,
  Ticket,
  MessageSquare,
  BarChart3,
  Settings,
  Bot,
  TrendingUp,
  Phone,
  Bell,
  Lock,
  Shield,
  Brain,
  FileText,
  Activity,
  UserCog,
  UserPlus,
  Key,
  Tag,
  Clock,
  Plug,
  Server,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { memo, useMemo } from "react";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: BarChart3,
    roles: ["tenant_admin", "support_agent", "super_admin"],
  },
  {
    title: "My Dashboard",
    url: "/customer/dashboard",
    icon: BarChart3,
    roles: ["customer"],
  },
  {
    title: "Customers",
    url: "/customers",
    icon: Users,
  },
  {
    title: "Tickets",
    url: "/tickets",
    icon: Ticket,
  },
  {
    title: "Messages",
    url: "/messages-new",
    icon: MessageSquare,
    roles: ["tenant_admin", "support_agent", "super_admin"],
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: TrendingUp,
    roles: ["tenant_admin", "support_agent", "super_admin"],
  },
  {
    title: "AI Assistant",
    url: "/ai-assistant-final",
    icon: Bot,
    roles: ["tenant_admin", "support_agent", "super_admin"],
  },
  {
    title: "Phone Calls",
    url: "/phone-calls",
    icon: Phone,
    roles: ["tenant_admin", "support_agent", "super_admin"],
  },
  {
    title: "Notifications",
    url: "/notifications",
    icon: Bell,
    roles: ["tenant_admin", "support_agent", "super_admin"],
  },
  {
    title: "Tenant Settings",
    url: "/tenant-settings",
    icon: Lock,
    roles: ["tenant_admin", "super_admin"],
  },
  {
    title: "Roles & Permissions",
    url: "/roles",
    icon: Shield,
    roles: ["tenant_admin", "super_admin"],
  },
  {
    title: "Teams",
    url: "/teams",
    icon: Users,
    roles: ["tenant_admin", "super_admin"],
  },
  {
    title: "Invites",
    url: "/invites",
    icon: UserPlus,
    roles: ["tenant_admin", "super_admin"],
  },
  {
    title: "MFA Setup",
    url: "/mfa",
    icon: Key,
  },
  {
    title: "Tags",
    url: "/tags",
    icon: Tag,
    roles: ["tenant_admin", "support_agent", "super_admin"],
  },
  {
    title: "SLA Policies",
    url: "/sla",
    icon: Clock,
    roles: ["tenant_admin", "super_admin"],
  },
  {
    title: "Integrations",
    url: "/integrations",
    icon: Plug,
    roles: ["tenant_admin", "super_admin"],
  },
  {
    title: "MCP Server",
    url: "/mcp-server",
    icon: Server,
    roles: ["tenant_admin", "super_admin"],
  },
  {
    title: "AI Settings",
    url: "/ai-settings",
    icon: Brain,
    roles: ["tenant_admin", "super_admin"],
  },
  {
    title: "Knowledge Base",
    url: "/knowledge-base",
    icon: FileText,
    roles: ["tenant_admin", "support_agent", "super_admin"],
  },
  {
    title: "AI Logs",
    url: "/ai-logs",
    icon: Activity,
    roles: ["tenant_admin", "super_admin"],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export const AppSidebar = memo(function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.role === "super_admin", [user?.role]);

  // Filter menu items based on user role
  const allMenuItems = useMemo(() => {
    const userRole = user?.role;
    
    // For customers, only show customer dashboard
    if (userRole === "customer") {
      return menuItems.filter((item) => item.roles?.includes("customer") || item.title === "My Dashboard");
    }
    
    // For other roles, filter by allowed roles
    const filtered = menuItems.filter((item) => {
      if (!item.roles) return true; // Show items without role restrictions
      return item.roles.includes(userRole || "");
    });
    
    // Add super-admin menu item if user is super admin
    if (isSuperAdmin) {
      filtered.push({
        title: "Super Admin",
        url: "/super-admin",
        icon: Shield,
      });
    }
    
    return filtered;
  }, [isSuperAdmin, user?.role]);

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-sidebar-foreground">
              Sohayota CRM
            </h2>
            <p className="text-xs text-muted-foreground">সহায়তা</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
});
