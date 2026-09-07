import React from "react";
import { HireEquipmentItem, EquipmentHire } from "../../types";
import { AlertCircle, Loader2, Package, Check, X, Clock, RefreshCw } from "lucide-react";

interface EquipmentHiringBoardProps {
  lang: "en" | "sw";
  canApprove: boolean; // equipment_management.approve
  canManage: boolean;  // equipment_management.edit
  canRequest: boolean; // equipment_management.create
}

const t = {
  en: {
    title: "Equipment Hiring", desc: "Active members get the discounted member rate. Prices are calculated by the server.",
    available: "Available Equipment", yourRate: "Your member rate", normalRate: "Normal rate",
    memberRate: "Member rate", stdRate: "Your price", request: "Request Hire", myHires: "My Hires",
    allHires: "All Hires", approve: "Approve", reject: "Reject", checkout: "Check Out",
    markReturned: "Mark Returned", cancel: "Cancel", start: "Start", end: "End", purpose: "Purpose",
    submit: "Submit Request", submitting: "Submitting...", noEquipment: "No equipment available right now.",
    noHires: "No hires yet.", rateApplied: "Rate applied", active: "Active member",
    notActive: "Not on member rate", total: "Total", retry: "Retry", loadError: "Failed to load equipment.", rejectReason: "Reason for rejection (required)", returnCondition: "Condition on return (e.g. good):"
  },
  sw: {
    title: "Ukodishaji wa Vifaa", desc: "Wanachama hai wanapata bei ya punguzo. Bei huhesabiwa na mfumo.",
    available: "Vifaa Vinavyopatikana", yourRate: "Bei yako", normalRate: "Bei ya kawaida",
    memberRate: "Bei ya mwanachama", stdRate: "Bei yako", request: "Omba Ukodishaji", myHires: "Maombi Yangu",
    allHires: "Maombi Yote", approve: "Idhinisha", reject: "Kataa", checkout: "Kabidhi",
    markReturned: "Imekamilika Kurudisha", cancel: "Ghairi", start: "Kuanza", end: "Mwisho", purpose: "Sababu",
    submit: "Tuma Ombi", submitting: "Inatuma...", noEquipment: "Hakuna vifaa kwa sasa.",
    noHires: "Hakuna maombi bado.", rateApplied: "Bei iliyotumika", active: "Mwanachama hai",
    notActive: "Hakuna punguzo", total: "Jumla", retry: "Jaribu tena", loadError: "Imeshindwa kupakia vifaa.", rejectReason: "Sababu ya kukatalia (lazima)", returnCondition: "Hali ya kurudisha (k.m. nzuri):"
  }
};

function statusLabel(s: string, lang: "en" | "sw") {
  const m: Record<string, string> = {
    requested: lang === "en" ? "Requested" : "Imeombwa",
    under_review: lang === "en" ? "Under Review" : "Inapitiwa",
    approved: lang === "en" ? "Approved" : "Imeidhinishwa",
    checked_out: lang === "en" ? "Checked Out" : "Imekabidhiwa",
    returned: lang === "en" ? "Returned" : "Imekamilika",
    rejected: lang === "en" ? "Rejected" : "Imekataliwa",
    cancelled: lang === "en" ? "Cancelled" : "Imeghairiwa",
    overdue: lang === "en" ? "Overdue" : "Imechelewa"
  };
  return m[s] || s;
}

export default function EquipmentHiringBoard({ lang, canApprove, canManage, canRequest }: EquipmentHiringBoardProps) {
  const tt = t[lang];
  const [equipment, setEquipment] = React.useState<HireEquipmentItem[]>([]);
  const [myHires, setMyHires] = React.useState<EquipmentHire[]>([]);
  const [allHires, setAllHires] = React.useState<EquipmentHire[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [reqTarget, setReqTarget] = React.useState<HireEquipmentItem | null>(null);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [purpose, setPurpose] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [eqRes, mineRes] = await Promise.all([fetch("/api/equipment"), fetch("/api/equipment/hire/my")]);
      const eqData = await eqRes.json().catch(() => []);
      if (!eqRes.ok) throw new Error((eqData && eqData.error) || `Server returned ${eqRes.status}`);
      setEquipment(Array.isArray(eqData) ? eqData : []);
      if (mineRes.ok) setMyHires(await mineRes.json());
      if (canApprove) {
        const allRes = await fetch("/api/equipment/hire");
        if (allRes.ok) setAllHires(await allRes.json());
      }
    } catch (err: any) {
      setError(err.message || tt.loadError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canApprove]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTarget || !startDate || !endDate) return;
    setActing(true);
    try {
      const res = await fetch("/api/equipment/hire", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentId: reqTarget.id, startDate, endDate, purpose })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
      setReqTarget(null); setStartDate(""); setEndDate(""); setPurpose("");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to submit hire request");
    } finally {
      setActing(false);
    }
  };

  const fmt = (n?: number) => `KSh ${Number(n || 0).toLocaleString()}`;

  const act = async (hireId: string, action: "decide" | "checkout" | "return" | "cancel", decision?: "approved" | "rejected") => {
    setBusyId(hireId);
    try {
      let res: Response;
      if (action === "decide") {
        let reason: string | undefined = undefined;
        if (decision === "rejected") {
          const r = window.prompt(tt.rejectReason);
          if (!r || !r.trim()) { setBusyId(null); return; }
          reason = r.trim();
        }
        res = await fetch(`/api/equipment/hire/${hireId}/decide`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, reason })
        });
      } else if (action === "checkout") {
        res = await fetch(`/api/equipment/hire/${hireId}/checkout`, { method: "POST", headers: { "Content-Type": "application/json" } });
      } else if (action === "return") {
        const condition = window.prompt(tt.returnCondition);
        res = await fetch(`/api/equipment/hire/${hireId}/return`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ condition })
        });
      } else {
        res = await fetch(`/api/equipment/hire/${hireId}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" } });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-black text-neutral-900">{tt.title}</h3>
          <p className="text-xs text-neutral-500 mt-1">{tt.desc}</p>
        </div>
        <button onClick={loadData} className="text-xs font-bold text-neutral-500 hover:text-neutral-800 flex items-center gap-1 cursor-pointer"><RefreshCw size={12} /> {tt.retry}</button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12} /> {error}</p>
          <button onClick={loadData} className="text-xs font-bold text-red-600 hover:underline">{tt.retry}</button>
        </div>
      )}

      {reqTarget && (
        <form onSubmit={submitRequest} className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3 max-w-md">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-neutral-800">{tt.request}: {reqTarget.name}</p>
            <button type="button" onClick={() => setReqTarget(null)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer"><X size={14} /></button>
          </div>
          <p className="text-[11px] text-neutral-600">
            {reqTarget.callerIsActiveMember
              ? <span className="font-bold text-emerald-700">{tt.yourRate}: {fmt(reqTarget.myRate)} / {reqTarget.pricingUnit}</span>
              : <span className="font-bold text-neutral-700">{tt.stdRate}: {fmt(reqTarget.myRate)} / {reqTarget.pricingUnit}</span>}
            <span className="mx-1.5 text-neutral-300">|</span>
            {tt.normalRate}: {fmt(reqTarget.normalHireRate)}
            {reqTarget.memberHireRate != null && Number(reqTarget.memberHireRate) > 0 && (
              <><span className="mx-1.5 text-neutral-300">|</span>{tt.memberRate}: {fmt(reqTarget.memberHireRate)}</>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
          </div>
          <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder={tt.purpose} className="w-full border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
          <button type="submit" disabled={acting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer flex items-center gap-1.5">
            {acting ? <Loader2 size={12} className="animate-spin" /> : null} {acting ? tt.submitting : tt.submit}
          </button>
        </form>
      )}

      <div>
        <p className="text-[10px] font-bold uppercase text-neutral-400 mb-2 flex items-center gap-1.5"><Package size={12} /> {tt.available}</p>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-neutral-400" /></div>
        ) : equipment.length === 0 ? (
          <p className="text-xs text-neutral-500 py-6 text-center">{tt.noEquipment}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {equipment.map(item => (
              <div key={item.id} className="bg-white border border-neutral-200 rounded-xl p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-neutral-900">{item.name}</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 uppercase shrink-0">{item.category}</span>
                </div>
                {item.description && <p className="text-[10px] text-neutral-500">{item.description}</p>}
                <p className="text-[11px]"><span className="text-neutral-400">{tt.normalRate}:</span> <span className="font-semibold">{fmt(item.normalHireRate)}</span> / {item.pricingUnit}</p>
                <p className="text-[11px]"><span className="text-neutral-400">{item.callerIsActiveMember ? tt.yourRate : tt.memberRate}:</span> <span className={`font-black ${item.callerIsActiveMember ? "text-emerald-700" : "text-neutral-500"}`}>{fmt(item.myRate)}</span></p>
                {canRequest && (
                  <button onClick={() => setReqTarget(item)} className="w-full mt-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg cursor-pointer">{tt.request}</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase text-neutral-400 mb-2">{tt.myHires}</p>
        {myHires.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4 text-center">{tt.noHires}</p>
        ) : (
          <div className="border border-neutral-200 rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase">Ref</th>
                  <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase">{tt.available}</th>
                  <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase">{tt.rateApplied}</th>
                  <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase">{tt.total}</th>
                  <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase">Status</th>
                  <th className="text-right px-3 py-2 font-bold text-neutral-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {myHires.map(h => (
                  <tr key={h.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 font-mono font-bold text-neutral-700">{h.reference}</td>
                    <td className="px-3 py-2 text-neutral-700">{h.equipmentNameSnapshot}<span className="text-neutral-400"> · {h.startDate} ? {h.endDate}</span></td>
                    <td className="px-3 py-2">
                      <span className={`font-bold ${h.pricingReason === "MEMBER_RATE" ? "text-emerald-700" : "text-neutral-700"}`}>{fmt(h.chargedRate)}</span>
                      <span className="text-[9px] text-neutral-400 block">{h.pricingReason === "MEMBER_RATE" ? tt.memberRate : tt.normalRate}</span>
                    </td>
                    <td className="px-3 py-2 font-bold text-neutral-800">{fmt(h.totalAmount)}</td>
                    <td className="px-3 py-2"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">{statusLabel(h.status, lang)}</span></td>
                    <td className="px-3 py-2 text-right">
                      {(h.status === "requested" || h.status === "under_review") && (
                        <button onClick={() => act(h.id, "cancel")} disabled={busyId === h.id} className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer disabled:opacity-50">{tt.cancel}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canApprove && (
        <div>
          <p className="text-[10px] font-bold uppercase text-neutral-400 mb-2">{tt.allHires}</p>
          {allHires.length === 0 ? (
            <p className="text-xs text-neutral-500 py-4 text-center">{tt.noHires}</p>
          ) : (
            <div className="border border-neutral-200 rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase">Ref</th>
                    <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase">Requester</th>
                    <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase">{tt.rateApplied}</th>
                    <th className="text-left px-3 py-2 font-bold text-neutral-500 uppercase">Status</th>
                    <th className="text-right px-3 py-2 font-bold text-neutral-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {allHires.map(h => (
                    <tr key={h.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 font-mono font-bold text-neutral-700">{h.reference}</td>
                      <td className="px-3 py-2">
                        <span className="font-semibold text-neutral-800">{h.requesterNameSnapshot}</span>
                        <span className="text-[9px] text-neutral-400 block">{h.equipmentNameSnapshot} · {h.startDate} ? {h.endDate}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-bold ${h.pricingReason === "MEMBER_RATE" ? "text-emerald-700" : "text-neutral-700"}`}>{fmt(h.chargedRate)}</span>
                        <span className="text-[9px] text-neutral-400 block">{h.membershipStatusAtRequest}</span>
                      </td>
                      <td className="px-3 py-2"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">{statusLabel(h.status, lang)}</span></td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1.5 justify-end">
                          {h.status === "requested" && (
                            <>
                              <button onClick={() => act(h.id, "decide", "approved")} disabled={busyId === h.id} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer disabled:opacity-50 flex items-center gap-1"><Check size={10} /> {tt.approve}</button>
                              <button onClick={() => act(h.id, "decide", "rejected")} disabled={busyId === h.id} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 cursor-pointer disabled:opacity-50 flex items-center gap-1"><X size={10} /> {tt.reject}</button>
                            </>
                          )}
                          {h.status === "approved" && canManage && (
                            <button onClick={() => act(h.id, "checkout")} disabled={busyId === h.id} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer disabled:opacity-50 flex items-center gap-1"><Clock size={10} /> {tt.checkout}</button>
                          )}
                          {h.status === "checked_out" && canManage && (
                            <button onClick={() => act(h.id, "return")} disabled={busyId === h.id} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-neutral-100 text-neutral-700 border border-neutral-200 hover:bg-neutral-200 cursor-pointer disabled:opacity-50">{tt.markReturned}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
