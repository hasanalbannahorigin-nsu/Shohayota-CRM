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
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: TrendingUp,
  },
  {
    title: "AI Assistant",
    url: "/ai-assistant-final",
    icon: Bot,
  },
  {
    title: "Phone Calls",
    url: "/phone-calls",
    icon: Phone,
  },
  {
    title: "Notifications",
    url: "/notifications",
    icon: Bell,
  },
  {
    title: "Tenant Settings",
    url: "/tenant-settings",
    icon: Lock,
  },
  {
    title: "Roles & Permissions",
    url: "/roles",
    icon: Shield,
  },
  {
    title: "Teams",
    url: "/teams",
    icon: Users,
  },
  {
    title: "Invites",
    url: "/invites",
    icon: UserPlus,
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
  },
  {
    title: "SLA Policies",
    url: "/sla",
    icon: Clock,
  },
  {
    title: "Integrations",
    url: "/integrations",
    icon: Plug,
  },
  {
    title: "AI Settings",
    url: "/ai-settings",
    icon: Brain,
  },
  {
    title: "Knowledge Base",
    url: "/knowledge-base",
    icon: FileText,
  },
  {
    title: "AI Logs",
    url: "/ai-logs",
    icon: Activity,
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

  // Add super-admin menu item if user is super admin
  const allMenuItems = useMemo(() => [
    ...menuItems,
    ...(isSuperAdmin
      ? [
          {
            title: "Super Admin",
            url: "/super-admin",
            icon: Shield,
          },
        ]
      : []),
  ], [isSuperAdmin]);

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
