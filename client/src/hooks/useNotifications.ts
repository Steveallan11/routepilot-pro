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
    try {
      if (!('Notification' in window)) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }, []);

  // Check current permission state
  const hasPermission = useCallback((): boolean => {
    return "Notification" in window && Notification.permission === "granted";
  }, []);

  // Schedule a 30-minute reminder for a job
  const scheduleJobReminder = useCallback(async (job: JobReminder): Promise<boolean> => {
    try {
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
    } catch (e) {
      console.warn("[Reminder] scheduleJobReminder error:", e);
      return false;
    }
  }, [hasPermission, requestPermission]);

  // Schedule a "Leave now" alert for a chain based on first leg departure time
  const scheduleChainLeaveNow = useCallback(async (opts: {
    chainId: number;
    fromPostcode: string;
    firstJobPostcode: string;
    departureTime: string; // HH:MM string (today's date assumed)
    firstStepInstruction?: string;
  }): Promise<boolean> => {
    try {
      if (!hasPermission()) {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      // Parse departure time as today's date
      const [hh, mm] = opts.departureTime.split(":").map(Number);
      const departureMs = (() => {
        const d = new Date();
        d.setHours(hh ?? 0, mm ?? 0, 0, 0);
        return d.getTime();
      })();

      const delay = departureMs - Date.now();
      const tag = `chain-leave-${opts.chainId}`;
      const body = `Leave ${opts.fromPostcode} now to reach ${opts.firstJobPostcode} on time${opts.firstStepInstruction ? `\nFirst step: ${opts.firstStepInstruction}` : ""}`;

      if (delay <= 0) {
        // Already at or past departure — fire immediately if within 5 min
        if (Date.now() - departureMs < 5 * 60 * 1000) {
          new Notification("🚶 Leave now for your chain!", { body, icon: "/favicon.ico", tag });
        }
        return true;
      }

      // Use service worker if available — sends SCHEDULE_CHAIN_LEAVE so the SW
      // can show the notification with a Snooze 5 min action
      if (swRef.current?.active) {
        swRef.current.active.postMessage({
          type: "SCHEDULE_CHAIN_LEAVE",
          chainId: opts.chainId,
          title: "🚶 Leave now for your chain!",
          body,
          departureMs,
        });
        return true;
      }

      // Fallback: setTimeout (no snooze action available outside SW)
      setTimeout(() => {
        if (!hasPermission()) return;
        new Notification("🚶 Leave now for your chain!", { body, icon: "/favicon.ico", tag });
      }, delay);

      return true;
    } catch (e) {
      console.warn("[Reminder] scheduleChainLeaveNow error:", e);
      return false;
    }
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
    scheduleChainLeaveNow,
    cancelJobReminder,
    isSupported: "Notification" in window && "serviceWorker" in navigator,
  };
}
