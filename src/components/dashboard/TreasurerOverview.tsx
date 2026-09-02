import React from "react";
import { Wallet, Clock3, FolderKanban, AlertTriangle } from "lucide-react";
import { Income, ExpenditureRequest, BudgetEngagement } from "../../types";
import StatCard from "./StatCard";
import DashboardTrendChart from "./DashboardTrendChart";
import MembershipPaymentsWidget from "./MembershipPaymentsWidget";

interface TreasurerOverviewProps {
  lang: "en" | "sw";
  cashReserves: number;
  pendingTreasurerCount: number;
  budgets: BudgetEngagement[];
  incomes: Income[];
  expenditures: ExpenditureRequest[];
  onNavigateToTab: (tab: string) => void;
}

const SYSTEM_DATE = new Date();

export default function TreasurerOverview({
  lang,
  cashReserves,
  pendingTreasurerCount,
  budgets,
  incomes,
  expenditures,
  onNavigateToTab
}: TreasurerOverviewProps) {
  // Budget utilization per approved engagement — same calculation already proven
  // correct in FinancialLedger's printed Budget vs Actual report (filter approved
  // expenditures by budgetId, sum against the engagement's contracted revenue), just
  // surfaced live on the dashboard instead of only appearing when someone prints a
  // report. This was real, working data that simply wasn't visible anywhere day-to-day.
  const engagementUtilization = budgets
    .filter(b => b.status === "approved")
    .map(b => {
      const actual = expenditures
        .filter(e => e.budgetId === b.id && e.status === "approved")
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const pct = b.revenue > 0 ? Math.round((actual / b.revenue) * 100) : 0;
      return { id: b.id, title: b.title, revenue: b.revenue, actual, pct };
    })
    .filter(b => b.pct >= 75) // only surface what actually needs attention
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label={lang === "en" ? "Current cash position" : "Akiba ya sasa (CBO)"}
          value={`KSh ${cashReserves.toLocaleString()}`}
          icon={<Wallet size={17} />}
          accent="finance"
        />
        <StatCard
          label={lang === "en" ? "Pending your approval" : "Zinasubiri makamishi"}
          value={String(pendingTreasurerCount)}
          icon={<Clock3 size={17} />}
          accent={pendingTreasurerCount > 0 ? "danger" : "finance"}
          onClick={() => onNavigateToTab("finance")}
        />
        <StatCard
          label={lang === "en" ? "Total budgeted outreaches" : "Jumla ya bajeti iliyowasilishwa"}
          value={String(budgets.length)}
          icon={<FolderKanban size={17} />}
          accent="neutral"
        />
      </div>

      <MembershipPaymentsWidget lang={lang} />

      {engagementUtilization.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-amber-600" />
            {lang === "en" ? "Engagement budgets nearing or over limit" : "Bajeti za ushirikiano karibu na mwisho"}
          </p>
          <div className="space-y-2">
            {engagementUtilization.map(b => (
              <button
                key={b.id}
                onClick={() => onNavigateToTab("finance")}
                className="w-full flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-neutral-50 rounded-lg px-2 py-1.5 -mx-2"
              >
                <span className="text-xs font-medium text-neutral-700 truncate">{b.title}</span>
                <span className={`text-xs font-mono font-bold shrink-0 ${b.pct >= 100 ? "text-red-600" : "text-amber-600"}`}>
                  {b.pct}% — KSh {b.actual.toLocaleString()} / {b.revenue.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <p className="text-sm font-semibold text-neutral-200 mb-3">
          {lang === "en" ? "Income vs. expenditure \u2014 last 6 months" : "Mapato dhidi ya matumizi \u2014 miezi 6 iliyopita"}
        </p>
        <DashboardTrendChart incomes={incomes} expenditures={expenditures} referenceDate={SYSTEM_DATE} lang={lang} />
      </div>
    </div>
  );
}
