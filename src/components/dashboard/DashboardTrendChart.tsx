import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Income, ExpenditureRequest } from "../../types";

interface DashboardTrendChartProps {
  incomes: Income[];
  expenditures: ExpenditureRequest[];
  /** Fixed "today" reference to keep the trend window stable, matching the rest of the app's use of a fixed system date. */
  referenceDate: Date;
  monthsBack?: number;
  lang: "en" | "sw";
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardTrendChart({ incomes, expenditures, referenceDate, monthsBack = 6, lang }: DashboardTrendChartProps) {
  const monthLabelsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabelsSw = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ago", "Sep", "Okt", "Nov", "Des"];
  const labels = lang === "en" ? monthLabelsEn : monthLabelsSw;

  const months: { key: string; label: string; month: number; year: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: labels[d.getMonth()], month: d.getMonth(), year: d.getFullYear() });
  }

  const data = months.map(({ key, label }) => {
    const income = incomes
      .filter(inc => {
        const d = new Date(inc.date);
        return !isNaN(d.getTime()) && monthKey(d) === key;
      })
      .reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);

    const expenditure = expenditures
      .filter(exp => {
        if (exp.status !== "approved") return false;
        const d = new Date(exp.requestDate);
        return !isNaN(d.getTime()) && monthKey(d) === key;
      })
      .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

    return { name: label, income, expenditure };
  });

  const hasAnyData = data.some(d => d.income > 0 || d.expenditure > 0);

  if (!hasAnyData) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
        {lang === "en" ? "No income or expenditure recorded yet in this period." : "Hakuna mapato au matumizi yaliyorekodiwa bado katika kipindi hiki."}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-2 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          {lang === "en" ? "Income" : "Mapato"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
          {lang === "en" ? "Expenditure" : "Matumizi"}
        </span>
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#e4e4e7" }}
              formatter={(value: number) => `KSh ${value.toLocaleString()}`}
            />
            <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} />
            <Line type="monotone" dataKey="expenditure" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
