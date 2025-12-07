import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  userId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export function AuditLogViewer() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs", { action: actionFilter, resourceType: resourceFilter }],
  });

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userId?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      create: "bg-green-500",
      update: "bg-blue-500",
      delete: "bg-red-500",
      login: "bg-purple-500",
      logout: "bg-gray-500",
    };
    return colors[action] || "bg-gray-500";
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading audit logs...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="login">Login</SelectItem>
          </SelectContent>
        </Select>
        <Select value={resourceFilter} onValueChange={setResourceFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="ticket">Ticket</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="tenant">Tenant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>User</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No audit logs found
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.slice(0, 50).map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <Badge className={getActionBadge(log.action)}>{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.resourceType}
                    {log.resourceId && (
                      <span className="text-muted-foreground ml-1">
                        ({log.resourceId.substring(0, 8)})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{log.userId || "System"}</TableCell>
                  <TableCell className="text-sm">{log.ipAddress || "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

