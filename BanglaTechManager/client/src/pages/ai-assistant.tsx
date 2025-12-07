import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Bot, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface AIMessage {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: string;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "1",
      content: "Hello! I'm your AI assistant. I can help you find customers, analyze tickets, generate reports, and answer questions about your CRM data. What would you like to know?",
      sender: "ai",
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: AIMessage = {
      id: String(messages.length + 1),
      content: input,
      sender: "user",
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const aiResponse: AIMessage = {
      id: String(messages.length + 2),
      content: getMockResponse(input),
      sender: "ai",
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages([...messages, userMessage, aiResponse]);
    setInput("");
    console.log("AI Query:", input);
  };

  const getMockResponse = (query: string) => {
    const lower = query.toLowerCase();
    if (lower.includes("customer") || lower.includes("rahim")) {
      return "I found 4 customers matching your query. Rahim Ahmed from Dhaka Tech Ltd is one of your active customers with 3 open tickets. Would you like to see more details?";
    } else if (lower.includes("ticket") || lower.includes("open")) {
      return "You currently have 48 open tickets. 3 are marked as high priority. The most recent one is TKT-1234 about email notifications, created 2 hours ago.";
    } else if (lower.includes("report") || lower.includes("analytics")) {
      return "I can generate various reports for you: Customer growth report, Ticket resolution metrics, Agent performance, or Revenue analysis. Which one would you like?";
    }
    return "I understand you're asking about '" + query + "'. I can help you search customers, analyze tickets, generate reports, or provide insights about your CRM data. Could you be more specific?";
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
                </div>
              </ScrollArea>
              <div className="p-6 border-t">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Ask me anything about your CRM data..."
                    data-testid="input-ai-query"
                  />
                  <Button
                    onClick={handleSend}
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
                  onClick={() => setInput(query)}
                  data-testid={`example-query-${index}`}
                >
                  {query}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voice Commands</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">
                  "Show open tickets"
                </p>
                <p className="text-xs">Displays all open support tickets</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">
                  "Search customer Rahim"
                </p>
                <p className="text-xs">Finds customer by name</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">
                  "Generate report"
                </p>
                <p className="text-xs">Creates analytics report</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
