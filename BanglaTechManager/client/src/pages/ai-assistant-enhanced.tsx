import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Bot, User, Loader } from "lucide-react";
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
}

export default function AIAssistantEnhanced() {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "1",
      content:
        "Hello! I'm your AI assistant. I can help you find customers, analyze tickets, generate reports, and answer questions about your CRM data. What would you like to know?",
      sender: "ai",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState("");
  const { toast } = useToast();

  const aiQueryMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/ai/query", { query });
      return res.json();
    },
    onSuccess: (aiResponse: any) => {
      const aiMsg: AIMessage = {
        id: String(messages.length + 2),
        content: aiResponse.content,
        sender: "ai",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to get AI response",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;

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

  const exampleQueries = [
    "Show me all open tickets",
    "Find customer Rahim Ahmed",
    "Generate this week's report",
    "What's the average response time?",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">AI Assistant</h1>
        <p className="text-muted-foreground mt-1">
          Natural language queries and intelligent insights
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <CardTitle>Conversational AI</CardTitle>
                <Badge variant="secondary">Powered by OpenAI</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-4 ${
                        message.sender === "user" ? "flex-row-reverse" : ""
                      }`}
                      data-testid={`ai-message-${message.id}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        {message.sender === "user" ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div
                        className={`flex flex-col gap-2 ${
                          message.sender === "user" ? "items-end" : ""
                        }`}
                      >
                        <div
                          className={`rounded-lg px-4 py-3 max-w-2xl ${
                            message.sender === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}
                  {aiQueryMutation.isPending && (
                    <div className="flex gap-4">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Loader className="h-4 w-4 text-primary animate-spin" />
                      </div>
                      <div className="rounded-lg px-4 py-3 bg-muted">
                        <p className="text-sm text-muted-foreground">
                          Thinking...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="p-6 border-t">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Ask me anything about your CRM data..."
                    disabled={aiQueryMutation.isPending}
                    data-testid="input-ai-query"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={
                      !input.trim() || aiQueryMutation.isPending
                    }
                    data-testid="button-send-query"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Example Queries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {exampleQueries.map((query, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full justify-start text-left"
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
                    }, 0);
                  }}
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
              <div>
                <p className="font-medium">Search & Find</p>
                <p className="text-xs text-muted-foreground">
                  Locate customers and tickets quickly
                </p>
              </div>
              <div>
                <p className="font-medium">Analytics</p>
                <p className="text-xs text-muted-foreground">
                  Get CRM insights and statistics
                </p>
              </div>
              <div>
                <p className="font-medium">Reports</p>
                <p className="text-xs text-muted-foreground">
                  Generate performance metrics
                </p>
              </div>
              <div>
                <p className="font-medium">Assistance</p>
                <p className="text-xs text-muted-foreground">
                  Help with CRM tasks and queries
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
