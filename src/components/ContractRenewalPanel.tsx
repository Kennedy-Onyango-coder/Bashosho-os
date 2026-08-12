import React from "react";
import { UserProfile, ContractRenewal, OrgSettings, getCanonicalRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import MpesaPayButton from "./MpesaPayButton";
import Modal from "./Modal";
import PrintWrapper from "./PrintWrapper";
import { Lock, Printer, ShieldCheck, Clock, AlertTriangle, CheckCircle2, XCircle, Sparkles } from "lucide-react";

interface ContractRenewalPanelProps {
  currentUser: UserProfile;
  lang: "en" | "sw";
  onRefreshUser?: () => void;
}

interface ContractCycleStatus {
  dueDate: string;
  paymentWindowOpen: boolean;
  reminderActive: boolean;
  effectiveDeadline: string;
  locked: boolean;
  daysUntilDue: number;
  renewalFee: number;
  activeCycleRenewal: ContractRenewal | null;
  lastApprovedRenewal: ContractRenewal | null;
}

export default function ContractRenewalPanel({ currentUser, lang, onRefreshUser }: ContractRenewalPanelProps) {
  const [settings, setSettings] = React.useState<OrgSettings>({
    name: "BASHOSHO TALENTS CBO",
    registrationNumber: "Reg No. DSD/KAM/CBO/5/4/22/269",
    contactDetails: "P.O. Box 48931-00100 Nairobi, Kenya",
    physicalAddress: "Community Center Hall, Kiambiu, Nairobi",
    emailAndPhone: "Email: barshoshotalents@gmail.com | Cell: +254 798 132 410",
    missionText: "Connecting Youths Through Talents",
    renewalFee: 500,
  });

  const [renewals, setRenewals] = React.useState<ContractRenewal[]>([]);
  const [profiles, setProfiles] = React.useState<UserProfile[]>([]);
  const [myStatus, setMyStatus] = React.useState<ContractCycleStatus | null>(null);
  const [selectedPhoto, setSelectedPhoto] = React.useState<string>("");
  const [signedConduct, setSignedConduct] = React.useState(false);
  const [agreedObjectives, setAgreedObjectives] = React.useState(false);
  const [signatureText, setSignatureText] = React.useState("");
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [activeRejectionId, setActiveRejectionId] = React.useState<string | null>(null);
  const [partialAmount, setPartialAmount] = React.useState<string>("");
  const [mpesaUnavailable, setMpesaUnavailable] = React.useState(false);
  const [claimAmount, setClaimAmount] = React.useState("");
  const [claimCode, setClaimCode] = React.useState("");
  const [claimPhone, setClaimPhone] = React.useState("");
  const [submittingClaim, setSubmittingClaim] = React.useState(false);
  const [manualPaymentTarget, setManualPaymentTarget] = React.useState<ContractRenewal | null>(null);
  const [manualAmount, setManualAmount] = React.useState("");
  const [manualCode, setManualCode] = React.useState("");
  const [exemptionTargetId, setExemptionTargetId] = React.useState<string | null>(null);
  const [exemptionReason, setExemptionReason] = React.useState("");
  const [graceTargetId, setGraceTargetId] = React.useState<string | null>(null);
  const [graceDays, setGraceDays] = React.useState("7");
  const [printingItem, setPrintingItem] = React.useState<ContractRenewal | null>(null);

  // AI Draft Evaluation state
  const [evaluationDraft, setEvaluationDraft] = React.useState<string | null>(null);
  const [activeDraftItemId, setActiveDraftItemId] = React.useState<string | null>(null);
  const [isDraftingEvaluation, setIsDraftingEvaluation] = React.useState(false);

  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const fetchMyStatus = async () => {
    try {
      const res = await fetch("/api/my_contract_status");
      if (res.ok) setMyStatus(await res.json());
    } catch (err) {
      console.error("Failed to load contract status:", err);
    }
  };

  React.useEffect(() => {
    setSettings(StorageService.getOrgSettings());
    setRenewals(StorageService.getContractRenewals());
    setProfiles(StorageService.getProfiles());
    fetchMyStatus();
  }, []);

  const refreshData = () => {
    setRenewals(StorageService.getContractRenewals());
    setProfiles(StorageService.getProfiles());
    fetchMyStatus();
  };

  const handleGenerateAiContractEvaluation = async (item: ContractRenewal) => {
    setActiveDraftItemId(item.id);
    setIsDraftingEvaluation(true);
    try {
      const res = await fetch("/api/document_templates/generate_draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Member: ${item.userName} (${item.userRole})\nSubmission Date: ${item.submissionDate}\nAgreed Conduct: Yes | Agreed Objectives: Yes\nEvaluate annual contract renewal, performance contributions in Kiambiu community projects, and recommend approval.`,
          docType: "contract_renewal",
          title: `Contract Renewal Evaluation - ${item.userName}`
        })
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setEvaluationDraft(data.draft);
      } else {
        throw new Error(data.error || "Failed to generate evaluation draft");
      }
    } catch (err: any) {
      alert("AI Evaluation Draft failed: " + err.message);
    } finally {
      setIsDraftingEvaluation(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setErrorMsg(lang === "en" ? "Photo exceeds 1.5MB limit. Please upload a smaller passport-size photo." : "Picha inazidi 1.5MB. Tafadhali weka picha ndogo zaidi ya pasipoti.");
      return;
    }
    setErrorMsg(null);
    if (StorageService.isOnline()) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          if (data.url) { setSelectedPhoto(data.url); return; }
        }
      } catch (err) {
        console.warn("Server-side file upload failed. Falling back to local Base64 rendering.", err);
      }
    }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setSelectedPhoto(reader.result); };
    reader.readAsDataURL(file);
  };

  const myRenewals = renewals.filter(r => r.userId === currentUser.id);
  const myPendingRenewal = myStatus?.activeCycleRenewal || myRenewals.find(r => r.status === "pending_review") || null;
  const myApprovedRenewal = myStatus?.lastApprovedRenewal || myRenewals.find(r => r.status === "approved") || null;
  const myRejectedRenewal = myRenewals.find(r => r.status === "rejected" && (!myPendingRenewal));

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!selectedPhoto) {
      setErrorMsg(lang === "en" ? "Please attach your passport-size photo." : "Tafadhali weka picha yako ya pasipoti.");
      return;
    }
    if (!signedConduct || !agreedObjectives) {
      setErrorMsg(lang === "en" ? "You must agree to the Code of Conduct and CBO Objectives." : "Ni lazima ukubaliane na Maadili na Malengo ya CBO.");
      return;
    }
    if (!currentUser.signatureUrl && !signatureText.trim()) {
      setErrorMsg(lang === "en" ? "Please provide your digital signature." : "Tafadhali weka sahihi yako ya kidijitali.");
      return;
    }
    try {
      const res = await fetch("/api/contract_renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          photoUrl: selectedPhoto,
          signedConduct,
          agreedObjectives,
          signatureUrl: currentUser.signatureUrl || signatureText.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit contract");
      setSelectedPhoto(""); setSignedConduct(false); setAgreedObjectives(false); setSignatureText("");
      setSuccessMsg(lang === "en"
        ? "Your contract has been signed and submitted. Pay the renewal fee below (in full or in installments) to complete it."
        : "Mkataba wako umesainiwa na kuwasilishwa. Lipa ada hapo chini (kwa mkupuo au kidogo kidogo) kukamilisha.");
      setTimeout(() => setSuccessMsg(null), 6000);
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleApprove = async (renewalId: string, exemption?: string) => {
    try {
      const res = await fetch("/api/contract_renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: renewalId,
          userId: renewals.find(r => r.id === renewalId)?.userId,
          status: "approved",
          grantExemption: !!exemption,
          exemptionReason: exemption
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      setExemptionTargetId(null);
      setExemptionReason("");
      setSuccessMsg(lang === "en" ? "Contract renewal approved successfully!" : "Mkataba umeidhinishwa!");
      setTimeout(() => setSuccessMsg(null), 5000);
      if (onRefreshUser) onRefreshUser();
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async (renewalId: string) => {
    if (!rejectionReason.trim()) return;
    try {
      const res = await fetch("/api/contract_renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: renewalId,
          userId: renewals.find(r => r.id === renewalId)?.userId,
          status: "rejected",
          rejectionReason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject");
      setActiveRejectionId(null);
      setRejectionReason("");
      setSuccessMsg(lang === "en" ? "Contract renewal request rejected with feedback." : "Ombi la mkataba limekataliwa pamoja na maoni.");
      setTimeout(() => setSuccessMsg(null), 5000);
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleManualPayment = async () => {
    if (!manualPaymentTarget || !manualAmount || Number(manualAmount) <= 0) return;
    try {
      const res = await fetch(`/api/contract_renewals/${manualPaymentTarget.id}/manual_payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(manualAmount), transactionCode: manualCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");
      setManualPaymentTarget(null); setManualAmount(""); setManualCode("");
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmitClaim = async (renewalId: string) => {
    if (!claimAmount || Number(claimAmount) <= 0 || !claimCode.trim()) {
      setErrorMsg(lang === "en" ? "Amount and M-Pesa transaction code are required." : "Kiasi na nambari ya muamala vinahitajika.");
      return;
    }
    setSubmittingClaim(true);
    try {
      const res = await fetch(`/api/contract_renewals/${renewalId}/claim_manual_payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(claimAmount), transactionCode: claimCode.trim(), phone: claimPhone || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit payment claim");
      setClaimAmount(""); setClaimCode(""); setClaimPhone("");
      setSuccessMsg(lang === "en" ? "Payment reported. The Treasurer or Chairperson will verify it against the till statement shortly." : "Malipo yameripotiwa. Yatathibitishwa hivi karibuni.");
      setTimeout(() => setSuccessMsg(null), 6000);
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleClaimDecision = async (renewalId: string, claimId: string, action: "confirm" | "reject") => {
    try {
      const res = await fetch(`/api/contract_renewals/${renewalId}/manual_claims/${claimId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process claim");
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGraceExtension = async () => {
    if (!graceTargetId || !graceDays || Number(graceDays) <= 0) return;
    try {
      const res = await fetch("/api/contract_renewals/grace_extension", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: graceTargetId, days: Number(graceDays) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to grant extension");
      setGraceTargetId(null); setGraceDays("7");
      setSuccessMsg(lang === "en" ? `Extension granted until ${data.contractGraceUntil}.` : `Muda umeongezwa hadi ${data.contractGraceUntil}.`);
      setTimeout(() => setSuccessMsg(null), 5000);
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const userRoleKey = currentUser.roleKey || getCanonicalRoleKey(currentUser.role);
  const isAdmin = ["chairperson", "vice_chairperson"].includes(userRoleKey);
  // Every authenticated person — including the Chairperson and Vice Chairperson
  // themselves — has their own contract to sign and renew. Admin status only adds
  // the review queue below; it never replaces someone's own personal section.

  // Excludes the current admin's own submission — they see and pay for that in their
  // own personal section above; approving it themselves is blocked server-side anyway,
  // so it shouldn't even be offered here.
  const pendingItems = renewals.filter(r => r.status === "pending_review" && r.userId !== currentUser.id);
  const approvedItems = renewals.filter(r => r.status === "approved");
  const lockedProfiles = profiles.filter(p => {
    const graceStillValid = p.contractGraceUntil && p.contractGraceUntil >= new Date().toISOString().split("T")[0];
    return p.status !== "Inactive" && !graceStillValid && p.validUntil && p.validUntil < new Date().toISOString().split("T")[0];
  });

  const amountPaidOn = (r: ContractRenewal) => (r.payments || []).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6 text-left" id="contract-renewal-stage">
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl p-4 shadow-2xs flex items-start gap-2.5">
          <CheckCircle2 size={16} className="shrink-0" /><p>{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-xl p-4 shadow-2xs flex items-start gap-2.5">
          <AlertTriangle size={16} className="shrink-0" /><p>{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: SYSTEM POLICIES */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="border-b pb-3">
              <span className="text-red-600 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
                {lang === "en" ? "CBO CONSTITUTION" : "KATIBA YA SHIRIKA"}
              </span>
              <h3 className="text-sm font-black text-neutral-900 mt-1 uppercase font-sans">
                {lang === "en" ? "Rules & Code of Conduct" : "Kanuni na Maadili"}
              </h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-black text-neutral-800 uppercase tracking-wide">{lang === "en" ? "Core Objectives" : "Malengo Kuu"}</h4>
                <div className="text-[11px] text-neutral-600 font-serif leading-relaxed whitespace-pre-line p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  {settings.objectives || (lang === "en" ? "Awaiting initialization..." : "Inasubiri kuwekwa...")}
                </div>
              </div>
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-black text-neutral-800 uppercase tracking-wide">{lang === "en" ? "Code of Conduct" : "Maadili ya Kundi"}</h4>
                <div className="text-[11px] text-neutral-600 font-serif leading-relaxed whitespace-pre-line p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  {settings.codeOfConduct || (lang === "en" ? "Awaiting initialization..." : "Inasubiri kuwekwa...")}
                </div>
              </div>
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-black text-neutral-800 uppercase tracking-wide">{lang === "en" ? "General Rules" : "Sheria Kuu"}</h4>
                <div className="text-[11px] text-neutral-600 font-serif leading-relaxed whitespace-pre-line p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  {settings.rules || (lang === "en" ? "Awaiting initialization..." : "Inasubiri kuwekwa...")}
                </div>
              </div>
            </div>
          </div>

          {isAdmin && lockedProfiles.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-black text-red-800 uppercase tracking-wide flex items-center gap-1.5">
                <Lock size={14} /> {lang === "en" ? "Locked Members" : "Wanachama Waliofungwa"} ({lockedProfiles.length})
              </h3>
              <div className="space-y-2">
                {lockedProfiles.map(p => (
                  <div key={p.id} className="bg-white border border-red-100 rounded-lg p-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-neutral-800">{p.name}</p>
                      <p className="text-[9px] font-mono text-neutral-400">{lang === "en" ? "expired" : "imeisha"} {p.validUntil}</p>
                    </div>
                    {userRoleKey === "chairperson" && (
                      <button
                        onClick={() => setGraceTargetId(p.id)}
                        className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer whitespace-nowrap"
                      >
                        {lang === "en" ? "Grant Extension" : "Ongeza Muda"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-8 space-y-6">

          {/* SECTION A: EVERYONE'S OWN CONTRACT — sign, view status, pay */}
          {(
            <div className="space-y-6">
              {myStatus?.locked && (
                <div className="bg-red-600 text-white rounded-2xl p-6 shadow-md space-y-2">
                  <div className="flex items-center gap-2 font-black text-sm uppercase">
                    <Lock size={18} /> {lang === "en" ? "Contract Lapsed — Account Locked" : "Mkataba Umeisha — Akaunti Imefungwa"}
                  </div>
                  <p className="text-xs text-red-50 leading-relaxed">
                    {lang === "en"
                      ? `Your annual contract expired on ${myStatus.dueDate} and hasn't been renewed. Please renew below, or contact the Chairperson if you need more time.`
                      : `Mkataba wako uliisha ${myStatus.dueDate} na haujarejeshwa. Tafadhali rejesha hapa chini, au wasiliana na Mwenyekiti kama unahitaji muda zaidi.`}
                  </p>
                </div>
              )}

              {!myStatus?.locked && myApprovedRenewal && !myPendingRenewal && (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-neutral-900">
                        {lang === "en" ? "Active Annual Contract" : "Mkataba wa Mwaka Uhai"}
                      </h3>
                      <p className="text-xs text-neutral-500">
                        {lang === "en" ? `Your status is active. Good until ${myApprovedRenewal.expiryDate}.` : `Mkataba wako ni halali hadi ${myApprovedRenewal.expiryDate}.`}
                        {myStatus && myStatus.daysUntilDue <= 90 && myStatus.daysUntilDue > 0 && (
                          <span className="block mt-1 text-amber-600 font-bold">
                            {lang === "en" ? `Renewal window opens now — ${myStatus.daysUntilDue} days left. Feel free to start paying early below.` : `Dirisha la kurejesha limefunguliwa — siku ${myStatus.daysUntilDue} zimebaki.`}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white p-4 border rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <img src={myApprovedRenewal.photoUrl} alt="Verified passport photo" className="w-16 h-16 object-cover rounded-lg border border-neutral-200 shadow-2xs" referrerPolicy="no-referrer" />
                      <div>
                        <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded w-fit">
                          {lang === "en" ? "Active Passport Profile" : "Picha Hai ya Pasipoti"}
                        </span>
                        <p className="text-xs text-neutral-500 mt-1">{lang === "en" ? "Approved by" : "Imeidhinishwa na"} {myApprovedRenewal.reviewedBy}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPrintingItem(myApprovedRenewal)}
                      className="bg-neutral-900 hover:bg-black text-white text-[11px] font-bold px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Printer size={13} /> {lang === "en" ? "Print" : "Chapa"}
                    </button>
                  </div>
                </div>
              )}

              {myPendingRenewal && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center animate-pulse">
                      <Clock size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-neutral-900">
                        {lang === "en" ? "Contract Under Review" : "Mkataba Unapitiwa"}
                      </h3>
                      <p className="text-xs text-neutral-500">
                        {lang === "en" ? `Submitted on ${myPendingRenewal.submissionDate}.` : `Kiliwasilishwa mnamo ${myPendingRenewal.submissionDate}.`}
                      </p>
                    </div>
                  </div>

                  {/* Lipa Pole Pole progress */}
                  {(() => {
                    const paid = amountPaidOn(myPendingRenewal);
                    const fee = myPendingRenewal.feeRequired || settings.renewalFee || 500;
                    const pct = Math.min(100, Math.round((paid / fee) * 100));
                    const remaining = Math.max(0, fee - paid);
                    return (
                      <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-neutral-700">{lang === "en" ? "Lipa Pole Pole Progress" : "Maendeleo ya Malipo"}</span>
                          <span className="font-mono text-emerald-700">Ksh {paid.toLocaleString()} / {fee.toLocaleString()}</span>
                        </div>
                        {settings.invoiceMpesaTill && (
                          <p className="text-[10px] font-mono text-neutral-400">
                            {lang === "en" ? "Till No." : "Namba ya Till"} <strong className="text-neutral-700">{settings.invoiceMpesaTill}</strong> — {settings.name}
                          </p>
                        )}
                        <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        {remaining > 0 ? (
                          <>
                            <p className="text-[10px] text-neutral-500">
                              {lang === "en" ? `Ksh ${remaining.toLocaleString()} remaining. Pay any amount, any time before your renewal deadline.` : `Ksh ${remaining.toLocaleString()} imebaki. Lipa kiasi chochote wakati wowote kabla ya tarehe ya mwisho.`}
                            </p>
                            <div className="flex gap-2 items-center">
                              <input
                                type="number" min="1" max={remaining}
                                value={partialAmount}
                                onChange={e => setPartialAmount(e.target.value)}
                                placeholder={lang === "en" ? `Up to ${remaining}` : `Hadi ${remaining}`}
                                className="w-32 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                              />
                              <MpesaPayButton
                                lang={lang}
                                linkType="contract_renewal"
                                linkId={myPendingRenewal.id}
                                amount={Number(partialAmount) > 0 ? Math.min(Number(partialAmount), remaining) : remaining}
                                defaultPhone={currentUser.phone}
                                onConfirmed={refreshData}
                                onNotConfigured={() => setMpesaUnavailable(true)}
                                tillNumber={settings.invoiceMpesaTill}
                                businessName={settings.name}
                              />
                            </div>

                            {mpesaUnavailable && (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 space-y-2.5">
                                <p className="text-[11px] font-bold text-blue-900">
                                  {lang === "en" ? "Already paid to the till manually? Report it here:" : "Tayari umelipa kwa Till? Ripoti hapa:"}
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                  <input
                                    type="number" min="1"
                                    value={claimAmount}
                                    onChange={e => setClaimAmount(e.target.value)}
                                    placeholder={lang === "en" ? "Amount paid" : "Kiasi"}
                                    className="col-span-1 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                                  />
                                  <input
                                    type="text"
                                    value={claimCode}
                                    onChange={e => setClaimCode(e.target.value)}
                                    placeholder={lang === "en" ? "M-Pesa code" : "Nambari ya muamala"}
                                    className="col-span-2 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs font-mono uppercase"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={claimPhone}
                                  onChange={e => setClaimPhone(e.target.value)}
                                  placeholder={lang === "en" ? "Phone used to pay (optional)" : "Simu uliyotumia (si lazima)"}
                                  className="w-full bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs"
                                />
                                <button
                                  onClick={() => handleSubmitClaim(myPendingRenewal.id)}
                                  disabled={submittingClaim}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-3 py-2 rounded-lg cursor-pointer disabled:opacity-50"
                                >
                                  {submittingClaim ? (lang === "en" ? "Submitting..." : "Inatuma...") : (lang === "en" ? "Report This Payment" : "Ripoti Malipo Haya")}
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-[10px] text-emerald-700 font-bold">
                            {lang === "en" ? "Fully paid — waiting for Chairperson/Vice Chairperson approval." : "Imelipwa kikamilifu — inasubiri idhini."}
                          </p>
                        )}
                        {(myPendingRenewal.payments || []).length > 0 && (
                          <div className="pt-2 border-t border-neutral-100 space-y-1">
                            {myPendingRenewal.payments.map(p => (
                              <p key={p.id} className="text-[9px] font-mono text-neutral-400 flex justify-between">
                                <span>{p.date} · {p.method}{p.transactionCode ? ` · ${p.transactionCode}` : ""}</span>
                                <span className="font-bold text-neutral-600">Ksh {p.amount.toLocaleString()}</span>
                              </p>
                            ))}
                          </div>
                        )}
                        {(myPendingRenewal.pendingManualClaims || []).filter(c => c.status !== "confirmed").length > 0 && (
                          <div className="pt-2 border-t border-neutral-100 space-y-1.5">
                            <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">{lang === "en" ? "Reported Payments Awaiting Verification" : "Malipo Yaliyoripotiwa"}</p>
                            {myPendingRenewal.pendingManualClaims.filter(c => c.status !== "confirmed").map(c => (
                              <div key={c.id} className={`text-[10px] rounded-lg px-2.5 py-1.5 flex justify-between items-center ${c.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                                <span>{c.claimedDate} · {c.transactionCode} {c.status === "rejected" && c.rejectionReason ? `— ${c.rejectionReason}` : ""}</span>
                                <span className="font-bold flex items-center gap-1">
                                  Ksh {c.amount.toLocaleString()}
                                  <span className="uppercase font-black">{c.status === "rejected" ? (lang === "en" ? "Rejected" : "Imekataliwa") : (lang === "en" ? "Pending" : "Inasubiri")}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {myRejectedRenewal && !myPendingRenewal && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase">
                    <XCircle size={14} /><span>{lang === "en" ? "Contract Renewal Rejected" : "Ombi la Mkataba Limekataliwa"}</span>
                  </div>
                  <p className="text-xs text-neutral-700 font-sans">
                    <strong>{lang === "en" ? "Feedback / Reason" : "Sababu ya Kukataliwa"}:</strong> {myRejectedRenewal.rejectionReason}
                  </p>
                  <p className="text-[10px] text-neutral-400 font-sans">
                    {lang === "en" ? "Please review the feedback and submit the form again below with correct details." : "Tafadhali kagua maoni na ujaze ombi jipya hapo chini."}
                  </p>
                </div>
              )}

              {(!myPendingRenewal && !myApprovedRenewal) || myStatus?.locked || (myApprovedRenewal && myStatus && myStatus.daysUntilDue <= 90 && !myPendingRenewal) ? (
                <form onSubmit={handleMemberSubmit} className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-2xs space-y-5">
                  <div className="border-b pb-3">
                    <span className="text-red-600 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
                      {lang === "en" ? "ANNUAL CONTRACT — RENEWS EVERY 12 MONTHS" : "MKATABA WA MWAKA — UNAREJESHWA KILA MIEZI 12"}
                    </span>
                    <h3 className="text-base font-black text-neutral-900 mt-1 font-sans">
                      {lang === "en" ? "Sign Contract & Renew Membership" : "Saini Mkataba na Usajili upya"}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {lang === "en"
                        ? `Adherence to safeguarding and conduct is mandatory. A standard renewal fee of Ksh ${settings.renewalFee} is payable — pay in full or a little at a time (Lipa Pole Pole) once you submit this form.`
                        : `Ni lazima ukubali kanuni. Ada ya Ksh ${settings.renewalFee} inahitajika — lipa mkupuo au kidogo kidogo baada ya kuwasilisha fomu hii.`}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                      {lang === "en" ? "Attach Passport-Size Photo" : "Weka Picha ya Pasipoti"} *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                      <div className="sm:col-span-1 bg-neutral-50 border border-neutral-200 rounded-xl h-24 w-24 overflow-hidden flex items-center justify-center relative">
                        {selectedPhoto ? (
                          <img src={selectedPhoto} alt="Preview avatar" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-2xl text-neutral-300">?</span>
                        )}
                      </div>
                      <div className="sm:col-span-3 space-y-1.5">
                        <input
                          type="file" accept="image/*" onChange={handlePhotoUpload}
                          className="block w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-700 file:cursor-pointer hover:file:bg-red-100"
                        />
                        <p className="text-[10px] text-neutral-400">
                          {lang === "en" ? "Maximum size 1.5MB. This photo will update your official membership card." : "Uzito usiozidi 1.5MB. Itatumika kwenye kadi yako ya kikundi."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 bg-neutral-50 p-4 border border-neutral-150 rounded-xl">
                    <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                      {lang === "en" ? "Constitutional Undertaking" : "Ahadi na Makubaliano"} *
                    </label>
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-neutral-700">
                      <input type="checkbox" checked={signedConduct} onChange={(e) => setSignedConduct(e.target.checked)} className="mt-0.5 rounded border-neutral-300 text-red-600 focus:ring-red-500" />
                      <span>{lang === "en" ? "I have read, fully understand, and agree to uphold the Code of Conduct and safeguarding rules." : "Nimesoma, nimeelewa na ninaahidi kufuata Kanuni za Maadili na Sera ya Ulinzi ya kundi."}</span>
                    </label>
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-neutral-700">
                      <input type="checkbox" checked={agreedObjectives} onChange={(e) => setAgreedObjectives(e.target.checked)} className="mt-0.5 rounded border-neutral-300 text-red-600 focus:ring-red-500" />
                      <span>{lang === "en" ? "I support the organization's objectives and promise to attend at least 70% of CBO programs." : "Ninalinda malengo ya shirika na ninaahidi kuhudhuria angalau 70% ya mazoezi na miradi."}</span>
                    </label>
                    <div className="pt-2 border-t border-neutral-200/60 mt-2">
                      <label className="block text-[10px] font-bold uppercase text-neutral-600 tracking-wider mb-1">
                        {lang === "en" ? "Member Signature" : "Sahihi ya Mwanachama"} *
                      </label>
                      {currentUser.signatureUrl ? (
                        <div className="bg-white border border-emerald-200 rounded-lg p-3 flex items-center gap-3">
                          <img src={currentUser.signatureUrl} alt="Your uploaded signature" className="h-10 max-w-[8rem] object-contain" />
                          <p className="text-[10px] text-emerald-700 font-mono leading-snug">
                            {lang === "en" ? "Your uploaded signature will be appended to this contract." : "Sahihi yako uliyopakia itaambatanishwa kwenye mkataba huu."}
                          </p>
                        </div>
                      ) : (
                        <>
                          <input
                            type="text" required
                            placeholder={lang === "en" ? "Type your official full name to sign..." : "Weka jina lako kamili kama sahihi..."}
                            value={signatureText} onChange={(e) => setSignatureText(e.target.value)}
                            className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-serif italic text-neutral-900"
                          />
                          <p className="mt-1.5 text-[10px] text-neutral-400 leading-snug">
                            {lang === "en" ? "Tip: upload a real signature image under Security & 2FA in your dashboard menu to sign with an actual signature next time." : "Kidokezo: pakia picha halisi ya sahihi yako chini ya Usalama na 2FA."}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-colors cursor-pointer">
                    {lang === "en" ? "Sign Contract & Submit Renewal" : "Saini na Wasilisha Mkataba"}
                  </button>
                </form>
              ) : null}
            </div>
          )}

          {/* SECTION B: CHAIRPERSON / VICE CHAIRPERSON REVIEW */}
          {isAdmin && (
            <div className="space-y-6">
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <span className="text-red-600 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
                      {lang === "en" ? "GOVERNANCE AUDIT" : "UKAGUZI WA MKATABA"}
                    </span>
                    <h3 className="text-sm font-black text-neutral-900 mt-1 uppercase font-sans">
                      {lang === "en" ? "Contract Renewal Queue" : "Foleni ya Mkataba"} ({pendingItems.length})
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">
                    Fee: Ksh {settings.renewalFee}
                  </span>
                </div>

                {pendingItems.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 text-xs italic">
                    {lang === "en" ? "No contract renewal submissions pending review." : "Hakuna mikataba inayosubiri kupitishwa."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingItems.map(item => {
                      const paid = amountPaidOn(item);
                      const fee = item.feeRequired || settings.renewalFee || 500;
                      const fullyPaid = paid >= fee;
                      return (
                      <div key={item.id} className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-4 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img src={item.photoUrl} alt="Passport preview" className="w-12 h-12 object-cover rounded-lg border shadow-2xs" referrerPolicy="no-referrer" />
                            <div>
                              <h4 className="font-extrabold text-neutral-900">{item.userName}</h4>
                              <p className="text-[10px] text-neutral-500">{item.userRole} • Submitted: {item.submissionDate}</p>
                            </div>
                          </div>
                          <div className={`px-3 py-1.5 rounded-lg border text-right shrink-0 ${fullyPaid ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                            <span className="text-[9px] text-neutral-400 block font-mono font-bold tracking-wider">PAYMENT</span>
                            <span className={`font-mono font-bold text-[11px] ${fullyPaid ? "text-emerald-700" : "text-amber-700"}`}>Ksh {paid.toLocaleString()} / {fee.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-white p-2.5 rounded-lg border text-[10px] font-sans text-neutral-600">
                          <p>✓ {lang === "en" ? "Signed Code of Conduct" : "Kusaini Maadili"}</p>
                          <p>✓ {lang === "en" ? "Agreed to CBO Objectives" : "Kukubali Malengo"}</p>
                        </div>

                        {activeDraftItemId === item.id && evaluationDraft !== null && (
                          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 space-y-2 text-left">
                            <div className="flex justify-between items-center text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                              <span>Editable AI Performance Review</span>
                              <button onClick={() => { setActiveDraftItemId(null); setEvaluationDraft(null); }} className="text-purple-600 hover:text-purple-900 cursor-pointer">✕</button>
                            </div>
                            <textarea value={evaluationDraft} onChange={(e) => setEvaluationDraft(e.target.value)} rows={5} className="w-full bg-white border border-purple-200 rounded-lg p-2.5 text-xs text-neutral-800 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-purple-500" />
                          </div>
                        )}

                        {(item.pendingManualClaims || []).filter(c => c.status === "pending").length > 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                            <p className="text-[9px] font-bold text-blue-800 uppercase tracking-wider">{lang === "en" ? "Member-Reported Payments — Verify Against Till Statement" : "Malipo Yaliyoripotiwa — Kagua na Taarifa ya Till"}</p>
                            {item.pendingManualClaims.filter(c => c.status === "pending").map(c => (
                              <div key={c.id} className="flex items-center justify-between bg-white border border-blue-100 rounded-lg px-2.5 py-1.5">
                                <span className="text-[10px] font-mono text-neutral-600">{c.claimedDate} · <strong>{c.transactionCode}</strong>{c.phone ? ` · ${c.phone}` : ""} · <span className="font-bold text-neutral-800">Ksh {c.amount.toLocaleString()}</span></span>
                                <div className="flex gap-1.5 shrink-0">
                                  <button onClick={() => handleClaimDecision(item.id, c.id, "confirm")} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded cursor-pointer">
                                    {lang === "en" ? "Confirm" : "Thibitisha"}
                                  </button>
                                  <button onClick={() => handleClaimDecision(item.id, c.id, "reject")} className="text-[10px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded cursor-pointer">
                                    {lang === "en" ? "Reject" : "Kataa"}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {!fullyPaid && (
                          <div className="flex items-center gap-2 border-t pt-3">
                            <button
                              onClick={() => setManualPaymentTarget(item)}
                              className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                            >
                              {lang === "en" ? "Record Manual Payment" : "Rekodi Malipo ya Mkono"}
                            </button>
                          </div>
                        )}

                        {activeRejectionId === item.id ? (
                          <div className="space-y-2 pt-2 border-t border-neutral-200">
                            <label className="block text-[9px] font-bold text-red-700 uppercase">Reason for Rejection *</label>
                            <input type="text" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Provide feedback on photo or payment issue..." className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
                            <div className="flex justify-end gap-2 text-xs">
                              <button onClick={() => { setActiveRejectionId(null); setRejectionReason(""); }} className="bg-neutral-100 hover:bg-neutral-200 px-3 py-1 rounded cursor-pointer">Cancel</button>
                              <button onClick={() => handleReject(item.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded font-bold cursor-pointer">Send Rejection</button>
                            </div>
                          </div>
                        ) : exemptionTargetId === item.id ? (
                          <div className="space-y-2 pt-2 border-t border-neutral-200">
                            <label className="block text-[9px] font-bold text-purple-700 uppercase">{lang === "en" ? "Exemption Reason (required)" : "Sababu ya Msamaha"} *</label>
                            <input type="text" value={exemptionReason} onChange={(e) => setExemptionReason(e.target.value)} placeholder={lang === "en" ? "Why is this fee being waived?" : "Kwa nini ada inaondolewa?"} className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500" />
                            <div className="flex justify-end gap-2 text-xs">
                              <button onClick={() => { setExemptionTargetId(null); setExemptionReason(""); }} className="bg-neutral-100 hover:bg-neutral-200 px-3 py-1 rounded cursor-pointer">Cancel</button>
                              <button onClick={() => exemptionReason.trim() && handleApprove(item.id, exemptionReason.trim())} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded font-bold cursor-pointer">{lang === "en" ? "Approve with Exemption" : "Idhinisha na Msamaha"}</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                            <button onClick={() => handleGenerateAiContractEvaluation(item)} disabled={isDraftingEvaluation && activeDraftItemId === item.id} className="bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-purple-200 cursor-pointer flex items-center gap-1">
                              <Sparkles size={11} /> {isDraftingEvaluation && activeDraftItemId === item.id ? "Drafting..." : "AI Draft Evaluation"}
                            </button>
                            <button onClick={() => setActiveRejectionId(item.id)} className="bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-red-200 cursor-pointer">
                              {lang === "en" ? "Reject" : "Kataa"}
                            </button>
                            {!fullyPaid && (
                              <button onClick={() => setExemptionTargetId(item.id)} className="bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-purple-200 cursor-pointer">
                                {lang === "en" ? "Waive Fee" : "Ondoa Ada"}
                              </button>
                            )}
                            <button
                              onClick={() => fullyPaid ? handleApprove(item.id) : null}
                              disabled={!fullyPaid}
                              className="bg-[#00A651] hover:bg-[#008d43] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold px-4 py-1.5 rounded-lg shadow-2xs cursor-pointer"
                            >
                              {lang === "en" ? "Approve & Update ID" : "Idhinisha & Sasisha Kadi"}
                            </button>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-2xs space-y-4">
                <h3 className="text-xs font-black text-neutral-900 border-b pb-2 uppercase tracking-wide">
                  {lang === "en" ? "Active Approved Contracts" : "Mikataba Halali Iliyoidhinishwa"}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-neutral-600">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[10px] text-neutral-400 font-mono tracking-wider uppercase">
                        <th className="py-2">{lang === "en" ? "Member Name" : "Jina"}</th>
                        <th className="py-2">{lang === "en" ? "Role" : "Nafasi"}</th>
                        <th className="py-2">{lang === "en" ? "Approved Date" : "Kuidhinishwa"}</th>
                        <th className="py-2">{lang === "en" ? "Expiry Date" : "Mwisho"}</th>
                        <th className="py-2 text-right">{lang === "en" ? "Fee" : "Ada"}</th>
                        <th className="py-2 text-right">{lang === "en" ? "Print" : "Chapa"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedItems.length === 0 ? (
                        <tr><td colSpan={6} className="py-4 text-center italic text-neutral-400">{lang === "en" ? "No approved renewals logged." : "Hakuna mikataba iliyoidhinishwa bado."}</td></tr>
                      ) : (
                        approvedItems.map(item => (
                          <tr key={item.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                            <td className="py-2.5 font-bold text-neutral-900 flex items-center gap-2">
                              <img src={item.photoUrl} alt="" className="w-6 h-6 rounded-full object-cover border" referrerPolicy="no-referrer" />
                              <span>{item.userName}</span>
                            </td>
                            <td className="py-2.5 text-neutral-500">{item.userRole}</td>
                            <td className="py-2.5 font-mono text-neutral-500">{item.reviewedDate || item.submissionDate}</td>
                            <td className="py-2.5 font-mono text-emerald-600 font-bold">{item.expiryDate || "N/A"}</td>
                            <td className="py-2.5 font-mono text-neutral-950 font-bold text-right">{item.paymentStatus === "exempt" ? "Exempt" : `Ksh ${item.feeRequired || settings.renewalFee}`}</td>
                            <td className="py-2.5 text-right">
                              <button onClick={() => setPrintingItem(item)} className="text-neutral-400 hover:text-neutral-900 cursor-pointer"><Printer size={13} /></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual payment modal */}
      <Modal isOpen={!!manualPaymentTarget} onClose={() => setManualPaymentTarget(null)} maxWidth="max-w-sm">
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900">{lang === "en" ? "Record Manual Payment" : "Rekodi Malipo ya Mkono"}</h3>
          <p className="text-xs text-neutral-500">{manualPaymentTarget?.userName}</p>
          <p className="text-[10px] text-neutral-400">
            {lang === "en" ? "Use this after confirming the payment against the" : "Tumia hii baada ya kuthibitisha malipo na"} {settings.name} Till {settings.invoiceMpesaTill} {lang === "en" ? "statement." : "taarifa."}
          </p>
          <input type="number" min="1" value={manualAmount} onChange={e => setManualAmount(e.target.value)} placeholder={lang === "en" ? "Amount (Ksh)" : "Kiasi (Ksh)"} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs font-mono" />
          <input type="text" value={manualCode} onChange={e => setManualCode(e.target.value)} placeholder={lang === "en" ? "Transaction code (optional)" : "Nambari ya muamala"} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs font-mono" />
          <button onClick={handleManualPayment} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
            {lang === "en" ? "Confirm Payment" : "Thibitisha Malipo"}
          </button>
        </div>
      </Modal>

      {/* Grace extension modal */}
      <Modal isOpen={!!graceTargetId} onClose={() => setGraceTargetId(null)} maxWidth="max-w-sm">
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900">{lang === "en" ? "Grant Grace Extension" : "Toa Muda wa Ziada"}</h3>
          <p className="text-xs text-neutral-500">{profiles.find(p => p.id === graceTargetId)?.name}</p>
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Extra Days" : "Siku za Ziada"}</label>
            <input type="number" min="1" value={graceDays} onChange={e => setGraceDays(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs font-mono" />
            <div className="flex gap-1.5 mt-1.5">
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setGraceDays(String(d))} className="text-[10px] font-bold bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded cursor-pointer">{d}d</button>
              ))}
            </div>
          </div>
          <button onClick={handleGraceExtension} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
            {lang === "en" ? "Grant Extension" : "Toa Muda"}
          </button>
        </div>
      </Modal>

      {/* Printable contract */}
      <Modal isOpen={!!printingItem} onClose={() => setPrintingItem(null)} maxWidth="max-w-3xl">
        {printingItem && (
          <PrintWrapper
            title={lang === "en" ? "Annual Membership Contract" : "Mkataba wa Mwaka wa Uanachama"}
            docType="CONTRACT"
            authorName={printingItem.userName}
            authorRole={printingItem.userRole}
            authorSignatureUrl={printingItem.signatureUrl}
            dateString={printingItem.reviewedDate || printingItem.submissionDate}
            verificationUrl={printingItem.verificationUrl}
          >
            <div className="space-y-5">
              <div className="flex items-center gap-4 border-b border-neutral-200 pb-4">
                <img src={printingItem.photoUrl} alt={printingItem.userName} className="w-20 h-20 object-cover rounded-xl border border-neutral-200" referrerPolicy="no-referrer" />
                <div>
                  <h2 className="text-lg font-black text-neutral-900">{printingItem.userName}</h2>
                  <p className="text-xs font-mono text-neutral-500 uppercase">{printingItem.userRole}</p>
                  <p className="text-xs text-neutral-500">{lang === "en" ? "Valid" : "Halali"}: {printingItem.reviewedDate} → {printingItem.expiryDate}</p>
                </div>
              </div>
              <div className="space-y-2 text-xs text-neutral-700 leading-relaxed font-serif">
                <p>{lang === "en"
                  ? `This certifies that ${printingItem.userName} has entered into an annual membership contract with Bashosho Talents CBO, has signed and agreed to uphold the organization's Code of Conduct and safeguarding policies, and supports the organization's stated objectives.`
                  : `Hii inathibitisha kwamba ${printingItem.userName} ameingia kwenye mkataba wa mwaka wa uanachama na Bashosho Talents CBO.`}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-neutral-200">
                <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Renewal Fee" : "Ada"}</span><span className="font-bold text-neutral-900">{printingItem.paymentStatus === "exempt" ? (lang === "en" ? "Exempted" : "Imesamehewa") : `Ksh ${printingItem.feeRequired}`}</span></div>
                <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Reviewed By" : "Ilikaguliwa Na"}</span><span className="font-bold text-neutral-900">{printingItem.reviewedBy}</span></div>
              </div>
            </div>
          </PrintWrapper>
        )}
      </Modal>
    </div>
  );
}
