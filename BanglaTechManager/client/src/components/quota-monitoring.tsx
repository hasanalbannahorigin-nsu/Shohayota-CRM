import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Users, Database, Activity, AlertTriangle } from "lucide-react";

interface QuotaData {
  users: { used: number; limit: number };
  customers: { used: number; limit: number };
  storage: { used: number; limit: number }; // bytes
  apiCalls: { used: number; limit: number };
}

export function QuotaMonitoring() {
  const { data: quotas, isLoading } = useQuery<QuotaData>({
    queryKey: ["/api/tenants/quotas"],
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading quotas...</div>;
  }

  if (!quotas) {
    return <div className="text-sm text-muted-foreground">No quota data available</div>;
  }

  // Defensive checks for nested properties
  if (!quotas.users || !quotas.customers || !quotas.storage || !quotas.apiCalls) {
    return <div className="text-sm text-muted-foreground">Incomplete quota data</div>;
  }

  const getPercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return "destructive";
    if (percentage >= 75) return "default";
    return "default";
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const quotaItems = [
    {
      label: "Users",
      used: quotas.users?.used ?? 0,
      limit: quotas.users?.limit ?? 0,
      icon: Users,
      format: (n: number) => n.toString(),
    },
    {
      label: "Customers",
      used: quotas.customers?.used ?? 0,
      limit: quotas.customers?.limit ?? 0,
      icon: Users,
      format: (n: number) => n.toString(),
    },
    {
      label: "Storage",
      used: quotas.storage?.used ?? 0,
      limit: quotas.storage?.limit ?? 0,
      icon: Database,
      format: formatBytes,
    },
    {
      label: "API Calls",
      used: quotas.apiCalls?.used ?? 0,
      limit: quotas.apiCalls?.limit ?? 0,
      icon: Activity,
      format: (n: number) => n.toLocaleString(),
    },
  ];

  return (
    <div className="space-y-4">
      {quotaItems.map((item) => {
        const percentage = getPercentage(item.used, item.limit);
        const isWarning = percentage >= 75;

        return (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {isWarning && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                <span className="text-muted-foreground">
                  {item.format(item.used)} / {item.format(item.limit)}
                </span>
              </div>
            </div>
            <Progress value={percentage} className="h-2" />
            {isWarning && (
              <p className="text-xs text-yellow-600">
                {percentage >= 90
                  ? "Quota nearly exceeded"
                  : "Approaching quota limit"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

