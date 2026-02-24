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
import { useLocation } from "wouter";

function Router() {
  const [location] = useLocation();
  const hideNav = location.startsWith("/share/") || location.startsWith("/shared-route/") || location === "/landing";

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/calculator" component={Home} />
        <Route path="/chain" component={ChainPlanner} />
        <Route path="/history" component={History} />
        <Route path="/planner" component={DayPlanner} />
        <Route path="/settings" component={Settings} />
        <Route path="/insights" component={AIInsights} />
        <Route path="/routes">{() => <RouteFinder />}</Route>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/badges" component={Badges} />
        <Route path="/share/:token" component={SharedChain} />
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
