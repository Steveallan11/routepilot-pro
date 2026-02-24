import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "sonner";

export function NotificationPermissionBanner() {
  const { requestPermission, hasPermission, isSupported } = useNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if: not supported, already granted, or dismissed
  if (!isSupported || hasPermission() || dismissed) return null;

  async function handleEnable() {
    const granted = await requestPermission();
    if (granted) {
      toast.success("Notifications enabled — you'll get a 30-min reminder before each job");
      setDismissed(true);
    } else {
      toast.error("Notifications blocked. Enable them in your browser settings.");
    }
  }

  return (
    <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2.5 text-sm">
      <Bell size={15} className="text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-xs">Enable job reminders</p>
        <p className="text-[10px] text-muted-foreground">Get a notification 30 min before each job</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Button size="sm" className="h-7 text-xs px-2.5" onClick={handleEnable}>
          Enable
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
