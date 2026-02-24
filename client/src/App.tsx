import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ChainPlanner from "./pages/ChainPlanner";
import History from "./pages/History";
import DayPlanner from "./pages/DayPlanner";
import Settings from "./pages/Settings";
import AIInsights from "./pages/AIInsights";
import SharedChain from "./pages/SharedChain";
import SharedRoute from "./pages/SharedRoute";
import RouteFinder from "./pages/RouteFinder";
import Dashboard from "./pages/Dashboard";
import Badges from "./pages/Badges";
import Landing from "./pages/Landing";
import BottomNav from "./components/BottomNav";
import VehicleCondition from "./pages/VehicleCondition";
import FuelFinder from "./pages/FuelFinder";
import TaxExport from "./pages/TaxExport";
import Brokers from "./pages/Brokers";
import Lifts from "./pages/Lifts";
import Notifications from "./pages/Notifications";
import Subscription from "./pages/Subscription";
import Calendar from "./pages/Calendar";
import Jobs from "./pages/Jobs";
import { useLocation } from "wouter";

function Router() {
  const [location] = useLocation();
  const hideNav =
    location.startsWith("/share/") ||
    location.startsWith("/chain/") ||
    location.startsWith("/shared-route/") ||
    location === "/landing" ||
    location.startsWith("/condition-report/");

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <Switch>
        {/* Root → Dashboard (Home tab) */}
        <Route path="/" component={Dashboard} />

        {/* Primary 5-tab routes */}
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/jobs">{() => <Jobs />}</Route>

        {/* Tools (accessible from Tools drawer) */}
        <Route path="/routes">{() => <RouteFinder />}</Route>
        <Route path="/chain" component={ChainPlanner} />
        <Route path="/fuel-finder" component={FuelFinder} />
        <Route path="/insights" component={AIInsights} />
        <Route path="/vehicle-condition" component={VehicleCondition} />
        <Route path="/tax-export" component={TaxExport} />
        <Route path="/brokers" component={Brokers} />
        <Route path="/lifts" component={Lifts} />

        {/* Me (accessible from Me drawer) */}
        <Route path="/notifications" component={Notifications} />
        <Route path="/badges" component={Badges} />
        <Route path="/subscription" component={Subscription} />
        <Route path="/settings" component={Settings} />

        {/* Legacy routes kept for backward compat */}
        <Route path="/calculator" component={Home} />
        <Route path="/history" component={History} />
        <Route path="/planner" component={DayPlanner} />

        {/* Shared / public routes */}
        <Route path="/share/:token" component={SharedChain} />
        <Route path="/chain/:token" component={SharedChain} />
        <Route path="/shared-route/:token" component={SharedRoute} />

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      {!hideNav && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
