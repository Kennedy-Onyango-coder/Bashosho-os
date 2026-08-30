import React from "react";
import { Users, Plus, UserPlus, Trash2, CheckCircle2, XCircle, Printer, AlertTriangle } from "lucide-react";
import { CastPaymentList, ExpenditureRequest, UserProfile } from "../types";
import Modal from "./Modal";
import PrintWrapper from "./PrintWrapper";

interface CastPaymentListsBoardProps {
  lang: "en" | "sw";
  currentUser: UserProfile;
  canSubmit: boolean; // Treasurer (or Chairperson)
  canReview: boolean; // Chairperson / Vice Chairperson
}

const STATUS_STYLES: Record<string, string> = {
  pending_review: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200"
};

export default function CastPaymentListsBoard({ lang, currentUser, canSubmit, canReview }: CastPaymentListsBoardProps) {
  const [lists, setLists] = React.useState<CastPaymentList[]>([]);
  const [expenditures, setExpenditures] = React.useState<ExpenditureRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [printingList, setPrintingList] = React.useState<CastPaymentList | null>(null);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  const [title, setTitle] = React.useState("");
  const [eventName, setEventName] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [expenditureRequestId, setExpenditureRequestId] = React.useState("");
  // Defaults to the org-wide 10% membership fund policy on every performance-fee
  // payout — still adjustable per list for exceptions.
  const [deductionRate, setDeductionRate] = React.useState("10");
  const [policyRate, setPolicyRate] = React.useState(10);
  const [deductionOverrideReason, setDeductionOverrideReason] = React.useState("");
  const [profiles, setProfiles] = React.useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = React.useState<{ name: string; role: string; phone: string; amount: string; userId: string }[]>([
    { name: "", role: "", phone: "", amount: "", userId: "" }
  ]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [lRes, eRes, pRes, sRes] = await Promise.all([fetch("/api/cast_payment_lists"), fetch("/api/expenditures"), fetch("/api/profiles"), fetch("/api/org_settings")]);
      if (lRes.ok) setLists(await lRes.json());
      if (eRes.ok) setExpenditures(await eRes.json());
      if (pRes.ok) setProfiles(await pRes.json());
      if (sRes.ok) {
        const settings = await sRes.json();
        // Seed the default from the org's configured policy (Settings → Financial
        // Policies) rather than a hardcoded literal. Still adjustable per list below
        // for genuine exceptions — see the note on that field.
        const rate = Number(settings?.performanceMembershipDeductionPercent);
        if (Number.isFinite(rate) && rate >= 0) {
          setPolicyRate(rate);
          setDeductionRate(String(rate));
        }
      }
    } catch (err) {
      console.error("Failed to load cast payment lists:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchAll(); }, []);

  const approvedExpenditures = expenditures.filter(e => e.status === "approved");
  const linkedExpenditure = expenditures.find(e => e.id === expenditureRequestId);
  const rowsTotal = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const amountMismatch = linkedExpenditure ? Math.abs(rowsTotal - linkedExpenditure.amount) > 0.01 : false;
  const rateNum = Math.max(0, Math.min(100, Number(deductionRate) || 0));
  // Same governance principle already applied to performance settlements' org-cut %:
  // the 10% membership deduction is an organizational policy, not a free-text field —
  // deviating from it requires a stated reason, and that reason travels with the record.
  const isDeductionOverride = rateNum !== policyRate;
  // Mirrors the server: the membership fund deduction only applies to rows linked to a
  // registered member (userId set) — external/outsourced cast rows contribute 0 here,
  // so this preview matches what will actually be saved.
  const memberRowsTotal = rows.reduce((sum, r) => sum + (r.userId ? (Number(r.amount) || 0) : 0), 0);
  const totalDeductionPreview = Math.round(memberRowsTotal * (rateNum / 100) * 100) / 100;

  const addRow = () => setRows([...rows, { name: "", role: "", phone: "", amount: "", userId: "" }]);
  const removeRow = (idx: number) => setRows(rows.filter((_, i) => i !== idx));
  const updateRow = (idx: number, field: string, value: string) => {
    setRows(rows.map((r, i) => {
      if (i !== idx) return r;
      if (field === "userId" && value) {
        const matched = profiles.find(p => p.id === value);
        return { ...r, userId: value, name: matched ? matched.name : r.name };
      }
      return { ...r, [field]: value };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const validRows = rows.filter(r => r.name.trim() && Number(r.amount) > 0);
    if (!title.trim() || !eventName.trim() || !expenditureRequestId || validRows.length === 0) {
      setErrorMsg(lang === "en" ? "Title, event, linked expenditure, and at least one payment row are required." : "Kichwa, tukio, matumizi yaliyounganishwa, na malipo angalau yanahitajika.");
      return;
    }
    if (isDeductionOverride && !deductionOverrideReason.trim()) {
      setErrorMsg(lang === "en"
        ? `This deducts ${rateNum}% instead of the standard ${policyRate}% membership fund policy. Enter a reason for this exception before saving.`
        : `Hii inakata ${rateNum}% badala ya sera ya kawaida ya ${policyRate}%. Andika sababu ya tofauti hii kabla ya kuhifadhi.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/cast_payment_lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, eventName, date, expenditureRequestId, deductionRate: rateNum,
          ...(isDeductionOverride ? { deductionOverrideReason: deductionOverrideReason.trim() } : {}),
          payments: validRows.map(r => ({ name: r.name, role: r.role, phone: r.phone, grossAmount: Number(r.amount), userId: r.userId || undefined }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save payment list");
      setTitle(""); setEventName(""); setExpenditureRequestId(""); setDate(new Date().toISOString().split("T")[0]); setDeductionRate(String(policyRate)); setDeductionOverrideReason("");
      setRows([{ name: "", role: "", phone: "", amount: "", userId: "" }]);
      setShowForm(false);
      fetchAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (list: CastPaymentList) => {
    try {
      const res = await fetch(`/api/cast_payment_lists/${list.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      const res = await fetch(`/api/cast_payment_lists/${rejectingId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject");
      setRejectingId(null);
      setRejectReason("");
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const sortedLists = [...lists].sort((a, b) => (b.submittedDate || "").localeCompare(a.submittedDate || ""));

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
            <Users className="text-[#E31E24]" size={20} />
            {lang === "en" ? "Cast & Crew Payment Lists" : "Orodha za Malipo ya Wasanii"}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            {lang === "en"
              ? "Every payout list must be tied to an approved expenditure and matches its amount exactly. Chairperson or Vice Chairperson reviews before it's final."
              : "Kila orodha ya malipo lazima iunganishwe na matumizi yaliyoidhinishwa na ilingane kikamilifu. Mwenyekiti au Makamu wanaikagua kabla ya kukamilika."}
          </p>
        </div>
        {canSubmit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#E31E24] hover:bg-[#c21419] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={14} /> {lang === "en" ? "New Payment List" : "Orodha Mpya"}
          </button>
        )}
      </div>

      {showForm && canSubmit && (
        <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
          {errorMsg && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{errorMsg}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "List Title" : "Kichwa"} *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required placeholder={lang === "en" ? "e.g. KENDA Cast Stipends" : ""} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Event Name" : "Jina la Tukio"} *</label>
              <input value={eventName} onChange={e => setEventName(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Payment Date" : "Tarehe ya Malipo"}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Linked Approved Expenditure" : "Matumizi Yaliyoidhinishwa"} *</label>
              <select value={expenditureRequestId} onChange={e => setExpenditureRequestId(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs">
                <option value="">{lang === "en" ? "Select expenditure request" : "Chagua ombi la matumizi"}</option>
                {approvedExpenditures.map(e => (
                  <option key={e.id} value={e.id}>{e.description} — Ksh {e.amount.toLocaleString()}</option>
                ))}
              </select>
            </div>
          </div>

          {linkedExpenditure && (
            <div className={`rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-2 ${amountMismatch ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
              {amountMismatch && <AlertTriangle size={14} />}
              {lang === "en" ? "Approved amount" : "Kiasi kilichoidhinishwa"}: Ksh {linkedExpenditure.amount.toLocaleString()} · {lang === "en" ? "Rows total" : "Jumla ya Safu"}: Ksh {rowsTotal.toLocaleString()}
              {amountMismatch && ` — ${lang === "en" ? "must match exactly before saving" : "lazima ilingane kabla ya kuhifadhi"}`}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                {lang === "en" ? "Membership Fund Deduction (%)" : "Makato ya Mfuko wa Uanachama (%)"}
              </label>
              <input
                type="number" min="0" max="100" step="0.5"
                value={deductionRate}
                onChange={e => setDeductionRate(e.target.value)}
                placeholder="0"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs font-mono"
              />
              <p className="text-[9px] text-neutral-400 mt-1">
                {lang === "en" ? "Withheld from each registered member's gross amount toward organizational development. Outsourced/external cast are exempt." : "Inatolewa kutoka kwa kila mwanachama aliyesajiliwa kuelekea maendeleo ya shirika. Wasanii wa nje hawakatwi."}
              </p>
            </div>
            {rateNum > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs font-bold text-purple-700">
                {lang === "en" ? "Total to Membership Fund (members only)" : "Jumla kwa Mfuko (wanachama pekee)"}: Ksh {totalDeductionPreview.toLocaleString()}
              </div>
            )}
          </div>

          {isDeductionOverride && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                {lang === "en"
                  ? `This is ${rateNum}% instead of the standard ${policyRate}% policy rate — the Chairperson/Vice Chairperson reviewing this list will see this exception.`
                  : `Hii ni ${rateNum}% badala ya sera ya kawaida ya ${policyRate}% — Mwenyekiti/Makamu atayaona tofauti hii wakati wa ukaguzi.`}
              </p>
              <input
                type="text"
                value={deductionOverrideReason}
                onChange={e => setDeductionOverrideReason(e.target.value)}
                placeholder={lang === "en" ? "Reason for this exception (required)" : "Sababu ya tofauti hii (inahitajika)"}
                className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{lang === "en" ? "Payees (from the paper list)" : "Waliolipwa"}</label>
              <button type="button" onClick={addRow} className="text-[10px] font-bold text-[#E31E24] hover:underline cursor-pointer flex items-center gap-1">
                <UserPlus size={12} /> {lang === "en" ? "Add Row" : "Ongeza"}
              </button>
            </div>
            <p className="text-[9px] text-neutral-400 mb-2">
              {lang === "en" ? "Link a row to a registered member/volunteer so this payment shows on their own dashboard — or just type a name for external cast." : "Unganisha safu na mwanachama aliyesajiliwa ili malipo yaonekane kwenye dashibodi yao — au andika jina tu kwa wasanii wa nje."}
            </p>
            <div className="space-y-2">
              {rows.map((row, idx) => {
                const gross = Number(row.amount) || 0;
                // Deduction only applies to rows linked to a registered member — mirrors
                // the server-side rule exactly (see /api/cast_payment_lists).
                const rowDeduction = row.userId ? Math.round(gross * (rateNum / 100) * 100) / 100 : 0;
                const rowNet = gross - rowDeduction;
                return (
                <div key={idx} className="space-y-1">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <select value={row.userId} onChange={e => updateRow(idx, "userId", e.target.value)} className="col-span-3 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-[10px]">
                      <option value="">{lang === "en" ? "— External —" : "— Nje —"}</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input placeholder={lang === "en" ? "Full name" : "Jina kamili"} value={row.name} onChange={e => updateRow(idx, "name", e.target.value)} disabled={!!row.userId} className="col-span-3 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs disabled:bg-neutral-100 disabled:text-neutral-400" />
                    <input placeholder={lang === "en" ? "Role" : "Wadhifa"} value={row.role} onChange={e => updateRow(idx, "role", e.target.value)} className="col-span-2 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs" />
                    <input placeholder={lang === "en" ? "Phone" : "Simu"} value={row.phone} onChange={e => updateRow(idx, "phone", e.target.value)} className="col-span-2 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs" />
                    <input type="number" min="0" placeholder="Ksh" value={row.amount} onChange={e => updateRow(idx, "amount", e.target.value)} className="col-span-1 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-mono" />
                    <button type="button" onClick={() => removeRow(idx)} className="col-span-1 text-neutral-400 hover:text-red-600 cursor-pointer flex justify-center">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {gross > 0 && rateNum > 0 && row.userId && (
                    <p className="text-[9px] text-neutral-400 pl-1">
                      {lang === "en" ? "Gross" : "Jumla"} Ksh {gross.toLocaleString()} − {lang === "en" ? "deduction" : "makato"} Ksh {rowDeduction.toLocaleString()} = <strong className="text-neutral-600">{lang === "en" ? "net" : "halisi"} Ksh {rowNet.toLocaleString()}</strong>
                    </p>
                  )}
                  {gross > 0 && rateNum > 0 && !row.userId && (
                    <p className="text-[9px] text-emerald-600 pl-1">
                      {lang === "en"
                        ? `External cast — no membership deduction. Full Ksh ${gross.toLocaleString()} paid.`
                        : `Msanii wa nje — hakuna makato. Ksh ${gross.toLocaleString()} kamili italipwa.`}
                    </p>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          <button disabled={submitting || amountMismatch} className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer disabled:opacity-40">
            {submitting ? (lang === "en" ? "Submitting..." : "Inatuma...") : (lang === "en" ? "Submit for Review" : "Wasilisha Kukaguliwa")}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-neutral-400 py-6 text-center">{lang === "en" ? "Loading payment lists..." : "Inapakia..."}</p>
      ) : sortedLists.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-400 text-xs">
          {lang === "en" ? "No payment lists recorded yet." : "Hakuna orodha za malipo bado."}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedLists.map(list => {
            const total = list.payments.reduce((s, p) => s + p.netAmount, 0);
            return (
              <div key={list.id} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-sm font-bold text-neutral-900">{list.title}</h4>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[list.status]}`}>{list.status.replace("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-400 flex-wrap">
                      <span>{list.eventName}</span>
                      <span>{list.date}</span>
                      <span>{list.payments.length} {lang === "en" ? "payees" : "waliolipwa"}</span>
                      <span className="font-bold text-neutral-700">Ksh {total.toLocaleString()}</span>
                      <span>{lang === "en" ? "by" : "na"} {list.submittedBy}</span>
                    </div>
                    {list.deductionOverrideReason && (
                      <p className="text-[10px] text-amber-700 italic mt-1 flex items-center gap-1">
                        <AlertTriangle size={11} />
                        {lang === "en" ? `Deduction set to ${list.deductionRate}% (policy exception)` : `Makato ${list.deductionRate}% (tofauti na sera)`}: {list.deductionOverrideReason}
                      </p>
                    )}
                    {list.rejectionReason && (
                      <p className="text-[10px] text-red-600 italic mt-1">{lang === "en" ? "Rejected" : "Imekataliwa"}: {list.rejectionReason}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {canReview && list.status === "pending_review" && list.submittedBy !== currentUser.name && (
                      <>
                        <button onClick={() => handleApprove(list)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer flex items-center gap-1">
                          <CheckCircle2 size={12} /> {lang === "en" ? "Approve" : "Idhinisha"}
                        </button>
                        <button onClick={() => setRejectingId(list.id)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 cursor-pointer flex items-center gap-1">
                          <XCircle size={12} /> {lang === "en" ? "Reject" : "Kataa"}
                        </button>
                      </>
                    )}
                    {list.status === "approved" && (
                      <button onClick={() => setPrintingList(list)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-black cursor-pointer flex items-center gap-1">
                        <Printer size={12} /> {lang === "en" ? "Print" : "Chapa"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!rejectingId} onClose={() => setRejectingId(null)} maxWidth="max-w-sm">
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900">{lang === "en" ? "Reason for rejection" : "Sababu ya kukataa"}</h3>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
          <button onClick={handleReject} className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
            {lang === "en" ? "Confirm Rejection" : "Thibitisha Kukataa"}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!printingList} onClose={() => setPrintingList(null)} maxWidth="max-w-3xl">
        {printingList && (
          <PrintWrapper
            title={printingList.title}
            docType="PAYMENT LIST"
            authorName={printingList.reviewedBy || ""}
            authorRole="Chairperson / Vice Chairperson"
            dateString={printingList.date}
            verificationUrl={printingList.verificationUrl}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs border-b border-neutral-200 pb-3">
                <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Event" : "Tukio"}</span><span className="font-bold text-neutral-900">{printingList.eventName}</span></div>
                <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Submitted By" : "Iliwasilishwa Na"}</span><span className="font-bold text-neutral-900">{printingList.submittedBy}</span></div>
                <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Reviewed By" : "Ilikaguliwa Na"}</span><span className="font-bold text-neutral-900">{printingList.reviewedBy} ({printingList.reviewedDate})</span></div>
                <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Total Net Paid" : "Jumla Halisi"}</span><span className="font-bold text-neutral-900">Ksh {printingList.payments.reduce((s, p) => s + p.netAmount, 0).toLocaleString()}</span></div>
              </div>
              <table className="w-full text-xs font-sans text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-neutral-300 text-neutral-500 uppercase text-[10px]">
                    <th className="py-2">#</th>
                    <th>{lang === "en" ? "Name" : "Jina"}</th>
                    <th>{lang === "en" ? "Role" : "Wadhifa"}</th>
                    <th>{lang === "en" ? "Phone" : "Simu"}</th>
                    <th className="text-right">{lang === "en" ? "Gross (Ksh)" : "Jumla (Ksh)"}</th>
                    <th className="text-right">{lang === "en" ? "Deduction (Ksh)" : "Makato (Ksh)"}</th>
                    <th className="text-right">{lang === "en" ? "Net Paid (Ksh)" : "Halisi (Ksh)"}</th>
                  </tr>
                </thead>
                <tbody>
                  {printingList.payments.map((p, idx) => (
                    <tr key={p.id} className="border-b border-neutral-150">
                      <td className="py-1.5">{idx + 1}</td>
                      <td className="font-bold">{p.name}</td>
                      <td>{p.role || "—"}</td>
                      <td>{p.phone || "—"}</td>
                      <td className="text-right font-mono">{p.grossAmount.toLocaleString()}</td>
                      <td className="text-right font-mono text-purple-700">{p.deductionAmount ? p.deductionAmount.toLocaleString() : "—"}</td>
                      <td className="text-right font-mono font-bold">{p.netAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PrintWrapper>
        )}
      </Modal>
    </div>
  );
}
