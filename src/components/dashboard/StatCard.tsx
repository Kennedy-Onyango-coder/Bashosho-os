import React from "react";

export type StatAccent = "neutral" | "finance" | "community" | "danger";

const ACCENT_STYLES: Record<StatAccent, { border: string; icon: string; value: string }> = {
  // Neutral / structural — minimal SaaS base
  neutral: { border: "border-l-blue-500", icon: "text-blue-400 bg-blue-500/10", value: "text-neutral-50" },
  // Money screens — trust & finance direction
  finance: { border: "border-l-emerald-500", icon: "text-emerald-400 bg-emerald-500/10", value: "text-neutral-50" },
  // People/community screens — warm direction
  community: { border: "border-l-amber-500", icon: "text-amber-400 bg-amber-500/10", value: "text-neutral-50" },
  danger: { border: "border-l-red-500", icon: "text-red-400 bg-red-500/10", value: "text-neutral-50" }
};

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: StatAccent;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  onClick?: () => void;
}

export default function StatCard({ label, value, icon, accent = "neutral", delta, deltaDirection = "neutral", onClick }: StatCardProps) {
  const styles = ACCENT_STYLES[accent];
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`bg-neutral-900 border border-neutral-800 border-l-4 ${styles.border} rounded-xl p-4 text-left w-full transition-colors duration-150 ${
        onClick ? "hover:bg-neutral-800/70 cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-neutral-400 truncate">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${styles.value} font-mono tabular-nums`}>{value}</p>
          {delta && (
            <p
              className={`text-xs mt-1 font-medium ${
                deltaDirection === "up" ? "text-emerald-400" : deltaDirection === "down" ? "text-red-400" : "text-neutral-500"
              }`}
            >
              {delta}
            </p>
          )}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${styles.icon}`}>{icon}</div>
      </div>
    </Wrapper>
  );
}
