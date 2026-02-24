import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { getLoginUrl } from "@/const";
import {
  CalendarDays, ChevronLeft, ChevronRight, MapPin, Clock, PoundSterling,
  Car, CheckCircle2, AlertCircle, Circle, XCircle, Train, Building2,
  Hash, FileText, Fuel, TrendingDown, Navigation, Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

type ViewMode = "day" | "week" | "month";

type Job = {
  id: number;
  status: "planned" | "active" | "completed" | "cancelled";
  pickupPostcode: string;
  dropoffPostcode: string;
  deliveryFee: number;
  fuelDeposit: number;
  fuelReimbursed: boolean;
  brokerFeePercent: number | null;
  brokerFeeFixed: number | null;
  estimatedDistanceMiles: number | null;
  estimatedDurationMins: number | null;
  estimatedFuelCost: number | null;
  estimatedNetProfit: number | null;
  estimatedProfitPerHour: number | null;
  estimatedProfitPerMile: number | null;
  worthItScore: "green" | "amber" | "red" | null;
  actualNetProfit: number | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  brokerName: string | null;
  jobReference: string | null;
  bookingImageUrl: string | null;
  notes: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleReg: string | null;
  travelToJobCost: number | null;
  travelHomeCost: number | null;
  travelToJobMode: string | null;
  travelHomeMode: string | null;
  scannedDistanceMiles: number | null;
  scannedDurationMins: number | null;
  scheduledPickupAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

const STATUS_CONFIG = {
  planned: { label: "Planned", color: "text-amber-400", bg: "bg-amber-400/15 border-amber-400/30", dot: "bg-amber-400", icon: Circle },
  active: { label: "Active", color: "text-blue-400", bg: "bg-blue-400/15 border-blue-400/30", dot: "bg-blue-400", icon: Clock },
  completed: { label: "Done", color: "text-primary", bg: "bg-primary/15 border-primary/30", dot: "bg-primary", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", bg: "bg-muted/30 border-border", dot: "bg-muted-foreground", icon: XCircle },
};

function formatTime(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function isSameDay(a: Date, b: Date) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function getJobDate(job: Job): Date | null {
  if (job.scheduledPickupAt) return new Date(job.scheduledPickupAt);
  if (job.completedAt) return new Date(job.completedAt);
  return new Date(job.createdAt);
}

function WorthItBadge({ score }: { score: "green" | "amber" | "red" | null }) {
  if (!score) return null;
  const map = { green: "bg-primary/20 text-primary", amber: "bg-amber-400/20 text-amber-400", red: "bg-red-500/20 text-red-400" };
  const labels = { green: "Worth It", amber: "Marginal", red: "Not Worth It" };
  return <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", map[score])}>{labels[score]}</span>;
}

function JobDetailSheet({ job, onClose, onStatusChange }: { job: Job; onClose: () => void; onStatusChange: (id: number, status: string) => void }) {
  const cfg = STATUS_CONFIG[job.status];
  const StatusIcon = cfg.icon;
  const netProfit = job.actualNetProfit ?? job.estimatedNetProfit ?? 0;
  const distance = job.estimatedDistanceMiles;
  const duration = job.estimatedDurationMins;
  const brokerFee = ((job.deliveryFee * (job.brokerFeePercent ?? 0)) / 100) + (job.brokerFeeFixed ?? 0);
  const travelCost = (job.travelToJobCost ?? 0) + (job.travelHomeCost ?? 0);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[90dvh] overflow-y-auto rounded-t-2xl px-0">
        <SheetHeader className="px-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
              <SheetTitle className="text-base font-bold">
                {job.pickupPostcode} → {job.dropoffPostcode}
              </SheetTitle>
            </div>
            <WorthItBadge score={job.worthItScore} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <StatusIcon size={13} className={cfg.color} />
            <span className={cn("text-xs font-medium", cfg.color)}>{cfg.label}</span>
            {job.scheduledPickupAt && (
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(job.scheduledPickupAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="px-4 pt-4 space-y-4">
          {/* Net profit hero */}
          <div className="bg-secondary rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Net Profit</p>
              <p className={cn("text-3xl font-bold font-mono", netProfit >= 0 ? "text-primary" : "text-destructive")}>
                {netProfit >= 0 ? "+" : ""}£{netProfit.toFixed(2)}
              </p>
            </div>
            <div className="text-right space-y-1">
              {distance && <p className="text-xs text-muted-foreground">{distance.toFixed(1)} mi</p>}
              {duration && <p className="text-xs text-muted-foreground">{Math.floor(duration / 60)}h {Math.round(duration % 60)}m</p>}
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Breakdown</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span className="font-mono text-primary">+£{job.deliveryFee.toFixed(2)}</span>
              </div>
              {(job.fuelDeposit ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fuel Deposit <span className="text-xs text-primary">(reimbursed)</span></span>
                  <span className="font-mono text-primary">+£{(job.fuelDeposit ?? 0).toFixed(2)}</span>
                </div>
              )}
              {(job.estimatedFuelCost ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Fuel size={11} /> Fuel Cost <span className="text-xs text-blue-400">(claimed back)</span>
                  </span>
                  <span className="font-mono text-muted-foreground">£{(job.estimatedFuelCost ?? 0).toFixed(2)}</span>
                </div>
              )}
              {brokerFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Broker Fee</span>
                  <span className="font-mono">-£{brokerFee.toFixed(2)}</span>
                </div>
              )}
              {(job.travelToJobCost ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Train size={11} /> Travel to Job</span>
                  <span className="font-mono">-£{(job.travelToJobCost ?? 0).toFixed(2)}</span>
                </div>
              )}
              {(job.travelHomeCost ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Train size={11} /> Travel Home</span>
                  <span className="font-mono">-£{(job.travelHomeCost ?? 0).toFixed(2)}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>Net Profit</span>
                <span className={cn("font-mono", netProfit >= 0 ? "text-primary" : "text-destructive")}>
                  {netProfit >= 0 ? "+" : ""}£{netProfit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Per-metric stats */}
          {(job.estimatedProfitPerHour || job.estimatedProfitPerMile) && (
            <div className="grid grid-cols-2 gap-2">
              {job.estimatedProfitPerHour != null && (
                <div className="bg-secondary rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Per Hour</p>
                  <p className="text-sm font-bold font-mono">£{job.estimatedProfitPerHour.toFixed(2)}</p>
                </div>
              )}
              {job.estimatedProfitPerMile != null && (
                <div className="bg-secondary rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Per Mile</p>
                  <p className="text-sm font-bold font-mono">£{job.estimatedProfitPerMile.toFixed(4)}</p>
                </div>
              )}
            </div>
          )}

          {/* Job sheet details */}
          {(job.brokerName || job.jobReference || job.pickupAddress || job.dropoffAddress || job.vehicleReg) && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1.5">
                <FileText size={11} /> Job Sheet
              </p>
              <div className="space-y-1.5 text-sm">
                {job.brokerName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Building2 size={11} /> Broker</span>
                    <span className="font-medium">{job.brokerName}</span>
                  </div>
                )}
                {job.jobReference && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Hash size={11} /> Reference</span>
                    <span className="font-mono text-xs">{job.jobReference}</span>
                  </div>
                )}
                {job.pickupAddress && <p className="text-xs text-muted-foreground">↑ {job.pickupAddress}</p>}
                {job.dropoffAddress && <p className="text-xs text-muted-foreground">↓ {job.dropoffAddress}</p>}
                {job.vehicleReg && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Car size={11} /> Vehicle</span>
                    <span className="font-mono text-xs">{[job.vehicleMake, job.vehicleModel, job.vehicleReg].filter(Boolean).join(" ")}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Booking screenshot */}
          {job.bookingImageUrl && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Booking Screenshot</p>
              <img src={job.bookingImageUrl} alt="Booking" className="w-full rounded-xl object-cover max-h-48" />
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Notes</p>
              <p className="text-sm text-foreground bg-secondary rounded-xl px-3 py-2">{job.notes}</p>
            </div>
          )}

          {/* Status actions */}
          {job.status === "planned" && (
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-primary/30 text-primary"
                onClick={() => { onStatusChange(job.id, "active"); onClose(); }}
              >
                Start Job
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-destructive/30 text-destructive"
                onClick={() => { onStatusChange(job.id, "cancelled"); onClose(); }}
              >
                Cancel
              </Button>
            </div>
          )}
          {job.status === "active" && (
            <Button
              className="w-full"
              onClick={() => { onStatusChange(job.id, "completed"); onClose(); }}
            >
              <CheckCircle2 size={16} className="mr-2" /> Mark Complete
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ jobs, chains, allJobs, date, onJobClick, onRefresh }: { jobs: Job[]; chains: ChainEntry[]; allJobs: Job[]; date: Date; onJobClick: (j: Job) => void; onRefresh: () => void }) {
  const hours = Array.from({ length: 18 }, (_, i) => i + 5); // 05:00 – 22:00
  const dayJobs = jobs.filter(j => {
    const d = getJobDate(j);
    return d && isSameDay(d, date);
  });
  const dayChains = chains.filter(c => c.scheduledDate && isSameDay(new Date(c.scheduledDate), date));

  // Jobs with a scheduled time
  const timedJobs = dayJobs.filter(j => j.scheduledPickupAt);
  // Jobs without a time (just date or created today)
  const untimedJobs = dayJobs.filter(j => !j.scheduledPickupAt);

  function getTopPercent(job: Job) {
    const d = new Date(job.scheduledPickupAt!);
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.max(0, Math.min(100, ((h - 5) / 18) * 100));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Chain entries for this day */}
      {dayChains.length > 0 && (
        <div className="px-4 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Linked Chain</p>
          {dayChains.map(chain => (
            <ChainCard key={`chain-${chain.id}`} chain={chain} jobs={allJobs} onRefresh={onRefresh} />
          ))}
        </div>
      )}
      {untimedJobs.length > 0 && (
        <div className="px-4 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">No time set</p>
          {untimedJobs.map(job => <JobCard key={job.id} job={job} onClick={() => onJobClick(job)} compact />)}
        </div>
      )}
      <div className="relative px-4">
        {/* Hour lines */}
        {hours.map(h => (
          <div key={h} className="flex items-start gap-2 h-14 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground w-10 pt-1 shrink-0">{String(h).padStart(2, "0")}:00</span>
            <div className="flex-1 relative" />
          </div>
        ))}
        {/* Timed job blocks */}
        {timedJobs.map(job => {
          const cfg = STATUS_CONFIG[job.status];
          const top = getTopPercent(job);
          const dur = Math.max(30, job.estimatedDurationMins ?? 60);
          const height = Math.max(40, (dur / (18 * 60)) * (hours.length * 56));
          return (
            <button
              key={job.id}
              className={cn("absolute left-14 right-4 rounded-xl border px-2 py-1.5 text-left transition-opacity hover:opacity-80", cfg.bg)}
              style={{ top: `${top}%`, height: `${height}px` }}
              onClick={() => onJobClick(job)}
            >
              <p className={cn("text-xs font-bold truncate", cfg.color)}>
                {formatTime(job.scheduledPickupAt)} · {job.pickupPostcode} → {job.dropoffPostcode}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                +£{job.deliveryFee.toFixed(0)} · {job.estimatedDistanceMiles?.toFixed(0) ?? "?"}mi
              </p>
            </button>
          );
        })}
        {/* Now line */}
        {isSameDay(date, new Date()) && (() => {
          const now = new Date();
          const h = now.getHours() + now.getMinutes() / 60;
          if (h < 5 || h > 23) return null;
          const top = ((h - 5) / 18) * 100;
          return (
            <div className="absolute left-12 right-4 flex items-center gap-1 pointer-events-none" style={{ top: `${top}%` }}>
              <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <div className="flex-1 h-px bg-red-500/60" />
            </div>
          );
        })()}
      </div>
      {dayJobs.length === 0 && dayChains.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <CalendarDays size={32} className="text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No jobs on this day</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Add a job from the Jobs tab</p>
        </div>
      )}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ jobs, chains, allJobs, weekStart, onJobClick, onDayClick, onRefresh }: { jobs: Job[]; chains: ChainEntry[]; allJobs: Job[]; weekStart: Date; onJobClick: (j: Job) => void; onDayClick: (d: Date) => void; onRefresh: () => void }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="px-2">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {days.map(d => (
          <div key={d.toISOString()} className="text-center">
            <p className="text-[10px] text-muted-foreground">{d.toLocaleDateString("en-GB", { weekday: "short" })}</p>
            <button
              onClick={() => onDayClick(d)}
              className={cn(
                "w-7 h-7 rounded-full text-xs font-bold mx-auto flex items-center justify-center transition-colors",
                isSameDay(d, new Date()) ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-foreground"
              )}
            >
              {d.getDate()}
            </button>
          </div>
        ))}
      </div>
      {/* Earnings strip — standalone jobs + chain totals, no double-counting */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {days.map(d => {
          const standaloneEarnings = jobs
            .filter(j => { const jd = getJobDate(j); return jd && isSameDay(jd, d) && j.status !== "cancelled"; })
            .reduce((s, j) => s + (j.actualNetProfit ?? j.estimatedNetProfit ?? 0), 0);
          const chainEarnings = chains
            .filter(c => c.scheduledDate && isSameDay(new Date(c.scheduledDate), d) && c.status !== "cancelled")
            .reduce((s, c) => s + c.totalNetProfit, 0);
          const dayEarnings = standaloneEarnings + chainEarnings;
          return (
            <div key={d.toISOString()} className="text-center">
              {dayEarnings !== 0 ? (
                <span className={cn(
                  "text-[9px] font-bold font-mono px-1 py-0.5 rounded-md",
                  dayEarnings > 0 ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10"
                )}>
                  {dayEarnings > 0 ? "+" : ""}£{dayEarnings.toFixed(0)}
                </span>
              ) : (
                <span className="text-[9px] text-muted-foreground/30">—</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const dayJobs = jobs.filter(j => {
            const jd = getJobDate(j);
            return jd && isSameDay(jd, d);
          });
          const dayChains = chains.filter(c => c.scheduledDate && isSameDay(new Date(c.scheduledDate), d));
          const hasItems = dayJobs.length > 0 || dayChains.length > 0;
          return (
            <div key={d.toISOString()} className="min-h-[120px] space-y-1">
              {/* Chain cards first */}
              {dayChains.map(chain => (
                <ChainCard key={`chain-${chain.id}`} chain={chain} jobs={allJobs} onRefresh={onRefresh} />
              ))}
              {/* Standalone job cards */}
              {dayJobs.map(job => {
                const cfg = STATUS_CONFIG[job.status];
                return (
                  <button
                    key={job.id}
                    onClick={() => onJobClick(job)}
                    className={cn("w-full rounded-lg border p-1.5 text-left transition-opacity hover:opacity-80", cfg.bg)}
                  >
                    <p className={cn("text-[9px] font-bold truncate", cfg.color)}>
                      {formatTime(job.scheduledPickupAt) ?? "–"}
                    </p>
                    <p className="text-[9px] text-foreground truncate font-medium">
                      {job.pickupPostcode}→{job.dropoffPostcode}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      £{job.deliveryFee.toFixed(0)}
                    </p>
                  </button>
                );
              })}
              {!hasItems && (
                <button onClick={() => onDayClick(d)} className="w-full h-full min-h-[120px] rounded-lg border border-dashed border-border/40 hover:border-border/70 transition-colors" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ jobs, chains, allJobs, month, year, onDayClick }: { jobs: Job[]; chains: ChainEntry[]; allJobs: Job[]; month: number; year: number; onDayClick: (d: Date) => void }) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
  const totalCells = startOffset + lastDay.getDate();
  const cells = Array.from({ length: Math.ceil(totalCells / 7) * 7 }, (_, i) => {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null;
    return new Date(year, month, dayNum);
  });

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="px-2">
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map(d => (
          <p key={d} className="text-[10px] text-muted-foreground text-center py-1">{d}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dayJobs = jobs.filter(j => {
            const jd = getJobDate(j);
            return jd && isSameDay(jd, d);
          });
          const dayChains = chains.filter(c => c.scheduledDate && isSameDay(new Date(c.scheduledDate), d));
          const standaloneProfit = dayJobs.reduce((s, j) => s + (j.actualNetProfit ?? j.estimatedNetProfit ?? 0), 0);
          const chainProfit = dayChains.reduce((s, c) => s + c.totalNetProfit, 0);
          const totalProfit = standaloneProfit + chainProfit;
          const hasItems = dayJobs.length > 0 || dayChains.length > 0;
          const isToday = isSameDay(d, new Date());
          return (
            <button
              key={d.toISOString()}
              onClick={() => onDayClick(d)}
              className={cn(
                "aspect-square flex flex-col items-center justify-center rounded-lg transition-colors relative",
                isToday ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-secondary",
                hasItems ? "cursor-pointer" : ""
              )}
            >
              <span className={cn("text-xs font-bold", isToday ? "text-primary" : "text-foreground")}>
                {d.getDate()}
              </span>
              {hasItems && (
                <>
                  <div className="flex gap-0.5 mt-0.5">
                    {dayChains.slice(0, 2).map(c => (
                      <div key={`c-${c.id}`} className="w-1.5 h-1.5 rounded-full bg-primary" />
                    ))}
                    {dayJobs.slice(0, Math.max(0, 3 - dayChains.length)).map(j => (
                      <div key={j.id} className={cn("w-1.5 h-1.5 rounded-full", STATUS_CONFIG[j.status].dot)} />
                    ))}
                  </div>
                  {totalProfit !== 0 && (
                    <span className={cn("text-[8px] font-mono font-bold mt-0.5", totalProfit >= 0 ? "text-primary" : "text-destructive")}>
                      £{totalProfit.toFixed(0)}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Job Card (compact) ───────────────────────────────────────────────────────

function JobCard({ job, onClick, compact }: { job: Job; onClick: () => void; compact?: boolean }) {
  const cfg = STATUS_CONFIG[job.status];
  const StatusIcon = cfg.icon;
  const netProfit = job.actualNetProfit ?? job.estimatedNetProfit ?? 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-3 transition-opacity hover:opacity-80",
        cfg.bg
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <StatusIcon size={12} className={cfg.color} />
            <span className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</span>
            {job.scheduledPickupAt && (
              <span className="text-[10px] text-muted-foreground ml-1">{formatTime(job.scheduledPickupAt)}</span>
            )}
          </div>
          <p className="text-sm font-bold text-foreground truncate">
            {job.pickupPostcode} → {job.dropoffPostcode}
          </p>
          {job.brokerName && <p className="text-xs text-muted-foreground truncate">{job.brokerName}</p>}
          {!compact && job.estimatedDistanceMiles && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {job.estimatedDistanceMiles.toFixed(1)} mi · {job.estimatedDurationMins ? `${Math.floor(job.estimatedDurationMins / 60)}h ${Math.round(job.estimatedDurationMins % 60)}m` : ""}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold font-mono text-primary">£{job.deliveryFee.toFixed(0)}</p>
          <p className={cn("text-xs font-mono", netProfit >= 0 ? "text-primary/70" : "text-destructive")}>
            {netProfit >= 0 ? "+" : ""}£{netProfit.toFixed(0)} net
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Chain Card ──────────────────────────────────────────────────────────────

type ChainEntry = {
  id: number;
  name: string | null;
  totalNetProfit: number;
  totalEarnings: number;
  totalCosts: number;
  totalDistanceMiles: number;
  jobIds: number[];
  scheduledDate: Date | null;
  status: "planned" | "active" | "completed" | "cancelled";
};

function ChainCard({ chain, jobs, onRefresh }: { chain: ChainEntry; jobs: Job[]; onRefresh: () => void }) {
  const chainJobs = jobs.filter(j => chain.jobIds.includes(j.id)).sort((a, b) => {
    const ta = a.scheduledPickupAt ? Number(a.scheduledPickupAt) : 0;
    const tb = b.scheduledPickupAt ? Number(b.scheduledPickupAt) : 0;
    return ta - tb;
  });
  const cfg = STATUS_CONFIG[chain.status] ?? STATUS_CONFIG.planned;
  const StatusIcon = cfg.icon;
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  const completeMutation = trpc.chains.complete.useMutation({
    onSuccess: () => {
      utils.chains.listWithJobs.invalidate();
      utils.jobs.list.invalidate();
      onRefresh();
    },
  });
  const deleteMutation = trpc.chains.delete.useMutation({
    onSuccess: () => {
      utils.chains.listWithJobs.invalidate();
      utils.jobs.list.invalidate();
      onRefresh();
    },
  });

  const transportCost = chain.totalCosts ?? 0;
  const currentJob = chainJobs[slideIndex];

  return (
    <>
      <button onClick={() => { setOpen(true); setSlideIndex(0); }} className={`w-full text-left rounded-xl border p-2 ${cfg.bg} hover:opacity-90 transition-opacity`}>
        <div className="flex items-center gap-1 mb-1">
          <StatusIcon size={10} className={cfg.color} />
          <span className={`text-[9px] font-bold ${cfg.color}`}>CHAIN · {chain.name ?? "Linked Jobs"}</span>
          {chain.scheduledDate && (
            <span className="text-[9px] text-muted-foreground ml-auto">
              {new Date(chain.scheduledDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        {chainJobs.map((j, i) => (
          <p key={j.id} className="text-[9px] text-foreground truncate">
            {i + 1}. {j.pickupPostcode}→{j.dropoffPostcode} <span className="text-muted-foreground">£{Number(j.deliveryFee).toFixed(0)}</span>
          </p>
        ))}
        <div className="mt-1 space-y-0.5">
          <p className="text-[9px] font-mono text-muted-foreground">
            Gross: £{chain.totalEarnings.toFixed(0)}
            {transportCost > 0 && <span className="text-red-400"> · Travel: −£{transportCost.toFixed(0)}</span>}
          </p>
          <p className="text-[9px] font-bold font-mono text-primary">
            Net: +£{chain.totalNetProfit.toFixed(0)}
          </p>
        </div>
        {chain.status !== "completed" && chain.status !== "cancelled" && (
          <div className="flex gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => completeMutation.mutate({ chainId: chain.id })}
              disabled={completeMutation.isPending}
              className="flex-1 text-[9px] font-semibold bg-primary/20 text-primary rounded px-1 py-0.5 hover:bg-primary/30 transition-colors"
            >
              {completeMutation.isPending ? "..." : "✓ Complete"}
            </button>
            <button
              onClick={() => { if (confirm("Remove this chain? Jobs will remain.")) deleteMutation.mutate({ chainId: chain.id }); }}
              disabled={deleteMutation.isPending}
              className="text-[9px] font-semibold bg-red-500/20 text-red-400 rounded px-1 py-0.5 hover:bg-red-500/30 transition-colors"
            >
              ✕
            </button>
          </div>
        )}
      </button>

      {/* Swipeable per-job P&L sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl p-0">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <div className="flex items-center justify-between mb-1">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                <StatusIcon size={9} /> CHAIN · {chainJobs.length} JOBS
              </div>
              <div className="text-right">
                <span className="text-base font-bold font-mono text-primary">£{chain.totalEarnings.toFixed(0)}</span>
                <span className={cn("text-xs font-mono ml-2", chain.totalNetProfit >= 0 ? "text-primary/70" : "text-destructive")}>
                  {chain.totalNetProfit >= 0 ? "+" : ""}£{chain.totalNetProfit.toFixed(0)} net
                </span>
              </div>
            </div>
            {/* Slide navigation */}
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => setSlideIndex(i => Math.max(0, i - 1))}
                disabled={slideIndex === 0}
                className="p-1.5 rounded-lg bg-secondary disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <div className="flex gap-1.5">
                {chainJobs.map((j, i) => (
                  <button
                    key={j.id}
                    onClick={() => setSlideIndex(i)}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      i === slideIndex ? "bg-primary w-5" : "bg-muted-foreground/30 w-2"
                    )}
                  />
                ))}
              </div>
              <button
                onClick={() => setSlideIndex(i => Math.min(chainJobs.length - 1, i + 1))}
                disabled={slideIndex === chainJobs.length - 1}
                className="p-1.5 rounded-lg bg-secondary disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          {/* Per-job slide */}
          {currentJob && (
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Job {slideIndex + 1} of {chainJobs.length}</h3>
                <span className="text-xs text-muted-foreground">{currentJob.pickupPostcode} → {currentJob.dropoffPostcode}</span>
              </div>
              {/* P&L */}
              <div className="bg-secondary/50 rounded-xl p-3 space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span className="font-mono font-bold text-primary">+£{Number(currentJob.deliveryFee).toFixed(2)}</span>
                </div>
                {(currentJob.estimatedFuelCost ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fuel Cost</span>
                    <span className="font-mono text-destructive">−£{Number(currentJob.estimatedFuelCost).toFixed(2)}</span>
                  </div>
                )}
                {(currentJob.travelToJobCost ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Transport to Job</span>
                    <span className="font-mono text-destructive">−£{Number(currentJob.travelToJobCost).toFixed(2)}</span>
                  </div>
                )}
                {(currentJob.travelHomeCost ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Transport Home</span>
                    <span className="font-mono text-destructive">−£{Number(currentJob.travelHomeCost).toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                  <span>Net Profit</span>
                  <span className={cn("font-mono", (currentJob.actualNetProfit ?? currentJob.estimatedNetProfit ?? 0) >= 0 ? "text-primary" : "text-destructive")}>
                    {(currentJob.actualNetProfit ?? currentJob.estimatedNetProfit ?? 0) >= 0 ? "+" : ""}£{Number(currentJob.actualNetProfit ?? currentJob.estimatedNetProfit ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
              {/* Job meta */}
              <div className="space-y-1.5 text-sm">
                {currentJob.scheduledPickupAt && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays size={13} />
                    <span>{new Date(Number(currentJob.scheduledPickupAt)).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
                {currentJob.estimatedDistanceMiles && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Navigation size={13} />
                    <span>{Number(currentJob.estimatedDistanceMiles).toFixed(1)} mi · {Math.floor((currentJob.estimatedDurationMins ?? 0) / 60)}h {Math.round((currentJob.estimatedDurationMins ?? 0) % 60)}m</span>
                  </div>
                )}
                {currentJob.brokerName && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 size={13} />
                    <span>{currentJob.brokerName}</span>
                  </div>
                )}
                {currentJob.vehicleReg && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Car size={13} />
                    <span>{[currentJob.vehicleMake, currentJob.vehicleModel, currentJob.vehicleReg].filter(Boolean).join(" · ")}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Main Calendar Page ───────────────────────────────────────────────────────

export default function Calendar() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const utils = trpc.useUtils();

  const { data: allJobsData } = trpc.jobs.list.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated }
  );
  const { data: chainsData } = trpc.chains.listWithJobs.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const updateMutation = trpc.jobs.update.useMutation({
    onSuccess: () => { allJobsData; },
  });

  const allJobs = (allJobsData?.jobs ?? []) as Job[];
  const allChains = (chainsData ?? []) as ChainEntry[];

  // Build set of job IDs that belong to a saved chain — exclude these from individual calendar entries
  const chainedJobIds = new Set(allChains.flatMap(c => c.jobIds));
  // Only show standalone (non-chained) jobs as individual entries
  const standaloneJobs = allJobs.filter(j => !chainedJobIds.has(j.id));

  // Navigation helpers
  function navigate_date(dir: 1 | -1) {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  }

  // Format a Date to datetime-local string for pre-filling
  function toDatetimeLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function handleAddJobFromCalendar() {
    // Build a pre-filled datetime: use currentDate at the nearest future half-hour
    const base = new Date(currentDate);
    if (view === "day") {
      // Round up to next half-hour from now if today, else default to 09:00
      const now = new Date();
      if (isSameDay(base, now)) {
        const mins = now.getMinutes();
        base.setHours(now.getHours(), mins < 30 ? 30 : 0, 0, 0);
        if (mins >= 30) base.setHours(base.getHours() + 1);
      } else {
        base.setHours(9, 0, 0, 0);
      }
    } else {
      base.setHours(9, 0, 0, 0);
    }
    navigate(`/jobs?date=${encodeURIComponent(toDatetimeLocal(base))}`);
  }

  function getWeekStart(d: Date) {
    const day = new Date(d);
    const dow = (day.getDay() + 6) % 7; // Mon=0
    day.setDate(day.getDate() - dow);
    day.setHours(0, 0, 0, 0);
    return day;
  }

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);

  function headerLabel() {
    if (view === "day") return formatDate(currentDate);
    if (view === "week") {
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      return `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    }
    return currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }

  if (!isAuthenticated) {
    return (
      <div className="pb-24 pt-4 px-4 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <CalendarDays size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Calendar</h2>
          <p className="text-muted-foreground text-sm">Sign in to see your jobs on the calendar</p>
        </div>
        <Button onClick={() => { window.location.href = getLoginUrl(); }} className="w-full max-w-xs">
          Sign In to Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-0 flex flex-col min-h-dvh">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <CalendarDays size={15} className="text-primary" />
            </div>
            <h1 className="text-lg font-bold">Calendar</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentDate(new Date())}
              className="text-xs text-primary font-medium px-2 py-1 rounded-lg bg-primary/10"
            >
              Today
            </button>
            <button
              onClick={handleAddJobFromCalendar}
              className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
              title="Add job"
            >
              <Plus size={15} className="text-primary-foreground" />
            </button>
          </div>
        </div>

        {/* View switcher */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-3">
          {(["day", "week", "month"] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors",
                view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate_date(-1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold">{headerLabel()}</span>
          <button onClick={() => navigate_date(1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-y-auto pt-3">
        {view === "day" && (
          <DayView
            jobs={standaloneJobs}
            chains={allChains}
            allJobs={allJobs}
            date={currentDate}
            onJobClick={setSelectedJob}
            onRefresh={() => { utils.chains.listWithJobs.invalidate(); utils.jobs.list.invalidate(); }}
          />
        )}
        {view === "week" && (
          <WeekView
            jobs={standaloneJobs}
            chains={allChains}
            allJobs={allJobs}
            weekStart={weekStart}
            onJobClick={setSelectedJob}
            onDayClick={(d) => { setCurrentDate(d); setView("day"); }}
            onRefresh={() => { utils.chains.listWithJobs.invalidate(); utils.jobs.list.invalidate(); }}
          />
        )}
        {view === "month" && (
          <MonthView
            jobs={standaloneJobs}
            chains={allChains}
            allJobs={allJobs}
            month={currentDate.getMonth()}
            year={currentDate.getFullYear()}
            onDayClick={(d) => { setCurrentDate(d); setView("day"); }}
          />
        )}
      </div>

      {/* Job detail sheet */}
      {selectedJob && (
        <JobDetailSheet
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onStatusChange={(id, status) => updateMutation.mutate({ id, status: status as "planned" | "active" | "completed" | "cancelled" })}
        />
      )}
    </div>
  );
}
