// RoutePilot Pro — Service Worker
// Handles push notifications and background job reminders

const CACHE_NAME = "routepilot-v1";

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "RoutePilot Pro", body: event.data ? event.data.text() : "New notification" };
  }

  const { title = "RoutePilot Pro", body = "", icon = "/favicon.ico", badge = "/favicon.ico", tag, data: extraData } = data;

  const options = {
    body,
    icon,
    badge,
    tag: tag || "routepilot-notification",
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: extraData || {},
    actions: extraData?.jobId ? [
      { action: "open-job", title: "View Job" },
      { action: "dismiss", title: "Dismiss" },
    ] : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click ───────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const jobId = event.notification.data?.jobId;
  const url = jobId ? `/jobs?jobId=${jobId}` : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.postMessage({ type: "OPEN_JOB", jobId });
          return;
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ─── Background sync for job reminders ───────────────────────────────────────
// The main thread schedules reminders via setTimeout; the SW handles the
// push events when they arrive from the server.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SCHEDULE_REMINDER") {
    const { jobId, jobTitle, pickupTime, travelRoute } = event.data;
    const pickupMs = new Date(pickupTime).getTime();
    const reminderMs = pickupMs - 30 * 60 * 1000; // 30 minutes before
    const delay = reminderMs - Date.now();

    if (delay > 0) {
      setTimeout(() => {
        const travelSummary = travelRoute?.steps?.[0]?.instruction
          ? `\nFirst step: ${travelRoute.steps[0].instruction}`
          : "";

        self.registration.showNotification("⏰ Job starting in 30 minutes", {
          body: `${jobTitle}${travelSummary}`,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: `reminder-${jobId}`,
          requireInteraction: true,
          vibrate: [300, 100, 300, 100, 300],
          data: { jobId },
          actions: [
            { action: "open-job", title: "View Job" },
            { action: "dismiss", title: "Dismiss" },
          ],
        });
      }, delay);
    }
  }
});
