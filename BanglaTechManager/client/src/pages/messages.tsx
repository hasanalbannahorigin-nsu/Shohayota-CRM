import { ChatPanel } from "@/components/chat-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface Contact {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
}

const mockContacts: Contact[] = [
  {
    id: "1",
    name: "Rahim Ahmed",
    lastMessage: "I can't access the customer portal",
    timestamp: "10:32 AM",
    unread: 2,
  },
  {
    id: "2",
    name: "Fatema Khan",
    lastMessage: "Thanks for the help!",
    timestamp: "Yesterday",
    unread: 0,
  },
  {
    id: "3",
    name: "Karim Hassan",
    lastMessage: "When will the feature be ready?",
    timestamp: "2 days ago",
    unread: 1,
  },
];

export default function MessagesPage() {
  const [selectedContact] = useState<string>("1");

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Messages</h1>
        <p className="text-muted-foreground mt-1">
          Real-time chat with customers and support agents
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="p-0">
            <div className="divide-y">
              {mockContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`p-4 cursor-pointer hover-elevate ${
                    selectedContact === contact.id ? "bg-accent" : ""
                  }`}
                  data-testid={`contact-${contact.id}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">{contact.name}</p>
                        {contact.unread > 0 && (
                          <Badge variant="default" className="shrink-0">
                            {contact.unread}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {contact.lastMessage}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {contact.timestamp}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
