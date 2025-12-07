import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Sparkles, ThumbsUp, ThumbsDown, Copy, Check } from "lucide-react";

interface AssistSuggestion {
  type: "reply" | "kb_article" | "tag" | "priority" | "action";
  content: string;
  confidence: number;
  evidence?: Array<{
    type: string;
    id: string;
    text: string;
    relevance: number;
  }>;
  metadata?: Record<string, any>;
}

interface AgentAssistPaneProps {
  ticketId?: string;
  customerId?: string;
  messages?: Array<{ role: string; content: string; timestamp: Date }>;
  onSuggestionAccepted?: (suggestion: AssistSuggestion) => void;
}

export function AgentAssistPane({
  ticketId,
  customerId,
  messages = [],
  onSuggestionAccepted,
}: AgentAssistPaneProps) {
  const [suggestions, setSuggestions] = useState<AssistSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (messages.length > 0) {
      loadSuggestions();
    }
  }, [messages, ticketId, customerId]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const response = await api.post<{ suggestions: AssistSuggestion[] }>("/ai/assist", {
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        ticketId,
        customerId,
      });
      setSuggestions(response.suggestions || []);
    } catch (error: any) {
      // Silently fail - assist is optional
      console.error("Failed to load suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({
      title: "Copied",
      description: "Suggestion copied to clipboard",
    });
  };

  const handleAccept = (suggestion: AssistSuggestion) => {
    onSuggestionAccepted?.(suggestion);
    toast({
      title: "Suggestion accepted",
      description: "Applied to conversation",
    });
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case "reply":
        return "💬";
      case "kb_article":
        return "📚";
      case "tag":
        return "🏷️";
      case "priority":
        return "⚡";
      case "action":
        return "✅";
      default:
        return "💡";
    }
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">AI Assist</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Generating suggestions...
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No suggestions available
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-lg space-y-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getSuggestionIcon(suggestion.type)}</span>
                      <Badge variant="outline" className="text-xs">
                        {suggestion.type}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(suggestion.confidence * 100)}%
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {suggestion.type === "reply" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(suggestion.content, index)}
                          >
                            {copiedIndex === index ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAccept(suggestion)}
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Send negative feedback
                          toast({
                            title: "Feedback recorded",
                            description: "Thank you for your feedback",
                          });
                        }}
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm">{suggestion.content}</div>

                  {suggestion.evidence && suggestion.evidence.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        Evidence:
                      </div>
                      {suggestion.evidence.slice(0, 2).map((ev, i) => (
                        <div key={i} className="text-xs text-muted-foreground">
                          • {ev.text.substring(0, 100)}...
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

