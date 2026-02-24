import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, TrendingUp, Car, PoundSterling, Calendar } from "lucide-react";
import { toast } from "sonner";
import { ProGate } from "@/components/ProGate";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

// UK tax year months (April to March)
function getTaxYearDates(taxYear: string) {
  const [start] = taxYear.split("-");
  const startYear = parseInt(start);
  return {
    fromDate: `${startYear}-04-06`,
    toDate: `${startYear + 1}-04-05`,
  };
}

const TAX_YEARS = Array.from({ length: 4 }, (_, i) => {
  const y = CURRENT_YEAR - 1 - i;
  return { value: `${y}-${y + 1}`, label: `${y}/${y + 1} Tax Year` };
});

export default function TaxExportPage() {
  const [activeTab, setActiveTab] = useState<"mileage" | "pl">("mileage");
  const [selectedTaxYear, setSelectedTaxYear] = useState(TAX_YEARS[0].value);
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));

  const taxYearDates = getTaxYearDates(selectedTaxYear);

  const { data: mileageData, isLoading: mileageLoading } = trpc.exports.mileageCSV.useQuery(
    taxYearDates,
    { enabled: activeTab === "mileage" }
  );

  const { data: plData, isLoading: plLoading } = trpc.exports.monthlyPL.useQuery(
    { year: parseInt(selectedYear) },
    { enabled: activeTab === "pl" }
  );

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filename} downloaded`);
  };

  const handleDownloadMileage = () => {
    if (!mileageData?.csv) return;
    downloadCSV(mileageData.csv, `mileage-log-${selectedTaxYear}.csv`);
  };

  const handleDownloadPL = () => {
    if (!plData) return;
    const rows = [
      "Month,Jobs,Gross Income (£),Fuel Costs (£),Travel Costs (£),Broker Fees (£),Net Profit (£),Miles,Avg/Job (£),Avg/Mile (£)",
      ...plData.months.map((m) =>
        [m.month, m.jobs, m.grossIncome, m.fuelCosts, m.travelCosts, m.brokerFees, m.netProfit, m.miles, m.avgPerJob, m.avgPerMile].join(",")
      ),
      "",
      `TOTAL,${plData.totals.jobs},${plData.totals.grossIncome.toFixed(2)},${plData.totals.fuelCosts.toFixed(2)},${plData.totals.travelCosts.toFixed(2)},${plData.totals.brokerFees.toFixed(2)},${plData.totals.netProfit.toFixed(2)},${plData.totals.miles.toFixed(1)},,`,
    ].join("\n");
    downloadCSV(rows, `profit-loss-${selectedYear}.csv`);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Tax & Mileage Export</h1>
          <p className="text-sm text-muted-foreground">HMRC-ready reports for self-assessment</p>
        </div>
      </div>

      <ProGate
        feature="Tax & Mileage Export"
        description="Generate HMRC mileage logs and monthly P&L reports for your self-assessment tax return."
      >
        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
          {[
            { id: "mileage" as const, label: "Mileage Log", icon: Car },
            { id: "pl" as const, label: "P&L Report", icon: TrendingUp },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "mileage" && (
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  Select Tax Year
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedTaxYear} onValueChange={setSelectedTaxYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_YEARS.map((ty) => (
                      <SelectItem key={ty.value} value={ty.value}>{ty.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Summary stats */}
            {mileageData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Jobs", value: mileageData.totalJobs, icon: Car, color: "text-blue-400" },
                  { label: "Total Miles", value: `${mileageData.totalMiles.toFixed(0)}`, icon: Car, color: "text-purple-400" },
                  { label: "HMRC Allowance", value: `£${mileageData.totalHmrcAllowance.toFixed(2)}`, icon: PoundSterling, color: "text-green-400" },
                  { label: "Net Profit", value: `£${mileageData.totalProfit.toFixed(2)}`, icon: TrendingUp, color: "text-amber-400" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <Card key={label} className="border-border/50">
                    <CardContent className="pt-3 pb-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={`text-lg font-bold ${color}`}>{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* HMRC info */}
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-blue-300 mb-2">HMRC Approved Mileage Rates 2024/25</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">First 10,000 miles</div>
                  <div className="font-medium text-foreground">45p per mile</div>
                  <div className="text-muted-foreground">Over 10,000 miles</div>
                  <div className="font-medium text-foreground">25p per mile</div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  The HMRC Approved Mileage Allowance Payment (AMAP) scheme lets you claim tax relief on business mileage. Keep this log as evidence for your self-assessment return.
                </p>
              </CardContent>
            </Card>

            <Button
              className="w-full bg-green-600 hover:bg-green-700 gap-2"
              onClick={handleDownloadMileage}
              disabled={mileageLoading || !mileageData}
            >
              <Download className="w-4 h-4" />
              {mileageLoading ? "Generating..." : `Download Mileage CSV (${mileageData?.totalJobs ?? 0} jobs)`}
            </Button>
          </div>
        )}

        {activeTab === "pl" && (
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  Select Calendar Year
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Annual totals */}
            {plData && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Total Jobs", value: plData.totals.jobs, color: "text-blue-400" },
                    { label: "Gross Income", value: `£${plData.totals.grossIncome.toFixed(2)}`, color: "text-green-400" },
                    { label: "Net Profit", value: `£${plData.totals.netProfit.toFixed(2)}`, color: "text-amber-400" },
                    { label: "Fuel Costs", value: `£${plData.totals.fuelCosts.toFixed(2)}`, color: "text-red-400" },
                    { label: "Travel Costs", value: `£${plData.totals.travelCosts.toFixed(2)}`, color: "text-orange-400" },
                    { label: "Broker Fees", value: `£${plData.totals.brokerFees.toFixed(2)}`, color: "text-purple-400" },
                  ].map(({ label, value, color }) => (
                    <Card key={label} className="border-border/50">
                      <CardContent className="pt-3 pb-3">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`text-base font-bold ${color}`}>{value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Monthly table */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Monthly Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border/50">
                            <th className="text-left py-2 pr-3">Month</th>
                            <th className="text-right py-2 px-2">Jobs</th>
                            <th className="text-right py-2 px-2">Gross</th>
                            <th className="text-right py-2 px-2">Fuel</th>
                            <th className="text-right py-2 px-2">Net</th>
                            <th className="text-right py-2 pl-2">Miles</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plData.months.map((m) => (
                            <tr key={m.month} className={`border-b border-border/30 ${m.jobs === 0 ? "opacity-40" : ""}`}>
                              <td className="py-1.5 pr-3 font-medium">{m.month.slice(0, 3)}</td>
                              <td className="text-right py-1.5 px-2">{m.jobs}</td>
                              <td className="text-right py-1.5 px-2 text-green-400">£{m.grossIncome.toFixed(0)}</td>
                              <td className="text-right py-1.5 px-2 text-red-400">£{m.fuelCosts.toFixed(0)}</td>
                              <td className={`text-right py-1.5 px-2 font-semibold ${m.netProfit >= 0 ? "text-amber-400" : "text-red-400"}`}>
                                £{m.netProfit.toFixed(0)}
                              </td>
                              <td className="text-right py-1.5 pl-2 text-muted-foreground">{m.miles.toFixed(0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            <Button
              className="w-full bg-green-600 hover:bg-green-700 gap-2"
              onClick={handleDownloadPL}
              disabled={plLoading || !plData}
            >
              <Download className="w-4 h-4" />
              {plLoading ? "Generating..." : `Download P&L CSV (${selectedYear})`}
            </Button>
          </div>
        )}
      </ProGate>
    </div>
  );
}
