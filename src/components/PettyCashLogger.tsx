import React from "react";
import { Wallet, Camera, Plus, CheckCircle2 } from "lucide-react";
import { ExpenditureRequest, OrgSettings } from "../types";
import { StorageService } from "../lib/storage";

interface PettyCashLoggerProps {
  lang: "en" | "sw";
}

const CATEGORIES = [
  { value: "transport", en: "Transport", sw: "Usafiri" },
  { value: "refreshments", en: "Refreshments", sw: "Chakula/Vinywaji" },
  { value: "materials", en: "Materials & Supplies", sw: "Vifaa" },
  { value: "airtime", en: "Airtime/Data", sw: "Muda wa Simu" },
  { value: "other", en: "Other", sw: "Nyingine" }
];

export default function PettyCashLogger({ lang }: PettyCashLoggerProps) {
  const [settings, setSettings] = React.useState<OrgSettings | null>(null);
  const [entries, setEntries] = React.useState<ExpenditureRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("transport");
  const [receiptUrl, setReceiptUrl] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/expenditures");
      if (res.ok) {
        const all: ExpenditureRequest[] = await res.json();
        setEntries(all.filter(e => e.isPettyCash).sort((a, b) => b.requestDate.localeCompare(a.requestDate)));
      }
    } catch (err) {
      console.error("Failed to load petty cash entries:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    setSettings(StorageService.getOrgSettings());
    fetchEntries();
  }, []);

  const threshold = settings?.pettyCashThreshold ?? 1000;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setReceiptUrl(data.url);
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (err: any) {
      setErrorMsg(lang === "en" ? "Couldn't upload the receipt photo. Try again." : "Imeshindwa kupakia picha. Jaribu tena.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!amount || Number(amount) <= 0 || !description.trim() || !receiptUrl) {
      setErrorMsg(lang === "en" ? "Amount, description, and a receipt photo are all required." : "Kiasi, maelezo, na picha ya risiti vinahitajika.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/petty_cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), description: description.trim(), category, receiptUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log entry");
      setAmount(""); setDescription(""); setCategory("transport"); setReceiptUrl("");
      setSuccessMsg(lang === "en" ? "Logged — recorded in the Financial Ledger immediately." : "Imerekodiwa — sasa ipo kwenye Daftari la Fedha.");
      setTimeout(() => setSuccessMsg(null), 5000);
      fetchEntries();
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
          <Wallet className="text-[#E31E24]" size={20} />
          {lang === "en" ? "Petty Cash Log" : "Kumbukumbu za Fedha Ndogo"}
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          {lang === "en"
            ? `For small day-to-day spends of Ksh ${threshold.toLocaleString()} or less — log it the moment you spend it, receipt photo required. Anything larger needs a full Expenditure Request.`
            : `Kwa matumizi madogo ya kila siku ya Ksh ${threshold.toLocaleString()} au chini — rekodi mara tu unapotumia, picha ya risiti inahitajika.`}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-3">
        {errorMsg && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{errorMsg}</div>}
        {successMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2 flex items-center gap-1.5"><CheckCircle2 size={14} /> {successMsg}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Amount (Ksh)" : "Kiasi (Ksh)"} *</label>
            <input type="number" min="1" max={threshold} value={amount} onChange={e => setAmount(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs font-mono" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Category" : "Aina"}</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs">
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{lang === "en" ? c.en : c.sw}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "What was it for?" : "Ilikuwa ya nini?"} *</label>
            <input value={description} onChange={e => setDescription(e.target.value)} required placeholder={lang === "en" ? "e.g. Matatu fare to Kiambiu outreach" : ""} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Receipt Photo" : "Picha ya Risiti"} *</label>
            {receiptUrl ? (
              <div className="flex items-center gap-3">
                <img src={receiptUrl} alt="Receipt" className="w-16 h-16 object-cover rounded-lg border border-neutral-200" />
                <button type="button" onClick={() => setReceiptUrl("")} className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer">{lang === "en" ? "Remove" : "Ondoa"}</button>
              </div>
            ) : (
              <label className="flex items-center gap-2 border border-dashed border-neutral-300 rounded-lg px-3 py-2.5 cursor-pointer hover:border-neutral-400 text-xs text-neutral-500">
                <Camera size={14} />
                {uploading ? (lang === "en" ? "Uploading..." : "Inapakia...") : (lang === "en" ? "Take/upload receipt photo" : "Piga/pakia picha ya risiti")}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
              </label>
            )}
          </div>
        </div>
        <button disabled={submitting || uploading} className="w-full bg-[#E31E24] hover:bg-[#c21419] disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg cursor-pointer flex items-center justify-center gap-1.5">
          <Plus size={14} /> {submitting ? (lang === "en" ? "Logging..." : "Inarekodi...") : (lang === "en" ? "Log Expense" : "Rekodi Matumizi")}
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-neutral-400 py-6 text-center">{lang === "en" ? "Loading..." : "Inapakia..."}</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-neutral-400 py-6 text-center">{lang === "en" ? "No petty cash entries yet." : "Hakuna kumbukumbu bado."}</p>
      ) : (
        <div className="space-y-2">
          <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wide">{lang === "en" ? "Recent Entries" : "Kumbukumbu za Hivi Karibuni"}</h3>
          {entries.slice(0, 20).map(e => (
            <div key={e.id} className="bg-white border border-neutral-200 rounded-lg p-3 flex items-center gap-3">
              {e.receiptUrl && <img src={e.receiptUrl} alt="" className="w-10 h-10 object-cover rounded-lg border shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-neutral-800 truncate">{e.description}</p>
                <p className="text-[9px] font-mono text-neutral-400">{e.requestDate} · {e.category} · {lang === "en" ? "by" : "na"} {e.requestedBy}</p>
              </div>
              <span className="text-xs font-bold font-mono text-neutral-900 shrink-0">Ksh {e.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
