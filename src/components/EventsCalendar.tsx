import React from "react";
import { CalendarDays, Plus, ChevronLeft, ChevronRight, MapPin, Clock, Check, X, HelpCircle } from "lucide-react";
import { CBOEvent, UserProfile } from "../types";

interface EventsCalendarProps {
  lang: "en" | "sw";
  currentUser: UserProfile;
  canCreate: boolean;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  rehearsal: "bg-amber-500",
  performance: "bg-red-500",
  training: "bg-purple-500",
  meeting: "bg-blue-500",
  street_performance: "bg-emerald-500",
  field_performance: "bg-emerald-600",
  other: "bg-neutral-400"
};

const EVENT_TYPE_LABELS: Record<string, { en: string; sw: string }> = {
  rehearsal: { en: "Rehearsal", sw: "Mazoezi" },
  performance: { en: "Performance", sw: "Onyesho" },
  training: { en: "Training", sw: "Mafunzo" },
  meeting: { en: "Meeting", sw: "Mkutano" },
  street_performance: { en: "Street Performance", sw: "Onyesho la Mtaani" },
  field_performance: { en: "Field Performance", sw: "Onyesho la Uwandani" },
  other: { en: "Other", sw: "Nyingine" }
};

function formatMonthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export default function EventsCalendar({ lang, currentUser, canCreate }: EventsCalendarProps) {
  const [events, setEvents] = React.useState<CBOEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewDate, setViewDate] = React.useState(new Date());
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState("rehearsal");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [description, setDescription] = React.useState("");

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/events");
      if (res.ok) setEvents(await res.json());
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchEvents(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!title.trim() || !date || !location.trim()) {
      setErrorMsg(lang === "en" ? "Title, date, and location are required." : "Kichwa, tarehe, na mahali vinahitajika.");
      return;
    }
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type, date, startTime, location, description })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create event");
      setTitle(""); setLocation(""); setDescription(""); setStartTime("");
      setShowForm(false);
      fetchEvents();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRsvp = async (eventId: string, response: "yes" | "no" | "maybe") => {
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response })
      });
      if (!res.ok) throw new Error("Failed to RSVP");
      fetchEvents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Build the month grid
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDay = new Map<number, CBOEvent[]>();
  events.forEach(ev => {
    const d = new Date(ev.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay.has(day)) eventsByDay.set(day, []);
      eventsByDay.get(day)!.push(ev);
    }
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const selectedDayEvents = selectedDay ? events.filter(e => e.date === selectedDay).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")) : [];
  const upcomingEvents = [...events].filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
            <CalendarDays className="text-[#E31E24]" size={20} />
            {lang === "en" ? "Events & Calendar" : "Matukio na Kalenda"}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {lang === "en" ? "See what's scheduled and RSVP ahead of time." : "Ona yaliyopangwa na uthibitishe mapema."}
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setShowForm(!showForm)} className="bg-[#E31E24] hover:bg-[#c21419] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5">
            <Plus size={14} /> {lang === "en" ? "Schedule Event" : "Panga Tukio"}
          </button>
        )}
      </div>

      {showForm && canCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-3">
          {errorMsg && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{errorMsg}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Event Title" : "Kichwa"} *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Type" : "Aina"}</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs">
                {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Date" : "Tarehe"} *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Start Time" : "Muda"}</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Location" : "Mahali"} *</label>
              <input value={location} onChange={e => setLocation(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Description" : "Maelezo"}</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
          </div>
          <button className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
            {lang === "en" ? "Schedule Event" : "Panga Tukio"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer"><ChevronLeft size={16} /></button>
            <h3 className="text-sm font-black text-neutral-900">{viewDate.toLocaleDateString(lang === "en" ? "en-US" : "sw-KE", { month: "long", year: "numeric" })}</h3>
            <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-neutral-500 uppercase mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              const dayStr = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
              const dayEvents = day ? (eventsByDay.get(day) || []) : [];
              const isToday = dayStr === todayStr;
              return (
                <button
                  key={idx}
                  disabled={!day}
                  onClick={() => dayStr && setSelectedDay(dayStr === selectedDay ? null : dayStr)}
                  className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-start pt-1 gap-0.5 transition-colors ${
                    !day ? "invisible" : dayStr === selectedDay ? "bg-neutral-900 text-white cursor-pointer" : isToday ? "bg-red-50 border border-red-200 cursor-pointer" : "hover:bg-neutral-50 cursor-pointer"
                  }`}
                >
                  <span className={`font-bold ${isToday && dayStr !== selectedDay ? "text-red-600" : ""}`}>{day}</span>
                  <div className="flex gap-0.5 flex-wrap justify-center px-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <span key={ev.id} className={`w-1.5 h-1.5 rounded-full ${EVENT_TYPE_COLORS[ev.type] || "bg-neutral-400"}`} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Side panel: selected day or upcoming */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
            {selectedDay ? selectedDay : (lang === "en" ? "Upcoming" : "Yajayo")}
          </h4>
          {(selectedDay ? selectedDayEvents : upcomingEvents).length === 0 ? (
            <p className="text-xs text-neutral-500 italic">{lang === "en" ? "No events." : "Hakuna matukio."}</p>
          ) : (
            (selectedDay ? selectedDayEvents : upcomingEvents).map(ev => {
              const myRsvp = ev.rsvps?.find(r => r.userId === currentUser.id);
              return (
                <div key={ev.id} className="bg-white border border-neutral-200 rounded-xl p-3 shadow-2xs space-y-2">
                  <div className="flex items-start gap-2">
                    <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${EVENT_TYPE_COLORS[ev.type] || "bg-neutral-400"}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-900">{ev.title}</p>
                      <p className="text-[10px] text-neutral-500 flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="flex items-center gap-0.5"><Clock size={9} /> {ev.date}{ev.startTime ? ` · ${ev.startTime}` : ""}</span>
                        <span className="flex items-center gap-0.5"><MapPin size={9} /> {ev.location}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleRsvp(ev.id, "yes")} className={`flex-1 text-[9px] font-bold py-1 rounded flex items-center justify-center gap-1 cursor-pointer ${myRsvp?.response === "yes" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                      <Check size={10} /> {lang === "en" ? "Going" : "Nitakuja"}
                    </button>
                    <button onClick={() => handleRsvp(ev.id, "maybe")} className={`flex-1 text-[9px] font-bold py-1 rounded flex items-center justify-center gap-1 cursor-pointer ${myRsvp?.response === "maybe" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}>
                      <HelpCircle size={10} /> {lang === "en" ? "Maybe" : "Labda"}
                    </button>
                    <button onClick={() => handleRsvp(ev.id, "no")} className={`flex-1 text-[9px] font-bold py-1 rounded flex items-center justify-center gap-1 cursor-pointer ${myRsvp?.response === "no" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"}`}>
                      <X size={10} /> {lang === "en" ? "Can't" : "Sitaweza"}
                    </button>
                  </div>
                  <p className="text-[9px] text-neutral-500">{(ev.rsvps || []).filter(r => r.response === "yes").length} {lang === "en" ? "going" : "wanakuja"} · {(ev.rsvps || []).filter(r => r.response === "maybe").length} {lang === "en" ? "maybe" : "labda"}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
