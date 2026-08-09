import React from "react";
import { Award, Printer, Star } from "lucide-react";
import { VolunteerCertificate, UserProfile } from "../types";
import Modal from "./Modal";
import PrintWrapper from "./PrintWrapper";

interface VolunteerRecognitionPanelProps {
  lang: "en" | "sw";
  currentUser: UserProfile;
  volunteerHours: number; // real hours from attendance, computed by the caller (same source as elsewhere in Dashboard)
}

const TIERS: { tier: "bronze" | "silver" | "gold" | "platinum"; minHours: number; color: string; label: { en: string; sw: string } }[] = [
  { tier: "platinum", minHours: 200, color: "from-slate-300 to-slate-500", label: { en: "Platinum", sw: "Platinamu" } },
  { tier: "gold", minHours: 100, color: "from-amber-300 to-amber-600", label: { en: "Gold", sw: "Dhahabu" } },
  { tier: "silver", minHours: 50, color: "from-neutral-300 to-neutral-400", label: { en: "Silver", sw: "Fedha" } },
  { tier: "bronze", minHours: 10, color: "from-orange-300 to-orange-600", label: { en: "Bronze", sw: "Shaba" } }
];

export default function VolunteerRecognitionPanel({ lang, currentUser, volunteerHours }: VolunteerRecognitionPanelProps) {
  const [certificates, setCertificates] = React.useState<VolunteerCertificate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [printingCert, setPrintingCert] = React.useState<VolunteerCertificate | null>(null);

  const fetchCerts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/volunteer_certificates");
      if (res.ok) {
        const all: VolunteerCertificate[] = await res.json();
        setCertificates(all.filter(c => c.userId === currentUser.id));
      }
    } catch (err) {
      console.error("Failed to load certificates:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchCerts(); }, [currentUser.id]);

  const earnedTier = TIERS.find(t => volunteerHours >= t.minHours);
  const nextTier = [...TIERS].reverse().find(t => volunteerHours < t.minHours);
  const alreadyIssuedTiers = new Set(certificates.map(c => c.tier));

  const handleGenerate = async (tier: string) => {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/volunteer_certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate certificate");
      await fetchCerts();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
          <Award className="text-[#E31E24]" size={18} />
          {lang === "en" ? "Volunteer Recognition" : "Utambuzi wa Kujitolea"}
        </h3>
        <span className="text-xs font-mono font-bold text-neutral-500">{volunteerHours} {lang === "en" ? "hrs logged" : "saa"}</span>
      </div>

      {errorMsg && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{errorMsg}</div>}

      {/* Current tier badge */}
      <div className="flex items-center gap-4">
        {earnedTier ? (
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${earnedTier.color} flex items-center justify-center shadow-md shrink-0`}>
            <Star className="text-white" size={28} fill="white" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-neutral-100 border-2 border-dashed border-neutral-300 flex items-center justify-center shrink-0">
            <Star className="text-neutral-300" size={24} />
          </div>
        )}
        <div>
          <p className="text-sm font-black text-neutral-900">
            {earnedTier ? earnedTier.label[lang] : (lang === "en" ? "No tier yet" : "Bado hakuna daraja")}
          </p>
          <p className="text-[11px] text-neutral-400">
            {nextTier
              ? (lang === "en"
                  ? `${nextTier.minHours - volunteerHours} more hrs to reach ${nextTier.label.en}`
                  : `Saa ${nextTier.minHours - volunteerHours} zaidi kufikia ${nextTier.label.sw}`)
              : (lang === "en" ? "Top tier reached!" : "Umefikia daraja la juu kabisa!")}
          </p>
        </div>
      </div>

      {/* Generate certificate button(s) */}
      {earnedTier && !alreadyIssuedTiers.has(earnedTier.tier) && (
        <button
          onClick={() => handleGenerate(earnedTier.tier)}
          disabled={generating}
          className="w-full bg-[#E31E24] hover:bg-[#c21419] text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Award size={14} /> {generating ? (lang === "en" ? "Generating..." : "Inatengeneza...") : (lang === "en" ? `Generate ${earnedTier.label.en} Certificate` : `Tengeneza Cheti cha ${earnedTier.label.sw}`)}
        </button>
      )}

      {/* Issued certificates list */}
      {loading ? (
        <p className="text-xs text-neutral-400 text-center py-3">{lang === "en" ? "Loading..." : "Inapakia..."}</p>
      ) : certificates.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-neutral-100">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{lang === "en" ? "Your Certificates" : "Vyeti Vyako"}</p>
          {certificates.map(cert => (
            <div key={cert.id} className="flex items-center justify-between bg-neutral-50 border border-neutral-150 rounded-lg px-3 py-2">
              <div>
                <p className="text-xs font-bold text-neutral-800 capitalize">{cert.tier} — {cert.hoursAtIssue} hrs</p>
                <p className="text-[10px] font-mono text-neutral-400">{cert.issuedDate}</p>
              </div>
              <button
                onClick={() => setPrintingCert(cert)}
                className="text-[10px] font-bold text-neutral-600 hover:text-[#E31E24] flex items-center gap-1 cursor-pointer"
              >
                <Printer size={12} /> {lang === "en" ? "Print" : "Chapa"}
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!printingCert} onClose={() => setPrintingCert(null)} maxWidth="max-w-3xl">
        {printingCert && (
          <PrintWrapper
            title={lang === "en" ? "Certificate of Volunteer Service" : "Cheti cha Huduma ya Kujitolea"}
            docType="CERTIFICATE"
            authorName="Bashosho Talents CBO"
            authorRole="Chairperson"
            dateString={printingCert.issuedDate}
            verificationUrl={printingCert.verificationUrl}
          >
            <div className="text-center space-y-4 py-6">
              <p className="text-sm uppercase tracking-widest text-neutral-500 font-mono">{lang === "en" ? "This certifies that" : "Hii inathibitisha kwamba"}</p>
              <h2 className="text-2xl font-black text-neutral-900 font-serif">{printingCert.userName}</h2>
              <p className="text-sm text-neutral-700 max-w-md mx-auto leading-relaxed">
                {lang === "en"
                  ? `has served Bashosho Talents CBO with distinction, contributing ${printingCert.hoursAtIssue} hours of volunteer service, earning the ${printingCert.tier.toUpperCase()} recognition tier.`
                  : `amehudumia Bashosho Talents CBO kwa kujitolea, akichangia saa ${printingCert.hoursAtIssue} za huduma, na kupata daraja la ${printingCert.tier.toUpperCase()}.`}
              </p>
            </div>
          </PrintWrapper>
        )}
      </Modal>
    </div>
  );
}
