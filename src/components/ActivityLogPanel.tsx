import React from "react";
import { History, Search, Loader2, ChevronRight } from "lucide-react";
import { ActivityLogEntry, PermissionModuleKey } from "../types";

interface ActivityLogPanelProps {
  lang: "en" | "sw";
}

const t = {
  en: {
    title: "Activity Log",
    desc: "Every create, edit, delete, and approval action across the platform, in one place.",
    searchPlaceholder: "Search by member, action, or record...",
    allModules: "All modules",
    loading: "Loading activity...",
    empty: "No activity found for these filters.",
    loadMore: "Load more",
    by: "by",
  },
  sw: {
    title: "Kumbukumbu za Shughuli",
    desc: "Kila kitendo cha kuunda, kuhariri, kufuta, na kuidhinisha katika mfumo mzima, mahali pamoja.",
    searchPlaceholder: "Tafuta kwa mwanachama, kitendo, au rekodi...",
    allModules: "Sehemu zote",
    loading: "Inapakia shughuli...",
    empty: "Hakuna shughuli iliyopatikana kwa vichungi hivi.",
    loadMore: "Pakia zaidi",
    by: "na",
  }
};

const MODULE_OPTIONS: PermissionModuleKey[] = [
  "documents", "finance", "assets", "grants", "classes", "invoices", "settings",
  "signup_reviews", "cms_editor", "beneficiaries", "roles", "safeguarding",
  "leadership_appointments", "activity_log"
];

export default function ActivityLogPanel({ lang }: ActivityLogPanelProps) {
  const tt = t[lang];
  const [items, setItems] = React.useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [moduleFilter, setModuleFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [cursor, setCursor] = React.useState<string | null>(null);

  const fetchPage = React.useCallback(async (reset: boolean) => {
    if (reset) { setLoading(true); setError(""); } else { setLoadingMore(true); }
    try {
      const params = new URLSearchParams();
      if (moduleFilter) params.set("module", moduleFilter);
      if (search) params.set("search", search);
      if (!reset && cursor) params.set("cursor", cursor);
      params.set("pageSize", "50");

      const res = await fetch(`/api/activity_log?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems(prev => reset ? data.items : [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } catch (err) {
      setError(lang === "en" ? "Failed to load activity log." : "Imeshindwa kupakia kumbukumbu.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleFilter, search]);

  React.useEffect(() => {
    fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleFilter, search]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
          <History size={18} className="text-red-600" /> {tt.title}
        </h2>
        <p className="text-xs text-neutral-500 mt-1">{tt.desc}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tt.searchPlaceholder}
            className="w-full pl-8 pr-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value)}
          className="text-xs border border-neutral-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="">{tt.allModules}</option>
          {MODULE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-neutral-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-neutral-400 py-10 text-center">{tt.empty}</p>
      ) : (
        <div className="border border-neutral-100 rounded-xl overflow-hidden divide-y divide-neutral-100">
          {items.map(item => (
            <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-neutral-50 text-xs">
              <ChevronRight size={12} className="text-neutral-300 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-neutral-800">
                  <span className="font-bold">{item.actorName}</span>
                  <span className="text-neutral-400"> ({item.actorRole}) </span>
                  <span className="font-mono text-neutral-500">{item.action}</span>
                  {item.targetLabel && <span className="text-neutral-600"> — {item.targetLabel}</span>}
                </p>
                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                  {item.module} · {new Date(item.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && cursor && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => fetchPage(false)}
            disabled={loadingMore}
            className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {loadingMore && <Loader2 size={12} className="animate-spin" />}
            {tt.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
