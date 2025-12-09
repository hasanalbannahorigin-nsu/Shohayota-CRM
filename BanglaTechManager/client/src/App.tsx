import { Switch, Route, useLocation } from "wouter";
import { useMemo } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { SearchBar } from "@/components/search-bar";
import { VoiceCommandButton } from "@/components/voice-command-button";
import { UserMenu } from "@/components/user-menu";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import CustomersPage from "@/pages/customers";
import TicketsPage from "@/pages/tickets";
import TicketDetailPage from "@/pages/tickets-detail";
import MessagesNewPage from "@/pages/messages-new";
import AnalyticsPage from "@/pages/analytics";
import AIAssistantFinal from "@/pages/ai-assistant-final";
import PhoneCallsPage from "@/pages/phone-calls";
import NotificationsPage from "@/pages/notifications";
import TenantSettingsPage from "@/pages/tenant-settings";
import SettingsPage from "@/pages/settings";
import SuperAdminPage from "@/pages/super-admin";
import RolesManagementPage from "@/pages/roles-management";
import TeamsManagementPage from "@/pages/teams-management";
import CustomerDetailPage from "@/pages/customer-detail";
import CallDetailPage from "@/pages/call-detail";
import IntegrationsPage from "@/pages/integrations";
import IntegrationMappingPage from "@/pages/integration-mapping";
import CustomerDashboardPage from "@/pages/customer-dashboard";
import McpLayout from "@/pages/mcp/McpLayout";
import TenantsList from "@/pages/mcp/TenantsList";
import TenantDetail from "@/pages/mcp/TenantDetail";
import NewTenantForm from "@/pages/mcp/NewTenantForm";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/customer/dashboard" component={CustomerDashboardPage} />
      <Route path="/" component={DashboardPage} />
      <Route path="/customers" component={CustomersPage} />
      <Route path="/tickets" component={TicketsPage} />
      <Route path="/tickets/detail" component={TicketDetailPage} />
      <Route path="/messages-new" component={MessagesNewPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/ai-assistant-final" component={AIAssistantFinal} />
      <Route path="/phone-calls" component={PhoneCallsPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/tenant-settings" component={TenantSettingsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/super-admin" component={SuperAdminPage} />
      <Route path="/roles" component={RolesManagementPage} />
      <Route path="/teams" component={TeamsManagementPage} />
      <Route path="/customers/detail" component={CustomerDetailPage} />
      <Route path="/calls/detail" component={CallDetailPage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/integrations/mapping" component={IntegrationMappingPage} />
      {/* MCP Routes */}
      <Route path="/mcp" component={McpLayout}>
        <Route path="/tenants" component={TenantsList} />
        <Route path="/tenants/:tenantId" component={TenantDetail} />
        <Route path="/new-tenant" component={NewTenantForm} />
        <Route path="/jobs" component={() => <div className="p-6"><h1 className="text-2xl font-bold">Background Jobs</h1><p className="text-muted-foreground mt-2">Job listing not yet implemented</p></div>} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const style = useMemo(() => ({
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  }), []);

  // Don't render if user is not loaded yet (prevents flickering)
  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b shrink-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <TenantSwitcher />
            </div>
            <div className="flex items-center gap-4">
              <SearchBar />
              <VoiceCommandButton />
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  const [location] = useLocation();
  const isLoginPage = useMemo(() => location === "/login", [location]);
  const isMcpPage = useMemo(() => location.startsWith("/mcp"), [location]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {isLoginPage ? (
          <LoginPage />
        ) : isMcpPage ? (
          <Router />
        ) : (
          <AuthenticatedApp />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
