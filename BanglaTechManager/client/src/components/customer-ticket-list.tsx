import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Ticket } from "@shared/schema";
import { format } from "date-fns";

interface CustomerTicketListProps {
  tickets: Ticket[];
  isLoading?: boolean;
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
}

export function CustomerTicketList({
  tickets,
  isLoading,
  selectedTicketId,
  onSelectTicket,
}: CustomerTicketListProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading tickets...
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tickets yet. Create your first ticket to get started.
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "default";
      case "in_progress":
        return "secondary";
      case "closed":
        return "outline";
      default:
        return "default";
    }
  };

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-2">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            onClick={() => onSelectTicket(ticket.id)}
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedTicketId === ticket.id
                ? "bg-accent border-primary"
                : "hover:bg-accent/50"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-sm line-clamp-2">
                {ticket.title}
              </h3>
              <Badge variant={getStatusColor(ticket.status)}>
                {ticket.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {ticket.description}
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{format(new Date(ticket.createdAt), "MMM d, yyyy")}</span>
              <Badge variant="outline" className="text-xs">
                {ticket.priority}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

