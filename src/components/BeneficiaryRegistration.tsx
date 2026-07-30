import React from "react";
import { Sparkles, Save, Search, FolderOpen } from "lucide-react";
import { Beneficiary } from "../types";

interface BeneficiaryRegistrationProps {
  lang: "en" | "sw";
}

export default function BeneficiaryRegistration({ lang }: BeneficiaryRegistrationProps) {
  const [beneficiaries, setBeneficiaries] = React.useState<Beneficiary[]>([]);
  const [loadingList, setLoadingList] = React.useState<boolean>(true);
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  
  // Form fields
  const [fullName, setFullName] = React.useState<string>("");
  const [dateOfBirth, setDateOfBirth] = React.useState<string>("");
  const [guardianName, setGuardianName] = React.useState<string>("");
  const [guardianPhone, setGuardianPhone] = React.useState<string>("");
  const [location, setLocation] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");
  const [isAiDrafting, setIsAiDrafting] = React.useState<boolean>(false);

  const handleGenerateBeneficiaryIntakeAiDraft = async () => {
    setIsAiDrafting(true);
    try {
      const res = await fetch("/api/document_templates/generate_draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Beneficiary Name: ${fullName || "Youth Participant"}
DOB: ${dateOfBirth || "N/A"}
Guardian: ${guardianName || "N/A"} (${guardianPhone || "N/A"})
Location: ${location || "Kiambiu, Nairobi"}
Initial Intake Context: ${notes || "Participating in youth theatre & creative mentorship workshops."}`,
          docType: "beneficiary_intake",
          title: `Intake Narrative - ${fullName || "Beneficiary"}`
        })
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setNotes(data.draft);
      } else {
        throw new Error(data.error || "Failed to draft intake narrative.");
      }
    } catch (err: any) {
      alert("AI Intake Narrative Draft failed: " + err.message);
    } finally {
      setIsAiDrafting(false);
    }
  };

  // Feedback states
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const fetchBeneficiaries = async () => {
    try {
      setLoadingList(true);
      const res = await fetch("/api/beneficiaries");
      if (res.ok) {
        const data = await res.json();
        setBeneficiaries(data);
      } else {
        console.error("Failed to fetch beneficiaries");
      }
    } catch (err) {
      console.error("Error loading beneficiaries:", err);
    } finally {
      setLoadingList(false);
    }
  };

  React.useEffect(() => {
    fetchBeneficiaries();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!fullName || !dateOfBirth || !guardianName || !guardianPhone || !location) {
      setErrorMsg(
        lang === "en"
          ? "Please fill in all required fields marked with *."
          : "Tafadhali jaza nyanja zote zinazohitajika zilizoashiriwa na *."
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/beneficiaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          dateOfBirth,
          guardianName,
          guardianPhone,
          location,
          notes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(
          lang === "en"
            ? `Beneficiary "${fullName}" registered successfully! ID: ${data.beneficiaryId}`
            : `Mfaidika "${fullName}" amesajiliwa kikamilifu! ID: ${data.beneficiaryId}`
        );
        // Clear fields
        setFullName("");
        setDateOfBirth("");
        setGuardianName("");
        setGuardianPhone("");
        setLocation("");
        setNotes("");
        // Reload list
        fetchBeneficiaries();
      } else {
        setErrorMsg(data.error || (lang === "en" ? "Failed to register beneficiary." : "Imeshindwa kusajili mfaidika."));
      }
    } catch (err: any) {
      setErrorMsg(err.message || (lang === "en" ? "Server connection error." : "Itifaki ya muunganisho imefeli."));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const query = searchQuery.toLowerCase();
    return (
      b.fullName.toLowerCase().includes(query) ||
      b.guardianName.toLowerCase().includes(query) ||
      b.guardianPhone.toLowerCase().includes(query) ||
      b.location.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 text-left">
      {/* Tab Header Banner */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-red-600 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
              {lang === "en" ? "INTERNAL PORTAL TOOL" : "KAZI YA NDANI YA PORTAL"}
            </span>
            <h2 className="text-xl font-black text-neutral-900 mt-1.5 font-sans">
              {lang === "en" ? "Beneficiary Directory & Registration" : "Sajili Mfaidika Mpya"}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {lang === "en"
                ? "Register and manage community beneficiaries for mental health, GBV recovery support, and art therapy programs."
                : "Sajili na udhibiti wafaidika wa kijamii kwa miradi ya afya ya akili, kupambana na GBV, na mafunzo ya sanaa."}
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800 max-w-sm">
            <span className="font-bold">️ {lang === "en" ? "System Policy" : "Sera ya Mfumo"}:</span>{" "}
            {lang === "en"
              ? "Beneficiary records are for tracking and safeguarding only. This does NOT create a login-capable account or member profile."
              : "Kumbukumbu za wafaidika ni za ufuatiliaji tu. Hii HAITANZI akaunti ya kuingia kwenye mfumo au wasifu wa kujiunga."}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Form Container */}
        <div className="xl:col-span-5">
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-4"
          >
            <h3 className="text-xs font-black text-neutral-900 font-sans uppercase tracking-wider border-b border-neutral-100 pb-2">
              {lang === "en" ? "Beneficiary Registration Form" : "Fomu ya Kusajili Mfaidika"}
            </h3>

            {successMsg && (
              <div className="bg-green-50 border border-green-200 text-green-800 text-xs font-bold rounded-lg p-3">
                {successMsg}
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-lg p-3">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-neutral-500 mb-1">
                  {lang === "en" ? "Full Name *" : "Majina Kamili *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === "en" ? "e.g., John Kamau" : "Mfano, John Kamau"}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-xs bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 rounded-lg p-2.5 outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-neutral-500 mb-1">
                  {lang === "en" ? "Date of Birth *" : "Tarehe ya Kuzaliwa *"}
                </label>
                <input
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full text-xs bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 rounded-lg p-2.5 outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-neutral-500 mb-1">
                  {lang === "en" ? "Guardian/Parent Name *" : "Jina la Mlezi/Mzazi *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === "en" ? "e.g., Jane Wanjiku" : "Mfano, Jane Wanjiku"}
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full text-xs bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 rounded-lg p-2.5 outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-neutral-500 mb-1">
                  {lang === "en" ? "Guardian Phone Number *" : "Namba ya Simu ya Mlezi *"}
                </label>
                <input
                  type="tel"
                  required
                  placeholder={lang === "en" ? "e.g., +254 712 345678" : "Mfano, +254 712 345678"}
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  className="w-full text-xs bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 rounded-lg p-2.5 outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-neutral-500 mb-1">
                  {lang === "en" ? "Kiambiu Location/Estate *" : "Eneo/Mtaa wa Kiambiu *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === "en" ? "e.g., Kamola, Kisumu Ndogo" : "Mfano, Kamola, Kisumu Ndogo"}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full text-xs bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 rounded-lg p-2.5 outline-none font-sans"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-black uppercase text-neutral-500">
                    {lang === "en" ? "Case/Support Notes" : "Maelezo ya Kesi/Msaada"}
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateBeneficiaryIntakeAiDraft}
                    disabled={isAiDrafting}
                    className="text-[10px] font-extrabold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Sparkles size={12} />
                    {isAiDrafting ? "Drafting Intake..." : "AI Draft Intake Notes"}
                  </button>
                </div>
                <textarea
                  rows={5}
                  placeholder={
                    lang === "en"
                      ? "Add medical history, creative therapy program mapping, or specific vulnerability notes..."
                      : "Ongeza maelezo ya afya, ushiriki wa sanaa, au mahitaji maalum..."
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 rounded-lg p-2.5 outline-none font-sans leading-relaxed"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#E31E24] hover:bg-red-700 text-white font-bold text-xs py-3 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                  <span>{lang === "en" ? "Submitting..." : "Inatuma..."}</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>{lang === "en" ? "Register Beneficiary" : "Sajili Mfaidika"}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* List Directory Container */}
        <div className="xl:col-span-7 flex flex-col space-y-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs flex-grow flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-xs font-black text-neutral-900 font-sans uppercase tracking-wider">
                {lang === "en" ? "Registered Beneficiaries Directory" : "Katalogi ya Wafaidika Waliomsajiliwa"}
              </h3>
              
              {/* Search Bar */}
              <div className="relative max-w-xs w-full">
                <input
                  type="text"
                  placeholder={lang === "en" ? "Search directory..." : "Tafuta katalogi..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs bg-neutral-50 focus:bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 outline-none font-sans"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-neutral-400" />
              </div>
            </div>

            <div className="flex-grow overflow-x-auto min-h-[300px]">
              {loadingList ? (
                <div className="h-full flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-2 border-[#E31E24] border-t-transparent animate-spin mb-3"></div>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider font-mono">
                    {lang === "en" ? "Loading Directory..." : "Inapakia Katalogi..."}
                  </p>
                </div>
              ) : filteredBeneficiaries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 border-2 border-dashed border-neutral-100 rounded-xl">
                  <FolderOpen size={28} className="text-neutral-400 mb-2" />
                  <p className="text-xs font-bold text-neutral-400">
                    {lang === "en" ? "No beneficiaries found." : "Hakuna wafaidika waliopatikana."}
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    {lang === "en" ? "Try adjusting your search criteria." : "Jaribu kubadilisha neno la utafutaji."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBeneficiaries.map((b) => (
                    <div
                      key={b.id}
                      className="border border-neutral-100 hover:border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 rounded-xl p-4 transition-all text-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                    >
                      <div className="space-y-1.5 text-left">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-black text-neutral-900 font-sans">
                            {b.fullName}
                          </strong>
                          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700">
                            ID: {b.id.slice(0, 8)}...
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-neutral-600 font-sans text-[11px]">
                          <p>
                            <span className="text-neutral-400 font-bold uppercase text-[9px] mr-1 font-mono">DOB:</span>{" "}
                            {new Date(b.dateOfBirth).toLocaleDateString(lang === "en" ? "en-KE" : "sw-KE")}
                          </p>
                          <p>
                            <span className="text-neutral-400 font-bold uppercase text-[9px] mr-1 font-mono">Location:</span>{" "}
                            {b.location}
                          </p>
                          <p>
                            <span className="text-neutral-400 font-bold uppercase text-[9px] mr-1 font-mono">Guardian:</span>{" "}
                            {b.guardianName}
                          </p>
                          <p>
                            <span className="text-neutral-400 font-bold uppercase text-[9px] mr-1 font-mono">Phone:</span>{" "}
                            {b.guardianPhone}
                          </p>
                        </div>
                        {b.notes && (
                          <div className="bg-neutral-100/50 border border-neutral-200/40 rounded-lg p-2.5 mt-2 max-w-xl text-[11px] text-neutral-600 leading-relaxed italic">
                            &ldquo;{b.notes}&rdquo;
                          </div>
                        )}
                      </div>
                      <div className="sm:text-right flex flex-col justify-between h-full text-[10px] text-neutral-400 font-mono">
                        <p className="font-bold">
                          {lang === "en" ? "REGISTERED BY" : "ALISAJILIWA NA"}
                        </p>
                        <p className="text-neutral-700 font-bold mt-0.5">{b.registeredBy}</p>
                        <p className="mt-1">
                          {new Date(b.registeredDate).toLocaleDateString(lang === "en" ? "en-KE" : "sw-KE")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
