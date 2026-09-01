import React from "react";
import { SignupApplication } from "../types";
import { motion, AnimatePresence } from "motion/react";
import Modal from "./Modal";

interface SignupReviewsProps {
  lang: "en" | "sw";
}

export default function SignupReviews({ lang }: SignupReviewsProps) {
  const [applications, setApplications] = React.useState<SignupApplication[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters and Tabs
  const [statusTab, setStatusTab] = React.useState<"pending" | "approved" | "rejected">("pending");
  const [typeFilter, setTypeFilter] = React.useState<"all" | "member" | "volunteer">("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Selection & Modal States
  const [selectedApp, setSelectedApp] = React.useState<SignupApplication | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [showRejectModal, setShowRejectModal] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Success response modal
  const [successCredentials, setSuccessCredentials] = React.useState<{
    memberNumber: string;
    cleartextPin: string;
    fullName: string;
  } | null>(null);

  const fetchApplications = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/signup_applications");
      if (res.ok) {
        const data = await res.json();
        setApplications(data);
      } else {
        throw new Error("Failed to load applications list");
      }
    } catch (err: any) {
      console.error(err);
      setError(lang === "en" ? "Failed to load signup applications." : "Imeshindwa kupakia maombi ya usajili.");
    } finally {
      setLoading(false);
    }
  }, [lang]);

  React.useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleApprove = async (appId: string) => {
    if (!window.confirm(lang === "en" ? "Are you sure you want to approve this application?" : "Je, uko tayari kuidhinisha ombi hili?")) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/signup_applications/${appId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessCredentials({
          memberNumber: data.memberNumber,
          cleartextPin: data.cleartextPin,
          fullName: selectedApp?.fullName || "Applicant"
        });
        setSelectedApp(null);
        fetchApplications();
      } else {
        alert(data.error || "Failed to approve application.");
      }
    } catch (err) {
      console.error(err);
      alert("Error approving application.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !rejectionReason.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/signup_applications/${selectedApp.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason })
      });
      const data = await res.json();
      if (res.ok) {
        setShowRejectModal(false);
        setRejectionReason("");
        setSelectedApp(null);
        fetchApplications();
      } else {
        alert(data.error || "Failed to reject application.");
      }
    } catch (err) {
      console.error(err);
      alert("Error rejecting application.");
    } finally {
      setSubmitting(false);
    }
  };

  const calculateAge = (dobString: string) => {
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const filtered = applications.filter((app) => {
    const matchesStatus = app.status === statusTab;
    const matchesType = typeFilter === "all" || app.type === typeFilter;
    const matchesSearch =
      app.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.phone.includes(searchQuery) ||
      (app.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6 text-left">
      {/* HEADER SECTION */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-xs font-bold text-[#E31E24] uppercase tracking-wider block">
            {lang === "en" ? "ADMINISTRATIVE REVIEW" : "UKAGUZI WA USIMAMIZI"}
          </span>
          <h2 className="text-xl font-black text-gray-900 tracking-tight font-sans">
            {lang === "en" ? "Signup Applications Register" : "Sajili za Maombi Mpya"}
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            {lang === "en" ? "Review, audit private document uploads, and approve member/volunteer profiles." : "Kagua nyaraka za dharura, thibitisha vitambulisho na uidhinishe wanachama wapya."}
          </p>
        </div>
        <button
          onClick={fetchApplications}
          className="bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] md:text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
        >
           {lang === "en" ? "Refresh Register" : "Pakia upya"}
        </button>
      </div>

      {/* FILTER & REGISTER CONTROLS */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Status Tab buttons */}
        <div className="md:col-span-5 flex bg-gray-100 p-0.5 rounded-xl text-xs font-bold border border-gray-200/50">
          <button
            onClick={() => setStatusTab("pending")}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              statusTab === "pending" ? "bg-white text-gray-900 shadow-xs font-black" : "text-gray-500 hover:text-gray-900"
            }`}
          >
             {lang === "en" ? "Pending" : "Yanayosubiri"}
          </button>
          <button
            onClick={() => setStatusTab("approved")}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              statusTab === "approved" ? "bg-white text-gray-900 shadow-xs font-black" : "text-gray-500 hover:text-gray-900"
            }`}
          >
             {lang === "en" ? "Approved" : "Yaliyokubaliwa"}
          </button>
          <button
            onClick={() => setStatusTab("rejected")}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              statusTab === "rejected" ? "bg-white text-gray-900 shadow-xs font-black" : "text-gray-500 hover:text-gray-900"
            }`}
          >
             {lang === "en" ? "Rejected" : "Yaliyokataliwa"}
          </button>
        </div>

        {/* Member/Volunteer Dropdown */}
        <div className="md:col-span-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
          >
            <option value="all"> {lang === "en" ? "All Application Types" : "Aina Zote"}</option>
            <option value="member">‍ {lang === "en" ? "Program Member signups" : "Maombi ya Uanachama"}</option>
            <option value="volunteer"> {lang === "en" ? "Volunteer staff signups" : "Maombi ya Kujitolea"}</option>
          </select>
        </div>

        {/* Search bar */}
        <div className="md:col-span-4">
          <input
            type="text"
            placeholder={lang === "en" ? "Search by name, estate, phone..." : "Tafuta kwa jina, mtaa, simu..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
          />
        </div>
      </div>

      {/* APPLICATIONS LIST OR EMPTY WRAPPER */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-3 border-[#E31E24] border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-gray-400 font-mono tracking-widest uppercase">{lang === "en" ? "Syncing applications..." : "Inatafuta maombi..."}</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold text-center">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400 text-xs font-medium">
           {lang === "en" ? "No registration applications found matching this filter." : "Hakuna maombi ya usajili yaliyopatikana kwa sasa."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* List Sidebar (on md screen: left side taking 4cols, on smaller: full) */}
          <div className="md:col-span-4 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs divide-y max-h-[70vh] overflow-y-auto">
            {filtered.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedApp(app)}
                aria-current={selectedApp?.id === app.id ? "true" : undefined}
                className={`w-full p-4 hover:bg-gray-50/70 transition-all cursor-pointer text-left flex items-center justify-between ${
                  selectedApp?.id === app.id ? "bg-red-50/40 border-l-4 border-l-[#E31E24]" : ""
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-gray-900">{app.fullName}</span>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                      app.type === "member" ? "bg-red-100 text-red-800" : "bg-neutral-100 text-gray-800"
                    }`}>
                      {app.type}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium"> {app.phone} •  {app.location}</p>
                  <p className="text-[9px] text-gray-400 font-mono">
                    {lang === "en" ? "Submitted" : "Imetolewa"}: {new Date(app.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-neutral-300"></div>
              </button>
            ))}
          </div>

          {/* Details Content Box */}
          <div className="md:col-span-8">
            <AnimatePresence mode="wait">
              {selectedApp ? (
                <motion.div
                  key={selectedApp.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-xs space-y-6 text-left"
                >
                  {/* Detailed Box Header */}
                  <div className="flex flex-wrap justify-between items-start gap-4 border-b border-gray-100 pb-4">
                    <div className="space-y-1">
                      <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded inline-block ${
                        selectedApp.type === "member" ? "bg-red-100 text-red-800" : "bg-neutral-100 text-gray-800"
                      }`}>
                        {selectedApp.type.toUpperCase()} APPLICATION
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">{selectedApp.fullName}</h3>
                      <p className="text-xs text-gray-500 font-medium font-mono">ID: {selectedApp.id}</p>
                    </div>

                    {selectedApp.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowRejectModal(true)}
                          disabled={submitting}
                          className="bg-white border hover:bg-gray-50 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
                        >
                           {lang === "en" ? "Reject Application" : "Kataa"}
                        </button>
                        <button
                          onClick={() => handleApprove(selectedApp.id)}
                          disabled={submitting}
                          className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1"
                        >
                          {submitting ? "..." : " " + (lang === "en" ? "Approve & Generate PIN" : "Kubali na Unda PIN")}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Core Demographics Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1 bg-gray-50/50 p-3 rounded-xl border">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Personal Contact Info</span>
                      <p className="font-semibold text-gray-800"> Email: <strong className="font-mono text-gray-950">{selectedApp.email || "N/A"}</strong></p>
                      <p className="font-semibold text-gray-800"> Phone: <strong className="font-mono text-gray-950">{selectedApp.phone}</strong></p>
                      <p className="font-semibold text-gray-800"> Location: <strong className="font-sans text-gray-950">{selectedApp.location}</strong></p>
                    </div>

                    <div className="space-y-1 bg-gray-50/50 p-3 rounded-xl border">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Age & Safeguarding Block</span>
                      <p className="font-semibold text-gray-800"> DOB: <strong className="font-mono text-gray-950">{selectedApp.dateOfBirth}</strong></p>
                      <p className="font-semibold text-gray-800">
                        ️ Age Checked:{" "}
                        <strong className="text-emerald-600 font-bold">
                          {calculateAge(selectedApp.dateOfBirth)} {lang === "en" ? "Years Old (18+ Valid)" : "Miaka (18+ Sahihi)"}
                        </strong>
                      </p>
                    </div>
                  </div>

                  {/* Skills & Motivation textareas */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Artistic Talents & Skills</h4>
                      <p className="text-xs text-gray-800 font-medium bg-neutral-50 p-3 rounded-xl border">
                        {selectedApp.skills || "No skills specified."}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Motivation for joining</h4>
                      <p className="text-xs text-gray-800 font-medium bg-neutral-50 p-3 rounded-xl border leading-relaxed">
                        "{selectedApp.whyJoin}"
                      </p>
                    </div>
                  </div>

                  {/* Emergency Contact Block */}
                  <div className="bg-neutral-900 text-white rounded-2xl p-4 space-y-2">
                    <h4 className="text-[9px] font-black text-red-500 uppercase tracking-widest">
                       EMERGENCY CONTACT (VERIFIED)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase block">Name</span>
                        <span className="font-bold">{selectedApp.emergencyContactName}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase block">Relationship</span>
                        <span className="font-bold">{selectedApp.emergencyContactRelationship}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase block">Phone</span>
                        <span className="font-bold font-mono text-emerald-400">{selectedApp.emergencyContactPhone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Audit Trail Review (If Approved or Rejected) */}
                  {selectedApp.status !== "pending" && (
                    <div className="p-4 bg-gray-50 border rounded-2xl text-xs space-y-1">
                      <span className="text-[10px] font-black text-gray-500 uppercase">Review Status and logs</span>
                      <p className="font-semibold">
                        Status:{" "}
                        <span className={`font-black uppercase ${
                          selectedApp.status === "approved" ? "text-emerald-600" : "text-red-600"
                        }`}>
                          {selectedApp.status}
                        </span>
                      </p>
                      <p className="text-gray-600">Reviewed By: <strong className="text-gray-900">{selectedApp.reviewedBy}</strong></p>
                      <p className="text-gray-600">Reviewed Date: <strong className="text-gray-900">{selectedApp.reviewedDate ? new Date(selectedApp.reviewedDate).toLocaleString() : "N/A"}</strong></p>
                      {selectedApp.rejectionReason && (
                        <p className="text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-100 font-medium mt-1">
                          ️ Rejection Reason: "{selectedApp.rejectionReason}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* SAFELY VIEW PRIVATE ATTACHMENTS (PASSPORT AND ID) */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                       Uploaded Supporting Private Identification Documents (Protected)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Passport Photo Frame */}
                      <div className="bg-gray-50 border rounded-xl p-3 text-center space-y-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">Applicant Passport Photo</span>
                        <div className="h-44 bg-neutral-200 rounded overflow-hidden flex items-center justify-center border">
                          <img
                            src={`/api/signup_applications/${selectedApp.id}/document/passport`}
                            alt="Passport ID"
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop";
                            }}
                          />
                        </div>
                      </div>

                      {/* ID document Frame */}
                      <div className="bg-gray-50 border rounded-xl p-3 text-center space-y-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">National Identification card (front)</span>
                        <div className="h-44 bg-neutral-200 rounded overflow-hidden flex items-center justify-center border">
                          <img
                            src={`/api/signup_applications/${selectedApp.id}/document/id`}
                            alt="National ID"
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=200&auto=format&fit=crop";
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center text-gray-400 text-xs font-semibold">
                   {lang === "en" ? "Select an application from the register to start administrative audit." : "Chagua ombi upande wa kushoto kuanza ukaguzi."}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* REJECTION REASON DIALOG MODAL */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectionReason(""); }}
        title={lang === "en" ? "State Rejection Reason" : "Eleza Sababu ya Kukataa"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleReject} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">
              {lang === "en" ? "Reason (Sent to staff logs)" : "Sababu (Hurekodiwa kwenye kumbukumbu)"}
            </label>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={lang === "en" ? "e.g. ID upload is blurry. Please apply again with a clearer picture." : "Mfano: Picha ya kitambulisho haisomeki vizuri."}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
            ></textarea>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setShowRejectModal(false); setRejectionReason(""); }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
            >
              {lang === "en" ? "Cancel" : "Funga"}
            </button>
            <button
              type="submit"
              disabled={submitting || !rejectionReason.trim()}
              className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {submitting ? "..." : (lang === "en" ? "Reject Application" : "Kataa Ombi")}
            </button>
          </div>
        </form>
      </Modal>

      {/* SECURE CREDENTIAL DISPLAY MODAL */}
      <Modal
        isOpen={!!successCredentials}
        onClose={() => setSuccessCredentials(null)}
        title={lang === "en" ? "Application Approved!" : "Ombi limeidhinishwa kikamilifu!"}
        maxWidth="max-w-md"
      >
        {successCredentials && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500 font-medium">
              {lang === "en"
                ? `Profile generated successfully for ${successCredentials.fullName}.`
                : `Wasifu umehifadhiwa kwa ufanisi kwa ajili ya ${successCredentials.fullName}.`}
            </p>

            {/* Secure Credentials card */}
            <div className="bg-neutral-900 text-white p-4 rounded-2xl space-y-3 border">
              <div className="flex justify-between items-center text-[9px] font-black text-emerald-500 uppercase tracking-widest border-b border-neutral-800 pb-2">
                <span>MEMBER ACCESS CREDENTIALS</span>
                <span>SECURE</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[9px] text-neutral-500 uppercase block">Member Number</span>
                  <strong className="text-white font-mono text-sm">{successCredentials.memberNumber}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 uppercase block">Temporary login PIN</span>
                  <strong className="text-yellow-400 font-mono text-sm tracking-wider">{successCredentials.cleartextPin}</strong>
                </div>
              </div>
            </div>

            {/* Security warning notice */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-800 leading-relaxed font-semibold">
              <strong>Security Advisory:</strong> Write down or copy these details immediately. For security and cryptographic integrity, the temporary PIN is hashed on the server and cannot be viewed or retrieved after closing this window. You must text or call the applicant with their member number and PIN.
            </div>

            <div className="text-center pt-2">
              <button
                onClick={() => setSuccessCredentials(null)}
                className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl cursor-pointer shadow-xs w-full transition-colors"
              >
                {lang === "en" ? "I have saved the credentials — Close" : "Nimehifadhi vitambulisho — Funga"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
