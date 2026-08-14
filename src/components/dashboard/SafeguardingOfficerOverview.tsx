import React from "react";
import { ShieldAlert, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { SafeguardingReport } from "../../types";

interface SafeguardingOfficerOverviewProps {
  lang: "en" | "sw";
  reports: SafeguardingReport[];
}

export default function SafeguardingOfficerOverview({ lang, reports }: SafeguardingOfficerOverviewProps) {
  const received = reports.filter(r => r.status === "received").length;
  const underReview = reports.filter(r => r.status === "under_review").length;
  const resolved = reports.filter(r => r.status === "resolved").length;
  const openReports = reports.filter(r => r.status !== "resolved");

  const today = new Date();
  const oldestOpen = openReports.reduce((oldest, r) => {
    const days = Math.floor((today.getTime() - new Date(r.reportedDate).getTime()) / (1000 * 60 * 60 * 24));
    return days > oldest ? days : oldest;
  }, 0);

  const cards = [
    { label: lang === "en" ? "New / Unreviewed" : "Mpya", value: received, icon: AlertTriangle, color: "text-red-600 bg-red-50 border-red-200" },
    { label: lang === "en" ? "Under Review" : "Inapitiwa", value: underReview, icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-200" },
    { label: lang === "en" ? "Resolved" : "Imetatuliwa", value: resolved, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black font-mono">{c.value}</span>
              <c.icon size={18} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider mt-1">{c.label}</p>
          </div>
        ))}
      </div>
      {openReports.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center gap-3">
          <ShieldAlert size={18} className="text-red-500 shrink-0" />
          <p className="text-xs text-neutral-600">
            {lang === "en"
              ? `${openReports.length} report${openReports.length === 1 ? "" : "s"} still open — the oldest has been waiting ${oldestOpen} day${oldestOpen === 1 ? "" : "s"} for resolution.`
              : `Ripoti ${openReports.length} bado wazi — ya zamani zaidi imesubiri siku ${oldestOpen}.`}
          </p>
        </div>
      )}
    </div>
  );
}
