import React from "react";
import { LeaveRequest } from "../../types";
import { Search, Filter, Calendar, User, Clock, AlertCircle, Loader2 } from "lucide-react";

interface LeaveRegisterProps {
  lang: "en" | "sw";
  canSeeConfidential: boolean;
}

type FilterKey = "all" | "pending" | "under_review" | "approved" | "rejected" | "cancelled" | "on_leave" | "completed";

function pendingDays(submittedAt?: string): number | null {
  if (!submittedAt) return null;
  const ms = Date.now() - new Date(submittedAt).getTime();
  if (isNaN(ms) || ms < 0) return null;
  return Math.floor(ms / 86400000);
}

function statusBadge(status: string, lang: "en" | "sw") {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-amber-100", text: "text-amber-700", label: lang === "en" ? "Pending" : "Inasubiri" },
    submitted: { bg: "bg-amber-100", text: "text-amber-700", label: lang === "en" ? "Pending" : "Inasubiri" },
    under_review: { bg: "bg-blue-100", text: "text-blue-700", label: lang === "en" ? "Under Review" : "Inapitiwa" },
    approved: { bg: "bg-emerald-100", text: "text-emerald-700", label: lang === "en" ? "Approved" : "Imeidhinishwa" },
    rejected: { bg: "bg-red-100", text: "text-red-700", label: lang === "en" ? "Rejected" : "Imekataliwa" },
    cancelled: { bg: "bg-neutral-100", text: "text-neutral-600", label: lang === "en" ? "Cancelled" : "Imeghairiwa" },
    on_leave: { bg: "bg-purple-100", text: "text-purple-700", label: lang === "en" ? "On Leave" : "Kwenye Likizo" },
    completed: { bg: "bg-neutral-100", text: "text-neutral-600", label: lang === "en" ? "Completed" : "Imekamilika" }
  };
  const s = map[status] || map.pending;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>;
}

const t = {
  en: {
    title: "Leave Register", desc: "Permanent record of all leave requests. No request disappears.",
    search: "Search by name, reference, type, or date...",
    all: "All", pending: "Pending", underReview: "Under Review",
    approved: "Approved", rejected: "Rejected", cancelled: "Cancelled", onLeave: "On Leave", completed: "Completed",
    ref: "Reference", employee: "Employee", dates: "Dates", approver: "Approver", status: "Status",
    noResults: "No leave requests match the current filter.",
    pendingFor: "Pending for", daysWord: "days", loadError: "Failed to load leave register.", retry: "Retry"
  },
  sw: {
    title: "Sajili ya Likizo", desc: "Rekodi ya kudumu ya maombi yote ya likizo. Hakuna ombi linaloyeyuka.",
    search: "Tafuta kwa jina, rejea, aina, au tarehe...",
    all: "Zote", pending: "Inasubiri", underReview: "Inapitiwa",
    approved: "Imeidhinishwa", rejected: "Imekataliwa", cancelled: "Imeghairiwa", onLeave: "Kwenye Likizo", completed: "Imekamilika",
    ref: "Rejea", employee: "Mfanyakazi", dates: "Tarehe", approver: "Muidinishaji", status: "Hali",
    noResults: "Hakuna maombi ya likizo yanayolingana na chujio cha sasa.",
    pendingFor: "Inasubiri kwa", daysWord: "siku", loadError: "Imeshindwa kupakia sajili ya likizo.", retry: "Jaribu tena"
  }
};

export default function LeaveRegister({ lang, canSeeConfidential }: LeaveRegisterProps) {
  const tt = t[lang];
  const [requests, setRequests] = React.useState<LeaveRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/leave_requests");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setRequests(data);
    } catch (err: any) {
      setError(err.message || tt.loadError);
    } finally {
      setLoading(false);
    }
  }, [tt.loadError]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const filtered = React.useMemo(() => {
    let items = requests;
    if (filter !== "all") {
      items = items.filter(r => {
        if (filter === "pending") return r.status === "pending" || r.status === "submitted";
        return r.status === filter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(r =>
        (r.userName || "").toLowerCase().includes(q) ||
        (r.reference || "").toLowerCase().includes(q) ||
        (r.leaveType || "").toLowerCase().includes(q) ||
        (r.startDate || "").includes(q) ||
        (r.endDate || "").includes(q)
      );
    }
    return items.sort((a, b) => (b.submittedAt || b.id).localeCompare(a.submittedAt || a.id));
  }, [requests, filter, search]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-black text-neutral-900">{tt.title}</h3>
        <p className="text-xs text-neutral-500 mt-1">{tt.desc}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tt.search}
            className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-neutral-400" />
          <select value={filter} onChange={e => setFilter(e.target.value as FilterKey)}
            className="border border-neutral-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500">
            <option value="all">{tt.all}</option>
            <option value="pending">{tt.pending}</option>
            <option value="under_review">{tt.underReview}</option>
            <option value="approved">{tt.approved}</option>
            <option value="rejected">{tt.rejected}</option>
            <option value="cancelled">{tt.cancelled}</option>
            <option value="on_leave">{tt.onLeave}</option>
            <option value="completed">{tt.completed}</option>
          </select>
        </div>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12} /> {error}</p>
          <button onClick={loadData} className="text-xs font-bold text-red-600 hover:underline">{tt.retry}</button>
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-neutral-400" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-neutral-500 py-6 text-center">{tt.noResults}</p>
      ) : (
        <div className="border border-neutral-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase tracking-wider">{tt.ref}</th>
                  <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase tracking-wider">{tt.employee}</th>
                  <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase tracking-wider">{tt.dates}</th>
                  <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase tracking-wider">{tt.approver}</th>
                  <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase tracking-wider">{tt.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map(req => {
                  const pd = pendingDays(req.submittedAt);
                  return (
                    <tr key={req.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-3 py-2.5"><span className="font-mono font-bold text-neutral-700">{req.reference || req.id}</span></td>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-1.5"><User size={11} className="text-neutral-400" /><span className="font-semibold text-neutral-800">{req.userName}</span></div></td>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-1.5 text-neutral-600"><Calendar size={11} className="text-neutral-400" />{req.startDate} → {req.endDate}{req.days != null && <span className="text-neutral-400">({req.days}d)</span>}</div></td>
                      <td className="px-3 py-2.5 text-neutral-600">{req.approverName || req.respondedBy || "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          {statusBadge(req.status, lang)}
                          {pd != null && (req.status === "pending" || req.status === "submitted") && (
                            <span className="text-[10px] text-neutral-400 flex items-center gap-1"><Clock size={9} />{tt.pendingFor} {pd} {tt.daysWord}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}