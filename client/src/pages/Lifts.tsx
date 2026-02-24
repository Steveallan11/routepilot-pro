import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Plus, MapPin, Clock, PoundSterling, CheckCircle, XCircle, Car, ArrowRight, Info } from "lucide-react";
import { toast } from "sonner";
import { ProGate } from "@/components/ProGate";

const PLATFORM_FEE = 12;

function formatDate(d: string | Date) {
  return new Date(d).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

interface PostLiftFormProps {
  onClose: () => void;
}

function PostLiftForm({ onClose }: PostLiftFormProps) {
  const [from, setFrom] = useState("");
  const [fromLabel, setFromLabel] = useState("");
  const [to, setTo] = useState("");
  const [toLabel, setToLabel] = useState("");
  const [departure, setDeparture] = useState("");
  const [seats, setSeats] = useState(1);
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();
  const post = trpc.lifts.post.useMutation({
    onSuccess: () => {
      toast.success("Lift posted! Drivers can now request to join.");
      utils.lifts.list.invalidate();
      utils.lifts.myLifts.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!from || !to || !departure || !price) {
      toast.error("Please fill in all required fields");
      return;
    }
    post.mutate({
      fromPostcode: from,
      fromLabel: fromLabel || undefined,
      toPostcode: to,
      toLabel: toLabel || undefined,
      departureTime: new Date(departure).toISOString(),
      seats,
      pricePerSeat: parseFloat(price),
      notes: notes || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">From Postcode *</Label>
          <Input value={from} onChange={(e) => setFrom(e.target.value.toUpperCase())} placeholder="e.g. SW1A 1AA" className="mt-1 font-mono uppercase" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">From Label</Label>
          <Input value={fromLabel} onChange={(e) => setFromLabel(e.target.value)} placeholder="e.g. London Victoria" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To Postcode *</Label>
          <Input value={to} onChange={(e) => setTo(e.target.value.toUpperCase())} placeholder="e.g. M1 1AE" className="mt-1 font-mono uppercase" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To Label</Label>
          <Input value={toLabel} onChange={(e) => setToLabel(e.target.value)} placeholder="e.g. Manchester Piccadilly" className="mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Departure Date & Time *</Label>
        <Input type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Seats Available *</Label>
          <Input type="number" min={1} max={8} value={seats} onChange={(e) => setSeats(parseInt(e.target.value) || 1)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Price per Seat (£) *</Label>
          <Input type="number" min={0} step={0.50} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="mt-1" />
        </div>
      </div>
      {price && (
        <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <p>You receive: <span className="text-foreground font-medium">£{(parseFloat(price) * (1 - PLATFORM_FEE / 100)).toFixed(2)}</span> per seat after {PLATFORM_FEE}% platform fee</p>
        </div>
      )}
      <div>
        <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Meeting point, luggage space, etc." className="mt-1" rows={2} />
      </div>
      <Button className="w-full" onClick={handleSubmit} disabled={post.isPending}>
        {post.isPending ? "Posting..." : "Post Lift"}
      </Button>
    </div>
  );
}

export default function LiftsPage() {
  const [activeTab, setActiveTab] = useState<"browse" | "mine">("browse");
  const [postOpen, setPostOpen] = useState(false);
  const [requestLiftId, setRequestLiftId] = useState<number | null>(null);
  const [requestMessage, setRequestMessage] = useState("");

  const utils = trpc.useUtils();
  const { data: lifts = [], isLoading } = trpc.lifts.list.useQuery({});
  const { data: myLifts } = trpc.lifts.myLifts.useQuery();

  const requestLift = trpc.lifts.request.useMutation({
    onSuccess: (data) => {
      toast.success(`Lift requested! Total: £${data.totalPrice.toFixed(2)} (incl. ${PLATFORM_FEE}% platform fee)`);
      utils.lifts.list.invalidate();
      utils.lifts.myLifts.invalidate();
      setRequestLiftId(null);
      setRequestMessage("");
    },
    onError: (e) => toast.error(e.message),
  });

  const respond = trpc.lifts.respondToRequest.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.accept ? "Request accepted!" : "Request declined");
      utils.lifts.myLifts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelLift = trpc.lifts.cancel.useMutation({
    onSuccess: () => {
      toast.success("Lift cancelled");
      utils.lifts.myLifts.invalidate();
      utils.lifts.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Lift Marketplace</h1>
            <p className="text-sm text-muted-foreground">Share journeys with other drivers</p>
          </div>
        </div>
        <Dialog open={postOpen} onOpenChange={setPostOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Post Lift
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Post a Lift</DialogTitle>
            </DialogHeader>
            <PostLiftForm onClose={() => setPostOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <ProGate
        feature="Lift Marketplace"
        description="Share journeys with other car delivery drivers. Post available lifts or request to join someone's route."
      >
        {/* Platform fee info */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            RoutePilot takes a <span className="text-blue-300 font-medium">{PLATFORM_FEE}% platform fee</span> on each lift booking to cover payment processing and platform costs.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
          {[
            { id: "browse" as const, label: `Browse (${lifts.length})` },
            { id: "mine" as const, label: "My Lifts" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "browse" && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl bg-muted/30 animate-pulse" />)}
              </div>
            ) : lifts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Car className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No lifts available right now</p>
                <p className="text-sm mt-1">Be the first to post a lift!</p>
              </div>
            ) : (
              lifts.map((lift) => (
                <Card key={lift.id} className={`border-border/50 ${lift.isOwn ? "opacity-60" : ""}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="truncate">{lift.fromLabel ?? lift.fromPostcode}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{lift.toLabel ?? lift.toPostcode}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(lift.departureTime)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {lift.seats} seat{lift.seats !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-lg font-bold text-green-400">£{Number(lift.pricePerSeat).toFixed(2)}</span>
                          <span className="text-xs text-muted-foreground">per seat</span>
                          <span className="text-xs text-muted-foreground">· by {lift.driverName}</span>
                        </div>
                        {lift.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{lift.notes}</p>
                        )}
                      </div>
                      {!lift.isOwn && (
                        <Button
                          size="sm"
                          onClick={() => setRequestLiftId(lift.id)}
                          className="shrink-0"
                        >
                          Request
                        </Button>
                      )}
                      {lift.isOwn && (
                        <Badge variant="outline" className="shrink-0 text-xs">Your lift</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === "mine" && (
          <div className="space-y-5">
            {/* Posted lifts */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Lifts I Posted ({myLifts?.posted.length ?? 0})</h3>
              {!myLifts?.posted.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">No lifts posted yet</p>
              ) : (
                <div className="space-y-2">
                  {myLifts.posted.map((lift) => (
                    <Card key={lift.id} className="border-border/50">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{lift.fromPostcode}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{lift.toPostcode}</span>
                          <Badge variant="outline" className={`ml-auto text-xs ${lift.status === "active" ? "border-green-500/50 text-green-400" : "border-muted text-muted-foreground"}`}>
                            {lift.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(lift.departureTime)} · £{Number(lift.pricePerSeat).toFixed(2)}/seat · {lift.seats} seats</p>
                        {lift.status === "active" && (
                          <Button size="sm" variant="outline" className="mt-2 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => cancelLift.mutate({ liftId: lift.id })}>
                            Cancel Lift
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Requested lifts */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Lifts I Requested ({myLifts?.requested.length ?? 0})</h3>
              {!myLifts?.requested.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">No lift requests yet</p>
              ) : (
                <div className="space-y-2">
                  {myLifts.requested.map((req) => (
                    <Card key={req.id} className="border-border/50">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{req.lift?.fromPostcode}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{req.lift?.toPostcode}</span>
                          <Badge variant="outline" className={`ml-auto text-xs ${
                            req.status === "accepted" ? "border-green-500/50 text-green-400" :
                            req.status === "rejected" ? "border-red-500/50 text-red-400" :
                            "border-amber-500/50 text-amber-400"
                          }`}>
                            {req.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {req.lift && formatDate(req.lift.departureTime)} · by {req.driverName} · £{Number(req.totalPrice).toFixed(2)} total
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Request dialog */}
        <Dialog open={requestLiftId !== null} onOpenChange={(v) => { if (!v) { setRequestLiftId(null); setRequestMessage(""); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Request This Lift</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {requestLiftId && (() => {
                const lift = lifts.find((l) => l.id === requestLiftId);
                if (!lift) return null;
                return (
                  <>
                    <div className="p-3 rounded-lg bg-muted/50 text-sm">
                      <p className="font-medium">{lift.fromLabel ?? lift.fromPostcode} → {lift.toLabel ?? lift.toPostcode}</p>
                      <p className="text-muted-foreground text-xs mt-1">{formatDate(lift.departureTime)}</p>
                      <p className="text-green-400 font-bold mt-1">£{Number(lift.pricePerSeat).toFixed(2)} per seat</p>
                      <p className="text-xs text-muted-foreground mt-1">Platform fee ({PLATFORM_FEE}%) included in price</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Message to driver (optional)</Label>
                      <Textarea
                        value={requestMessage}
                        onChange={(e) => setRequestMessage(e.target.value)}
                        placeholder="Introduce yourself, mention your pickup point..."
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => requestLift.mutate({ liftId: requestLiftId, message: requestMessage || undefined })}
                      disabled={requestLift.isPending}
                    >
                      {requestLift.isPending ? "Sending..." : "Send Request"}
                    </Button>
                  </>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
      </ProGate>
    </div>
  );
}
