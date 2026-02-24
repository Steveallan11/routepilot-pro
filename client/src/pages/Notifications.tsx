import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CheckCheck, Car, Users, Trophy, Fuel, Info } from "lucide-react";
import { toast } from "sonner";

function getNotificationIcon(type: string) {
  switch (type) {
    case "lift_request":
    case "lift_accepted":
    case "lift_rejected":
      return <Users className="w-4 h-4 text-blue-400" />;
    case "badge_unlocked":
      return <Trophy className="w-4 h-4 text-amber-400" />;
    case "fuel_alert":
      return <Fuel className="w-4 h-4 text-orange-400" />;
    case "job_reminder":
      return <Car className="w-4 h-4 text-green-400" />;
    default:
      return <Info className="w-4 h-4 text-muted-foreground" />;
  }
}

export default function NotificationsPage() {
  const utils = trpc.useUtils();
  const { data: notifications = [], isLoading } = trpc.notifications.list.useQuery();

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      toast.success("All notifications marked as read");
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const unread = notifications.filter((n) => !n.readAt);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center relative">
            <Bell className="w-5 h-5 text-blue-400" />
            {unread.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                {unread.length > 9 ? "9+" : unread.length}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unread.length > 0 ? `${unread.length} unread` : "All caught up"}
            </p>
          </div>
        </div>
        {unread.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No notifications yet</p>
          <p className="text-sm mt-1">Lift requests, badge unlocks, and alerts will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`border-border/50 cursor-pointer transition-colors ${
                !notif.readAt ? "bg-blue-500/5 border-blue-500/20" : ""
              }`}
              onClick={() => {
                if (!notif.readAt) markRead.mutate({ id: notif.id });
              }}
            >
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    !notif.readAt ? "bg-blue-500/20" : "bg-muted/50"
                  }`}>
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${!notif.readAt ? "text-foreground" : "text-muted-foreground"}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {new Date(notif.createdAt).toLocaleString("en-GB", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {!notif.readAt && (
                    <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
