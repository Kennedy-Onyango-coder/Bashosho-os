import React from "react";
import { History, Search, Loader2, ChevronRight, LogIn, MapPin, Monitor } from "lucide-react";
import { ActivityLogEntry, LoginHistoryEntry, PermissionModuleKey } from "../types";

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
    tabActivity: "Actions",
    tabLogins: "Logins",
    loginTitle: "Login History",
    loginDesc: "Who logged in, when, from what device, and (approximately) where.",
    loginSearchPlaceholder: "Search by member, IP, device, or location...",
    loginEmpty: "No login events found for these filters.",
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
    tabActivity: "Vitendo",
    tabLogins: "Kuingia",
    loginTitle: "Kumbukumbu za Kuingia",
    loginDesc: "Nani aliingia, lini, kutoka kifaa gani, na (takriban) wapi.",
    loginSearchPlaceholder: "Tafuta kwa mwanachama, IP, kifaa, au mahali...",
    loginEmpty: "Hakuna kuingia kulikopatikana kwa vichungi hivi.",
  }
};

const MODULE_OPTIONS: PermissionModuleKey[] = [
  "documents", "finance", "assets", "grants", "classes", "invoices", "settings",
  "signup_reviews", "cms_editor", "beneficiaries", "roles", "safeguarding",
  "leadership_appointments", "activity_log"
];

export default function ActivityLogPanel({ lang }: ActivityLogPanelProps) {
  const tt = t[lang];
  const [view, setView] = React.useState<"activity" | "logins">("activity");
  const [items, setItems] = React.useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [moduleFilter, setModuleFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [cursor, setCursor] = React.useState<string | null>(null);

  const [loginItems, setLoginItems] = React.useState<LoginHistoryEntry[]>([]);
  const [loginLoading, setLoginLoading] = React.useState(true);
  const [loginLoadingMore, setLoginLoadingMore] = React.useState(false);
  const [loginError, setLoginError] = React.useState("");
  const [loginSearch, setLoginSearch] = React.useState("");
  const [loginCursor, setLoginCursor] = React.useState<string | null>(null);

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

  const fetchLoginPage = React.useCallback(async (reset: boolean) => {
    if (reset) { setLoginLoading(true); setLoginError(""); } else { setLoginLoadingMore(true); }
    try {
      const params = new URLSearchParams();
      if (loginSearch) params.set("search", loginSearch);
      if (!reset && loginCursor) params.set("cursor", loginCursor);
      params.set("pageSize", "50");

      const res = await fetch(`/api/login_history?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setLoginItems(prev => reset ? data.items : [...prev, ...data.items]);
      setLoginCursor(data.nextCursor);
    } catch (err) {
      setLoginError(lang === "en" ? "Failed to load login history." : "Imeshindwa kupakia kumbukumbu za kuingia.");
    } finally {
      setLoginLoading(false);
      setLoginLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginSearch]);

  React.useEffect(() => {
    if (view === "logins") fetchLoginPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, loginSearch]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
            {view === "activity" ? <History size={18} className="text-red-600" /> : <LogIn size={18} className="text-red-600" />}
            {view === "activity" ? tt.title : tt.loginTitle}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">{view === "activity" ? tt.desc : tt.loginDesc}</p>
        </div>
        <div className="flex gap-1.5 bg-neutral-100 rounded-lg p-1">
          <button
            onClick={() => setView("activity")}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-md cursor-pointer transition-colors ${view === "activity" ? "bg-white text-red-600 shadow-xs" : "text-neutral-500"}`}
          >
            {tt.tabActivity}
          </button>
          <button
            onClick={() => setView("logins")}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-md cursor-pointer transition-colors ${view === "logins" ? "bg-white text-red-600 shadow-xs" : "text-neutral-500"}`}
          >
            {tt.tabLogins}
          </button>
        </div>
      </div>

      {view === "activity" ? (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
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

          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

          {loading ? (
            <div className="flex items-center justify-center py-10 text-neutral-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-neutral-500 py-10 text-center">{tt.empty}</p>
          ) : (
            <div className="border border-neutral-100 rounded-xl overflow-hidden divide-y divide-neutral-100">
              {items.map(item => (
                <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-neutral-50 text-xs">
                  <ChevronRight size={12} className="text-neutral-300 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-800">
                      <span className="font-bold">{item.actorName}</span>
                      <span className="text-neutral-500"> ({item.actorRole}) </span>
                      <span className="font-mono text-neutral-500">{item.action}</span>
                      {item.targetLabel && <span className="text-neutral-600"> — {item.targetLabel}</span>}
                    </p>
                    <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
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
        </>
      ) : (
        <>
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={loginSearch}
              onChange={e => setLoginSearch(e.target.value)}
              placeholder={tt.loginSearchPlaceholder}
              className="w-full pl-8 pr-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {loginError && <p className="text-xs text-red-600">{loginError}</p>}

          {loginLoading ? (
            <div className="flex items-center justify-center py-10 text-neutral-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : loginItems.length === 0 ? (
            <p className="text-xs text-neutral-500 py-10 text-center">{tt.loginEmpty}</p>
          ) : (
            <div className="border border-neutral-100 rounded-xl overflow-hidden divide-y divide-neutral-100">
              {loginItems.map(item => (
                <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-neutral-50 text-xs">
                  <LogIn size={12} className="text-neutral-300 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-800">
                      <span className="font-bold">{item.userName}</span>
                      <span className="text-neutral-500"> ({item.userRole}) </span>
                      {item.method === "2fa" && <span className="text-[9px] font-mono bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">2FA</span>}
                    </p>
                    <p className="text-[10px] text-neutral-500 font-mono mt-0.5 flex items-center gap-3 flex-wrap">
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Monitor size={10} /> {item.device}</span>
                      <span className="flex items-center gap-1"><MapPin size={10} /> {item.location || `${lang === "en" ? "IP" : "IP"}: ${item.ipAddress}`}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loginLoading && loginCursor && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => fetchLoginPage(false)}
                disabled={loginLoadingMore}
                className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {loginLoadingMore && <Loader2 size={12} className="animate-spin" />}
                {tt.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
