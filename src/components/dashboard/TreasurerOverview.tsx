import React from "react";
import { Wallet, Clock3, FolderKanban } from "lucide-react";
import { Income, ExpenditureRequest, BudgetEngagement } from "../../types";
import StatCard from "./StatCard";
import DashboardTrendChart from "./DashboardTrendChart";

interface TreasurerOverviewProps {
  lang: "en" | "sw";
  cashReserves: number;
  pendingTreasurerCount: number;
  budgets: BudgetEngagement[];
  incomes: Income[];
  expenditures: ExpenditureRequest[];
  onNavigateToTab: (tab: string) => void;
}

const SYSTEM_DATE = new Date("2026-07-12");

export default function TreasurerOverview({
  lang,
  cashReserves,
  pendingTreasurerCount,
  budgets,
  incomes,
  expenditures,
  onNavigateToTab
}: TreasurerOverviewProps) {
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

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <p className="text-sm font-semibold text-neutral-200 mb-3">
          {lang === "en" ? "Income vs. expenditure \u2014 last 6 months" : "Mapato dhidi ya matumizi \u2014 miezi 6 iliyopita"}
        </p>
        <DashboardTrendChart incomes={incomes} expenditures={expenditures} referenceDate={SYSTEM_DATE} lang={lang} />
      </div>
    </div>
  );
}
