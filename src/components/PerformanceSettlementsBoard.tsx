import React from "react";
import { Percent, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { PerformanceSettlement } from "../types";

interface PerformanceSettlementsBoardProps {
  lang: "en" | "sw";
  canConfirm: boolean;
}

export default function PerformanceSettlementsBoard({ lang, canConfirm }: PerformanceSettlementsBoardProps) {
  const [settlements, setSettlements] = React.useState<PerformanceSettlement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingPercent, setEditingPercent] = React.useState<Record<string, string>>({});
  const [overrideReason, setOverrideReason] = React.useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/performance_settlements");
      if (res.ok) setSettlements(await res.json());
    } catch (err) {
      console.error("Failed to load performance settlements:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchSettlements(); }, []);

  const handleConfirm = async (s: PerformanceSettlement) => {
    setConfirmingId(s.id);
    try {
      const pct = editingPercent[s.id];
      const isOverride = pct !== undefined && Number(pct) !== s.orgCutPercent;
      const body: any = pct !== undefined ? { orgCutPercent: Number(pct) } : {};
      if (isOverride) body.overrideReason = (overrideReason[s.id] || "").trim();
      const res = await fetch(`/api/performance_settlements/${s.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to confirm settlement");
      fetchSettlements();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  const pending = settlements.filter(s => s.status === "pending_confirmation").sort((a, b) => b.createdDate.localeCompare(a.createdDate));
  const confirmed = settlements.filter(s => s.status === "confirmed").sort((a, b) => (b.confirmedDate || "").localeCompare(a.confirmedDate || ""));

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
          <Percent className="text-[#E31E24]" size={20} />
          {lang === "en" ? "Performance Settlements" : "Ugawaji wa Mapato ya Maonyesho"}
        </h2>
        <p className="text-xs text-neutral-500 mt-1">
          {lang === "en"
            ? "Every performance/engagement invoice marked paid lands here first — the organizational cut and cast pool are calculated automatically, but nothing becomes real income or an expenditure until confirmed below."
            : "Kila ankara ya onyesho iliyolipwa inaonekana hapa kwanza — mgawanyo unakokotolewa kiotomatiki, lakini hauwi rasmi hadi uthibitishwe."}
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-neutral-500 py-10 text-center">{lang === "en" ? "Loading..." : "Inapakia..."}</p>
      ) : (
        <>
          <div>
            <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" /> {lang === "en" ? "Awaiting Confirmation" : "Inasubiri Uthibitisho"} ({pending.length})
            </h3>
            {pending.length === 0 ? (
              <p className="text-xs text-neutral-500 bg-white border border-neutral-200 rounded-xl p-6 text-center">
                {lang === "en" ? "Nothing waiting — every settlement is confirmed." : "Hakuna kinachosubiri."}
              </p>
            ) : (
              <div className="space-y-3">
                {pending.map(s => (
                  <div key={s.id} className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-bold text-neutral-900">{s.engagementDescription}</h4>
                        <p className="text-[10px] font-mono text-neutral-500">{s.createdDate} · {lang === "en" ? "Gross" : "Jumla"}: Ksh {s.grossAmount.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-neutral-50 rounded-lg p-3 text-xs">
                      <div className="flex-1">
                        <label className="block text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Org Cut %" : "% ya Shirika"}</label>
                        <input
                          type="number" min="0" max="100"
                          value={editingPercent[s.id] ?? String(s.orgCutPercent)}
                          onChange={e => setEditingPercent(prev => ({ ...prev, [s.id]: e.target.value }))}
                          disabled={!canConfirm}
                          className="w-20 bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <ArrowRight size={14} className="text-neutral-300 shrink-0" />
                      <div className="text-right flex-1">
                        <p className="font-bold text-purple-700">Ksh {Math.round(s.grossAmount * (Number(editingPercent[s.id] ?? s.orgCutPercent) / 100)).toLocaleString()}</p>
                        <p className="text-[9px] text-neutral-500">{lang === "en" ? "→ Org Development Fund" : "→ Mfuko wa Maendeleo"}</p>
                      </div>
                      <div className="text-right flex-1">
                        <p className="font-bold text-emerald-700">Ksh {Math.round(s.grossAmount - s.grossAmount * (Number(editingPercent[s.id] ?? s.orgCutPercent) / 100)).toLocaleString()}</p>
                        <p className="text-[9px] text-neutral-500">{lang === "en" ? "→ Cast/Crew Pool" : "→ Malipo ya Wasanii"}</p>
                      </div>
                    </div>
                    {editingPercent[s.id] !== undefined && Number(editingPercent[s.id]) !== s.orgCutPercent && (
                      <div>
                        <label className="block text-[9px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                          {lang === "en"
                            ? `Reason for deviating from the ${s.orgCutPercent}% policy rate (required)`
                            : `Sababu ya kutofautiana na kiwango cha sera ${s.orgCutPercent}% (inahitajika)`}
                        </label>
                        <input
                          type="text"
                          value={overrideReason[s.id] ?? ""}
                          onChange={e => setOverrideReason(prev => ({ ...prev, [s.id]: e.target.value }))}
                          placeholder={lang === "en" ? "e.g. negotiated special rate for this engagement" : "mfano: kiwango maalum kilichokubaliwa"}
                          className="w-full bg-white border border-amber-300 rounded-lg px-2 py-1.5 text-xs"
                        />
                      </div>
                    )}
                    {canConfirm && (
                      <button
                        onClick={() => handleConfirm(s)}
                        disabled={confirmingId === s.id || (editingPercent[s.id] !== undefined && Number(editingPercent[s.id]) !== s.orgCutPercent && !(overrideReason[s.id] || "").trim())}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 size={14} /> {confirmingId === s.id ? (lang === "en" ? "Confirming..." : "Inathibitisha...") : (lang === "en" ? "Confirm & Post to Ledger" : "Thibitisha")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {confirmed.length > 0 && (
            <div>
              <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wide mb-3">{lang === "en" ? "Confirmed" : "Zilizothibitishwa"} ({confirmed.length})</h3>
              <div className="overflow-x-auto bg-white border border-neutral-200 rounded-xl">
                <table className="w-full text-left text-xs text-neutral-600">
                  <thead>
                    <tr className="border-b border-neutral-200 text-[10px] text-neutral-500 font-mono tracking-wider uppercase">
                      <th className="py-2 px-3">{lang === "en" ? "Engagement" : "Tukio"}</th>
                      <th className="py-2 px-3 text-right">{lang === "en" ? "Gross" : "Jumla"}</th>
                      <th className="py-2 px-3 text-right">{lang === "en" ? "Org Cut" : "Sehemu ya Shirika"}</th>
                      <th className="py-2 px-3 text-right">{lang === "en" ? "Cast Pool" : "Wasanii"}</th>
                      <th className="py-2 px-3">{lang === "en" ? "Confirmed By" : "Ilithibitishwa Na"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmed.map(s => (
                      <tr key={s.id} className="border-b border-neutral-100">
                        <td className="py-2 px-3 font-bold text-neutral-900">{s.engagementDescription}</td>
                        <td className="py-2 px-3 text-right font-mono">{s.grossAmount.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-purple-700">{s.orgCutAmount.toLocaleString()} ({s.orgCutPercent}%)</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700">{s.castPoolAmount.toLocaleString()}</td>
                        <td className="py-2 px-3 font-mono text-neutral-500">{s.confirmedBy}<br /><span className="text-[9px]">{s.confirmedDate}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
