import React from "react";
import { AlertTriangle, Clock, FileCheck, ShieldAlert, Palmtree, ChevronRight } from "lucide-react";

export interface NotificationItem {
  id: string;
  label: string;
  count: number;
  /** Sensitive items (e.g. safeguarding) render with a lock-toned accent and no detail beyond the count. */
  sensitive?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}

interface NotificationFeedProps {
  items: NotificationItem[];
  lang: "en" | "sw";
}

export default function NotificationFeed({ items, lang }: NotificationFeedProps) {
  const visible = items.filter(i => i.count > 0);

  if (visible.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 text-sm text-neutral-500 flex items-center gap-2">
        <FileCheck size={16} className="text-emerald-500" />
        {lang === "en" ? "You're all caught up \u2014 nothing pending your attention." : "Umekamilisha kila kitu \u2014 hakuna kinachosubiri."}
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl divide-y divide-neutral-800 overflow-hidden">
      {visible.map(item => (
        <button
          key={item.id}
          onClick={item.onClick}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-800/70 transition-colors duration-150"
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              item.sensitive ? "bg-purple-500/10 text-purple-400" : "bg-amber-500/10 text-amber-400"
            }`}
          >
            {item.icon}
          </div>
          <span className="flex-1 text-sm text-neutral-200">{item.label}</span>
          <span className="text-sm font-bold font-mono text-neutral-50 bg-neutral-800 px-2 py-0.5 rounded-full min-w-[24px] text-center">
            {item.count}
          </span>
          <ChevronRight size={16} className="text-neutral-600 shrink-0" />
        </button>
      ))}
    </div>
  );
}

export const NotificationIcons = { AlertTriangle, Clock, FileCheck, ShieldAlert, Palmtree };
