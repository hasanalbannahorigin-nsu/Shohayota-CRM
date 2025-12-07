import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isSelf: boolean;
}

const mockMessages: Message[] = [
  {
    id: "1",
    sender: "Rahim Ahmed",
    content: "Hello, I need help with my account setup",
    timestamp: "10:30 AM",
    isSelf: false,
  },
  {
    id: "2",
    sender: "You",
    content: "Hello Rahim! I'd be happy to help. What specific issue are you facing?",
    timestamp: "10:31 AM",
    isSelf: true,
  },
  {
    id: "3",
    sender: "Rahim Ahmed",
    content: "I can't access the customer portal",
    timestamp: "10:32 AM",
    isSelf: false,
  },
];

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [newMessage, setNewMessage] = useState("");

  const handleSend = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: String(messages.length + 1),
      sender: "You",
      content: newMessage,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isSelf: true,
    };

    setMessages([...messages, message]);
    setNewMessage("");
    console.log("Message sent:", newMessage);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <Card className="w-96 h-[500px] flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="text-base">Chat with Rahim Ahmed</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.isSelf ? "flex-row-reverse" : ""}`}
                data-testid={`message-${message.id}`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">
                    {getInitials(message.sender)}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`flex flex-col gap-1 ${message.isSelf ? "items-end" : ""}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2 max-w-xs ${
                      message.isSelf
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
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message..."
              data-testid="input-chat-message"
            />
            <Button
              size="icon"
              onClick={handleSend}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
