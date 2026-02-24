import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, Plus, TrendingUp, Car, PoundSterling, Percent, Trash2, Edit, Globe, Phone } from "lucide-react";
import { toast } from "sonner";

function StarRating({ rating, onChange }: { rating?: number; onChange?: (r: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange?.(s)}
          className={`transition-colors ${onChange ? "cursor-pointer" : "cursor-default"}`}
        >
          <Star
            className={`w-4 h-4 ${(rating ?? 0) >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
          />
        </button>
      ))}
    </div>
  );
}

interface BrokerFormData {
  name: string;
  feePercent: number;
  feeFixed: number;
  notes: string;
  website: string;
  phone: string;
  rating?: number;
}

const defaultForm: BrokerFormData = {
  name: "", feePercent: 0, feeFixed: 0, notes: "", website: "", phone: "", rating: undefined,
};

export default function BrokersPage() {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BrokerFormData>(defaultForm);

  const utils = trpc.useUtils();
  const { data: stats = [], isLoading } = trpc.brokers.stats.useQuery();

  const createBroker = trpc.brokers.create.useMutation({
    onSuccess: () => {
      toast.success("Broker added");
      utils.brokers.stats.invalidate();
      setOpen(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateBroker = trpc.brokers.update.useMutation({
    onSuccess: () => {
      toast.success("Broker updated");
      utils.brokers.stats.invalidate();
      setOpen(false);
      setEditId(null);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteBroker = trpc.brokers.delete.useMutation({
    onSuccess: () => {
      toast.success("Broker removed");
      utils.brokers.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("Broker name is required"); return; }
    if (editId !== null) {
      updateBroker.mutate({ id: editId, ...form, website: form.website || undefined, phone: form.phone || undefined });
    } else {
      createBroker.mutate({ ...form, website: form.website || undefined, phone: form.phone || undefined });
    }
  };

  const handleEdit = (broker: typeof stats[0]) => {
    setEditId(broker.id);
    setForm({
      name: broker.name,
      feePercent: Number(broker.feePercent) || 0,
      feeFixed: Number(broker.feeFixed) || 0,
      notes: broker.notes ?? "",
      website: broker.website ?? "",
      phone: broker.phone ?? "",
      rating: broker.rating ?? undefined,
    });
    setOpen(true);
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Remove ${name}? This won't delete associated jobs.`)) return;
    deleteBroker.mutate({ id });
  };

  const getRatingColor = (avg: number) => {
    if (avg >= 100) return "text-green-400";
    if (avg >= 50) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Broker Tracker</h1>
            <p className="text-sm text-muted-foreground">Compare performance across brokers</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(defaultForm); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Broker
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Broker" : "Add Broker"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Broker Name *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Move My Car" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Fee % (default)</Label>
                  <Input type="number" min={0} max={100} step={0.5} value={form.feePercent} onChange={(e) => setForm((f) => ({ ...f, feePercent: parseFloat(e.target.value) || 0 }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fixed Fee £</Label>
                  <Input type="number" min={0} step={0.01} value={form.feeFixed} onChange={(e) => setForm((f) => ({ ...f, feeFixed: parseFloat(e.target.value) || 0 }))} className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Your Rating</Label>
                <div className="mt-1">
                  <StarRating rating={form.rating} onChange={(r) => setForm((f) => ({ ...f, rating: r }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Website</Label>
                <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://..." className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="07..." className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Payment terms, contact info, tips..." className="mt-1" rows={2} />
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={createBroker.isPending || updateBroker.isPending}>
                {editId ? "Save Changes" : "Add Broker"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : stats.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No brokers yet</p>
          <p className="text-sm mt-1">Add brokers to track earnings and compare performance</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border/50">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Total Brokers</p>
                <p className="text-2xl font-bold text-purple-400">{stats.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-bold text-blue-400">{stats.reduce((s, b) => s + b.totalJobs, 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold text-green-400">£{stats.reduce((s, b) => s + b.totalEarned, 0).toFixed(0)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Broker cards */}
          {stats.map((broker, rank) => (
            <Card key={broker.id} className="border-border/50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  {/* Rank badge */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    rank === 0 ? "bg-amber-500/20 text-amber-400" :
                    rank === 1 ? "bg-slate-500/20 text-slate-400" :
                    rank === 2 ? "bg-orange-500/20 text-orange-400" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    #{rank + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{broker.name}</h3>
                      {broker.rating && <StarRating rating={broker.rating} />}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Jobs</p>
                        <p className="font-bold text-blue-400">{broker.totalJobs}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Earned</p>
                        <p className="font-bold text-green-400">£{broker.totalEarned.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg/Job</p>
                        <p className={`font-bold ${getRatingColor(broker.avgPerJob)}`}>£{broker.avgPerJob.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg/Mile</p>
                        <p className={`font-bold ${getRatingColor(broker.avgPerMile * 100)}`}>£{broker.avgPerMile.toFixed(3)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {(Number(broker.feePercent) > 0 || Number(broker.feeFixed) > 0) && (
                        <span className="flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          {Number(broker.feePercent) > 0 && `${broker.feePercent}%`}
                          {Number(broker.feePercent) > 0 && Number(broker.feeFixed) > 0 && " + "}
                          {Number(broker.feeFixed) > 0 && `£${broker.feeFixed}`}
                          {" fee"}
                        </span>
                      )}
                      {broker.website && (
                        <a href={broker.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
                          <Globe className="w-3 h-3" />
                          Website
                        </a>
                      )}
                      {broker.phone && (
                        <a href={`tel:${broker.phone}`} className="flex items-center gap-1 hover:text-foreground">
                          <Phone className="w-3 h-3" />
                          {broker.phone}
                        </a>
                      )}
                    </div>

                    {broker.notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic truncate">{broker.notes}</p>
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(broker)} className="h-8 w-8 p-0">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(broker.id, broker.name)} className="h-8 w-8 p-0 text-red-400 hover:text-red-300">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
