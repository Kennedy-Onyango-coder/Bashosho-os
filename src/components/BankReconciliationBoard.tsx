import React from "react";
import { Landmark, Plus, CheckCircle2, AlertTriangle, UserPlus, Trash2 } from "lucide-react";
import { BankReconciliation } from "../types";

interface BankReconciliationBoardProps {
  lang: "en" | "sw";
}

export default function BankReconciliationBoard({ lang }: BankReconciliationBoardProps) {
  const [records, setRecords] = React.useState<BankReconciliation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [resultMsg, setResultMsg] = React.useState<{ status: string; difference: number } | null>(null);

  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState(new Date().toISOString().split("T")[0]);
  const [bankBalance, setBankBalance] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<{ date: string; description: string; amount: string }[]>([]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/bank_reconciliations");
      if (res.ok) setRecords(await res.json());
    } catch (err) {
      console.error("Failed to load reconciliations:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchRecords(); }, []);

  const addLine = () => setLines([...lines, { date: "", description: "", amount: "" }]);
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx: number, field: string, value: string) => {
    setLines(lines.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResultMsg(null);
    if (!periodEnd || !bankBalance) {
      setErrorMsg(lang === "en" ? "Statement end date and bank balance are required." : "Tarehe ya mwisho na kiasi cha benki vinahitajika.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bank_reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statementPeriodStart: periodStart,
          statementPeriodEnd: periodEnd,
          bankStatementBalance: Number(bankBalance),
          notes,
          statementLines: lines.filter(l => l.description.trim()).map(l => ({ date: l.date, description: l.description, amount: Number(l.amount) || 0 }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save reconciliation");
      setResultMsg({ status: data.status, difference: data.difference });
      setPeriodStart(""); setBankBalance(""); setNotes(""); setLines([]);
      fetchRecords();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const sorted = [...records].sort((a, b) => (b.statementPeriodEnd || "").localeCompare(a.statementPeriodEnd || ""));

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
            <Landmark className="text-[#E31E24]" size={20} />
            {lang === "en" ? "Bank Reconciliation" : "Ulinganisho wa Benki"}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            {lang === "en"
              ? "Enter the closing balance from a bank statement received by email — the system compares it against your own recorded books for that period automatically."
              : "Weka kiasi cha mwisho kutoka taarifa ya benki iliyopokelewa kwa barua pepe — mfumo utalinganisha na kumbukumbu zake mwenyewe kwa kipindi hicho."}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#E31E24] hover:bg-[#c21419] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
        >
          <Plus size={14} /> {lang === "en" ? "New Reconciliation" : "Ulinganisho Mpya"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
          {errorMsg && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{errorMsg}</div>}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Statement Period Start" : "Mwanzo wa Kipindi"}</label>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Statement Period End" : "Mwisho wa Kipindi"} *</label>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Bank Closing Balance (Ksh)" : "Kiasi cha Benki (Ksh)"} *</label>
              <input type="number" value={bankBalance} onChange={e => setBankBalance(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Notes" : "Maelezo"}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={lang === "en" ? "Any known outstanding cheques, pending deposits, or bank fees?" : ""} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{lang === "en" ? "Statement Lines (optional — for manual matching)" : "Miamala ya Taarifa (si lazima)"}</label>
              <button type="button" onClick={addLine} className="text-[10px] font-bold text-[#E31E24] hover:underline cursor-pointer flex items-center gap-1">
                <UserPlus size={12} /> {lang === "en" ? "Add Line" : "Ongeza"}
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input type="date" value={l.date} onChange={e => updateLine(idx, "date", e.target.value)} className="col-span-3 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs" />
                  <input placeholder={lang === "en" ? "Description from statement" : "Maelezo"} value={l.description} onChange={e => updateLine(idx, "description", e.target.value)} className="col-span-6 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs" />
                  <input type="number" placeholder="Ksh" value={l.amount} onChange={e => updateLine(idx, "amount", e.target.value)} className="col-span-2 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-mono" />
                  <button type="button" onClick={() => removeLine(idx)} className="col-span-1 text-neutral-400 hover:text-red-600 cursor-pointer flex justify-center">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button disabled={submitting} className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
            {submitting ? (lang === "en" ? "Reconciling..." : "Inalinganisha...") : (lang === "en" ? "Run Reconciliation" : "Fanya Ulinganisho")}
          </button>
        </form>
      )}

      {resultMsg && (
        <div className={`rounded-xl p-4 flex items-center gap-3 border ${resultMsg.status === "balanced" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {resultMsg.status === "balanced" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <p className="text-sm font-bold">
            {resultMsg.status === "balanced"
              ? (lang === "en" ? "Balanced — bank statement matches system records exactly." : "Sawa — taarifa ya benki inalingana na kumbukumbu za mfumo.")
              : (lang === "en" ? `Discrepancy of Ksh ${Math.abs(resultMsg.difference).toLocaleString()} ${resultMsg.difference > 0 ? "more in the bank than recorded" : "less in the bank than recorded"}.` : `Tofauti ya Ksh ${Math.abs(resultMsg.difference).toLocaleString()}.`)}
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-neutral-400 py-6 text-center">{lang === "en" ? "Loading reconciliation history..." : "Inapakia..."}</p>
      ) : sorted.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-400 text-xs">
          {lang === "en" ? "No reconciliations recorded yet." : "Hakuna ulinganisho uliorekodiwa bado."}
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(r => (
            <div key={r.id} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-sm font-bold text-neutral-900">
                      {r.statementPeriodStart || "—"} → {r.statementPeriodEnd}
                    </h4>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${r.status === "balanced" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                      {r.status === "balanced" ? (lang === "en" ? "Balanced" : "Sawa") : (lang === "en" ? "Discrepancy" : "Tofauti")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-500 flex-wrap">
                    <span>{lang === "en" ? "Bank" : "Benki"}: Ksh {r.bankStatementBalance.toLocaleString()}</span>
                    <span>{lang === "en" ? "System" : "Mfumo"}: Ksh {r.systemBalance.toLocaleString()}</span>
                    <span className={r.difference !== 0 ? "font-bold text-red-600" : ""}>{lang === "en" ? "Diff" : "Tofauti"}: Ksh {r.difference.toLocaleString()}</span>
                    <span>{lang === "en" ? "by" : "na"} {r.reconciledBy}</span>
                  </div>
                  {r.notes && <p className="text-[10px] text-neutral-500 italic mt-1">{r.notes}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
