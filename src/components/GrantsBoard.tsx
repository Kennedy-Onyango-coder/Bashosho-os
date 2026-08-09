import { Lock, Pencil, Trash2, Globe, Landmark, TrendingUp, Trophy, Clock3, ExternalLink, Sparkles } from "lucide-react";
import React from "react";
import Modal from "./Modal";
import { Grant, UserRole, getUserRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import StatCard from "./dashboard/StatCard";

interface GrantsBoardProps {
  currentUser: any;
  lang: "en" | "sw";
}

const SYSTEM_DATE = new Date("2026-07-12");

const COLUMNS = [
  { id: "identified", labelEn: "Identified", labelSw: "Zilizotambuliwa", dot: "bg-blue-500", header: "bg-blue-50/60 border-blue-200/80" },
  { id: "preparing", labelEn: "Preparing", labelSw: "Zinaandaliwa", dot: "bg-amber-500", header: "bg-amber-50/60 border-amber-200/80" },
  { id: "submitted", labelEn: "Submitted", labelSw: "Zilizowasilishwa", dot: "bg-purple-500", header: "bg-purple-50/60 border-purple-200/80" },
  { id: "awarded", labelEn: "Awarded", labelSw: "Zilizofadhiliwa", dot: "bg-emerald-500", header: "bg-emerald-50/60 border-emerald-200/80" },
  { id: "declined", labelEn: "Declined", labelSw: "Zilizokataliwa", dot: "bg-neutral-400", header: "bg-neutral-50 border-neutral-200" },
] as const;

const CARD_ACCENT: Record<string, string> = {
  identified: "border-l-blue-400",
  preparing: "border-l-amber-400",
  submitted: "border-l-purple-400",
  awarded: "border-l-emerald-500",
  declined: "border-l-neutral-300",
};

function fmtKsh(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";
}

export default function GrantsBoard({ currentUser, lang }: GrantsBoardProps) {
  const [grants, setGrants] = React.useState<Grant[]>([]);
  const [showModal, setShowModal] = React.useState(false);
  const [editingGrant, setEditingGrant] = React.useState<Grant | null>(null);

  const [name, setName] = React.useState("");
  const [funder, setFunder] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [link, setLink] = React.useState("");
  const [status, setStatus] = React.useState<Grant["status"]>("identified");
  const [isAiDrafting, setIsAiDrafting] = React.useState(false);

  const handleGenerateGrantPitchAiDraft = async () => {
    setIsAiDrafting(true);
    try {
      const res = await fetch("/api/document_templates/generate_draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Project/Grant Title: ${name || "Kiambiu Youth Empowerment Initiative"}
Target Funder: ${funder || "International Donor Agency"}
Target Budget: Ksh ${amount || "500,000"}
Key Objectives: Forum Theatre for SGBV prevention, Youth Mental Health Hub, Cinema Workshops in Kiambiu.
Notes context: ${notes || "None provided"}`,
          docType: "grants",
          title: `Grant Concept Note - ${name || "Project"}`
        })
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setNotes(data.draft);
      } else {
        throw new Error(data.error || "Failed to draft grant pitch.");
      }
    } catch (err: any) {
      alert("AI Grant Proposal Draft failed: " + err.message);
    } finally {
      setIsAiDrafting(false);
    }
  };

  React.useEffect(() => {
    setGrants(StorageService.getGrants());
  }, []);

  const handleOpenAdd = () => {
    setEditingGrant(null);
    setName("");
    setFunder("");
    setDeadline("");
    setAmount("");
    setNotes("");
    setLink("");
    setStatus("identified");
    setShowModal(true);
  };

  const handleOpenEdit = (grant: Grant) => {
    setEditingGrant(grant);
    setName(grant.name || "");
    setFunder(grant.funder || "");
    setDeadline(grant.deadline || "");
    setAmount((grant?.amount || 0).toString());
    setNotes(grant.notes);
    setLink(grant.link || "");
    setStatus(grant.status);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !funder.trim() || !deadline || !amount) return;

    const parsedAmount = parseFloat(amount) || 0;
    let finalGrant: Grant;

    if (editingGrant) {
      finalGrant = { ...editingGrant, name, funder, deadline, amount: parsedAmount, notes, link, status };
      const updated = grants.map(g => g.id === editingGrant.id ? finalGrant : g);
      setGrants(updated);
    } else {
      finalGrant = {
        id: `g-${Date.now()}`,
        name,
        funder,
        deadline,
        amount: parsedAmount,
        notes,
        link,
        status,
      };
      setGrants([finalGrant, ...grants]);
    }

    StorageService.saveRecord("grants", finalGrant).catch(console.error);
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm(lang === "en" ? "Are you sure you want to delete this grant?" : "Je, una uhakika unataka kufuta ruzuku hii?")) {
      const updated = grants.filter(g => g.id !== id);
      setGrants(updated);
      StorageService.deleteRecord("grants", id).catch(console.error);
    }
  };

  const moveStatus = (grant: Grant, nextStatus: Grant["status"]) => {
    const updatedGrant = { ...grant, status: nextStatus };
    const updated = grants.map(g => g.id === grant.id ? updatedGrant : g);
    setGrants(updated);
    StorageService.saveRecord("grants", updatedGrant).catch(console.error);
  };

  const isUrgent = (grant: Grant) => {
    if (grant.status === "submitted" || grant.status === "awarded" || grant.status === "declined") return false;
    const deadlineDate = new Date(grant.deadline);
    if (isNaN(deadlineDate.getTime())) return false;
    const diffDays = Math.ceil((deadlineDate.getTime() - SYSTEM_DATE.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 14;
  };

  const isAuthorized = [UserRole.CHAIRPERSON, UserRole.TREASURER].includes(getUserRoleKey(currentUser) as UserRole);

  const activePipelineValue = grants
    .filter(g => !["awarded", "declined"].includes(g.status))
    .reduce((sum, g) => sum + (g.amount || 0), 0);
  const awardedValue = grants.filter(g => g.status === "awarded").reduce((sum, g) => sum + (g.amount || 0), 0);
  const activeCount = grants.filter(g => !["awarded", "declined"].includes(g.status)).length;
  const decidedCount = grants.filter(g => g.status === "awarded" || g.status === "declined").length;
  const winRate = decidedCount > 0 ? Math.round((grants.filter(g => g.status === "awarded").length / decidedCount) * 100) : null;
  const urgentCount = grants.filter(isUrgent).length;

  if (!isAuthorized) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center max-w-lg mx-auto">
        <Lock size={32} className="text-amber-500" />
        <h3 className="text-lg font-bold text-neutral-900 mt-4">
          {lang === "en" ? "Access Restricted" : "Ufikiaji Umezuiliwa"}
        </h3>
        <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
          {lang === "en"
            ? "The Grants Board is strictly confidential and reserved for the Chairperson and Treasurer roles."
            : "Bodi ya Ruzuku ni siri na imehifadhiwa kwa nafasi za Mwenyekiti na Mweka Hazina pekee."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left" id="grants-board-module">
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-6 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-red-400 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5">
            {lang === "en" ? "RESOURCE PIPELINE" : "IDARA YA FEDHA ZA RUZUKU"}
          </span>
          <h2 className="text-xl font-black text-white mt-1.5 font-sans">
            {lang === "en" ? "CBO Fundraising & Grants Board" : "Bodi ya Maombi ya Ruzuku"}
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {lang === "en"
              ? "Track active proposals from identification through preparations to submission and awards."
              : "Fuatilia maombi ya ruzuku tangu mwanzo, maandalizi, uwasilishaji, hadi kupata ufadhili."}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          {lang === "en" ? "Add Proposal" : "Weka Ombi la Ruzuku"}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={lang === "en" ? "Active pipeline value" : "Thamani ya maombi hai"}
          value={`Ksh ${fmtKsh(activePipelineValue)}`}
          icon={<TrendingUp size={17} />}
          accent="finance"
        />
        <StatCard
          label={lang === "en" ? "Awarded to date" : "Zilizofadhiliwa"}
          value={`Ksh ${fmtKsh(awardedValue)}`}
          icon={<Trophy size={17} />}
          accent="finance"
        />
        <StatCard
          label={lang === "en" ? "Active proposals" : "Maombi hai"}
          value={String(activeCount)}
          icon={<Landmark size={17} />}
          accent="neutral"
        />
        <StatCard
          label={lang === "en" ? "Win rate" : "Kiwango cha ushindi"}
          value={winRate === null ? "\u2014" : `${winRate}%`}
          icon={<Sparkles size={17} />}
          accent={urgentCount > 0 ? "danger" : "community"}
          delta={urgentCount > 0 ? `${urgentCount} ${lang === "en" ? "urgent deadline(s)" : "muhula wa haraka"}` : undefined}
          deltaDirection={urgentCount > 0 ? "down" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
        {COLUMNS.map(col => {
          const colGrants = grants.filter(g => g.status === col.id);
          const colValue = colGrants.reduce((sum, g) => sum + (g.amount || 0), 0);
          return (
            <div key={col.id} className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3 min-h-[520px] flex flex-col">
              <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 mb-3 ${col.header}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <h3 className="text-xs font-bold text-neutral-800">
                    {lang === "en" ? col.labelEn : col.labelSw}
                  </h3>
                </div>
                <span className="bg-white border border-neutral-200 text-neutral-600 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                  {colGrants.length}
                </span>
              </div>
              {colValue > 0 && (
                <p className="text-[10px] font-mono font-bold text-neutral-400 px-1 mb-2 -mt-1">
                  Ksh {fmtKsh(colValue)} {lang === "en" ? "total" : "jumla"}
                </p>
              )}

              <div className="space-y-3 flex-grow overflow-y-auto">
                {colGrants.map(grant => {
                  const urgent = isUrgent(grant);
                  const daysRemaining = Math.ceil((new Date(grant.deadline).getTime() - SYSTEM_DATE.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <div
                      key={grant.id}
                      className={`bg-white border border-l-4 rounded-xl p-3.5 shadow-sm space-y-3 relative hover:shadow-md transition-shadow border-neutral-200 ${CARD_ACCENT[grant.status]}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                          {initials(grant.funder)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-neutral-950 leading-snug line-clamp-2">{grant.name}</h4>
                          <p className="text-[10px] text-neutral-500 font-medium truncate">{grant.funder}</p>
                        </div>
                      </div>

                      {(urgent || grant.source === "public_website") && (
                        <div className="flex flex-wrap gap-1.5">
                          {urgent && (
                            <div className="bg-red-50 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-200 inline-flex items-center gap-1 uppercase tracking-wider font-mono">
                              <Clock3 size={9} /> {daysRemaining} {lang === "en" ? "days left" : "siku"}
                            </div>
                          )}
                          {grant.source === "public_website" && (
                            <div className="bg-blue-50 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-200 inline-flex items-center gap-1 uppercase tracking-wider font-mono">
                              <Globe size={9} /> {lang === "en" ? "Website" : "Tovuti"}
                            </div>
                          )}
                        </div>
                      )}

                      {grant.source === "public_website" && grant.contactPhone && (
                        <p className="text-[10px] text-blue-600 font-mono font-bold">{grant.contactPhone}</p>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-neutral-500 bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                        <div>
                          <span className="block text-[8px] text-neutral-400 font-bold uppercase tracking-wider">
                            {lang === "en" ? "Amount" : "Kiasi"}
                          </span>
                          <span className="text-neutral-800 font-mono font-bold">Ksh {(grant?.amount || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-neutral-400 font-bold uppercase tracking-wider">
                            {lang === "en" ? "Deadline" : "Mwisho"}
                          </span>
                          <span className="text-neutral-800 font-mono font-bold">{grant.deadline}</span>
                        </div>
                      </div>

                      {grant.notes && (
                        <p className="text-[10px] text-neutral-500 line-clamp-2 italic border-l-2 border-neutral-200 pl-2">
                          {grant.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100">
                        {grant.link ? (
                          <a
                            href={grant.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink size={11} /> {lang === "en" ? "Open link" : "Fungua kiungo"}
                          </a>
                        ) : (
                          <span />
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(grant)}
                            className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-800 cursor-pointer transition-colors"
                            title={lang === "en" ? "Edit" : "Hariri"}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(grant.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 cursor-pointer transition-colors"
                            title={lang === "en" ? "Delete" : "Futa"}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <select
                        value={grant.status}
                        onChange={(e) => moveStatus(grant, e.target.value as Grant["status"])}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-400 cursor-pointer"
                      >
                        <option value="identified">{lang === "en" ? "Stage: Identified" : "Hatua: Tambuliwa"}</option>
                        <option value="preparing">{lang === "en" ? "Stage: Preparing" : "Hatua: Maandalizi"}</option>
                        <option value="submitted">{lang === "en" ? "Stage: Submitted" : "Hatua: Wasilishwa"}</option>
                        <option value="awarded">{lang === "en" ? "Stage: Awarded" : "Hatua: Kupata fedha"}</option>
                        <option value="declined">{lang === "en" ? "Stage: Declined" : "Hatua: Kataliwa"}</option>
                      </select>
                    </div>
                  );
                })}

                {colGrants.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className={`w-8 h-8 rounded-full ${col.dot} opacity-20 mb-2`} />
                    <p className="text-[10px] text-neutral-400 font-medium">
                      {lang === "en" ? "No proposals here" : "Hakuna maombi hapa"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          editingGrant
            ? (lang === "en" ? "Edit Grant Proposal" : "Hariri Ombi la Ruzuku")
            : (lang === "en" ? "Add New Grant Proposal" : "Weka Ombi Jipya la Ruzuku")
        }
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                  {lang === "en" ? "Proposal Name" : "Jina la Ombi"} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SRHR Youth Creative Arts Grant"
                  className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    {lang === "en" ? "Funder Name" : "Jina la Mfadhili"} *
                  </label>
                  <input
                    type="text"
                    required
                    value={funder}
                    onChange={(e) => setFunder(e.target.value)}
                    placeholder="e.g. UN Women Kenya"
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    {lang === "en" ? "Target Amount (Ksh)" : "Kiasi cha Lengo (Ksh)"} *
                  </label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1500000"
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    {lang === "en" ? "Submission Deadline" : "Mwisho wa Kutuma"} *
                  </label>
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    {lang === "en" ? "Pipeline Stage" : "Hatua ya Sasa"}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Grant["status"])}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-semibold"
                  >
                    <option value="identified">Identified</option>
                    <option value="preparing">Preparing</option>
                    <option value="submitted">Submitted</option>
                    <option value="awarded">Awarded</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                  {lang === "en" ? "Funder Portal/Proposal Link" : "Kiungo cha Tovuti ya Mfadhili"}
                </label>
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://example.com/apply"
                  className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    {lang === "en" ? "Technical Notes & Checklists" : "Kumbukumbu na Maelezo ya Kiufundi"}
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateGrantPitchAiDraft}
                    disabled={isAiDrafting}
                    className="text-[10px] font-extrabold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1"
                  >
                    {isAiDrafting ? "Drafting Proposal..." : "AI Draft Proposal Notes"}
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="e.g. Requires certified budget proposal and letter of authorization."
                  className="w-full bg-white border border-neutral-200 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-sans leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  {lang === "en" ? "Cancel" : "Ghairi"}
                </button>
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-sm transition-colors"
                >
                  {editingGrant
                    ? (lang === "en" ? "Save Changes" : "Hifadhi Mabadiliko")
                    : (lang === "en" ? "Add Proposal" : "Weka Ombi")}
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
}
