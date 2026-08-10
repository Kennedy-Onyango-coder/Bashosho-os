import React from "react";
import { ClipboardList, Plus, UserPlus, Trash2, CheckCircle2, XCircle, Printer, Clock } from "lucide-react";
import { AttendanceSheet, UserProfile } from "../types";
import Modal from "./Modal";
import PrintWrapper from "./PrintWrapper";

interface AttendanceRegisterBoardProps {
  lang: "en" | "sw";
  currentUser: UserProfile;
  canSubmit: boolean; // Secretary (or Chairperson) — can transcribe a new register
  canDecide: boolean; // Programs Director / Chairperson — can act on the approval chain
}

const EVENT_TYPE_LABELS: Record<string, { en: string; sw: string }> = {
  training: { en: "Training", sw: "Mafunzo" },
  street_performance: { en: "Street Performance", sw: "Onyesho la Mtaani" },
  field_performance: { en: "Field Performance", sw: "Onyesho la Uwandani" },
  office_attendance: { en: "Office Attendance", sw: "Mahudhurio ya Ofisi" },
  rehearsal: { en: "Rehearsal", sw: "Mazoezi" },
  performance: { en: "Performance", sw: "Onyesho" },
  meeting: { en: "Meeting", sw: "Mkutano" },
  class: { en: "Class", sw: "Darasa" },
  external: { en: "External Event", sw: "Tukio la Nje" }
};

const STATUS_STYLES: Record<string, string> = {
  pending_programs_approval: "bg-amber-50 text-amber-700 border-amber-200",
  pending_chairperson_approval: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200"
};

const STATUS_LABELS: Record<string, { en: string; sw: string }> = {
  pending_programs_approval: { en: "Awaiting Programs Director", sw: "Inasubiri Programs Director" },
  pending_chairperson_approval: { en: "Awaiting Chairperson", sw: "Inasubiri Mwenyekiti" },
  approved: { en: "Approved", sw: "Imeidhinishwa" },
  rejected: { en: "Rejected", sw: "Imekataliwa" }
};

export default function AttendanceRegisterBoard({ lang, currentUser, canSubmit, canDecide }: AttendanceRegisterBoardProps) {
  const [registers, setRegisters] = React.useState<AttendanceSheet[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [printingSheet, setPrintingSheet] = React.useState<AttendanceSheet | null>(null);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  const [title, setTitle] = React.useState("");
  const [eventType, setEventType] = React.useState("training");
  const [venue, setVenue] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [rows, setRows] = React.useState<{ userName: string; phone: string; role: string; status: "present" | "absent" | "excused" }[]>([
    { userName: "", phone: "", role: "", status: "present" }
  ]);

  const fetchRegisters = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/attendance_registers");
      if (res.ok) setRegisters(await res.json());
    } catch (err) {
      console.error("Failed to load attendance registers:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchRegisters(); }, []);

  const addRow = () => setRows([...rows, { userName: "", phone: "", role: "", status: "present" }]);
  const removeRow = (idx: number) => setRows(rows.filter((_, i) => i !== idx));
  const updateRow = (idx: number, field: string, value: string) => {
    setRows(rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const validRows = rows.filter(r => r.userName.trim());
    if (!title.trim() || !venue.trim() || validRows.length === 0) {
      setErrorMsg(lang === "en" ? "Event title, venue, and at least one attendee are required." : "Kichwa, mahali, na mhudhuriaji mmoja angalau vinahitajika.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance_registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, venue, date, type: eventType,
          records: validRows.map(r => ({ userId: "", userName: r.userName, phone: r.phone, role: r.role, status: r.status }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit register");
      setTitle(""); setVenue(""); setEventType("training"); setDate(new Date().toISOString().split("T")[0]);
      setRows([{ userName: "", phone: "", role: "", status: "present" }]);
      setShowForm(false);
      fetchRegisters();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (sheet: AttendanceSheet) => {
    try {
      const res = await fetch(`/api/attendance_registers/${sheet.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      fetchRegisters();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      const res = await fetch(`/api/attendance_registers/${rejectingId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject");
      setRejectingId(null);
      setRejectReason("");
      fetchRegisters();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const sortedRegisters = [...registers].sort((a, b) => (b.submittedDate || "").localeCompare(a.submittedDate || ""));

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
            <ClipboardList className="text-[#E31E24]" size={20} />
            {lang === "en" ? "Attendance Registers" : "Rejista za Mahudhurio"}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            {lang === "en"
              ? "Transcribe a paper sign-in sheet from a training, performance, or office day — Programs Director then Chairperson approve before it's official."
              : "Andika rejista ya karatasi kutoka mafunzo au onyesho — Programs Director kisha Mwenyekiti wanaithibitisha kabla haijawa rasmi."}
          </p>
        </div>
        {canSubmit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#E31E24] hover:bg-[#c21419] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={14} /> {lang === "en" ? "Transcribe Register" : "Andika Rejista"}
          </button>
        )}
      </div>

      {showForm && canSubmit && (
        <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
          {errorMsg && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{errorMsg}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Event Title" : "Kichwa cha Tukio"} *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required placeholder={lang === "en" ? "e.g. GBV Awareness Training — Kiambiu" : ""} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Event Type" : "Aina ya Tukio"}</label>
              <select value={eventType} onChange={e => setEventType(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs">
                {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Location / Venue" : "Mahali"} *</label>
              <input value={venue} onChange={e => setVenue(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Date" : "Tarehe"}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{lang === "en" ? "Attendees (from the paper sheet)" : "Waliohudhuria"}</label>
              <button type="button" onClick={addRow} className="text-[10px] font-bold text-[#E31E24] hover:underline cursor-pointer flex items-center gap-1">
                <UserPlus size={12} /> {lang === "en" ? "Add Row" : "Ongeza"}
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input placeholder={lang === "en" ? "Full name" : "Jina kamili"} value={row.userName} onChange={e => updateRow(idx, "userName", e.target.value)} className="col-span-4 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs" />
                  <input placeholder={lang === "en" ? "Role (optional)" : "Wadhifa"} value={row.role} onChange={e => updateRow(idx, "role", e.target.value)} className="col-span-3 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs" />
                  <input placeholder={lang === "en" ? "Phone (optional)" : "Simu"} value={row.phone} onChange={e => updateRow(idx, "phone", e.target.value)} className="col-span-3 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs" />
                  <select value={row.status} onChange={e => updateRow(idx, "status", e.target.value)} className="col-span-1 bg-neutral-50 border border-neutral-200 rounded-lg px-1 py-1.5 text-[10px]">
                    <option value="present">{lang === "en" ? "In" : "Yupo"}</option>
                    <option value="excused">{lang === "en" ? "Exc." : "Ruhusa"}</option>
                    <option value="absent">{lang === "en" ? "Out" : "Hayupo"}</option>
                  </select>
                  <button type="button" onClick={() => removeRow(idx)} className="col-span-1 text-neutral-400 hover:text-red-600 cursor-pointer flex justify-center">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button disabled={submitting} className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
            {submitting ? (lang === "en" ? "Submitting..." : "Inatuma...") : (lang === "en" ? "Submit for Approval" : "Wasilisha Kuidhinishwa")}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-neutral-400 py-6 text-center">{lang === "en" ? "Loading registers..." : "Inapakia..."}</p>
      ) : sortedRegisters.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-400 text-xs">
          {lang === "en" ? "No attendance registers transcribed yet." : "Hakuna rejista zilizoandikwa bado."}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedRegisters.map(sheet => (
            <div key={sheet.id} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-sm font-bold text-neutral-900">{sheet.title}</h4>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[sheet.approvalStatus || ""] || "bg-neutral-100 text-neutral-500 border-neutral-200"}`}>
                      {STATUS_LABELS[sheet.approvalStatus || ""]?.[lang] || sheet.approvalStatus}
                    </span>
                    <span className="text-[9px] font-mono text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                      {EVENT_TYPE_LABELS[sheet.type]?.[lang] || sheet.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-400 flex-wrap">
                    <span>{sheet.venue}</span>
                    <span className="flex items-center gap-1"><Clock size={11} /> {sheet.date}</span>
                    <span>{sheet.records.length} {lang === "en" ? "attendees" : "waliohudhuria"}</span>
                    <span>{lang === "en" ? "by" : "na"} {sheet.submittedBy}</span>
                  </div>
                  {sheet.rejectionReason && (
                    <p className="text-[10px] text-red-600 italic mt-1">{lang === "en" ? "Rejected" : "Imekataliwa"}: {sheet.rejectionReason}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {canDecide && (sheet.approvalStatus === "pending_programs_approval" || sheet.approvalStatus === "pending_chairperson_approval") && (
                    <>
                      <button onClick={() => handleApprove(sheet)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer flex items-center gap-1">
                        <CheckCircle2 size={12} /> {lang === "en" ? "Approve" : "Idhinisha"}
                      </button>
                      <button onClick={() => setRejectingId(sheet.id)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 cursor-pointer flex items-center gap-1">
                        <XCircle size={12} /> {lang === "en" ? "Reject" : "Kataa"}
                      </button>
                    </>
                  )}
                  {sheet.approvalStatus === "approved" && (
                    <button onClick={() => setPrintingSheet(sheet)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-black cursor-pointer flex items-center gap-1">
                      <Printer size={12} /> {lang === "en" ? "Print" : "Chapa"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject reason modal */}
      <Modal isOpen={!!rejectingId} onClose={() => setRejectingId(null)} maxWidth="max-w-sm">
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900">{lang === "en" ? "Reason for rejection" : "Sababu ya kukataa"}</h3>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
          <button onClick={handleReject} className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
            {lang === "en" ? "Confirm Rejection" : "Thibitisha Kukataa"}
          </button>
        </div>
      </Modal>

      {/* Printable roster */}
      <Modal isOpen={!!printingSheet} onClose={() => setPrintingSheet(null)} maxWidth="max-w-3xl">
        {printingSheet && (
          <PrintWrapper
            title={printingSheet.title}
            docType="ATTENDANCE REGISTER"
            authorName={printingSheet.submittedBy || ""}
            authorRole="Secretary"
            dateString={printingSheet.date}
            verificationUrl={printingSheet.verificationUrl}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs border-b border-neutral-200 pb-3">
                <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Venue" : "Mahali"}</span><span className="font-bold text-neutral-900">{printingSheet.venue}</span></div>
                <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Type" : "Aina"}</span><span className="font-bold text-neutral-900">{EVENT_TYPE_LABELS[printingSheet.type]?.[lang] || printingSheet.type}</span></div>
                <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Programs Approved By" : "Programs Director"}</span><span className="font-bold text-neutral-900">{printingSheet.programsApprovedBy} ({printingSheet.programsApprovedDate})</span></div>
                <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Chairperson Approved By" : "Mwenyekiti"}</span><span className="font-bold text-neutral-900">{printingSheet.chairpersonApprovedBy} ({printingSheet.chairpersonApprovedDate})</span></div>
              </div>
              <table className="w-full text-xs font-sans text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-neutral-300 text-neutral-500 uppercase text-[10px]">
                    <th className="py-2">#</th>
                    <th>{lang === "en" ? "Name" : "Jina"}</th>
                    <th>{lang === "en" ? "Role" : "Wadhifa"}</th>
                    <th>{lang === "en" ? "Phone" : "Simu"}</th>
                    <th>{lang === "en" ? "Status" : "Hali"}</th>
                  </tr>
                </thead>
                <tbody>
                  {printingSheet.records.map((r, idx) => (
                    <tr key={idx} className="border-b border-neutral-150">
                      <td className="py-1.5">{idx + 1}</td>
                      <td className="font-bold">{r.userName}</td>
                      <td>{r.role || "—"}</td>
                      <td>{r.phone || "—"}</td>
                      <td className="capitalize">{r.status}</td>
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
