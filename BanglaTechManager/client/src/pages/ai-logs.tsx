import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Search, Filter, Clock, DollarSign, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface AIOperationLog {
  id: string;
  operationType: string;
  modelProvider?: string;
  modelName?: string;
  status: string;
  tokensUsed?: number;
  cost?: number;
  latency?: number;
  confidence?: number;
  createdAt: string;
}

export default function AILogsPage() {
  const [logs, setLogs] = useState<AIOperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();
  }, [operationTypeFilter]);

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (operationTypeFilter !== "all") {
        params.append("operationType", operationTypeFilter);
      }
      
      const response = await api.get<{ logs: AIOperationLog[]; total: number }>(
        `/ai/logs?${params.toString()}`
      );
      setLogs(response.logs || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) =>
    log.operationType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.modelName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    if (status === "completed") {
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
    } else if (status === "failed") {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Operation Logs</h1>
        <p className="text-muted-foreground mt-1">
          Monitor AI operations, costs, and performance
        </p>
      </div>

      <Card>
        <CardHeader>
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
            <Select value={operationTypeFilter} onValueChange={setOperationTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operations</SelectItem>
                <SelectItem value="transcription">Transcription</SelectItem>
                <SelectItem value="nlu">NLU</SelectItem>
                <SelectItem value="bot">Bot</SelectItem>
                <SelectItem value="rag">RAG</SelectItem>
                <SelectItem value="nlq">NLQ</SelectItem>
                <SelectItem value="assist">Assist</SelectItem>
                <SelectItem value="summarize">Summarize</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No logs found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.operationType}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.modelName ? (
                        <div>
                          <div className="font-medium">{log.modelName}</div>
                          {log.modelProvider && (
                            <div className="text-xs text-muted-foreground">{log.modelProvider}</div>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell>{log.tokensUsed?.toLocaleString() || "-"}</TableCell>
                    <TableCell>
                      {log.cost !== undefined ? (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {(log.cost / 100).toFixed(2)}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {log.latency ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {log.latency}ms
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {log.confidence !== undefined ? (
                        <div className="flex items-center gap-1">
                          {log.confidence}%
                        </div>
                      ) : (
                        "-"
                      )}
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

