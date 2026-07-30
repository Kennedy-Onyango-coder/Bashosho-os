import React from "react";
import { UserProfile, UserRole, ContractRenewal, OrgSettings, Income, getCanonicalRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import MpesaPayButton from "./MpesaPayButton";

interface ContractRenewalPanelProps {
  currentUser: UserProfile;
  lang: "en" | "sw";
  onRefreshUser?: () => void;
}

export default function ContractRenewalPanel({ currentUser, lang, onRefreshUser }: ContractRenewalPanelProps) {
  const [settings, setSettings] = React.useState<OrgSettings>({
    name: "BASHOSHO TALENTS CBO",
    registrationNumber: "Reg No. DSD/KAM/CBO/5/4/22/269",
    contactDetails: "P.O. Box 48931-00100 Nairobi, Kenya",
    physicalAddress: "Community Center Hall, Kiambiu, Nairobi",
    emailAndPhone: "Email: barshoshotalents@gmail.com | Cell: +254 798 132 410",
    missionText: "Connecting Youths Through Talents",
    renewalFee: 200,
  });

  const [renewals, setRenewals] = React.useState<ContractRenewal[]>([]);
  const [profiles, setProfiles] = React.useState<UserProfile[]>([]);
  const [selectedPhoto, setSelectedPhoto] = React.useState<string>("");
  const [signedConduct, setSignedConduct] = React.useState(false);
  const [agreedObjectives, setAgreedObjectives] = React.useState(false);
  const [signatureText, setSignatureText] = React.useState("");
  const [transactionCode, setTransactionCode] = React.useState("");
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [activeRejectionId, setActiveRejectionId] = React.useState<string | null>(null);
  
  // AI Draft Evaluation state
  const [evaluationDraft, setEvaluationDraft] = React.useState<string | null>(null);
  const [activeDraftItemId, setActiveDraftItemId] = React.useState<string | null>(null);
  const [isDraftingEvaluation, setIsDraftingEvaluation] = React.useState(false);

  const handleGenerateAiContractEvaluation = async (item: ContractRenewal) => {
    setActiveDraftItemId(item.id);
    setIsDraftingEvaluation(true);
    try {
      const res = await fetch("/api/document_templates/generate_draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Member: ${item.userName} (${item.userRole})
Submission Date: ${item.submissionDate}
Agreed Conduct: Yes | Agreed Objectives: Yes
Evaluate 6-month contract renewal, performance contributions in Kiambiu community projects, and recommend 6-month extension.`,
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
  
  // Alert banner states
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSettings(StorageService.getOrgSettings());
    setRenewals(StorageService.getContractRenewals());
    setProfiles(StorageService.getProfiles());
  }, []);

  const refreshData = () => {
    setRenewals(StorageService.getContractRenewals());
    setProfiles(StorageService.getProfiles());
  };

  // Convert uploaded photo to Base64 data url for storage and digital ID synchronization, with server /api/upload integration
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      setErrorMsg(lang === "en" ? "Photo exceeds 1.5MB limit. Please upload a smaller passport-size photo." : "Picha inazidi 1.5MB. Tafadhali weka picha ndogo zaidi ya pasipoti.");
      return;
    }

    setErrorMsg(null);

    // Try server-side upload via REST API if online
    if (StorageService.isOnline()) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            setSelectedPhoto(data.url);
            return;
          }
        }
      } catch (err) {
        console.warn("Server-side file upload failed. Falling back to local Base64 rendering.", err);
      }
    }

    // Local Base64 fallback for offline capability
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSelectedPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Check if member has current submission
  const myRenewals = renewals.filter(r => r.userId === currentUser.id);
  const myPendingRenewal = myRenewals.find(r => r.status === "pending_review");
  const myApprovedRenewal = myRenewals.find(r => r.status === "approved");
  const myRejectedRenewal = myRenewals.find(r => r.status === "rejected");

  const handleMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    if (!transactionCode.trim()) {
      setErrorMsg(lang === "en" ? "Please provide an M-Pesa transaction code or Receipt Ref." : "Tafadhali weka nambari ya muamala wa M-Pesa au Stakabadhi.");
      return;
    }

    const newRenewal: ContractRenewal = {
      id: `ren-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      submissionDate: new Date().toISOString().split("T")[0],
      photoUrl: selectedPhoto,
      signedConduct,
      agreedObjectives,
      // Prefer the member's real uploaded signature image (set via Security & 2FA) over
      // a typed name — falls back to the typed attestation only if they haven't uploaded one.
      signatureUrl: currentUser.signatureUrl || signatureText.trim(),
      paymentStatus: "pending",
      status: "pending_review"
    };

    const updatedRenewals = [newRenewal, ...renewals];
    StorageService.saveRecord("contract_renewals", newRenewal).catch(console.error);
    setRenewals(updatedRenewals);
    
    // Reset Form
    setSelectedPhoto("");
    setSignedConduct(false);
    setAgreedObjectives(false);
    setSignatureText("");
    setTransactionCode("");
    
    setSuccessMsg(lang === "en" 
      ? "Your 6-month contract renewal has been submitted and is awaiting Chairperson review!" 
      : "Ombi lako la mkataba wa miezi 6 limewasilishwa na linasubiri mapitio ya Mwenyekiti!");
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // Admin approval of a contract renewal
  const handleApprove = (renewalId: string) => {
    const targetRenewal = renewals.find(r => r.id === renewalId);
    if (!targetRenewal) return;

    // 1. Update the renewal request status
    let approvedRenewal: ContractRenewal | null = null;
    const updatedRenewals = renewals.map(r => {
      if (r.id === renewalId) {
        approvedRenewal = {
          ...r,
          status: "approved" as const,
          paymentStatus: "paid" as const,
          expiryDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 6 months from now
          reviewedBy: currentUser.name,
          reviewedDate: new Date().toISOString().split("T")[0],
        };
        return approvedRenewal;
      }
      return r;
    });

    // 2. Save renewals
    if (approvedRenewal) {
      StorageService.saveRecord("contract_renewals", approvedRenewal).catch(console.error);
    }
    setRenewals(updatedRenewals);

    // 3. Update the member profile with their new passport size photo and set status to Active
    let approvedProfile: UserProfile | null = null;
    const updatedProfiles = profiles.map(p => {
      if (p.id === targetRenewal.userId) {
        approvedProfile = {
          ...p,
          status: "Active" as const,
          avatar: targetRenewal.photoUrl // set uploaded passport size photo as profile photo
        };
        return approvedProfile;
      }
      return p;
    });
    if (approvedProfile) {
      StorageService.saveRecord("profiles", approvedProfile).catch(console.error);
    }
    setProfiles(updatedProfiles);

    // 4. Record the renewal payment into the Income ledger
    const newIncome: Income = {
      id: `inc-${Date.now()}`,
      source: "membership_contribution",
      amount: settings.renewalFee ?? 200,
      date: new Date().toISOString().split("T")[0],
      description: `6-Month Contract Renewal Fee - ${targetRenewal.userName} (${targetRenewal.userRole})`,
      recordedBy: currentUser.name
    };
    StorageService.saveRecord("incomes", newIncome).catch(console.error);

    setSuccessMsg(lang === "en" 
      ? `Contract renewal for ${targetRenewal.userName} approved successfully! Passport photo synchronized and Kshs ${settings.renewalFee} recorded in Treasury.` 
      : `Mkataba wa ${targetRenewal.userName} umeidhinishwa! Picha ya pasipoti imesasishwa na Kshs ${settings.renewalFee} kurekodiwa hazina.`);
    setTimeout(() => setSuccessMsg(null), 5000);

    if (onRefreshUser) onRefreshUser();
    refreshData();
  };

  // Admin rejection
  const handleReject = (renewalId: string) => {
    if (!rejectionReason.trim()) return;

    let rejectedRenewal: ContractRenewal | null = null;
    const updatedRenewals = renewals.map(r => {
      if (r.id === renewalId) {
        rejectedRenewal = {
          ...r,
          status: "rejected" as const,
          rejectionReason: rejectionReason,
          reviewedBy: currentUser.name,
          reviewedDate: new Date().toISOString().split("T")[0],
        };
        return rejectedRenewal;
      }
      return r;
    });

    if (rejectedRenewal) {
      StorageService.saveRecord("contract_renewals", rejectedRenewal).catch(console.error);
    }
    setRenewals(updatedRenewals);
    setActiveRejectionId(null);
    setRejectionReason("");

    setSuccessMsg(lang === "en" ? "Contract renewal request rejected with feedback." : "Ombi la mkataba limekataliwa pamoja na maoni.");
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const userRoleKey = currentUser.roleKey || getCanonicalRoleKey(currentUser.role);
  const isAdmin = ["chairperson", "programs_director", "vice_chairperson"].includes(userRoleKey);
  const isMember = ["program_member", "volunteer"].includes(userRoleKey);

  const pendingCount = renewals.filter(r => r.status === "pending_review").length;

  return (
    <div className="space-y-6 text-left" id="contract-renewal-stage">
      {/* Dynamic Alerts */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl p-4 shadow-2xs flex items-start gap-2.5">
          <span className="text-sm"></span>
          <p>{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-xl p-4 shadow-2xs flex items-start gap-2.5">
          <span className="text-sm">️</span>
          <p>{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: SYSTEM POLICIES & ORG INFORMATION (Always Visible, editable by admin in Settings) */}
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
                <h4 className="text-[11px] font-black text-neutral-800 uppercase tracking-wide"> {lang === "en" ? "Core Objectives" : "Malengo Kuu"}</h4>
                <div className="text-[11px] text-neutral-600 font-serif leading-relaxed whitespace-pre-line p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  {settings.objectives || (lang === "en" ? "Awaiting initialization..." : "Inasubiri kuwekwa...")}
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-[11px] font-black text-neutral-800 uppercase tracking-wide"> {lang === "en" ? "Code of Conduct" : "Maadili ya Kundi"}</h4>
                <div className="text-[11px] text-neutral-600 font-serif leading-relaxed whitespace-pre-line p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  {settings.codeOfConduct || (lang === "en" ? "Awaiting initialization..." : "Inasubiri kuwekwa...")}
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-[11px] font-black text-neutral-800 uppercase tracking-wide"> {lang === "en" ? "General Rules" : "Sheria Kuu"}</h4>
                <div className="text-[11px] text-neutral-600 font-serif leading-relaxed whitespace-pre-line p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  {settings.rules || (lang === "en" ? "Awaiting initialization..." : "Inasubiri kuwekwa...")}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTION FLOWS (MEMBER FORM OR ADMIN REVIEW LEVER) */}
        <div className="lg:col-span-8 space-y-6">

          {/* SECTION A: FOR MEMBER/VOLUNTEER SIGNING */}
          {isMember && (
            <div className="space-y-6">
              {/* If already has an approved renewal */}
              {myApprovedRenewal && (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg">
                      
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-neutral-900">
                        {lang === "en" ? "Active 6-Month Contract Validated" : "Mkataba wa Miezi 6 Umethibitishwa"}
                      </h3>
                      <p className="text-xs text-neutral-500">
                        {lang === "en" ? `Your status is active. Good until ${myApprovedRenewal.expiryDate}.` : `Mkataba wako ni halali hadi ${myApprovedRenewal.expiryDate}.`}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-neutral-600 font-sans border-t border-emerald-150 pt-3 space-y-2">
                    <p> <strong>{lang === "en" ? "Code of Conduct Signed" : "Kanuni za Maadili Zimesainiwa"}:</strong> Agreed on {myApprovedRenewal.submissionDate}</p>
                    <p> <strong>{lang === "en" ? "Renewal Fee Payment Status" : "Ada ya Urejeshaji"}:</strong> Paid Kshs {settings.renewalFee} (Verified by Treasurer)</p>
                    <p> <strong>{lang === "en" ? "System Identity Card" : "Kadi ya Kitambulisho"}:</strong> Passport photo uploaded and active.</p>
                  </div>
                  <div className="bg-white p-4 border rounded-xl flex items-center gap-4">
                    <img 
                      src={myApprovedRenewal.photoUrl} 
                      alt="Verified passport photo" 
                      className="w-16 h-16 object-cover rounded-lg border border-neutral-200 shadow-2xs"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded w-fit">
                        {lang === "en" ? "Active Passport Profile" : "Picha Hai ya Pasipoti"}
                      </span>
                      <p className="text-xs text-neutral-500 mt-1">{lang === "en" ? "This photo is active on your Digital ID card and global profile." : "Picha hii ndiyo inayotumika kwenye kadi yako ya uanachama."}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* If has a pending review */}
              {myPendingRenewal && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-lg animate-pulse">
                      
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-neutral-900">
                        {lang === "en" ? "Renewal Contract Under Chairperson Review" : "Ombi la Mkataba Linapitiwa na Mwenyekiti"}
                      </h3>
                      <p className="text-xs text-neutral-500">
                        {lang === "en" ? `Submitted on ${myPendingRenewal.submissionDate}. Waiting for verification.` : `Kiliwasilishwa mnamo ${myPendingRenewal.submissionDate}. Kinasubiri usajili.`}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {lang === "en"
                      ? "Thank you for submitting your contract. The chairperson and safeguarding team are verifying your details and payment. Once approved, your profile photo will update globally."
                      : "Asante kwa kuwasilisha mkataba wako. Mwenyekiti anathibitisha malipo na picha yako rasmi ya pasipoti kwa sasa."}
                  </p>
                  {myPendingRenewal.paymentStatus !== "paid" && (
                    <div className="pt-1">
                      <MpesaPayButton
                        lang={lang}
                        linkType="contract_renewal"
                        linkId={myPendingRenewal.id}
                        amount={settings.renewalFee || 0}
                        defaultPhone={currentUser.phone}
                        onConfirmed={refreshData}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* If rejected */}
              {myRejectedRenewal && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase">
                    <span></span>
                    <span>{lang === "en" ? "Contract Renewal Rejected" : "Ombi la Mkataba Limekataliwa"}</span>
                  </div>
                  <p className="text-xs text-neutral-700 font-sans">
                    <strong>{lang === "en" ? "Feedback / Reason" : "Sababu ya Kukataliwa"}:</strong> {myRejectedRenewal.rejectionReason}
                  </p>
                  <p className="text-[10px] text-neutral-400 font-sans">
                    {lang === "en" ? "Please review the feedback and submit the form again below with correct details." : "Tafadhali kagua maoni na ujaze ombi jipya hapo chini."}
                  </p>
                </div>
              )}

              {/* Renewal Signing Form (Visible only if no approved or pending, or if rejected) */}
              {(!myPendingRenewal && !myApprovedRenewal) && (
                <form onSubmit={handleMemberSubmit} className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-2xs space-y-5">
                  <div className="border-b pb-3">
                    <span className="text-red-600 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
                      {lang === "en" ? "6-MONTH PERIODIC CONTRACT" : "USAJILI UPYA NA MKATABA WA MIEZI 6"}
                    </span>
                    <h3 className="text-base font-black text-neutral-900 mt-1 font-sans">
                      {lang === "en" ? "Sign Contract & Renew Membership" : "Saini Mkataba na Usajili upya"}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {lang === "en" 
                        ? `Adherence to safeguarding and conduct is mandatory. A standard renewal fee of Kshs ${settings.renewalFee} is payable.` 
                        : `Ni lazima ukubali kanuni na kutoa mchango wa ukarabati wa ukumbi wa Kshs ${settings.renewalFee}.`}
                    </p>
                  </div>

                  {/* 1. Passport Size Photo Attachment Box */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                       {lang === "en" ? "Attach Passport-Size Photo" : "Weka Picha ya Pasipoti"} *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                      <div className="sm:col-span-1 bg-neutral-50 border border-neutral-200 rounded-xl h-24 w-24 overflow-hidden flex items-center justify-center relative">
                        {selectedPhoto ? (
                          <img 
                            src={selectedPhoto} 
                            alt="Preview avatar" 
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-2xl text-neutral-300"></span>
                        )}
                      </div>
                      <div className="sm:col-span-3 space-y-1.5">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="block w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-700 file:cursor-pointer hover:file:bg-red-100"
                        />
                        <p className="text-[10px] text-neutral-400">
                          {lang === "en" ? "Maximum size 1.5MB. This photo will update your official membership card." : "Uzito usiozidi 1.5MB. Itatumika kwenye kadi yako ya kikundi."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 2. Agreements checklist */}
                  <div className="space-y-3 bg-neutral-50 p-4 border border-neutral-150 rounded-xl">
                    <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                       {lang === "en" ? "Constitutional Undertaking" : "Ahadi na Makubaliano"} *
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-neutral-700">
                      <input
                        type="checkbox"
                        checked={signedConduct}
                        onChange={(e) => setSignedConduct(e.target.checked)}
                        className="mt-0.5 rounded border-neutral-300 text-red-600 focus:ring-red-500"
                      />
                      <span>
                        {lang === "en" 
                          ? "I have read, fully understand, and agree to uphold the Code of Conduct and safeguarding rules." 
                          : "Nimesoma, nimeelewa na ninaahidi kufuata Kanuni za Maadili na Sera ya Ulinzi ya kundi."}
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-neutral-700">
                      <input
                        type="checkbox"
                        checked={agreedObjectives}
                        onChange={(e) => setAgreedObjectives(e.target.checked)}
                        className="mt-0.5 rounded border-neutral-300 text-red-600 focus:ring-red-500"
                      />
                      <span>
                        {lang === "en"
                          ? "I support the organization's objectives and promise to attend at least 70% of CBO programs."
                          : "Ninalinda malengo ya shirika na ninaahidi kuhudhuria angalau 70% ya mazoezi na miradi."}
                      </span>
                    </label>

                    {/* Member Digital Signature Box */}
                    <div className="pt-2 border-t border-neutral-200/60 mt-2">
                      <label className="block text-[10px] font-bold uppercase text-neutral-600 tracking-wider mb-1">
                        ️ {lang === "en" ? "Member Signature" : "Sahihi ya Mwanachama"} *
                      </label>
                      {currentUser.signatureUrl ? (
                        <div className="bg-white border border-emerald-200 rounded-lg p-3 flex items-center gap-3">
                          <img src={currentUser.signatureUrl} alt="Your uploaded signature" className="h-10 max-w-[8rem] object-contain" />
                          <p className="text-[10px] text-emerald-700 font-mono leading-snug">
                            {lang === "en"
                              ? "Your uploaded signature will be appended to this contract."
                              : "Sahihi yako uliyopakia itaambatanishwa kwenye mkataba huu."}
                          </p>
                        </div>
                      ) : (
                        <>
                          <input
                            type="text"
                            required
                            placeholder={lang === "en" ? "Type your official full name to sign..." : "Weka jina lako kamili kama sahihi..."}
                            value={signatureText}
                            onChange={(e) => setSignatureText(e.target.value)}
                            className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-serif italic text-neutral-900"
                          />
                          {signatureText.trim() && (
                            <div className="mt-1 text-[10px] text-emerald-600 font-mono flex items-center gap-1">
                               Signed: <span className="font-serif italic font-bold">{signatureText}</span> ({new Date().toLocaleDateString()})
                            </div>
                          )}
                          <p className="mt-1.5 text-[10px] text-neutral-400 leading-snug">
                            {lang === "en"
                              ? "Tip: upload a real signature image under Security & 2FA in your dashboard menu to sign with an actual signature next time."
                              : "Kidokezo: pakia picha halisi ya sahihi yako chini ya Usalama na 2FA kwenye menyu ya dashibodi yako ili kutia sahihi halisi wakati ujao."}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 3. Renewal Fee Entry */}
                  <div className="space-y-1 bg-red-50/50 p-4 border border-red-100 rounded-xl">
                    <label className="block text-[10px] font-bold uppercase text-red-700 tracking-wider">
                       {lang === "en" ? "Renewal Contribution Fee Required" : "Ada ya Mchango Inahitajika"}
                    </label>
                    <p className="text-[11px] text-neutral-600">
                      {lang === "en" 
                        ? `Please pay a renewal contribution of Kshs ${settings.renewalFee} to the CBO Treasury. Provide the M-Pesa Transaction Code below.` 
                        : `Tafadhali lipa Kshs ${settings.renewalFee} kwa mhazini wa kikundi au ofisini na uweke nambari ya muamala hapa.`}
                    </p>
                    <div className="mt-3">
                      <input
                        type="text"
                        required
                        value={transactionCode}
                        onChange={(e) => setTransactionCode(e.target.value.toUpperCase())}
                        placeholder="e.g. QHB3NK8W9Z"
                        className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono font-bold placeholder-neutral-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                     {lang === "en" ? "Sign Contract & Submit Renewal" : "Saini na Wasilisha Mkataba"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* SECTION B: FOR CHAIRPERSON / ADMIN REVIEW DASHBOARD */}
          {isAdmin && (
            <div className="space-y-6">
              
              {/* Review Queue Card */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <span className="text-red-600 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
                      {lang === "en" ? "GOVERNANCE AUDIT" : "UKAGUZI WA MKATABA"}
                    </span>
                    <h3 className="text-sm font-black text-neutral-900 mt-1 uppercase font-sans">
                      {lang === "en" ? "Contract Renewal Queue" : "M mkataba Inayoruhusiwa"} ({pendingCount})
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">
                    Fee: Kshs {settings.renewalFee}
                  </span>
                </div>

                {renewals.filter(r => r.status === "pending_review").length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 text-xs italic">
                    {lang === "en" ? "No contract renewal submissions pending review." : "Hakuna mikataba ya wanachama inayosubiri kupitishwa."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {renewals.filter(r => r.status === "pending_review").map(item => (
                      <div key={item.id} className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-4 text-xs">
                        
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img 
                              src={item.photoUrl} 
                              alt="Passport preview" 
                              className="w-12 h-12 object-cover rounded-lg border shadow-2xs"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <h4 className="font-extrabold text-neutral-900">{item.userName}</h4>
                              <p className="text-[10px] text-neutral-500">{item.userRole} • Submitted: {item.submissionDate}</p>
                            </div>
                          </div>
                          
                          <div className="bg-white px-3 py-1.5 rounded-lg border border-neutral-200 text-right shrink-0">
                            <span className="text-[9px] text-neutral-400 block font-mono font-bold tracking-wider">TX REF CODE</span>
                            <span className="font-mono font-bold text-red-600 text-[11px]">{item.photoUrl.startsWith("data:") ? "PASSPORT ATTACHED" : "IMAGE REF"}</span>
                            <span className="block text-[10px] font-bold text-neutral-800 font-mono mt-0.5">MPESA: {item.id.replace("ren-", "TX-")}</span>
                          </div>
                        </div>

                        {/* Agreement checkboxes audit summary */}
                        <div className="grid grid-cols-2 gap-4 bg-white p-2.5 rounded-lg border text-[10px] font-sans text-neutral-600">
                          <p> {lang === "en" ? "Signed Code of Conduct" : "Kusaini Maadili"}</p>
                          <p> {lang === "en" ? "Agreed to CBO Objectives" : "Kukubali Malengo"}</p>
                        </div>

                        {/* AI Evaluation Draft Preview if generated for this item */}
                        {activeDraftItemId === item.id && evaluationDraft !== null && (
                          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 space-y-2 text-left">
                            <div className="flex justify-between items-center text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                              <span> Editable AI Performance Review</span>
                              <button
                                onClick={() => {
                                  setActiveDraftItemId(null);
                                  setEvaluationDraft(null);
                                }}
                                className="text-purple-600 hover:text-purple-900"
                              >
                                
                              </button>
                            </div>
                            <textarea
                              value={evaluationDraft}
                              onChange={(e) => setEvaluationDraft(e.target.value)}
                              rows={5}
                              className="w-full bg-white border border-purple-200 rounded-lg p-2.5 text-xs text-neutral-800 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <p className="text-[9px] text-purple-700 italic">Review or customize the evaluation above prior to approving.</p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        {activeRejectionId === item.id ? (
                          <div className="space-y-2 pt-2 border-t border-neutral-200">
                            <label className="block text-[9px] font-bold text-red-700 uppercase">Reason for Rejection *</label>
                            <input
                              type="text"
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="Provide feedback on photo or payment issue..."
                              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                            <div className="flex justify-end gap-2 text-xs">
                              <button
                                onClick={() => {
                                  setActiveRejectionId(null);
                                  setRejectionReason("");
                                }}
                                className="bg-neutral-100 hover:bg-neutral-200 px-3 py-1 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleReject(item.id)}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded font-bold"
                              >
                                Send Rejection
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2 border-t pt-3">
                            <button
                              onClick={() => handleGenerateAiContractEvaluation(item)}
                              disabled={isDraftingEvaluation && activeDraftItemId === item.id}
                              className="bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-purple-200 cursor-pointer flex items-center gap-1"
                            >
                              {isDraftingEvaluation && activeDraftItemId === item.id ? " Drafting Evaluation..." : " AI Draft Evaluation"}
                            </button>
                            <button
                              onClick={() => setActiveRejectionId(item.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-red-200 cursor-pointer"
                            >
                               {lang === "en" ? "Reject" : "Kataa"}
                            </button>
                            <button
                              onClick={() => handleApprove(item.id)}
                              className="bg-[#00A651] hover:bg-[#008d43] text-white text-[11px] font-bold px-4 py-1.5 rounded-lg shadow-2xs cursor-pointer"
                            >
                               {lang === "en" ? "Approve & Update ID" : "Idhinisha & Sasisha Kadi"}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historical Reviewed Log Card */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-2xs space-y-4">
                <h3 className="text-xs font-black text-neutral-900 border-b pb-2 uppercase tracking-wide">
                   {lang === "en" ? "Active Approved 6-Month Contracts" : "Orodha ya Mikataba Halali Iliyoidhinishwa"}
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-neutral-600">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[10px] text-neutral-400 font-mono tracking-wider uppercase">
                        <th className="py-2">{lang === "en" ? "Member Name" : "Jina la Mwanachama"}</th>
                        <th className="py-2">{lang === "en" ? "Role" : "Nafasi"}</th>
                        <th className="py-2">{lang === "en" ? "Approved Date" : "Siku ya Kuidhinishwa"}</th>
                        <th className="py-2">{lang === "en" ? "Expiry Date" : "Mwisho wa Mkataba"}</th>
                        <th className="py-2 text-right">{lang === "en" ? "Fee" : "Ada"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renewals.filter(r => r.status === "approved").length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center italic text-neutral-400">
                            {lang === "en" ? "No approved renewals logged." : "Hakuna mikataba iliyoidhinishwa bado."}
                          </td>
                        </tr>
                      ) : (
                        renewals.filter(r => r.status === "approved").map(item => (
                          <tr key={item.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                            <td className="py-2.5 font-bold text-neutral-900 flex items-center gap-2">
                              <img 
                                src={item.photoUrl} 
                                alt="" 
                                className="w-6 h-6 rounded-full object-cover border"
                                referrerPolicy="no-referrer"
                              />
                              <span>{item.userName}</span>
                            </td>
                            <td className="py-2.5 text-neutral-500">{item.userRole}</td>
                            <td className="py-2.5 font-mono text-neutral-500">{item.reviewedDate || item.submissionDate}</td>
                            <td className="py-2.5 font-mono text-emerald-600 font-bold">{item.expiryDate || "N/A"}</td>
                            <td className="py-2.5 font-mono text-neutral-950 font-bold text-right">Kshs {settings.renewalFee}</td>
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
    </div>
  );
}
