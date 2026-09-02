import { Lock, AlertTriangle, Link, Pencil, Trash2, X, Sparkles, Globe, CheckCircle2, HelpCircle, XCircle, Plus } from "lucide-react";
import React from "react";
import Modal from "./Modal";
import { Grant, UserRole, getUserRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import { computeEligibilityVerdict } from "../../grantEligibility";

interface GrantsBoardProps {
  currentUser: any;
  lang: "en" | "sw";
}

const COLUMNS = [
  { id: "identified", labelEn: "Identified", labelSw: "Zilizotambuliwa", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "preparing", labelEn: "Preparing", labelSw: "Zinaandaliwa", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "submitted", labelEn: "Submitted", labelSw: "Zilizowasilishwa", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "under_review", labelEn: "Under Review", labelSw: "Inakaguliwa na Mfadhili", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { id: "awarded", labelEn: "Awarded", labelSw: "Zilizofadhiliwa", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "declined", labelEn: "Declined", labelSw: "Zilizokataliwa", color: "bg-neutral-50 text-neutral-600 border-neutral-200" },
  { id: "withdrawn", labelEn: "Withdrawn", labelSw: "Zimeondolewa", color: "bg-neutral-50 text-neutral-500 border-neutral-200" },
];

export default function GrantsBoard({ currentUser, lang }: GrantsBoardProps) {
  const [grants, setGrants] = React.useState<Grant[]>([]);
  const [showModal, setShowModal] = React.useState(false);
  const [editingGrant, setEditingGrant] = React.useState<Grant | null>(null);

  // Form states
  const [name, setName] = React.useState("");
  const [funder, setFunder] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [link, setLink] = React.useState("");
  const [status, setStatus] = React.useState<Grant["status"]>("identified");
  const [isAiDrafting, setIsAiDrafting] = React.useState(false);
  const [generatingProposalId, setGeneratingProposalId] = React.useState<string | null>(null);
  const [proposalMessage, setProposalMessage] = React.useState<{ grantId: string; text: string; isError: boolean } | null>(null);

  const handleGenerateFullProposal = async (grant: Grant) => {
    setGeneratingProposalId(grant.id);
    setProposalMessage(null);
    try {
      const res = await fetch(`/api/grants/${grant.id}/generate_proposal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate proposal");
      setProposalMessage({
        grantId: grant.id,
        isError: false,
        text: lang === "en"
          ? `Draft saved to Documents → Grant Proposals as "${data.document.title}". Review and edit before submitting anywhere.`
          : `Rasimu imehifadhiwa kwenye Nyaraka → Mapendekezo ya Ruzuku. Kagua na uhariri kabla ya kuwasilisha.`
      });
    } catch (err: any) {
      setProposalMessage({ grantId: grant.id, isError: true, text: err.message });
    } finally {
      setGeneratingProposalId(null);
    }
  };

  // Eligibility checklist (master doc Phase 13). Deliberately simple CRUD against the
  // grant record — the verdict is computed purely from what's here (see
  // grantEligibility.ts), never independently claimed. Adding/toggling a requirement
  // reuses the same StorageService.saveRecord path as the rest of this board.
  const [checklistOpenFor, setChecklistOpenFor] = React.useState<string | null>(null);
  const [newRequirementText, setNewRequirementText] = React.useState("");

  const addEligibilityRequirement = (grant: Grant) => {
    if (!newRequirementText.trim()) return;
    const updated: Grant = {
      ...grant,
      eligibilityChecklist: [
        ...(grant.eligibilityChecklist || []),
        { id: `req-${Date.now()}`, requirement: newRequirementText.trim(), status: "needs_verification" }
      ]
    };
    setGrants(grants.map(g => g.id === grant.id ? updated : g));
    StorageService.saveRecord("grants", updated).catch(console.error);
    setNewRequirementText("");
  };

  const setRequirementStatus = (grant: Grant, reqId: string, status: "met" | "not_met" | "needs_verification") => {
    const updated: Grant = {
      ...grant,
      eligibilityChecklist: (grant.eligibilityChecklist || []).map(item =>
        item.id === reqId ? { ...item, status } : item
      )
    };
    setGrants(grants.map(g => g.id === grant.id ? updated : g));
    StorageService.saveRecord("grants", updated).catch(console.error);
  };

  const removeRequirement = (grant: Grant, reqId: string) => {
    const updated: Grant = {
      ...grant,
      eligibilityChecklist: (grant.eligibilityChecklist || []).filter(item => item.id !== reqId)
    };
    setGrants(grants.map(g => g.id === grant.id ? updated : g));
    StorageService.saveRecord("grants", updated).catch(console.error);
  };

  const handleGenerateGrantPitchAiDraft = async () => {
    // SECURITY/INTEGRITY FIX: this previously fell back to fabricated example content
    // — a fictional project name, a fictional funder, a fictional Ksh 500,000 budget,
    // and specific invented objectives — whenever the form's real fields were still
    // empty. That fabricated content was indistinguishable from real input once it
    // came back in the "notes" field, exactly the failure mode Bashosho's AI policy
    // exists to prevent: never invent project specifics, funders, or figures. Now it
    // requires the real name, funder, and amount before drafting anything.
    if (!name.trim() || !funder.trim() || !amount) {
      alert(lang === "en"
        ? "Enter the real grant name, funder, and target amount first — AI drafting only works from real information you've provided, never placeholders."
        : "Weka jina halisi la ruzuku, mfadhili, na kiasi kwanza.");
      return;
    }
    setIsAiDrafting(true);
    try {
      const res = await fetch("/api/document_templates/generate_draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Project/Grant Title: ${name}
Target Funder: ${funder}
Target Budget: Ksh ${amount}
Notes context: ${notes || "None provided — do not invent specific objectives or activities; keep this section general and mark specifics as [REVIEW REQUIRED]."}`,
          docType: "grants",
          title: `Grant Concept Note - ${name}`
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
    setLink(grant.link);
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
    
    // Explicitly call saveRecord to perform a clean write
    StorageService.saveRecord("grants", finalGrant).catch(console.error);
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm(lang === "en" ? "Are you sure you want to delete this grant?" : "Je, una uhakika unataka kufuta ruzuku hii?")) {
      const updated = grants.filter(g => g.id !== id);
      setGrants(updated);
      
      // Explicitly call deleteRecord to perform a clean server and cache deletion
      StorageService.deleteRecord("grants", id).catch(console.error);
    }
  };

  const moveStatus = (grant: Grant, nextStatus: Grant["status"]) => {
    const updatedGrant = { ...grant, status: nextStatus };
    const updated = grants.map(g => g.id === grant.id ? updatedGrant : g);
    setGrants(updated);
    
    // Explicitly call saveRecord for status update
    StorageService.saveRecord("grants", updatedGrant).catch(console.error);
  };

  // Check if a grant is close to deadline (<14 days) and not submitted
  const isUrgent = (grant: Grant) => {
    if (["submitted", "under_review", "awarded", "declined", "withdrawn"].includes(grant.status)) return false;
    const deadlineDate = new Date(grant.deadline);
    if (isNaN(deadlineDate.getTime())) return false;
    const systemDate = new Date(); // system default date
    const diffTime = deadlineDate.getTime() - systemDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 14;
  };

  const isAuthorized = [UserRole.CHAIRPERSON, UserRole.TREASURER].includes(getUserRoleKey(currentUser) as UserRole);

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
      {/* Module Header */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-red-600 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
            {lang === "en" ? "RESOURCE PIPELINE" : "IDARA YA FEDHA ZA RUZUKU"}
          </span>
          <h2 className="text-xl font-black text-neutral-900 mt-1.5 font-sans">
            {lang === "en" ? "CBO Fundraising & Grants Board" : "Bodi ya Maombi ya Ruzuku"}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {lang === "en"
              ? "Track active proposals from identification through preparations to submission and awards."
              : "Fuatilia maombi ya ruzuku tangu mwanzo, maandalizi, uwasilishaji, hadi kupata ufadhili."}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          {lang === "en" ? "Add Proposal" : "Weka Ombi la Ruzuku"}
        </button>
      </div>

      {/* Kanban Board Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
        {COLUMNS.map(col => {
          const colGrants = grants.filter(g => g.status === col.id);
          return (
            <div key={col.id} className="bg-gray-50/50 border border-neutral-150 rounded-2xl p-4 min-h-[500px] flex flex-col space-y-3">
              {/* Column Header */}
              <div className="flex items-center justify-between border-b pb-2 mb-2">
                <h3 className="text-xs font-bold text-neutral-900">
                  {lang === "en" ? col.labelEn : col.labelSw}
                </h3>
                <span className="bg-white border text-neutral-500 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                  {colGrants.length}
                </span>
              </div>

              {/* Column Cards */}
              <div className="space-y-3 flex-grow overflow-y-auto">
                {colGrants.map(grant => {
                  const urgent = isUrgent(grant);
                  const daysRemaining = Math.ceil((new Date(grant.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <div
                      key={grant.id}
                      className={`bg-white border rounded-xl p-4 shadow-2xs space-y-3 relative hover:border-red-500/30 transition-all ${
                        urgent ? "border-l-4 border-l-red-600 border-red-200" : "border-neutral-200"
                      }`}
                    >
                      {urgent && (
                        <div className="bg-red-50 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-200 inline-block uppercase tracking-wider font-mono">
                          {daysRemaining} {lang === "en" ? "days left!" : "siku zimebaki!"}
                        </div>
                      )}

                      {grant.source === "public_website" && (
                        <div className="bg-blue-50 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-200 inline-flex items-center gap-1 uppercase tracking-wider font-mono w-fit">
                          <Globe size={9} /> {lang === "en" ? "From Website" : "Kutoka Tovutini"}
                        </div>
                      )}

                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-neutral-950 line-clamp-2">{grant.name}</h4>
                        <p className="text-[10px] text-neutral-500 font-medium">{grant.funder}</p>
                        {grant.source === "public_website" && grant.contactPhone && (
                          <p className="text-[10px] text-blue-600 font-mono font-bold">📞 {grant.contactPhone}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-neutral-500 bg-neutral-50 p-2 rounded-lg">
                        <div>
                          <span className="block text-[8px] text-neutral-500 font-bold uppercase tracking-wider">Amount</span>
                          <span className="text-neutral-800 font-mono font-bold">Ksh {(grant?.amount || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-neutral-500 font-bold uppercase tracking-wider">Deadline</span>
                          <span className="text-neutral-800 font-mono font-bold">{grant.deadline}</span>
                        </div>
                      </div>

                      {grant.notes && (
                        <p className="text-[10px] text-neutral-500 line-clamp-2 font-serif italic">
                          "{grant.notes}"
                        </p>
                      )}

                      {(() => {
                        const verdict = computeEligibilityVerdict(grant.eligibilityChecklist);
                        const verdictConfig = {
                          eligible: { label: lang === "en" ? "Eligible" : "Inastahili", icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                          not_eligible: { label: lang === "en" ? "Not Eligible" : "Haistahili", icon: XCircle, cls: "bg-red-50 text-red-600 border-red-200" },
                          needs_verification: { label: lang === "en" ? "Needs Verification" : "Inahitaji Uthibitisho", icon: HelpCircle, cls: "bg-amber-50 text-amber-700 border-amber-200" },
                          no_requirements_listed: { label: lang === "en" ? "No requirements listed" : "Hakuna mahitaji", icon: HelpCircle, cls: "bg-neutral-50 text-neutral-400 border-neutral-200" }
                        }[verdict];
                        const VerdictIcon = verdictConfig.icon;
                        const isOpen = checklistOpenFor === grant.id;
                        return (
                          <div className="space-y-2">
                            <button
                              onClick={() => setChecklistOpenFor(isOpen ? null : grant.id)}
                              className={`w-full flex items-center justify-between gap-1.5 border rounded-lg px-2 py-1.5 text-[10px] font-bold cursor-pointer ${verdictConfig.cls}`}
                            >
                              <span className="flex items-center gap-1.5"><VerdictIcon size={12} /> {verdictConfig.label}</span>
                              <span className="font-mono opacity-60">{(grant.eligibilityChecklist || []).length} {lang === "en" ? "reqs" : "mahitaji"}</span>
                            </button>
                            {isOpen && (
                              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-2.5 space-y-2">
                                {(grant.eligibilityChecklist || []).map(item => (
                                  <div key={item.id} className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-neutral-700 flex-1 truncate">{item.requirement}</span>
                                    <select
                                      value={item.status}
                                      onChange={e => setRequirementStatus(grant, item.id, e.target.value as any)}
                                      className={`text-[9px] font-bold rounded px-1 py-0.5 border cursor-pointer ${
                                        item.status === "met" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : item.status === "not_met" ? "bg-red-50 text-red-600 border-red-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                      }`}
                                    >
                                      <option value="needs_verification">{lang === "en" ? "Unverified" : "Haijathibitishwa"}</option>
                                      <option value="met">{lang === "en" ? "Met" : "Imetimizwa"}</option>
                                      <option value="not_met">{lang === "en" ? "Not Met" : "Haijatimizwa"}</option>
                                    </select>
                                    <button onClick={() => removeRequirement(grant, item.id)} className="text-neutral-300 hover:text-red-500 cursor-pointer shrink-0">
                                      <X size={11} />
                                    </button>
                                  </div>
                                ))}
                                <div className="flex gap-1.5 pt-1">
                                  <input
                                    value={newRequirementText}
                                    onChange={e => setNewRequirementText(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") addEligibilityRequirement(grant); }}
                                    placeholder={lang === "en" ? "e.g. Registered CBO in Kenya" : "mfano: CBO iliyosajiliwa Kenya"}
                                    className="flex-1 bg-white border border-neutral-200 rounded px-2 py-1 text-[10px]"
                                  />
                                  <button onClick={() => addEligibilityRequirement(grant)} className="bg-neutral-900 hover:bg-black text-white rounded px-2 cursor-pointer">
                                    <Plus size={12} />
                                  </button>
                                </div>
                                <p className="text-[9px] text-neutral-400 leading-snug pt-1 border-t border-neutral-200">
                                  {lang === "en"
                                    ? "Enter each real requirement from the funder's own call and mark it only once you've actually checked it — this never auto-verifies anything."
                                    : "Weka kila hitaji halisi kutoka kwa mfadhili na uliweke tu baada ya kuthibitisha — hii haithibitishi kiotomatiki."}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {(grant.status === "identified" || grant.status === "preparing") && (
                        <button
                          onClick={() => handleGenerateFullProposal(grant)}
                          disabled={generatingProposalId === grant.id}
                          className="w-full flex items-center justify-center gap-1.5 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-2 py-1.5 rounded-lg cursor-pointer"
                        >
                          <Sparkles size={11} />
                          {generatingProposalId === grant.id
                            ? (lang === "en" ? "Generating..." : "Inatengeneza...")
                            : (lang === "en" ? "Generate Draft Proposal" : "Tengeneza Rasimu ya Pendekezo")}
                        </button>
                      )}
                      {proposalMessage?.grantId === grant.id && (
                        <p className={`text-[10px] font-medium ${proposalMessage.isError ? "text-red-600" : "text-emerald-700"}`}>
                          {proposalMessage.text}
                        </p>
                      )}

                      {/* Action buttons & Card control row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100">
                        {/* External link */}
                        {grant.link ? (
                          <a
                            href={grant.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-red-600 hover:underline flex items-center gap-0.5"
                          >
                            {lang === "en" ? "Link" : "Tovuti"}
                          </a>
                        ) : (
                          <div />
                        )}

                        {/* Standard controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(grant)}
                            className="p-1 hover:bg-neutral-100 rounded text-neutral-500 hover:text-neutral-800 cursor-pointer"
                            title="Edit"
                            aria-label="Edit grant"
                          >
                            
                          </button>
                          <button
                            onClick={() => handleDelete(grant.id)}
                            className="p-1 hover:bg-neutral-100 rounded text-red-500 hover:text-red-700 cursor-pointer"
                            title="Delete"
                            aria-label="Delete grant"
                          >
                            
                          </button>
                        </div>
                      </div>

                      {/* Movement controls for columns */}
                      <div className="flex justify-between items-center bg-neutral-50 p-1.5 rounded-lg border border-neutral-100">
                        <select
                          value={grant.status}
                          onChange={(e) => moveStatus(grant, e.target.value as Grant["status"])}
                          className="bg-transparent text-[9px] font-bold text-neutral-600 focus:outline-none w-full cursor-pointer"
                        >
                          <option value="identified">{lang === "en" ? "Stage: Identified" : "Hatua: Tambuliwa"}</option>
                          <option value="preparing">{lang === "en" ? "Stage: Preparing" : "Hatua: Maandalizi"}</option>
                          <option value="submitted">{lang === "en" ? "Stage: Submitted" : "Hatua: Wasilishwa"}</option>
                          <option value="under_review">{lang === "en" ? "Stage: Under Review" : "Hatua: Inakaguliwa"}</option>
                          <option value="awarded">{lang === "en" ? "Stage: Awarded" : "Hatua: Kupata fedha"}</option>
                          <option value="declined">{lang === "en" ? "Stage: Declined" : "Hatua: Kataliwa"}</option>
                          <option value="withdrawn">{lang === "en" ? "Stage: Withdrawn" : "Hatua: Imeondolewa"}</option>
                        </select>
                      </div>
                    </div>
                  );
                })}

                {colGrants.length === 0 && (
                  <p className="text-[10px] text-neutral-500 text-center py-10 font-medium">
                    {lang === "en" ? "No proposals here" : "Hakuna maombi hapa"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grant Entry Modal */}
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
                    <option value="under_review">Under Review</option>
                    <option value="awarded">Awarded</option>
                    <option value="declined">Declined</option>
                    <option value="withdrawn">Withdrawn</option>
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
