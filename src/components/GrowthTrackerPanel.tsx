import React from "react";
import { TrendingUp, GraduationCap, Award, Tag } from "lucide-react";
import { UserProfile, Class, VolunteerCertificate } from "../types";

interface GrowthTrackerPanelProps {
  lang: "en" | "sw";
  currentUser: UserProfile;
  classes: Class[];
}

export default function GrowthTrackerPanel({ lang, currentUser, classes }: GrowthTrackerPanelProps) {
  const [certificates, setCertificates] = React.useState<VolunteerCertificate[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/volunteer_certificates")
      .then(res => res.ok ? res.json() : [])
      .then((all: VolunteerCertificate[]) => { if (!cancelled) setCertificates(all.filter(c => c.userId === currentUser.id)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentUser.id]);

  const myClasses = classes.filter(c => c.enrolledUserIds?.includes(currentUser.id));
  const skills = currentUser.skills || [];

  if (myClasses.length === 0 && certificates.length === 0 && skills.length === 0) return null;

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
      <h3 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
        <TrendingUp className="text-[#E31E24]" size={18} />
        {lang === "en" ? "My Growth" : "Maendeleo Yangu"}
      </h3>

      {skills.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Tag size={11} /> {lang === "en" ? "Skills" : "Ujuzi"}</p>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s, i) => (
              <span key={i} className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        </div>
      )}

      {myClasses.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><GraduationCap size={11} /> {lang === "en" ? "Trainings & Classes" : "Mafunzo na Madarasa"} ({myClasses.length})</p>
          <div className="space-y-1.5">
            {myClasses.map(c => (
              <div key={c.id} className="bg-neutral-50 rounded-lg px-2.5 py-1.5">
                <p className="text-xs font-bold text-neutral-800">{c.name}</p>
                <p className="text-[9px] font-mono text-neutral-400">{c.trainer} · {c.startDate}{c.endDate ? ` → ${c.endDate}` : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {certificates.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Award size={11} /> {lang === "en" ? "Certificates Earned" : "Vyeti Vilivyopatikana"} ({certificates.length})</p>
          <div className="space-y-1.5">
            {certificates.map(c => (
              <div key={c.id} className="bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                <p className="text-xs font-bold text-amber-800 capitalize">{c.tier} — {c.hoursAtIssue} {lang === "en" ? "hrs" : "saa"}</p>
                <p className="text-[9px] font-mono text-amber-600">{c.issuedDate}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
