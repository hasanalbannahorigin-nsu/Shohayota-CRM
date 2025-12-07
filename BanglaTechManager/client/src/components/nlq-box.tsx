import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Search, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface NLQQueryPlan {
  type: "read" | "write" | "delete";
  description: string;
  sql?: string;
  riskLevel: "low" | "medium" | "high";
  requiresConfirmation: boolean;
}

interface NLQResult {
  queryPlan: NLQQueryPlan;
  results?: any[];
  executionTime?: number;
  rowCount?: number;
  clarificationPrompts?: string[];
}

export function NLQBox() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NLQResult | null>(null);
  const { toast } = useToast();

  const handleQuery = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await api.post<NLQResult>("/ai/nlq", {
        question: query,
        execute: false, // Start with parse-only
      });

      setResult(response);

      if (response.queryPlan.requiresConfirmation) {
        toast({
          title: "Query needs clarification",
          description: "Please review the query plan",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process query",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!result?.queryPlan) return;

    if (result.queryPlan.riskLevel === "high") {
      toast({
        title: "High-risk query",
        description: "This query requires super-admin approval",
        variant: "destructive",
      });
      return;
    }

    if (result.queryPlan.requiresConfirmation) {
      toast({
        title: "Confirmation required",
        description: "Please confirm the query plan first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<NLQResult>("/ai/nlq", {
        question: query,
        execute: true,
      });
      setResult(response);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to execute query",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "low":
        return <Badge className="bg-green-500">Low Risk</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">Medium Risk</Badge>;
      case "high":
        return <Badge variant="destructive">High Risk</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Natural Language Query
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question in natural language... (e.g., 'Show me open tickets')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleQuery();
              }
            }}
          />
          <Button onClick={handleQuery} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Query"}
          </Button>
        </div>

        {result && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.queryPlan.type === "read" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="font-medium">{result.queryPlan.description}</span>
              </div>
              {getRiskBadge(result.queryPlan.riskLevel)}
            </div>

            {result.queryPlan.sql && (
              <div className="text-xs bg-background p-2 rounded font-mono">
                {result.queryPlan.sql}
              </div>
            )}

            {result.clarificationPrompts && result.clarificationPrompts.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-medium">Clarification needed:</div>
                {result.clarificationPrompts.map((prompt, i) => (
                  <div key={i} className="text-sm text-muted-foreground">• {prompt}</div>
                ))}
              </div>
            )}

            {result.results && (
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  Results ({result.rowCount} rows in {result.executionTime}ms)
                </div>
                <div className="text-xs bg-background p-2 rounded max-h-40 overflow-auto">
                  <pre>{JSON.stringify(result.results, null, 2)}</pre>
                </div>
              </div>
            )}

            {result.queryPlan.type === "read" &&
              result.queryPlan.riskLevel === "low" &&
              !result.queryPlan.requiresConfirmation && (
                <Button onClick={handleExecute} disabled={loading} size="sm">
                  Execute Query
                </Button>
              )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          💡 Tip: Ask questions like "How many open tickets?" or "Show customers from last week"
        </div>
      </CardContent>
    </Card>
  );
}

