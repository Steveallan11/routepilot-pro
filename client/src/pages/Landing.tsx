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
  Quote,
  CheckCircle2,
  XCircle,
  Receipt,
  BarChart3,
  Shield,
  Fuel,
  Bell,
  FileText,
} from "lucide-react";

const HERO_VIDEO = "https://files.manuscdn.com/user_upload_by_module/session_file/102182261/zkrZULNknHenbxWd.mp4";
const HERO_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/102182261/YXCQojTZvUrtFxxC.jpg";

const features = [
  {
    icon: Zap,
    title: "Instant Profit Check",
    description: "Two postcodes + delivery fee = your real net profit in under 2 seconds. Live fuel prices, travel costs, and wear & tear all included.",
    color: "text-primary",
    bg: "bg-primary/10",
    badge: "Core",
  },
  {
    icon: Camera,
    title: "Scan Any Booking",
    description: "Point your camera at an ALD, Movex, or Autorola confirmation. AI reads postcode, fee, vehicle, and fills everything in for you.",
    color: "text-violet-400",
    bg: "bg-violet-400/10",
    badge: "AI",
  },
  {
    icon: Link2,
    title: "Multi-Job Chains",
    description: "Link 2–3 deliveries and see combined profit. Factor in public transport repositioning costs between each drop-off.",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    badge: "Pro",
  },
  {
    icon: Navigation,
    title: "Smart Route Finder",
    description: "Compare train, bus, and driving options ranked Fastest, Cheapest, and Best Value — with colour-coded maps and real departure times.",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    badge: "Pro",
  },
  {
    icon: BarChart3,
    title: "Driver Dashboard",
    description: "Daily and weekly earnings, profit per hour, miles driven, streak counter, and AI-powered insights on how to maximise your day.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    badge: "Core",
  },
  {
    icon: Trophy,
    title: "Badges & Leaderboard",
    description: "Earn 25 achievements as you work — Road Warrior, Chain Master, Profit King. Climb the weekly leaderboard against other UK drivers.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    badge: "Core",
  },
  {
    icon: Receipt,
    title: "Receipt Scanner",
    description: "Scan fuel, train, and parking receipts. Costs are automatically logged against the right job for accurate P&L tracking.",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
    badge: "Pro",
  },
  {
    icon: Fuel,
    title: "Live Fuel Prices",
    description: "Real-time UK pump prices from the GOV.UK Fuel Finder API. Your fuel cost is always accurate — never estimated.",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    badge: "Core",
  },
  {
    icon: FileText,
    title: "HMRC Mileage Export",
    description: "One-tap export of your full mileage log as a HMRC-ready CSV at 45p/25p rates. Tax season sorted in seconds.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    badge: "Pro",
  },
  {
    icon: Shield,
    title: "Vehicle Condition Logger",
    description: "Photo-document vehicle condition before and after every job. Protect yourself from false damage claims with timestamped evidence.",
    color: "text-red-400",
    bg: "bg-red-400/10",
    badge: "Pro",
  },
  {
    icon: Bell,
    title: "Job Reminders",
    description: "Automatic push notifications 30 minutes before each scheduled pickup. Never miss a job or a departure time again.",
    color: "text-indigo-400",
    bg: "bg-indigo-400/10",
    badge: "Core",
  },
  {
    icon: Map,
    title: "Broker Tracker",
    description: "Track earnings per broker, average profit per job, and average per mile. Know which brokers are worth your time.",
    color: "text-teal-400",
    bg: "bg-teal-400/10",
    badge: "Pro",
  },
];

const stats = [
  { value: "2s", label: "To calculate profit" },
  { value: "A+→D", label: "Job grade system" },
  { value: "25+", label: "Driver badges" },
  { value: "100%", label: "Built for UK drivers" },
];

const testimonials = [
  {
    name: "Steve M.",
    location: "Bristol",
    rating: 5,
    text: "Finally know if a job is worth taking before I accept it. Saved me from two terrible runs this week alone. The grade system makes it dead simple.",
    badge: "Road Warrior",
  },
  {
    name: "Dave K.",
    location: "Manchester",
    rating: 5,
    text: "The booking scanner is a game changer. Snap the ALD confirmation and everything fills in automatically. Takes about 5 seconds.",
    badge: "Chain Master",
  },
  {
    name: "Lee P.",
    location: "Birmingham",
    rating: 5,
    text: "Chained 3 jobs from Bristol to London, found a cheap train back. Made £240 profit on the day. The chain planner is brilliant.",
    badge: "Profit King",
  },
];

const beforeAfter = [
  { before: "Guess if a job is worth it", after: "See your exact net profit in 2 seconds" },
  { before: "Manually calculate fuel costs", after: "Live UK pump prices auto-applied" },
  { before: "Lose money on bad repositions", after: "Cheapest train/bus found instantly" },
  { before: "No idea what you earned this week", after: "Dashboard with full P&L breakdown" },
  { before: "Scramble for HMRC mileage logs", after: "One-tap HMRC-ready CSV export" },
  { before: "No proof on damage disputes", after: "Timestamped condition photos saved" },
];

const pricingTiers = [
  {
    name: "Free",
    price: "£0",
    period: "forever",
    description: "Everything you need to get started",
    features: [
      "Instant profit calculator",
      "Booking screenshot scanner",
      "Driver dashboard",
      "Badges & streaks",
      "Job reminders",
      "Live fuel prices",
    ],
    cta: "Get Started Free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "£9.99",
    period: "per month",
    annualNote: "or £74.99/yr — save £44.89",
    description: "For serious delivery drivers",
    features: [
      "Everything in Free",
      "Multi-job chain planner",
      "Smart route finder",
      "Receipt scanner",
      "HMRC mileage export",
      "Vehicle condition logger",
      "Broker performance tracker",
      "Driver lift marketplace",
      "Monthly P&L export",
    ],
    cta: "Start 7-Day Free Trial",
    highlight: true,
  },
];

export default function Landing() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();

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
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay muted loop playsInline poster={HERO_IMAGE}
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/55 to-black/97" />

        {/* Nav */}
        <header className="relative z-10 flex items-center justify-between px-6 pt-12 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap size={16} className="text-primary-foreground" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight font-display">RoutePilot Pro</span>
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
          <div className="inline-flex items-center gap-1.5 bg-primary/20 border border-primary/40 rounded-full px-3 py-1 mb-6">
            <Star size={12} className="text-primary fill-primary" />
            <span className="text-xs font-medium text-primary">Built for UK Car Delivery Drivers</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4 max-w-sm font-display">
            Stop guessing.{" "}
            <span className="text-primary">Start knowing.</span>
          </h1>

          <p className="text-white/70 text-base sm:text-lg max-w-xs mb-3 leading-relaxed">
            Know if a job is worth taking before you accept it. Instant profit calculations, AI booking scanner, multi-job chaining, and smart route planning.
          </p>

          {/* Grade pill */}
          <div className="flex items-center gap-2 mb-8">
            {["A+", "A", "B", "C", "D"].map((g, i) => (
              <div key={g} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                i === 0 ? "bg-emerald-500 text-white" :
                i === 1 ? "bg-green-500 text-white" :
                i === 2 ? "bg-primary text-white" :
                i === 3 ? "bg-amber-500 text-white" :
                "bg-red-500/80 text-white"
              }`}>{g}</div>
            ))}
            <span className="text-white/50 text-xs ml-1">Every job graded instantly</span>
          </div>

          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base px-8 py-4 h-auto rounded-xl shadow-lg shadow-primary/30 mb-3"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            Get Started Free
            <ChevronRight size={18} className="ml-1" />
          </Button>
          <p className="text-white/40 text-xs">No credit card required · Free plan available</p>
        </div>

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
              <div className="text-2xl font-extrabold text-primary font-display">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BEFORE / AFTER ────────────────────────────────────── */}
      <section className="px-6 py-14 bg-background">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest text-center mb-2">The difference</p>
          <h2 className="text-2xl font-bold text-center text-foreground mb-8 font-display">
            Driving without RoutePilot vs. with it
          </h2>
          <div className="space-y-3">
            {beforeAfter.map(({ before, after }) => (
              <div key={before} className="grid grid-cols-2 gap-2">
                <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/15 rounded-xl p-3">
                  <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-snug">{before}</p>
                </div>
                <div className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3">
                  <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground leading-snug">{after}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section className="px-6 py-14 bg-card/30">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest text-center mb-2">How it works</p>
          <h2 className="text-2xl font-bold text-center text-foreground mb-10 font-display">
            From booking to profit in three taps
          </h2>
          <div className="space-y-6">
            {[
              {
                step: "01",
                title: "Scan or enter your booking",
                desc: "Take a photo of your booking confirmation and AI fills in all the details — postcode, fee, distance, vehicle. Or type it in manually in under 10 seconds.",
                icon: Camera,
              },
              {
                step: "02",
                title: "See your real profit grade",
                desc: "Live fuel prices, travel costs, and time value are calculated instantly. Every job gets an A+/A/B/C/D grade so you know immediately whether to take it.",
                icon: Zap,
              },
              {
                step: "03",
                title: "Plan your day and maximise earnings",
                desc: "Chain multiple jobs together, find the cheapest train home, and track your weekly earnings — all in one place.",
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
      <section className="px-6 py-14 bg-background">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest text-center mb-2">Features</p>
          <h2 className="text-2xl font-bold text-center text-foreground mb-2 font-display">
            Everything a delivery driver needs
          </h2>
          <p className="text-muted-foreground text-sm text-center mb-8">One app. Every tool. Nothing missing.</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, description, color, bg, badge }) => (
              <div
                key={title}
                className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-colors relative"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon size={18} className={color} />
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    badge === "AI" ? "bg-violet-500/15 text-violet-400" :
                    badge === "Pro" ? "bg-primary/15 text-primary" :
                    "bg-emerald-500/15 text-emerald-400"
                  }`}>{badge}</span>
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────── */}
      <section className="px-6 py-14 bg-card/30">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest text-center mb-2">Pricing</p>
          <h2 className="text-2xl font-bold text-center text-foreground mb-2 font-display">
            Simple, honest pricing
          </h2>
          <p className="text-muted-foreground text-sm text-center mb-8">Start free. Upgrade when you're ready.</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl p-5 border relative ${
                  tier.highlight
                    ? "bg-primary/10 border-primary/40 shadow-lg shadow-primary/10"
                    : "bg-card border-border"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-bold text-foreground text-base mb-0.5">{tier.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-foreground font-display">{tier.price}</span>
                    <span className="text-xs text-muted-foreground">{tier.period}</span>
                  </div>
                  {tier.annualNote && (
                    <p className="text-xs text-emerald-400 mt-0.5">{tier.annualNote}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{tier.description}</p>
                </div>
                <ul className="space-y-2 mb-5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-foreground">
                      <CheckCircle2 size={12} className={tier.highlight ? "text-primary" : "text-emerald-400"} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full h-10 text-sm font-semibold rounded-xl ${
                    tier.highlight
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-secondary hover:bg-secondary/80 text-foreground"
                  }`}
                  onClick={() => { window.location.href = getLoginUrl(); }}
                >
                  {tier.cta}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground/50 text-xs text-center mt-4">
            Pro trial requires no credit card. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ── SOCIAL PROOF ──────────────────────────────────────── */}
      <section className="px-6 py-14 bg-background">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest text-center mb-2">Trusted by drivers</p>
          <h2 className="text-2xl font-bold text-center text-foreground mb-2 font-display">
            What drivers are saying
          </h2>
          <div className="flex items-center justify-center gap-1.5 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
            ))}
            <span className="text-sm text-muted-foreground ml-1">5.0 · Loved by UK delivery drivers</span>
          </div>

          <div className="space-y-4">
            {testimonials.map(({ name, location, rating, text, badge }) => (
              <div key={name} className="bg-card border border-border rounded-2xl p-5 relative">
                <Quote size={20} className="text-primary/20 absolute top-4 right-4" />
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} size={12} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-foreground text-sm leading-relaxed mb-4">"{text}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-foreground">{name}</div>
                    <div className="text-xs text-muted-foreground">{location}</div>
                  </div>
                  <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
                    <Trophy size={10} className="text-primary" />
                    <span className="text-[10px] font-medium text-primary">{badge}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────── */}
      <section className="px-6 py-16 text-center bg-gradient-to-b from-background to-primary/5">
        <div className="max-w-sm mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
            <Zap size={26} className="text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3 font-display">
            Start earning smarter today
          </h2>
          <p className="text-muted-foreground text-sm mb-7 leading-relaxed">
            Join UK car delivery drivers who use RoutePilot Pro to maximise every job, every day. Free to start. No credit card needed.
          </p>
          <Button
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base py-4 h-auto rounded-xl shadow-lg shadow-primary/30"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            Get Started Free
            <ChevronRight size={18} className="ml-1" />
          </Button>
          <p className="text-muted-foreground/50 text-xs mt-4">Free plan · No credit card · Works on any phone</p>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="border-t border-border px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
            <Zap size={10} className="text-primary" />
          </div>
          <span className="font-semibold text-sm text-foreground font-display">RoutePilot Pro</span>
        </div>
        <p className="text-muted-foreground/60 text-xs">
          The smarter way to plan, calculate, and maximise your car delivery earnings.
        </p>
        <p className="text-muted-foreground/30 text-xs mt-2">© 2026 RoutePilot Pro · Built for UK drivers</p>
      </footer>
    </div>
  );
}
