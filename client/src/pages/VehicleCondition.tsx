import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Video, Share2, CheckCircle, AlertTriangle, Car, MapPin, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { ProGate } from "@/components/ProGate";

const DAMAGE_LOCATIONS = [
  "Front bumper", "Rear bumper", "Front left wing", "Front right wing",
  "Rear left wing", "Rear right wing", "Driver door", "Passenger door",
  "Rear left door", "Rear right door", "Bonnet", "Boot/tailgate",
  "Roof", "Windscreen", "Rear screen", "Left mirror", "Right mirror",
  "Wheel/tyre", "Underbody", "Interior",
];

interface ReportFormProps {
  jobId?: number;
  type: "pickup" | "dropoff";
  onComplete?: (shareToken: string) => void;
}

function ReportForm({ jobId, type, onComplete }: ReportFormProps) {
  const [vehicleReg, setVehicleReg] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColour, setVehicleColour] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState("");
  const [damageLocations, setDamageLocations] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = trpc.vehicleCondition.uploadPhoto.useMutation();
  const createReport = trpc.vehicleCondition.create.useMutation({
    onSuccess: (data) => {
      toast.success(`${type === "pickup" ? "Pickup" : "Dropoff"} condition report saved!`);
      if (onComplete) onComplete(data.shareToken ?? "");
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    try {
      for (const file of files) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = (ev) => resolve((ev.target?.result as string).split(",")[1]);
          reader.readAsDataURL(file);
        });

        const result = await uploadPhoto.mutateAsync({
          base64,
          mimeType: file.type,
          filename: file.name,
        });
        setPhotoUrls((prev) => [...prev, result.url]);
      }
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} uploaded`);
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const toggleDamageLocation = (loc: string) => {
    setDamageLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  };

  const handleSubmit = () => {
    createReport.mutate({
      jobId,
      type,
      vehicleReg: vehicleReg || undefined,
      vehicleMake: vehicleMake || undefined,
      vehicleModel: vehicleModel || undefined,
      vehicleColour: vehicleColour || undefined,
      photoUrls,
      hasDamage,
      damageNotes: damageNotes || undefined,
      damageLocations,
    });
  };

  return (
    <div className="space-y-5">
      {/* Vehicle info */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Car className="w-4 h-4 text-blue-400" />
            Vehicle Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Registration</Label>
            <Input
              value={vehicleReg}
              onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
              placeholder="e.g. AB23 CDE"
              className="mt-1 font-mono uppercase"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Make</Label>
            <Input value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} placeholder="e.g. BMW" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Model</Label>
            <Input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="e.g. 3 Series" className="mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Colour</Label>
            <Input value={vehicleColour} onChange={(e) => setVehicleColour(e.target.value)} placeholder="e.g. Midnight Black" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Camera className="w-4 h-4 text-green-400" />
            Photos ({photoUrls.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {photoUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photoUrls.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhotoUrls((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploading}
          >
            <Plus className="w-4 h-4" />
            {uploading ? "Uploading..." : "Add Photos"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Take photos of all 4 sides, wheels, and interior
          </p>
        </CardContent>
      </Card>

      {/* Damage */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Damage Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              variant={!hasDamage ? "default" : "outline"}
              size="sm"
              onClick={() => setHasDamage(false)}
              className={!hasDamage ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              No Damage
            </Button>
            <Button
              variant={hasDamage ? "default" : "outline"}
              size="sm"
              onClick={() => setHasDamage(true)}
              className={hasDamage ? "bg-red-600 hover:bg-red-700" : ""}
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Damage Present
            </Button>
          </div>

          {hasDamage && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Damage Locations</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAMAGE_LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => toggleDamageLocation(loc)}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        damageLocations.includes(loc)
                          ? "bg-red-500/20 border-red-500/50 text-red-300"
                          : "border-border/50 text-muted-foreground hover:border-border"
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Damage Notes</Label>
                <Textarea
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="Describe the damage in detail — scratches, dents, marks, etc."
                  className="mt-1 text-sm"
                  rows={3}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Button
        className="w-full bg-blue-600 hover:bg-blue-700 font-semibold"
        onClick={handleSubmit}
        disabled={createReport.isPending || photoUrls.length === 0}
      >
        {createReport.isPending ? "Saving..." : `Save ${type === "pickup" ? "Pickup" : "Dropoff"} Report`}
      </Button>
      {photoUrls.length === 0 && (
        <p className="text-xs text-center text-muted-foreground">Add at least one photo to save the report</p>
      )}
    </div>
  );
}

export default function VehicleConditionPage() {
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [reportType, setReportType] = useState<"pickup" | "dropoff">("pickup");
  const [savedToken, setSavedToken] = useState<string | null>(null);

  const { data: reports = [] } = trpc.vehicleCondition.list.useQuery();

  const handleCopyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/condition-report/${token}`);
    toast.success("Share link copied to clipboard!");
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Camera className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Vehicle Condition Logger</h1>
          <p className="text-sm text-muted-foreground">Protect yourself with timestamped photo evidence</p>
        </div>
      </div>

      <ProGate
        feature="Vehicle Condition Logger"
        description="Log pickup and dropoff condition with timestamped photos. Essential legal protection against false damage claims."
      >
        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
          {(["new", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab === "new" ? "New Report" : `History (${reports.length})`}
            </button>
          ))}
        </div>

        {activeTab === "new" && (
          <div className="space-y-4">
            {/* Pickup / Dropoff toggle */}
            <div className="flex gap-2">
              {(["pickup", "dropoff"] as const).map((t) => (
                <Button
                  key={t}
                  variant={reportType === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setReportType(t); setSavedToken(null); }}
                  className={reportType === t ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  {t === "pickup" ? "📍 Pickup" : "🏁 Dropoff"}
                </Button>
              ))}
            </div>

            {savedToken ? (
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Report saved successfully!</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Share this link with your broker or keep it as evidence:</p>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-green-500/30"
                    onClick={() => handleCopyLink(savedToken)}
                  >
                    <Share2 className="w-4 h-4" />
                    Copy Share Link
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setSavedToken(null)}
                  >
                    Log Another Report
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ReportForm type={reportType} onComplete={setSavedToken} />
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No condition reports yet</p>
                <p className="text-sm mt-1">Log your first pickup or dropoff above</p>
              </div>
            ) : (
              reports.map((report) => (
                <Card key={report.id} className="border-border/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={report.type === "pickup" ? "border-blue-500/50 text-blue-400" : "border-green-500/50 text-green-400"}
                          >
                            {report.type === "pickup" ? "📍 Pickup" : "🏁 Dropoff"}
                          </Badge>
                          {report.hasDamage && (
                            <Badge variant="outline" className="border-red-500/50 text-red-400">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Damage
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm">
                          {report.vehicleReg ? report.vehicleReg : "No reg recorded"}
                          {report.vehicleMake && ` · ${report.vehicleMake} ${report.vehicleModel ?? ""}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(report.createdAt).toLocaleString("en-GB")} · {(report.photoUrls as string[]).length} photos
                        </p>
                        {report.damageNotes && (
                          <p className="text-xs text-red-300 mt-1 truncate">{report.damageNotes}</p>
                        )}
                      </div>
                      {report.shareToken && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyLink(report.shareToken!)}
                          className="shrink-0"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    {(report.photoUrls as string[]).length > 0 && (
                      <div className="flex gap-2 mt-3 overflow-x-auto">
                        {(report.photoUrls as string[]).slice(0, 4).map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Photo ${i + 1}`}
                            className="w-16 h-16 rounded-lg object-cover shrink-0"
                          />
                        ))}
                        {(report.photoUrls as string[]).length > 4 && (
                          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs text-muted-foreground">
                            +{(report.photoUrls as string[]).length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </ProGate>
    </div>
  );
}
