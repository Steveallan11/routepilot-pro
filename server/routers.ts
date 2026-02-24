import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { jobsRouter } from "./routers/jobs";
import { chainsRouter } from "./routers/chains";
import { settingsRouter } from "./routers/settings";
import { fuelRouter } from "./routers/fuel";
import { historyRouter } from "./routers/history";
import { aiRouter } from "./routers/ai";
import { shareRouter } from "./routers/share";
import { scanRouter } from "./routers/scan";
import { receiptsRouter } from "./routers/receipts";
import { routesRouter } from "./routers/routes";
import { dashboardRouter } from "./routers/dashboard";
import { subscriptionRouter } from "./routers/subscription";
import { brokersRouter } from "./routers/brokers";
import { vehicleConditionRouter } from "./routers/vehicleCondition";
import { liftsRouter } from "./routers/lifts";
import { notificationsRouter } from "./routers/notifications";
import { exportsRouter } from "./routers/exports";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  jobs: jobsRouter,
  chains: chainsRouter,
  settings: settingsRouter,
  fuel: fuelRouter,
  history: historyRouter,
  ai: aiRouter,
  share: shareRouter,
  scan: scanRouter,
  receipts: receiptsRouter,
  routes: routesRouter,
  dashboard: dashboardRouter,
  subscription: subscriptionRouter,
  brokers: brokersRouter,
  vehicleCondition: vehicleConditionRouter,
  lifts: liftsRouter,
  notifications: notificationsRouter,
  exports: exportsRouter,
});

export type AppRouter = typeof appRouter;
