import React from "react";
import Modal from "./Modal";
import { UserProfile, LeadershipAppointment, UserRole } from "../types";
import { Award, FileText, Check, Shield } from "lucide-react";

interface LeadershipAppointmentsPanelProps {
  currentUser: UserProfile;
  lang: "en" | "sw";
  profiles: UserProfile[];
  appointments: LeadershipAppointment[];
  onGenerateLetter: (appt: LeadershipAppointment) => void;
}

export default function LeadershipAppointmentsPanel({
  currentUser,
  lang,
  profiles,
  appointments,
  onGenerateLetter
}: LeadershipAppointmentsPanelProps) {
  // AI Appointment Draft state
  const [selectedAiAppt, setSelectedAiAppt] = React.useState<LeadershipAppointment | null>(null);
  const [draftContent, setDraftContent] = React.useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = React.useState(false);

  // Resolve appointee name helper
  const getAppointeeName = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    return profile ? profile.name : "Unknown Member";
  };

  const handleGenerateAiAppointmentTerms = async (appt: LeadershipAppointment) => {
    const appointeeName = getAppointeeName(appt.profileId);
    setSelectedAiAppt(appt);
    setIsAiLoading(true);
    try {
      const res = await fetch("/api/document_templates/generate_draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Appointee: ${appointeeName}
Role / Title: ${appt.role}
Term Start: ${appt.termStart}
Term End: ${appt.termEnd || "Indefinite"}
Draft formal appointment letter and mandate duties according to Bashosho Talents CBO constitution.`,
          docType: "appointment_letter",
          title: `Appointment Terms - ${appointeeName} (${appt.role})`
        })
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setDraftContent(data.draft);
      } else {
        throw new Error(data.error || "Failed to generate appointment terms.");
      }
    } catch (err: any) {
      alert("AI Appointment Draft failed: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs mt-4 text-left">
      <div className="flex justify-between items-center border-b border-neutral-100 pb-4 mb-4">
        <div>
          <h3 className="text-sm font-black text-neutral-800 uppercase tracking-wider font-sans flex items-center gap-1.5">
            <Award className="text-red-600 w-4 h-4" /> {lang === "en" ? "Leadership Roles & Appointments" : "Teuzi na Majukumu ya Uongozi"}
          </h3>
          <p className="text-xs text-neutral-500 font-medium">
            {lang === "en"
              ? "Official appointments, terms of office, and official letters of assignment."
              : "Teuzi rasmi, vipindi vya uongozi, na barua za uteuzi zilizoandaliwa na mfumo."}
          </p>
        </div>
      </div>

      {appointments.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-neutral-200 rounded-xl bg-neutral-50/50 flex flex-col items-center justify-center">
          <Award className="text-neutral-300 w-10 h-10 mb-2" />
          <p className="text-xs font-semibold text-neutral-500 mt-2 font-mono uppercase tracking-wider">
            {lang === "en" ? "No Leadership Appointments Yet" : "Hakuna Teuzi zilizoundwa bado"}
          </p>
          <p className="text-[11px] text-neutral-400 mt-1 max-w-sm mx-auto">
            {lang === "en"
              ? "Use the 'Invite Member' form in the Overview tab to create a leadership appointment with formal terms."
              : "Tumia fomu ya 'Unda Akaunti' katika ukurasa wa muhtasari ili kuteua kiongozi rasmi."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-400 font-semibold font-mono uppercase text-[9px] tracking-wider">
                <th className="py-3 px-4">{lang === "en" ? "Appointee" : "Mteuliwa"}</th>
                <th className="py-3 px-4">{lang === "en" ? "Position" : "Cheo"}</th>
                <th className="py-3 px-4">{lang === "en" ? "Term Start" : "Kuanza kwa Kipindi"}</th>
                <th className="py-3 px-4">{lang === "en" ? "Term End" : "Kumalizika"}</th>
                <th className="py-3 px-4">{lang === "en" ? "Status" : "Hali"}</th>
                <th className="py-3 px-4 text-right">{lang === "en" ? "Actions" : "Vitendo"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {appointments.map((appt) => {
                const appointeeName = getAppointeeName(appt.profileId);
                return (
                  <tr key={appt.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-neutral-900">{appointeeName}</td>
                    <td className="py-3 px-4">
                      <span className="bg-red-50 text-[#E31E24] text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase">
                        {appt.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-500 font-mono font-medium">{appt.termStart}</td>
                    <td className="py-3 px-4 text-neutral-500 font-mono font-medium">
                      {appt.termEnd || (lang === "en" ? "Indefinite" : "Hadi ukomo")}
                    </td>
                    <td className="py-3 px-4">
                      {appt.acknowledged ? (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                          <Check className="w-3 h-3 text-emerald-600" /> {lang === "en" ? "Active" : "Inafanya kazi"}
                        </span>
                      ) : (
                        <span className="text-neutral-500 bg-neutral-100 border border-neutral-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                          {lang === "en" ? "Draft / Pending Acknowledgment" : "Inasubiri uthibitisho"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right flex justify-end gap-2">
                      <button
                        onClick={() => handleGenerateAiAppointmentTerms(appt)}
                        disabled={isAiLoading && selectedAiAppt?.id === appt.id}
                        className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[11px] px-3 py-1.5 rounded-lg border border-purple-200 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {isAiLoading && selectedAiAppt?.id === appt.id ? " Drafting..." : " AI Draft Terms"}
                      </button>
                      <button
                        onClick={() => onGenerateLetter(appt)}
                        className="bg-neutral-900 hover:bg-neutral-950 text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" /> {lang === "en" ? "Generate & Print Letter" : "Andaa na Print Barua"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* AI Editable Draft Preview Modal */}
      <Modal
        isOpen={draftContent !== null}
        onClose={() => setDraftContent(null)}
        title={lang === "en" ? "Editable Appointment Letter Draft" : "Rasimu ya Barua ya Uteuzi"}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-neutral-500">
            {lang === "en" ? "Review and edit the AI-generated appointment letter below before printing or issuing." : "Kagua na ubadilishe barua iliyoandaliwa kabla ya kuisaini au kuipiga chapa."}
          </p>
          <textarea
            value={draftContent || ""}
            onChange={(e) => setDraftContent(e.target.value)}
            rows={12}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs text-neutral-800 font-serif leading-relaxed focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDraftContent(null)}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
            >
              {lang === "en" ? "Close" : "Funga"}
            </button>
            <button
              onClick={() => {
                if (selectedAiAppt) {
                  onGenerateLetter({
                    ...selectedAiAppt,
                    role: selectedAiAppt.role
                  });
                }
                setDraftContent(null);
              }}
              className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
            >
              {lang === "en" ? "Proceed to Print Letterhead" : "Endelea na Kuchapisha"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
