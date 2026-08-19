import React from "react";
import { BookOpen, Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";

interface BulkHistoricalEntryBoardProps {
  lang: "en" | "sw";
}

interface Row {
  type: "income" | "expenditure";
  date: string;
  description: string;
  amount: string;
  category: string; // source for income, category for expenditure
}

const INCOME_SOURCES = [
  { value: "engagement_fee", en: "Engagement Fee", sw: "Ada ya Huduma" },
  { value: "grant", en: "Grant", sw: "Ruzuku" },
  { value: "donation", en: "Donation", sw: "Mchango" },
  { value: "membership_contribution", en: "Membership Contribution", sw: "Mchango wa Uanachama" },
  { value: "other", en: "Other", sw: "Nyingine" }
];

const EXPENSE_CATEGORIES = [
  { value: "stipend", en: "Stipend", sw: "Posho" },
  { value: "transport", en: "Transport", sw: "Usafiri" },
  { value: "materials", en: "Materials & Supplies", sw: "Vifaa" },
  { value: "venue", en: "Venue/Rent", sw: "Kodi ya Ukumbi" },
  { value: "utilities", en: "Utilities", sw: "Huduma" },
  { value: "other", en: "Other", sw: "Nyingine" }
];

const emptyRow = (type: "income" | "expenditure"): Row => ({
  type, date: "", description: "", amount: "", category: type === "income" ? "other" : "other"
});

export default function BulkHistoricalEntryBoard({ lang }: BulkHistoricalEntryBoardProps) {
  const [rows, setRows] = React.useState<Row[]>([emptyRow("income"), emptyRow("income"), emptyRow("income")]);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [resultMsg, setResultMsg] = React.useState<{ created: number; errors: string[] } | null>(null);

  const addRow = (type: "income" | "expenditure") => setRows([...rows, emptyRow(type)]);
  const removeRow = (idx: number) => setRows(rows.filter((_, i) => i !== idx));
  const updateRow = (idx: number, field: keyof Row, value: string) => {
    setRows(rows.map((r, i) => i === idx ? { ...r, [field]: value, ...(field === "type" ? { category: value === "income" ? "other" : "other" } : {}) } : r));
  };

  const validRows = rows.filter(r => r.date && r.description.trim() && Number(r.amount) > 0);
  const totalIncome = validRows.filter(r => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = validRows.filter(r => r.type === "expenditure").reduce((s, r) => s + Number(r.amount), 0);

  const handleSubmit = async () => {
    setErrorMsg(null);
    setResultMsg(null);
    if (validRows.length === 0) {
      setErrorMsg(lang === "en" ? "Fill in at least one complete row (date, description, amount)." : "Jaza safu moja angalau.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/finance/bulk_historical_entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: validRows.map(r => ({
            type: r.type,
            date: r.date,
            description: r.description.trim(),
            amount: Number(r.amount),
            source: r.type === "income" ? r.category : undefined,
            category: r.type === "expenditure" ? r.category : undefined
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save entries");
      setResultMsg({ created: data.created, errors: data.errors || [] });
      if (data.created > 0) {
        setRows([emptyRow("income"), emptyRow("income"), emptyRow("income")]);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
          <BookOpen className="text-[#E31E24]" size={20} />
          {lang === "en" ? "Bulk Historical Entry" : "Uwekaji wa Rekodi za Zamani"}
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          {lang === "en"
            ? "Digitize your old paper cashbook fast — add as many rows as you need, fill in each line exactly as it appears in the book, then save them all at once. Every entry is tagged as a historical record for a clean audit trail."
            : "Weka rekodi za kitabu chako cha zamani cha fedha haraka — ongeza safu nyingi utakavyo, jaza kila mstari kama ulivyo kwenye kitabu, kisha hifadhi zote mara moja."}
        </p>
      </div>

      {errorMsg && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{errorMsg}</div>}
      {resultMsg && (
        <div className={`rounded-xl p-4 space-y-1 border ${resultMsg.created > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          <p className="text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 size={14} /> {resultMsg.created} {lang === "en" ? "record(s) saved to the Financial Ledger." : "rekodi zimehifadhiwa."}
          </p>
          {resultMsg.errors.length > 0 && (
            <div className="text-[10px] space-y-0.5 pt-1">
              {resultMsg.errors.map((e, i) => <p key={i} className="flex items-center gap-1"><AlertTriangle size={10} /> {e}</p>)}
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider text-left">
                <th className="pb-2 pr-2">{lang === "en" ? "Type" : "Aina"}</th>
                <th className="pb-2 pr-2">{lang === "en" ? "Date" : "Tarehe"}</th>
                <th className="pb-2 pr-2">{lang === "en" ? "Description" : "Maelezo"}</th>
                <th className="pb-2 pr-2">{lang === "en" ? "Category/Source" : "Aina/Chanzo"}</th>
                <th className="pb-2 pr-2">{lang === "en" ? "Amount (Ksh)" : "Kiasi"}</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-neutral-100">
                  <td className="py-1.5 pr-2">
                    <select value={row.type} onChange={e => updateRow(idx, "type", e.target.value)} className={`w-full border rounded-lg px-2 py-1.5 text-[11px] font-bold ${row.type === "income" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                      <option value="income">{lang === "en" ? "Income" : "Mapato"}</option>
                      <option value="expenditure">{lang === "en" ? "Expense" : "Matumizi"}</option>
                    </select>
                  </td>
                  <td className="py-1.5 pr-2"><input type="date" value={row.date} onChange={e => updateRow(idx, "date", e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-[11px]" /></td>
                  <td className="py-1.5 pr-2 min-w-[160px]"><input value={row.description} onChange={e => updateRow(idx, "description", e.target.value)} placeholder={lang === "en" ? "As written in the cashbook" : "Kama ilivyoandikwa"} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-[11px]" /></td>
                  <td className="py-1.5 pr-2">
                    <select value={row.category} onChange={e => updateRow(idx, "category", e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-[11px]">
                      {(row.type === "income" ? INCOME_SOURCES : EXPENSE_CATEGORIES).map(c => <option key={c.value} value={c.value}>{lang === "en" ? c.en : c.sw}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2"><input type="number" min="0" value={row.amount} onChange={e => updateRow(idx, "amount", e.target.value)} className="w-24 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-[11px] font-mono" /></td>
                  <td className="py-1.5"><button onClick={() => removeRow(idx)} className="text-neutral-400 hover:text-red-600 cursor-pointer"><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
          <button onClick={() => addRow("income")} className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"><Plus size={12} /> {lang === "en" ? "Add Income Row" : "Ongeza Mapato"}</button>
          <button onClick={() => addRow("expenditure")} className="text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"><Plus size={12} /> {lang === "en" ? "Add Expense Row" : "Ongeza Matumizi"}</button>
          <div className="flex-1" />
          <div className="text-[10px] font-mono text-neutral-500 self-center">
            {lang === "en" ? "Income" : "Mapato"}: <strong className="text-emerald-700">Ksh {totalIncome.toLocaleString()}</strong> · {lang === "en" ? "Expense" : "Matumizi"}: <strong className="text-red-700">Ksh {totalExpense.toLocaleString()}</strong>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || validRows.length === 0}
          className="w-full bg-[#E31E24] hover:bg-[#c21419] disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg cursor-pointer"
        >
          {submitting ? (lang === "en" ? "Saving..." : "Inahifadhi...") : (lang === "en" ? `Save ${validRows.length} Record(s)` : `Hifadhi Rekodi ${validRows.length}`)}
        </button>
      </div>
    </div>
  );
}
