import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, MessageCircle, Send, X } from "lucide-react";

interface Notification {
  id: string;
  type: "email" | "sms" | "telegram" | "in_app";
  title: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "notif-001",
      type: "email",
      title: "New Ticket Assigned",
      content: "Ticket #1234 has been assigned to you - High priority support issue",
      timestamp: new Date(Date.now() - 3600000).toLocaleString(),
      read: false,
    },
    {
      id: "notif-002",
      type: "sms",
      title: "Customer Call",
      content: "Incoming call from Karim Hassan regarding ticket #1233",
      timestamp: new Date(Date.now() - 7200000).toLocaleString(),
      read: false,
    },
    {
      id: "notif-003",
      type: "telegram",
      title: "Update: Ticket Resolved",
      content: "Ticket #1230 has been marked as resolved and closed",
      timestamp: new Date(Date.now() - 14400000).toLocaleString(),
      read: true,
    },
    {
      id: "notif-004",
      type: "in_app",
      title: "System Maintenance",
      content: "Scheduled maintenance completed successfully",
      timestamp: new Date(Date.now() - 86400000).toLocaleString(),
      read: true,
    },
  ]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="h-5 w-5 text-blue-500" />;
      case "sms":
        return <MessageCircle className="h-5 w-5 text-green-500" />;
      case "telegram":
        return <Send className="h-5 w-5 text-cyan-500" />;
      default:
        return <Bell className="h-5 w-5 text-purple-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "email":
        return <Badge className="bg-blue-600">Email</Badge>;
      case "sms":
        return <Badge className="bg-green-600">SMS</Badge>;
      case "telegram":
        return <Badge className="bg-cyan-600">Telegram</Badge>;
      case "in_app":
        return <Badge variant="outline">In-App</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleDelete = (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Notifications</h1>
        <p className="text-muted-foreground mt-1">
          Email, SMS, Telegram, and in-app notifications
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
            <p className="text-xs text-muted-foreground">All notifications</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">Active channels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                notifications.filter(
                  (n) =>
                    new Date(n.timestamp).getTime() >
                    Date.now() - 604800000
                ).length
              }
            </div>
            <p className="text-xs text-muted-foreground">New messages</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  notification.read ? "bg-muted" : "bg-blue-50 dark:bg-blue-950"
                }`}
                data-testid={`notification-${notification.id}`}
              >
                <div className="pt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{notification.title}</p>
                    {getTypeBadge(notification.type)}
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {notification.content}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {notification.timestamp}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsRead(notification.id)}
                      data-testid={`button-mark-read-${notification.id}`}
                    >
                      Mark read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(notification.id)}
                    data-testid={`button-delete-${notification.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded">
            <div>
              <p className="font-medium">Email</p>
              <p className="text-sm text-muted-foreground">
                Send notifications via email
              </p>
            </div>
            <Badge className="bg-green-600">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded">
            <div>
              <p className="font-medium">SMS</p>
              <p className="text-sm text-muted-foreground">
                Twilio SMS integration
              </p>
            </div>
            <Badge className="bg-green-600">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded">
            <div>
              <p className="font-medium">Telegram</p>
              <p className="text-sm text-muted-foreground">
                Bot notifications to customers
              </p>
            </div>
            <Badge variant="outline">Available</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded">
            <div>
              <p className="font-medium">In-App</p>
              <p className="text-sm text-muted-foreground">
                Real-time dashboard notifications
              </p>
            </div>
            <Badge className="bg-green-600">Active</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
