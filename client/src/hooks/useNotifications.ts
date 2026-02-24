import { useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TravelRoute {
  steps?: Array<{ instruction: string }>;
}

interface JobReminder {
  jobId: number;
  pickupPostcode: string;
  dropoffPostcode: string;
  scheduledPickupAt: Date | string;
  travelRouteData?: TravelRoute | null;
  brokerName?: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  // Register service worker on mount
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        swRef.current = reg;
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    const result = await Notification.requestPermission();
    return result === "granted";
  }, []);

  // Check current permission state
  const hasPermission = useCallback((): boolean => {
    return "Notification" in window && Notification.permission === "granted";
  }, []);

  // Schedule a 30-minute reminder for a job
  const scheduleJobReminder = useCallback(async (job: JobReminder): Promise<boolean> => {
    if (!hasPermission()) {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    const pickupMs = new Date(job.scheduledPickupAt).getTime();
    const reminderMs = pickupMs - 30 * 60 * 1000;
    const delay = reminderMs - Date.now();

    if (delay <= 0) {
      // Already past the reminder time — show immediately if within 30 min
      if (Date.now() < pickupMs) {
        const minsLeft = Math.round((pickupMs - Date.now()) / 60000);
        const travelSummary = (job.travelRouteData as TravelRoute)?.steps?.[0]?.instruction
          ? `\nFirst step: ${(job.travelRouteData as TravelRoute).steps![0].instruction}`
          : "";
        new Notification("⏰ Job starting soon!", {
          body: `${job.pickupPostcode} → ${job.dropoffPostcode} in ${minsLeft} min${travelSummary}`,
          icon: "/favicon.ico",
          tag: `reminder-${job.jobId}`,
        });
      }
      return true;
    }

    // Use service worker for background scheduling if available
    if (swRef.current?.active) {
      const jobTitle = `${job.pickupPostcode} → ${job.dropoffPostcode}${job.brokerName ? ` (${job.brokerName})` : ""}`;
      swRef.current.active.postMessage({
        type: "SCHEDULE_REMINDER",
        jobId: job.jobId,
        jobTitle,
        pickupTime: new Date(job.scheduledPickupAt).toISOString(),
        travelRoute: job.travelRouteData,
      });
      return true;
    }

    // Fallback: use window setTimeout (works while tab is open)
    setTimeout(() => {
      if (!hasPermission()) return;
      const travelSummary = (job.travelRouteData as TravelRoute)?.steps?.[0]?.instruction
        ? `\nFirst step: ${(job.travelRouteData as TravelRoute).steps![0].instruction}`
        : "";
      new Notification("⏰ Job starting in 30 minutes", {
        body: `${job.pickupPostcode} → ${job.dropoffPostcode}${job.brokerName ? ` (${job.brokerName})` : ""}${travelSummary}`,
        icon: "/favicon.ico",
        tag: `reminder-${job.jobId}`,
      });
    }, delay);

    return true;
  }, [hasPermission, requestPermission]);

  // Cancel a scheduled reminder (by closing the notification if shown)
  const cancelJobReminder = useCallback((jobId: number) => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration("/sw.js").then((reg) => {
      if (!reg) return;
      reg.getNotifications({ tag: `reminder-${jobId}` }).then((notifications) => {
        notifications.forEach((n) => n.close());
      });
    });
  }, []);

  return {
    requestPermission,
    hasPermission,
    scheduleJobReminder,
    cancelJobReminder,
    isSupported: "Notification" in window && "serviceWorker" in navigator,
  };
}
