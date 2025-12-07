import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

interface TicketSummaryProps {
  ticketId: string;
  sourceType: "ticket";
  content: string;
}

export function TicketSummary({ ticketId, sourceType, content }: TicketSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateSummary = async () => {
    setLoading(true);
    try {
      const response = await api.post<{ summary: string }>("/ai/summarize", {
        sourceType,
        sourceId: ticketId,
        content,
      });
      setSummary(response.summary);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate summary",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (content && content.length > 100) {
      generateSummary();
    }
  }, [ticketId, content]);

  if (!content || content.length < 100) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">AI Summary</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={generateSummary}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !summary ? (
          <div className="text-sm text-muted-foreground">Generating summary...</div>
        ) : summary ? (
          <p className="text-sm">{summary}</p>
        ) : (
          <Button variant="outline" size="sm" onClick={generateSummary}>
            Generate Summary
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

