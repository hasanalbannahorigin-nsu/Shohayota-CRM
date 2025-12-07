import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, User } from "lucide-react";

interface TicketCardProps {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "closed";
  priority: "low" | "medium" | "high";
  assignee?: string;
  createdAt: string;
  category: "support" | "bug" | "feature";
  onClick?: () => void;
}

export function TicketCard({
  id,
  title,
  description,
  status,
  priority,
  assignee,
  createdAt,
  category,
  onClick,
}: TicketCardProps) {
  const statusColors = {
    open: "default",
    in_progress: "secondary",
    closed: "outline",
  } as const;

  const priorityColors = {
    low: "secondary",
    medium: "default",
    high: "destructive",
  } as const;

  const categoryColors = {
    support: "default",
    bug: "destructive",
    feature: "secondary",
  } as const;

  return (
    <Card 
      className="hover-elevate cursor-pointer" 
      data-testid={`ticket-card-${id}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold">
            <span className="text-xs font-mono text-muted-foreground mr-2">
              #{id}
            </span>
            {title}
          </CardTitle>
          <Badge variant={priorityColors[priority]} className="shrink-0">
            {priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusColors[status]}>{status.replace("_", " ")}</Badge>
          <Badge variant={categoryColors[category]}>{category}</Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{createdAt}</span>
          </div>
          {assignee && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{assignee}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
