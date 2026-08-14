import React from "react";
import { Gavel, Plus, FileText, CheckCircle2, Trash2, UserPlus } from "lucide-react";
import { BoardMeeting, Document, UserProfile } from "../types";

interface BoardMeetingsPanelProps {
  lang: "en" | "sw";
  currentUser: UserProfile;
  documents: Document[];
  onCreateMinutesDoc: (meeting: BoardMeeting) => void;
}

export default function BoardMeetingsPanel({ lang, currentUser, documents, onCreateMinutesDoc }: BoardMeetingsPanelProps) {
  const [meetings, setMeetings] = React.useState<BoardMeeting[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [agendaItems, setAgendaItems] = React.useState<string[]>([""]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/board_meetings");
      if (res.ok) setMeetings(await res.json());
    } catch (err) {
      console.error("Failed to load board meetings:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchMeetings(); }, []);

  const addAgendaItem = () => setAgendaItems([...agendaItems, ""]);
  const updateAgendaItem = (idx: number, value: string) => setAgendaItems(agendaItems.map((a, i) => i === idx ? value : a));
  const removeAgendaItem = (idx: number) => setAgendaItems(agendaItems.filter((_, i) => i !== idx));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!title.trim() || !date) {
      setErrorMsg(lang === "en" ? "Title and date are required." : "Kichwa na tarehe vinahitajika.");
      return;
    }
    try {
      const res = await fetch("/api/board_meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, date, time, location, agenda: agendaItems.filter(a => a.trim()) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule meeting");
      setTitle(""); setTime(""); setLocation(""); setAgendaItems([""]);
      setShowForm(false);
      fetchMeetings();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const markCompleted = async (meeting: BoardMeeting) => {
    try {
      const res = await fetch("/api/board_meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: meeting.id, status: "completed" })
      });
      if (!res.ok) throw new Error("Failed to update meeting");
      fetchMeetings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const linkMinutes = async (meeting: BoardMeeting, docId: string) => {
    try {
      const res = await fetch("/api/board_meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: meeting.id, minutesDocId: docId })
      });
      if (!res.ok) throw new Error("Failed to link minutes");
      fetchMeetings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const minutesDocs = documents.filter(d => d.type === "minutes");
  const sortedMeetings = [...meetings].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
            <Gavel className="text-[#E31E24]" size={20} />
            {lang === "en" ? "Board Meetings" : "Mikutano ya Bodi"}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            {lang === "en" ? "Schedule with an agenda, then link the real minutes once it's happened." : "Panga na ajenda, kisha unganisha kumbukumbu baada ya mkutano."}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-[#E31E24] hover:bg-[#c21419] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5">
          <Plus size={14} /> {lang === "en" ? "Schedule Meeting" : "Panga Mkutano"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-3">
          {errorMsg && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{errorMsg}</div>}
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Meeting Title" : "Kichwa"} *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required placeholder={lang === "en" ? "e.g. Q3 Board Review" : ""} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Date" : "Tarehe"} *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Time" : "Muda"}</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Location" : "Mahali"}</label>
              <input value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{lang === "en" ? "Agenda Items" : "Ajenda"}</label>
              <button type="button" onClick={addAgendaItem} className="text-[10px] font-bold text-[#E31E24] hover:underline cursor-pointer flex items-center gap-1">
                <UserPlus size={12} /> {lang === "en" ? "Add Item" : "Ongeza"}
              </button>
            </div>
            <div className="space-y-1.5">
              {agendaItems.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-xs text-neutral-400 pt-1.5 font-mono">{idx + 1}.</span>
                  <input value={item} onChange={e => updateAgendaItem(idx, e.target.value)} placeholder={lang === "en" ? "Agenda item..." : "Kipengele cha ajenda..."} className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs" />
                  <button type="button" onClick={() => removeAgendaItem(idx)} className="text-neutral-400 hover:text-red-600 cursor-pointer"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
          <button className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
            {lang === "en" ? "Schedule Meeting" : "Panga Mkutano"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-neutral-400 py-6 text-center">{lang === "en" ? "Loading meetings..." : "Inapakia..."}</p>
      ) : sortedMeetings.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-400 text-xs">
          {lang === "en" ? "No board meetings scheduled yet." : "Hakuna mikutano iliyopangwa bado."}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedMeetings.map(m => (
            <div key={m.id} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-neutral-900">{m.title}</h4>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${m.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : m.status === "cancelled" ? "bg-neutral-100 text-neutral-500 border-neutral-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                      {m.status}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-neutral-400 mt-0.5">{m.date}{m.time ? ` · ${m.time}` : ""}{m.location ? ` · ${m.location}` : ""}</p>
                </div>
                {m.status === "scheduled" && (
                  <button onClick={() => markCompleted(m)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer flex items-center gap-1">
                    <CheckCircle2 size={12} /> {lang === "en" ? "Mark Completed" : "Kamilisha"}
                  </button>
                )}
              </div>
              {m.agenda.length > 0 && (
                <ul className="text-xs text-neutral-600 space-y-1 list-decimal list-inside bg-neutral-50 rounded-lg p-3">
                  {m.agenda.map((a, idx) => <li key={idx}>{a}</li>)}
                </ul>
              )}
              {m.status === "completed" && (
                <div className="border-t border-neutral-100 pt-2">
                  {m.minutesDocId ? (
                    <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                      <FileText size={12} /> {lang === "en" ? "Minutes linked" : "Kumbukumbu zimeunganishwa"}: {documents.find(d => d.id === m.minutesDocId)?.title || m.minutesDocId}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => onCreateMinutesDoc(m)} className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer">
                        {lang === "en" ? "Write New Minutes" : "Andika Kumbukumbu Mpya"}
                      </button>
                      {minutesDocs.length > 0 && (
                        <select onChange={e => e.target.value && linkMinutes(m, e.target.value)} className="text-[10px] bg-neutral-50 border border-neutral-200 rounded px-2 py-1">
                          <option value="">{lang === "en" ? "...or link existing minutes" : "...au unganisha zilizopo"}</option>
                          {minutesDocs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
