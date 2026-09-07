import React from "react";
import { LeaveRequest, LeaveAuditEvent } from "../../types";
import { X, Loader2, Check, AlertCircle, Calendar, Clock, User as UserIcon } from "lucide-react";

interface LeaveDetailProps {
  requestId: string;
  lang: "en" | "sw";
  canApprove: boolean;      // leave_management.approve
  canSeeConfidential: boolean;
  onClose: () => void;
  onChanged: () => void;    // refetch the register after a successful decision
}

const t = {
  en: {
    leaveRequest: "LEAVE REQUEST", employee: "Employee", leaveType: "Leave type",
    start: "Start", end: "End", daysLabel: "Days", reason: "Reason", statusLabel: "Status",
    approver: "Approver", submitted: "Submitted", decisionDate: "Decision date",
    decisionComment: "Decision comment", approve: "Approve", reject: "Reject",
    timelinest: "Timeline", auditt: "Audit trail", close: "Close",
    rejectReasonPh: "Reason for rejection (required)",
    daysUnit: "days"
  },
  sw: {
    leaveRequest: "OMBI LA LIKIZO", employee: "Mfanyakazi", leaveType: "Aina ya likizo",
    start: "Kuanza", end: "Mwisho", daysLabel: "Siku", reason: "Sababu", statusLabel: "Hali",
    approver: "Muidhinishaji", submitted: "Iliwasilishwa", decisionDate: "Tarehe ya uamuzi",
    decisionComment: "Maoni ya uamuzi", approve: "Idhinisha", reject: "Kataa",
    cancelReason: "Ghairi",
    timelinest: "Mkondo", auditt: "Rekodi ya ukaguzi", close: "Funga",
    rejectReasonPh: "Sababu ya kukatalia (lazima)",
    daysLeft: "siku"
  }
};

function statusLabelOf(s: string | undefined, lang: "en" | "sw"): string {
  const map: Record<string, { en: string; sw: string }> = {
    pending: { en: "Pending", sw: "Inasubiri" },
    submitted: { en: "Pending", sw: "Inasubiri" },
    under_review: { en: "Under Review", sw: "Inapitiwa" },
    approved: { en: "Approved", sw: "Imeidhinishwa" },
    rejected: { en: "Rejected", sw: "Imekataliwa" },
    cancelled: { en: "Cancelled", sw: "Imeghairiwa" },
    on_leave: { en: "On Leave", sw: "Kwenye Likizo" },
    completed: { en: "Completed", sw: "Imekamilika" }
  };
  const r = map[s || "pending"];
  return r ? r[lang] : (lang === "en" ? "Pending" : "Inasubiri");
}

export default function LeaveDetail({ requestId, lang, canApprove, canSeeConfidential, onClose, onChanged }: LeaveDetailProps) {
  const tt = t[lang];
  const [req, setReq] = React.useState<LeaveRequest | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try {
        const res = await fetch(`/api/leave_requests/${requestId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
        if (!cancelled) setReq(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load request");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requestId]);

  const decide = async (decision: "approved" | "rejected") => {
    if (acting) return;
    if (decision === "rejected" && !rejectReason.trim()) return;
    setActing(true); setError("");
    try {
      const body: any = { decision };
      if (decision === "rejected") body.reason = rejectReason.trim();
      const res = await fetch(`/api/leave_requests/${requestId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
      setReq(data.request || data);
      onChanged();
    } catch (err: any) {
      setError(err.message || "Failed to process decision");
    } finally {
      setActing(false); setRejectOpen(false); setRejectReason("");
    }
  };

  const open = req?.status === "pending" || req?.status === "submitted" || req?.status === "under_review";
  const timelineSteps: { label: string; at?: string; done: boolean }[] = req ? [
    { label: lang === "en" ? "Submitted" : "Iliwasilishwa", at: req.submittedAt, done: true },
    { label: lang === "en" ? "Assigned" : "Imepewa", at: req.approverName || req.respondedBy, done: !!req.approverName || !!req.respondedBy },
    { label: lang === "en" ? "Decision" : "Uamuzi", at: req.decisionDate, done: ["approved","rejected","cancelled"].includes(req.status) },
    { label: lang === "en" ? "Leave begins" : "Likizo inaanza", at: req.startDate, done: ["on_leave","completed"].includes(req.status) },
    { label: lang === "en" ? "Return" : "Kurejea", at: req.returnConfirmedAt, done: !!req.returnConfirmedAt },
    { label: lang === "en" ? "Completed" : "Imekamilika", at: req.completedAt, done: req.status === "completed" }
  ] : [];

  const overlay = (content: React.ReactNode) => (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">{content}</div>
    </div>
  );

  if (loading) return overlay(<div className="p-8 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-neutral-400" /></div>);
  if (!req) return overlay(<div className="p-6 space-y-4">
      <div className="flex items-center justify-between"><h3 className="text-sm font-black">{tt.leaveRequest}</h3><button onClick={onClose}><X size={18} /></button></div>
      <p className="text-xs text-red-600">{error}</p>
      <button onClick={onClose} className="text-xs font-bold text-neutral-600 underline">{tt.close}</button>
    </div>);

  return overlay(
    <div>
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 sticky top-0 bg-white">
        <div>
          <p className="text-[10px] font-bold uppercase text-neutral-500">{tt.leaveRequest}</p>
          <p className="text-sm font-black text-neutral-900 font-mono">{req.reference || req.id}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer"><X size={18} /></button>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div><p className="text-[10px] font-bold uppercase text-neutral-400">{tt.employee}</p><p className="font-semibold mt-0.5 flex items-center gap-1"><UserIcon size={12} /> {req.userName}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-neutral-400">{tt.leaveType}</p><p className="mt-0.5 font-semibold">{req.leaveType || "Leave"}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-neutral-400">{tt.statusLabel}</p><span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{statusLabelOf(req.status, lang)}</span></div>
          <div><p className="text-[10px] font-bold uppercase text-neutral-400">{tt.start}</p><p className="mt-0.5 flex items-center gap-1"><Calendar size={11} /> {req.startDate}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-neutral-400">{tt.end}</p><p className="mt-0.5 flex items-center gap-1"><Calendar size={11} /> {req.endDate}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-neutral-400">{tt.daysLabel}</p><p className="mt-0.5 font-semibold">{req.days}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-neutral-400">{tt.approver}</p><p className="mt-0.5">{req.approverName || req.respondedBy || "—"}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-neutral-400">{tt.submitted}</p><p className="mt-0.5">{req.submittedAt || "—"}</p></div>
        </div>

        {canSeeConfidential && req.reason && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase text-neutral-400">{tt.reason}</p>
            <p className="text-xs mt-1 text-neutral-700">{req.reason}</p>
          </div>
        )}

        <div>
          <p className="text-[10px] font-bold uppercase text-neutral-400 mb-2">{tt.timelinest}</p>
          <ol className="space-y-1.5">
            {timelineSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center ${s.done ? "bg-emerald-100 text-emerald-600" : "bg-neutral-100 text-neutral-400"}`}>{s.done ? <Check size={10} /> : <Clock size={10} />}</span>
                <div>
                  <p className={`font-semibold ${s.done ? "text-neutral-800" : "text-neutral-400"}`}>{s.label}</p>
                  {s.at && <p className="text-[10px] text-neutral-400">{s.at}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {req.auditTrail && req.auditTrail.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase text-neutral-400 mb-2">{tt.auditt}</p>
            <div className="max-h-40 overflow-y-auto border border-neutral-100 rounded-lg divide-y divide-neutral-100">
              {req.auditTrail.map((e: LeaveAuditEvent) => (
                <div key={e.id} className="px-3 py-1.5 text-[11px] flex items-center justify-between">
                  <span className="font-mono font-bold text-neutral-700">{e.type}</span>
                  <span className="text-neutral-400">{e.at}{e.byName ? ` — ${e.byName}` : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}

        {canApprove && open && (
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-neutral-200">
            <button onClick={() => decide("approved")} disabled={acting} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer flex items-center gap-1.5">
              {acting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {tt.approve}
            </button>
            <button onClick={() => setRejectOpen(v => !v)} disabled={acting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer">
              {tt.reject}
            </button>
            {rejectOpen && (
              <div className="w-full sm:flex-1 flex gap-2 items-center">
                <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder={tt.rejectReasonPh} autoFocus className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
                <button onClick={() => decide("rejected")} disabled={acting || !rejectReason.trim()} className="px-3 py-2 bg-red-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer">{tt.reject}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
