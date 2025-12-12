import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Bot, User, Loader, AlertCircle, Lightbulb } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AIMessage {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: string;
  type?: "answer" | "error" | "suggestion";
}

export default function AIAssistantFinal() {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "1",
      content:
        "Hello! 👋 I'm your AI-powered CRM assistant. I can help you with:\n\n📊 Ticket Analysis\n👥 Customer Insights\n📈 Reports & Metrics\n⏱️ Response Times\n🔍 Search & Find\n\nJust ask me anything about your CRM! Type 'help' to see all commands.",
      sender: "ai",
      timestamp: new Date().toLocaleTimeString(),
      type: "answer",
    },
  ]);
  const [input, setInput] = useState("");
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const aiQueryMutation = useMutation({
    mutationFn: async (query: string) => {
      // Try new endpoint first, fallback to old one for compatibility
      try {
        const res = await apiRequest("POST", "/api/v1/ai/chat", { query });
        if (!res.ok) {
          throw new Error("Failed to get AI response");
        }
        const data = await res.json();
        
        // Handle new response format: { success: true, data: { text: "...", provider: "gemini" | "rule" } }
        if (data.success && data.data) {
          return {
            content: data.data.text,
            provider: data.data.provider || "gemini",
            type: "answer" as const,
          };
        }
        
        // Fallback to old format if needed
        return data;
      } catch (error) {
        // Fallback to legacy endpoint
        const res = await apiRequest("POST", "/api/ai/query", { query });
        if (!res.ok) {
          throw new Error("Failed to get AI response");
        }
        return res.json();
      }
    },
    onSuccess: (aiResponse: any) => {
      // Handle both new and old response formats
      let content = "";
      let type: "answer" | "error" | "suggestion" = "answer";
      
      if (aiResponse.content) {
        // Old format
        content = aiResponse.content;
        type = aiResponse.type || "answer";
      } else if (typeof aiResponse === "string") {
        // Direct string response
        content = aiResponse;
      } else {
        throw new Error("Invalid response from AI");
      }

      const aiMsg: AIMessage = {
        id: aiResponse.id || String(messages.length + 2),
        content: content,
        sender: "ai",
        timestamp: new Date().toLocaleTimeString(),
        type: type,
      };
      setMessages((prev) => [...prev, aiMsg]);
      
      // Show provider badge if available
      if (aiResponse.provider) {
        toast({
          title: "AI Response",
          description: `Powered by ${aiResponse.provider === "gemini" ? "Gemini AI" : "Rule-based"}`,
          variant: "default",
        });
      }
    },
    onError: (error: any) => {
      const errorMsg: AIMessage = {
        id: String(messages.length + 2),
        content: `⚠️ ${
          error.message || "Failed to get response. Please try again."
        }`,
        sender: "ai",
        timestamp: new Date().toLocaleTimeString(),
        type: "error",
      };
      setMessages((prev) => [...prev, errorMsg]);

      toast({
        title: "Error",
        description: error.message || "Failed to process query",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;
    if (aiQueryMutation.isPending) return;

    const userMessage: AIMessage = {
      id: String(messages.length + 1),
      content: input,
      sender: "user",
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    aiQueryMutation.mutate(input);
    setInput("");
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const exampleQueries = [
    "Show open tickets",
    "Customer summary",
    "Generate report",
    "High priority items",
  ];

  const getMessageIcon = (message: AIMessage) => {
    if (message.sender === "user") {
      return <User className="h-4 w-4" />;
    }

    switch (message.type) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "suggestion":
        return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      default:
        return <Bot className="h-4 w-4 text-primary" />;
    }
  };

  const getMessageBadgeColor = (type?: string) => {
    switch (type) {
      case "error":
        return "destructive";
      case "suggestion":
        return "secondary";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">AI Assistant</h1>
        <p className="text-muted-foreground mt-1">
          Intelligent CRM insights and support - ask me anything!
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle>AI Assistant</CardTitle>
                </div>
                <Badge variant="outline">
                  {aiQueryMutation.isPending ? "Thinking..." : "Powered by Gemini AI"}
                </Badge>
              </div>
            </CardHeader>

            <ScrollArea
              ref={scrollRef}
              className="flex-1 p-6 space-y-4 overflow-hidden"
            >
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.sender === "user" ? "flex-row-reverse" : ""
                    }`}
                    data-testid={`ai-message-${message.id}`}
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        message.sender === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {getMessageIcon(message)}
                    </div>
                    <div
                      className={`flex flex-col gap-2 max-w-xl ${
                        message.sender === "user" ? "items-end" : ""
                      }`}
                    >
                      <div
                        className={`rounded-lg px-4 py-3 whitespace-pre-wrap ${
                          message.sender === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp}
                        </span>
                        {message.type && message.sender === "ai" && (
                          <Badge
                            variant={getMessageBadgeColor(message.type) as any}
                            className="text-xs"
                          >
                            {message.type}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {aiQueryMutation.isPending && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <Loader className="h-4 w-4 text-primary animate-spin" />
                    </div>
                    <div className="rounded-lg px-4 py-3 bg-muted">
                      <p className="text-sm text-muted-foreground">
                        Thinking... 🤔
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t space-y-3">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask me about tickets, customers, reports..."
                  disabled={aiQueryMutation.isPending}
                  data-testid="input-ai-query"
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || aiQueryMutation.isPending}
                  data-testid="button-send-query"
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Tip: Press Shift+Enter for new line, Enter to send
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Commands</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {exampleQueries.map((query, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full justify-start text-left text-sm"
                  onClick={() => {
                    setInput(query);
                    setTimeout(() => {
                      const userMessage: AIMessage = {
                        id: String(messages.length + 1),
                        content: query,
                        sender: "user",
                        timestamp: new Date().toLocaleTimeString(),
                      };
                      setMessages((prev) => [...prev, userMessage]);
                      aiQueryMutation.mutate(query);
                    }, 100);
                  }}
                  disabled={aiQueryMutation.isPending}
                  data-testid={`example-query-${index}`}
                >
                  {query}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capabilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1">
                <p className="font-medium">📊 Analytics</p>
                <p className="text-xs text-muted-foreground">
                  Metrics & Reports
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">🎟️ Tickets</p>
                <p className="text-xs text-muted-foreground">
                  Status, Priority
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">👥 Customers</p>
                <p className="text-xs text-muted-foreground">
                  Info, Overview
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">⏱️ Performance</p>
                <p className="text-xs text-muted-foreground">
                  Response times
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>✓ Be specific with queries</p>
              <p>✓ Use natural language</p>
              <p>✓ Type 'help' for commands</p>
              <p>✓ Ask about any CRM topic</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
