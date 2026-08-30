import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Users, MapPin, Activity, Download, Baby } from "lucide-react";
import { ProgramSession, ProgramArea } from "../types";

interface MEDashboardBoardProps {
  lang: "en" | "sw";
}

const PROGRAM_AREA_LABELS: Record<ProgramArea, { en: string; sw: string }> = {
  gbv: { en: "GBV Awareness", sw: "Uhamasishaji GBV" },
  srhr: { en: "SRHR Awareness", sw: "Uhamasishaji SRHR" },
  mental_health: { en: "Mental Health", sw: "Afya ya Akili" },
  film_academy: { en: "Film Academy", sw: "Chuo cha Filamu" },
  taas: { en: "Theatre as a Service", sw: "Huduma za Tamthilia" },
  general: { en: "General / Admin", sw: "Jumla / Utawala" }
};

const AREA_COLORS: Record<ProgramArea, string> = {
  gbv: "#E31E24",
  srhr: "#7c3aed",
  mental_health: "#2563eb",
  film_academy: "#d97706",
  taas: "#00A651",
  general: "#71717a"
};

type Period = "all" | "this_year" | "this_month";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toCsvValue(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function MEDashboardBoard({ lang }: MEDashboardBoardProps) {
  const [sessions, setSessions] = React.useState<ProgramSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [period, setPeriod] = React.useState<Period>("all");

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/program_sessions");
        if (res.ok) setSessions(await res.json());
      } catch (err) {
        console.error("Failed to load program sessions for M&E dashboard:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const now = new Date();
  const filtered = sessions.filter(s => {
    const d = new Date(s.date);
    if (isNaN(d.getTime())) return period === "all";
    if (period === "this_year") return d.getFullYear() === now.getFullYear();
    if (period === "this_month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    return true;
  });

  // --- Headline totals — every number here is a straight sum of what staff/volunteers
  // actually logged in Program Outcomes. Nothing here is estimated or extrapolated. ---
  const totalSessions = filtered.length;
  const totalParticipants = filtered.reduce((s, r) => s + (Number(r.participantsReached) || 0), 0);
  const totalMale = filtered.reduce((s, r) => s + (Number(r.maleCount) || 0), 0);
  const totalFemale = filtered.reduce((s, r) => s + (Number(r.femaleCount) || 0), 0);
  const totalChildren = filtered.reduce((s, r) => s + (Number(r.childrenCount) || 0), 0);
  const uniqueLocations = new Set(filtered.map(r => r.location.trim().toLowerCase()).filter(Boolean));
  const uniqueFacilitators = new Set(
    filtered.flatMap(r => r.facilitators.split(",").map(f => f.trim().toLowerCase()).filter(Boolean))
  );

  // --- By program area ---
  const areaKeys = Object.keys(PROGRAM_AREA_LABELS) as ProgramArea[];
  const byArea = areaKeys
    .map(area => {
      const rows = filtered.filter(r => r.programArea === area);
      return {
        area,
        label: PROGRAM_AREA_LABELS[area][lang],
        sessions: rows.length,
        participants: rows.reduce((s, r) => s + (Number(r.participantsReached) || 0), 0),
        color: AREA_COLORS[area]
      };
    })
    .filter(a => a.sessions > 0)
    .sort((a, b) => b.participants - a.participants);

  // --- Monthly trend (last 6 calendar months up to now, regardless of period filter,
  // so the trend chart always shows a stable recent window) ---
  const monthLabelsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabelsSw = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ago", "Sep", "Okt", "Nov", "Des"];
  const labels = lang === "en" ? monthLabelsEn : monthLabelsSw;
  const trendMonths: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    trendMonths.push({ key: monthKey(d), label: labels[d.getMonth()] });
  }
  const trendData = trendMonths.map(({ key, label }) => {
    const rows = sessions.filter(r => {
      const d = new Date(r.date);
      return !isNaN(d.getTime()) && monthKey(d) === key;
    });
    return {
      name: label,
      sessions: rows.length,
      participants: rows.reduce((s, r) => s + (Number(r.participantsReached) || 0), 0)
    };
  });

  // --- Geographic distribution ---
  const byLocation = Array.from(uniqueLocations)
    .map(loc => {
      const rows = filtered.filter(r => r.location.trim().toLowerCase() === loc);
      return {
        location: rows[0]?.location || loc,
        sessions: rows.length,
        participants: rows.reduce((s, r) => s + (Number(r.participantsReached) || 0), 0)
      };
    })
    .sort((a, b) => b.participants - a.participants)
    .slice(0, 8);

  const genderData = [
    { name: lang === "en" ? "Male" : "Wanaume", value: totalMale, color: "#2563eb" },
    { name: lang === "en" ? "Female" : "Wanawake", value: totalFemale, color: "#E31E24" }
  ].filter(g => g.value > 0);

  const exportCsv = () => {
    const header = ["Date", "Program Area", "Title", "Location", "Facilitators", "Participants Reached", "Male", "Female", "Children", "Logged By"];
    const rows = filtered.map(r => [
      r.date,
      PROGRAM_AREA_LABELS[r.programArea]?.en || r.programArea,
      r.title,
      r.location,
      r.facilitators,
      r.participantsReached,
      r.maleCount,
      r.femaleCount,
      r.childrenCount,
      r.loggedBy
    ]);
    const csv = [header, ...rows].map(row => row.map(toCsvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bashosho-me-dashboard-${period}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const PERIOD_LABELS: Record<Period, { en: string; sw: string }> = {
    all: { en: "All Time", sw: "Wakati Wote" },
    this_year: { en: "This Year", sw: "Mwaka Huu" },
    this_month: { en: "This Month", sw: "Mwezi Huu" }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
            <Activity className="text-[#E31E24]" size={20} />
            {lang === "en" ? "M&E Dashboard" : "Dashibodi ya M&E"}
          </h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            {lang === "en"
              ? "Built entirely from what's logged in Program Outcomes — nothing here is estimated. Log sessions there to improve this picture."
              : "Imejengwa kutoka kwa yale yaliyorekodiwa katika Matokeo ya Mipango — hakuna makadirio hapa."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-neutral-100 rounded-lg p-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-colors ${
                  period === p ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                {PERIOD_LABELS[p][lang]}
              </button>
            ))}
          </div>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 bg-neutral-900 hover:bg-black disabled:opacity-40 text-white text-[10px] font-bold px-3 py-2 rounded-lg cursor-pointer"
          >
            <Download size={12} /> {lang === "en" ? "Export CSV" : "Pakua CSV"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-neutral-400 py-10 text-center">{lang === "en" ? "Loading..." : "Inapakia..."}</p>
      ) : totalSessions === 0 ? (
        <div className="bg-white border border-dashed border-neutral-300 rounded-xl p-8 text-center text-neutral-400 text-xs">
          {lang === "en"
            ? "No program sessions logged for this period yet — data will appear here once Program Outcomes has entries."
            : "Hakuna vikao vya mipango vilivyorekodiwa kwa kipindi hiki bado."}
        </div>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wide"><Users size={12} /> {lang === "en" ? "Participants Reached" : "Waliofikiwa"}</div>
              <p className="text-2xl font-black text-neutral-900 font-mono mt-1">{totalParticipants.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wide"><Activity size={12} /> {lang === "en" ? "Sessions Logged" : "Vikao"}</div>
              <p className="text-2xl font-black text-neutral-900 font-mono mt-1">{totalSessions.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wide"><Baby size={12} /> {lang === "en" ? "Children Reached" : "Watoto"}</div>
              <p className="text-2xl font-black text-neutral-900 font-mono mt-1">{totalChildren.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wide"><MapPin size={12} /> {lang === "en" ? "Locations Covered" : "Maeneo"}</div>
              <p className="text-2xl font-black text-neutral-900 font-mono mt-1">{uniqueLocations.size}</p>
              <p className="text-[9px] text-neutral-400 mt-0.5">{uniqueFacilitators.size} {lang === "en" ? "facilitators active" : "wawezeshaji"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Program area comparison */}
            <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl p-4">
              <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wide mb-3">
                {lang === "en" ? "Participants by Program Area" : "Waliofikiwa kwa Eneo la Mpango"}
              </h3>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byArea} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                    <XAxis dataKey="label" stroke="#a3a3a3" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis stroke="#a3a3a3" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="participants" radius={[4, 4, 0, 0]}>
                      {byArea.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gender split */}
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wide mb-3">
                {lang === "en" ? "Gender Breakdown" : "Mgawanyo wa Jinsia"}
              </h3>
              {genderData.length === 0 ? (
                <p className="text-[10px] text-neutral-400 text-center py-10">{lang === "en" ? "No gender data logged yet." : "Hakuna data ya jinsia bado."}</p>
              ) : (
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                        {genderData.map((g, i) => <Cell key={i} fill={g.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Monthly trend */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wide mb-3">
              {lang === "en" ? "Sessions & Reach — Last 6 Months" : "Vikao na Ufikiaji — Miezi 6 Iliyopita"}
            </h3>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                  <XAxis dataKey="name" stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="participants" fill="#E31E24" radius={[4, 4, 0, 0]} name={lang === "en" ? "Participants" : "Waliofikiwa"} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Geographic distribution */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <MapPin size={14} className="text-[#E31E24]" /> {lang === "en" ? "Geographic Distribution" : "Mgawanyo wa Kijiografia"}
            </h3>
            {byLocation.length === 0 ? (
              <p className="text-[10px] text-neutral-400 text-center py-6">{lang === "en" ? "No locations logged yet." : "Hakuna maeneo yaliyorekodiwa bado."}</p>
            ) : (
              <div className="space-y-2">
                {byLocation.map(loc => (
                  <div key={loc.location} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-neutral-700 w-32 truncate shrink-0">{loc.location}</span>
                    <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#00A651] h-2 rounded-full"
                        style={{ width: `${byLocation[0].participants > 0 ? (loc.participants / byLocation[0].participants) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500 w-24 text-right shrink-0">
                      {loc.participants.toLocaleString()} · {loc.sessions} {lang === "en" ? "sessions" : "vikao"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
