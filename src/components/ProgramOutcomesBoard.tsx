import React from "react";
import { BarChart3, Plus, Users, MapPin, Calendar } from "lucide-react";
import { ProgramSession, ProgramArea, UserProfile } from "../types";

interface ProgramOutcomesBoardProps {
  lang: "en" | "sw";
  currentUser: UserProfile;
  canEditAll: boolean; // leadership — can edit/delete anyone's logged session
}

const PROGRAM_AREA_LABELS: Record<ProgramArea, { en: string; sw: string }> = {
  gbv: { en: "GBV Awareness", sw: "Uhamasishaji GBV" },
  srhr: { en: "SRHR Awareness", sw: "Uhamasishaji SRHR" },
  mental_health: { en: "Mental Health", sw: "Afya ya Akili" },
  film_academy: { en: "Film Academy", sw: "Chuo cha Filamu" },
  taas: { en: "Theatre as a Service", sw: "Huduma za Tamthilia" },
  general: { en: "General / Admin", sw: "Jumla / Utawala" }
};

const PROGRAM_AREA_COLORS: Record<ProgramArea, string> = {
  gbv: "bg-red-50 text-red-700 border-red-200",
  srhr: "bg-purple-50 text-purple-700 border-purple-200",
  mental_health: "bg-blue-50 text-blue-700 border-blue-200",
  film_academy: "bg-amber-50 text-amber-700 border-amber-200",
  taas: "bg-emerald-50 text-emerald-700 border-emerald-200",
  general: "bg-neutral-100 text-neutral-600 border-neutral-200"
};

const REPORTABLE_AREAS: ProgramArea[] = ["gbv", "srhr", "mental_health", "film_academy", "taas"];

export default function ProgramOutcomesBoard({ lang, currentUser, canEditAll }: ProgramOutcomesBoardProps) {
  const [sessions, setSessions] = React.useState<ProgramSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [filterArea, setFilterArea] = React.useState<"all" | ProgramArea>("all");

  const [programArea, setProgramArea] = React.useState<ProgramArea>("gbv");
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [location, setLocation] = React.useState("");
  const [facilitators, setFacilitators] = React.useState("");
  const [participantsReached, setParticipantsReached] = React.useState("");
  const [maleCount, setMaleCount] = React.useState("");
  const [femaleCount, setFemaleCount] = React.useState("");
  const [childrenCount, setChildrenCount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [outcomeNotes, setOutcomeNotes] = React.useState("");

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/program_sessions");
      if (res.ok) setSessions(await res.json());
    } catch (err) {
      console.error("Failed to load program sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchSessions(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!title.trim()) {
      setErrorMsg(lang === "en" ? "Session title is required." : "Kichwa cha kikao kinahitajika.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/program_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programArea, title, date, location, facilitators: facilitators || currentUser.name,
          participantsReached, maleCount, femaleCount, childrenCount, description, outcomeNotes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log session");
      setTitle(""); setLocation(""); setFacilitators(""); setParticipantsReached("");
      setMaleCount(""); setFemaleCount(""); setChildrenCount(""); setDescription(""); setOutcomeNotes("");
      setShowForm(false);
      fetchSessions();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const visibleSessions = filterArea === "all" ? sessions : sessions.filter(s => s.programArea === filterArea);
  const sortedSessions = [...visibleSessions].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Aggregate reach — the real donor-report numbers
  const totals = REPORTABLE_AREAS.reduce((acc, area) => {
    const areaSessions = sessions.filter(s => s.programArea === area);
    acc[area] = {
      sessions: areaSessions.length,
      reached: areaSessions.reduce((sum, s) => sum + (s.participantsReached || 0), 0),
      male: areaSessions.reduce((sum, s) => sum + (s.maleCount || 0), 0),
      female: areaSessions.reduce((sum, s) => sum + (s.femaleCount || 0), 0),
      children: areaSessions.reduce((sum, s) => sum + (s.childrenCount || 0), 0)
    };
    return acc;
  }, {} as Record<string, { sessions: number; reached: number; male: number; female: number; children: number }>);

  const grandTotalReached = REPORTABLE_AREAS.reduce((sum, area) => sum + totals[area].reached, 0);

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
            <BarChart3 className="text-[#E31E24]" size={20} />
            {lang === "en" ? "Program Outcomes" : "Matokeo ya Mipango"}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            {lang === "en" ? "Log sessions and see real reach numbers across all five programs — the data your donor reports need." : "Rekodi vikao na uone idadi halisi ya watu waliofikiwa katika mipango yote mitano."}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#E31E24] hover:bg-[#c21419] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
        >
          <Plus size={14} /> {lang === "en" ? "Log Session" : "Rekodi Kikao"}
        </button>
      </div>

      {/* Aggregate reach cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {REPORTABLE_AREAS.map(area => (
          <button
            key={area}
            onClick={() => setFilterArea(filterArea === area ? "all" : area)}
            className={`text-left rounded-xl p-3 border transition-all cursor-pointer ${PROGRAM_AREA_COLORS[area]} ${filterArea === area ? "ring-2 ring-offset-1 ring-neutral-900" : ""}`}
          >
            <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">{PROGRAM_AREA_LABELS[area][lang]}</p>
            <p className="text-xl font-black font-mono mt-1">{totals[area].reached.toLocaleString()}</p>
            <p className="text-[9px] font-mono opacity-70">{totals[area].sessions} {lang === "en" ? "sessions" : "vikao"}</p>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-neutral-400 font-mono">
        {lang === "en" ? "Total lifetime reach across all programs:" : "Jumla ya watu waliofikiwa:"} <strong className="text-neutral-700">{grandTotalReached.toLocaleString()}</strong>
      </p>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-3">
          {errorMsg && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{errorMsg}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Program Area" : "Eneo la Mpango"} *</label>
              <select value={programArea} onChange={e => setProgramArea(e.target.value as ProgramArea)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs">
                {REPORTABLE_AREAS.map(k => <option key={k} value={k}>{PROGRAM_AREA_LABELS[k][lang]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Date" : "Tarehe"}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Session Title" : "Kichwa cha Kikao"} *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required placeholder={lang === "en" ? "e.g. GBV Awareness Theatre — Kiambiu Primary" : ""} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Location" : "Mahali"}</label>
              <input value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Facilitators" : "Waelekezaji"}</label>
              <input value={facilitators} onChange={e => setFacilitators(e.target.value)} placeholder={currentUser.name} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Total Reached" : "Jumla"}</label>
              <input type="number" min="0" value={participantsReached} onChange={e => setParticipantsReached(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Male" : "Wanaume"}</label>
              <input type="number" min="0" value={maleCount} onChange={e => setMaleCount(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Female" : "Wanawake"}</label>
              <input type="number" min="0" value={femaleCount} onChange={e => setFemaleCount(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Under 18" : "Chini ya 18"}</label>
              <input type="number" min="0" value={childrenCount} onChange={e => setChildrenCount(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Description" : "Maelezo"}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Outcome Notes" : "Maelezo ya Matokeo"}</label>
            <textarea value={outcomeNotes} onChange={e => setOutcomeNotes(e.target.value)} rows={2} placeholder={lang === "en" ? "What changed for participants? Referrals made? Follow-up needed?" : ""} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
          </div>
          <button disabled={submitting} className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
            {submitting ? (lang === "en" ? "Saving..." : "Inahifadhi...") : (lang === "en" ? "Log Session" : "Hifadhi Kikao")}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-neutral-400 py-6 text-center">{lang === "en" ? "Loading sessions..." : "Inapakia..."}</p>
      ) : sortedSessions.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-400 text-xs">
          {lang === "en" ? "No sessions logged yet." : "Hakuna vikao vilivyorekodiwa bado."}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSessions.map(session => (
            <div key={session.id} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${PROGRAM_AREA_COLORS[session.programArea]}`}>
                      {PROGRAM_AREA_LABELS[session.programArea]?.[lang] || session.programArea}
                    </span>
                    <h4 className="text-sm font-bold text-neutral-900">{session.title}</h4>
                  </div>
                  {session.description && <p className="text-xs text-neutral-600 mb-2">{session.description}</p>}
                  {session.outcomeNotes && (
                    <p className="text-xs text-neutral-500 italic mb-2 border-l-2 border-neutral-200 pl-2">{session.outcomeNotes}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-400 flex-wrap">
                    <span className="flex items-center gap-1"><Calendar size={11} /> {session.date}</span>
                    {session.location && <span className="flex items-center gap-1"><MapPin size={11} /> {session.location}</span>}
                    <span>{lang === "en" ? "by" : "na"} {session.facilitators}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black font-mono text-neutral-800 flex items-center gap-1 justify-end">
                    <Users size={14} className="text-neutral-400" /> {session.participantsReached}
                  </p>
                  {(session.maleCount || session.femaleCount || session.childrenCount) ? (
                    <p className="text-[9px] font-mono text-neutral-400">
                      {session.maleCount}M / {session.femaleCount}F / {session.childrenCount}{lang === "en" ? "u18" : "chini18"}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
