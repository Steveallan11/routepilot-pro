import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Link2,
  Navigation,
  Trophy,
  ChevronRight,
  Star,
  TrendingUp,
  Camera,
  Map,
} from "lucide-react";

const HERO_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/102182261/YXCQojTZvUrtFxxC.jpg";

const features = [
  {
    icon: Zap,
    title: "Instant Profit Calculator",
    description:
      "Enter two postcodes and a delivery fee — get live fuel costs, time value, wear & tear, and your real net profit in seconds.",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    icon: Camera,
    title: "Scan Booking Screenshots",
    description:
      "Point your camera at any booking confirmation. AI reads the postcode, fee, distance and fills the form for you automatically.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: Link2,
    title: "Chain Multiple Jobs",
    description:
      "Link 2–3 deliveries together and see combined profit. Factor in public transport repositioning costs between each drop-off.",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: Navigation,
    title: "Smart Route Finder",
    description:
      "Compare train, bus, and driving options ranked Fastest, Cheapest, and Best Value — with colour-coded maps and real departure times.",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    icon: TrendingUp,
    title: "Driver Dashboard",
    description:
      "Daily and weekly earnings, profit per hour, miles driven, and AI-powered insights on how to maximise your next working day.",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
  {
    icon: Trophy,
    title: "Badges & Streaks",
    description:
      "Earn 25 achievements as you work — Road Warrior, Chain Master, Profit King and more. Keep your streak alive and climb the ranks.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
];

const stats = [
  { value: "£0", label: "Hidden fees" },
  { value: "2s", label: "To calculate profit" },
  { value: "25+", label: "Driver badges" },
  { value: "100%", label: "Built for UK drivers" },
];

export default function Landing() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  // Redirect authenticated users straight to the dashboard
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        {/* Dark gradient overlay — heavier at top and bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />

        {/* Nav bar */}
        <header className="relative z-10 flex items-center justify-between px-6 pt-12 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap size={16} className="text-primary-foreground" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">RoutePilot Pro</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-white/30 text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            Sign In
          </Button>
        </header>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pb-24 pt-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 bg-primary/20 border border-primary/40 rounded-full px-3 py-1 mb-6">
            <Star size={12} className="text-primary fill-primary" />
            <span className="text-xs font-medium text-primary">Built for UK Car Delivery Drivers</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4 max-w-sm">
            Know if a job is{" "}
            <span className="text-primary">worth it</span>{" "}
            before you take it.
          </h1>

          {/* Subheadline */}
          <p className="text-white/70 text-base sm:text-lg max-w-xs mb-8 leading-relaxed">
            Instant profit calculations, booking screenshot scanning, multi-job chaining, and smart route planning — all in one app.
          </p>

          {/* CTA */}
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base px-8 py-4 h-auto rounded-xl shadow-lg shadow-primary/30 mb-4"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            Get Started Free
            <ChevronRight size={18} className="ml-1" />
          </Button>
          <p className="text-white/40 text-xs">No credit card required · Free to use</p>
        </div>

        {/* Scroll indicator */}
        <div className="relative z-10 flex justify-center pb-8 animate-bounce">
          <div className="w-5 h-8 rounded-full border-2 border-white/30 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 bg-white/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <section className="bg-card border-y border-border py-6 px-6">
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto sm:grid-cols-4 sm:max-w-2xl">
          {stats.map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-extrabold text-primary">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section className="px-6 py-14">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest text-center mb-2">How it works</p>
          <h2 className="text-2xl font-bold text-center text-foreground mb-10">
            From booking to profit in three taps
          </h2>

          <div className="space-y-6">
            {[
              {
                step: "01",
                title: "Scan or enter your booking",
                desc: "Take a photo of your booking confirmation and AI fills in all the details — postcode, fee, distance, vehicle.",
                icon: Camera,
              },
              {
                step: "02",
                title: "See your real profit",
                desc: "Live fuel prices, travel costs, time value, and wear & tear are calculated instantly. Green means go.",
                icon: Zap,
              },
              {
                step: "03",
                title: "Plan your return journey",
                desc: "Find the cheapest or fastest train/bus home, or chain another job to maximise your day's earnings.",
                icon: Map,
              },
            ].map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Icon size={18} className="text-primary" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-primary/60 tracking-widest mb-0.5">STEP {step}</div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ─────────────────────────────────────── */}
      <section className="px-6 py-10 bg-card/50">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest text-center mb-2">Features</p>
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            Everything a delivery driver needs
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, description, color, bg }) => (
              <div
                key={title}
                className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  <Icon size={20} className={color} />
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1.5">{title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────── */}
      <section className="px-6 py-16 text-center">
        <div className="max-w-sm mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
            <Zap size={26} className="text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Start earning smarter today
          </h2>
          <p className="text-muted-foreground text-sm mb-7 leading-relaxed">
            Join UK car delivery drivers who use RoutePilot Pro to maximise every job, every day.
          </p>
          <Button
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base py-4 h-auto rounded-xl shadow-lg shadow-primary/30"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            Sign In &amp; Get Started
            <ChevronRight size={18} className="ml-1" />
          </Button>
          <p className="text-muted-foreground/50 text-xs mt-4">Free · No credit card · Works on any phone</p>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="border-t border-border px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
            <Zap size={10} className="text-primary" />
          </div>
          <span className="font-semibold text-sm text-foreground">RoutePilot Pro</span>
        </div>
        <p className="text-muted-foreground/60 text-xs">
          The smarter way to plan, calculate, and maximise your car delivery earnings.
        </p>
      </footer>
    </div>
  );
}
