import React from "react";
import { UserProfile, LeaveRequest, ContractRenewal, LeadershipAppointment, getCanonicalRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import {
  User, Save, Loader2, CheckCircle2, AlertCircle, Calendar, Plus,
  Clock, FileText, Award, Briefcase, X, Check, Users
} from "lucide-react";

interface MemberSelfServicePanelProps {
  currentUser: UserProfile;
  lang: "en" | "sw";
  onRefreshUser?: () => void;
}

const t = {
  en: {
    tabProfile: "My Profile", tabLeave: "Leave Requests", tabRecords: "My Records",
    profileTitle: "Edit Your Contact Details", profileDesc: "Keep your contact info and skills up to date. Your role, member number, and status can only be changed by staff.",
    name: "Full Name", email: "Email Address", phone: "Phone Number", skills: "Skills (comma-separated)",
    emergencyName: "Emergency Contact Name", emergencyPhone: "Emergency Contact Phone", emergencyRelationship: "Relationship",
    saveProfile: "Save Changes", saving: "Saving...", saved: "Profile updated.",
    leaveTitle: "Leave Requests", leaveDesc: "Request time off and track approval status.",
    newRequest: "New Leave Request", startDate: "Start Date", endDate: "End Date", reason: "Reason",
    submitRequest: "Submit Request", cancel: "Cancel", noRequests: "You haven't submitted any leave requests yet.",
    statusPending: "Pending", statusApproved: "Approved", statusRejected: "Rejected",
    recordsTitle: "My Records", recordsDesc: "A read-only summary of your membership records.",
    contractStatus: "Contract / Renewal Status", noContract: "No renewal record on file yet.",
    leadershipTitle: "Leadership Appointments", noLeadership: "No leadership appointments on record.",
    paymentStatus: "Payment Status", submittedOn: "Submitted",
    respondedBy: "Reviewed by",
    teamRequestsTitle: "Team Leave Requests Awaiting Your Decision",
    noTeamRequests: "No pending leave requests from the team right now.",
    approve: "Approve", reject: "Reject"
  },
  sw: {
    tabProfile: "Wasifu Wangu", tabLeave: "Maombi ya Likizo", tabRecords: "Rekodi Zangu",
    profileTitle: "Hariri Maelezo Yako ya Mawasiliano", profileDesc: "Hakikisha maelezo yako ya mawasiliano na ujuzi yako sawa. Jukumu, nambari ya uanachama, na hali yako vinaweza kubadilishwa na wafanyakazi pekee.",
    name: "Jina Kamili", email: "Barua Pepe", phone: "Nambari ya Simu", skills: "Ujuzi (tenganisha kwa koma)",
    emergencyName: "Jina la Dharura", emergencyPhone: "Simu ya Dharura", emergencyRelationship: "Uhusiano",
    saveProfile: "Hifadhi Mabadiliko", saving: "Inahifadhi...", saved: "Wasifu umesasishwa.",
    leaveTitle: "Maombi ya Likizo", leaveDesc: "Omba likizo na ufuatilie hali ya idhini.",
    newRequest: "Ombi Jipya la Likizo", startDate: "Tarehe ya Kuanza", endDate: "Tarehe ya Mwisho", reason: "Sababu",
    submitRequest: "Wasilisha Ombi", cancel: "Ghairi", noRequests: "Bado hujawasilisha ombi lolote la likizo.",
    statusPending: "Inasubiri", statusApproved: "Imeidhinishwa", statusRejected: "Imekataliwa",
    recordsTitle: "Rekodi Zangu", recordsDesc: "Muhtasari wa rekodi zako za uanachama (kusoma tu).",
    contractStatus: "Hali ya Mkataba / Upyaji", noContract: "Hakuna rekodi ya upyaji bado.",
    leadershipTitle: "Uteuzi wa Uongozi", noLeadership: "Hakuna rekodi ya uteuzi wa uongozi.",
    paymentStatus: "Hali ya Malipo", submittedOn: "Iliwasilishwa",
    respondedBy: "Ilipitiwa na",
    teamRequestsTitle: "Maombi ya Likizo ya Timu Yanayosubiri Uamuzi Wako",
    noTeamRequests: "Hakuna maombi ya likizo yanayosubiri kutoka kwa timu kwa sasa.",
    approve: "Idhinisha", reject: "Kataa"
  }
};

export default function MemberSelfServicePanel({ currentUser, lang, onRefreshUser }: MemberSelfServicePanelProps) {
  const tt = t[lang];
  const [tab, setTab] = React.useState<"profile" | "leave" | "records">("profile");

  const [name, setName] = React.useState(currentUser.name);
  const [email, setEmail] = React.useState(currentUser.email);
  const [phone, setPhone] = React.useState(currentUser.phone);
  const [skillsText, setSkillsText] = React.useState((currentUser.skills || []).join(", "));
  const [emergName, setEmergName] = React.useState(currentUser.emergencyContact?.name || "");
  const [emergPhone, setEmergPhone] = React.useState(currentUser.emergencyContact?.phone || "");
  const [emergRel, setEmergRel] = React.useState(currentUser.emergencyContact?.relationship || "");
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState("");
  const [saveErr, setSaveErr] = React.useState("");

  const [leaveRequests, setLeaveRequests] = React.useState<LeaveRequest[]>([]);
  const [showLeaveForm, setShowLeaveForm] = React.useState(false);
  const [leaveStart, setLeaveStart] = React.useState("");
  const [leaveEnd, setLeaveEnd] = React.useState("");
  const [leaveReason, setLeaveReason] = React.useState("");
  const [leaveSubmitting, setLeaveSubmitting] = React.useState(false);
  const [leaveErr, setLeaveErr] = React.useState("");

  const [myContractRenewal, setMyContractRenewal] = React.useState<ContractRenewal | null>(null);
  const [myAppointments, setMyAppointments] = React.useState<LeadershipAppointment[]>([]);

  const userRoleKey = currentUser.roleKey || getCanonicalRoleKey(currentUser.role);
  const canApproveLeave = ["chairperson", "vice_chairperson"].includes(userRoleKey);
  const [teamRequests, setTeamRequests] = React.useState<LeaveRequest[]>([]);
  const [respondingId, setRespondingId] = React.useState<string | null>(null);

  // ----- Server-authoritative data loading -----
  // The frontend NEVER trusts localStorage for leave status. Every action goes through
  // the server API and the UI refetches the authoritative record.

  const loadMyLeave = React.useCallback(async () => {
    try {
      const res = await fetch("/api/leave_requests/my", {
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setLeaveRequests(data);
    } catch (err: any) {
      setLeaveErr(err.message || "Failed to load leave requests");
    }
  }, []);

  const loadTeamLeave = React.useCallback(async () => {
    if (!canApproveLeave) return;
    try {
      const res = await fetch("/api/leave_requests", {
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setTeamRequests(data.filter((l: LeaveRequest) => l.userId !== currentUser.id && (l.status === "pending" || l.status === "submitted" || l.status === "under_review")));
    } catch (err: any) {
      setLeaveErr(err.message || "Failed to load team leave requests");
    }
  }, [canApproveLeave, currentUser.id]);

  const loadLeaveData = React.useCallback(() => {
    loadMyLeave();
    if (canApproveLeave) loadTeamLeave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMyLeave, loadTeamLeave, canApproveLeave]);

  // Server-authoritative decision handler
  const handleRespondToLeave = async (req: LeaveRequest, decision: "approved" | "rejected") => {
    setRespondingId(req.id);
    setLeaveErr("");
    try {
      const res = await fetch(`/api/leave_requests/${req.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: decision === "rejected" ? "Rejected by administrator" : undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Server returned ${res.status}`);
      }
      // Refetch authoritative data — never trust optimistic local state
      loadLeaveData();
    } catch (err: any) {
      setLeaveErr(err.message || "Failed to process decision");
    } finally {
      setRespondingId(null);
    }
  };

  React.useEffect(() => {
    loadLeaveData();
    const renewals = StorageService.getContractRenewals().filter(r => r.userId === currentUser.id);
    setMyContractRenewal(renewals.length ? renewals[renewals.length - 1] : null);
    setMyAppointments(StorageService.getLeadershipAppointments().filter(a => a.profileId === currentUser.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    setSaveErr("");
    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, phone,
          skills: skillsText.split(",").map(s => s.trim()).filter(Boolean),
          emergencyContact: { name: emergName, phone: emergPhone, relationship: emergRel }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaveMsg(tt.saved);
      onRefreshUser?.();
      setTimeout(() => setSaveMsg(""), 4000);
    } catch (err: any) {
      setSaveErr(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd || !leaveReason.trim()) return;
    setLeaveSubmitting(true);
    setLeaveErr("");
    try {
      const res = await fetch("/api/leave_requests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: leaveReason.trim(),
          leaveType: "annual"
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Server returned ${res.status}`);
      }
      // Refetch authoritative data from server
      loadLeaveData();
      setShowLeaveForm(false);
      setLeaveStart(""); setLeaveEnd(""); setLeaveReason("");
    } catch (err: any) {
      setLeaveErr(err.message || (lang === "en" ? "Failed to submit leave request." : "Imeshindwa kuwasilisha ombi la likizo."));
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: "bg-amber-100", text: "text-amber-700", label: tt.statusPending },
      submitted: { bg: "bg-amber-100", text: "text-amber-700", label: tt.statusPending },
      under_review: { bg: "bg-blue-100", text: "text-blue-700", label: lang === "en" ? "Under Review" : "Inapitiwa" },
      approved: { bg: "bg-emerald-100", text: "text-emerald-700", label: tt.statusApproved },
      rejected: { bg: "bg-red-100", text: "text-red-700", label: tt.statusRejected },
      cancelled: { bg: "bg-neutral-100", text: "text-neutral-600", label: lang === "en" ? "Cancelled" : "Imeghairiwa" },
      on_leave: { bg: "bg-purple-100", text: "text-purple-700", label: lang === "en" ? "On Leave" : "Kwenye Likizo" },
      completed: { bg: "bg-neutral-100", text: "text-neutral-600", label: lang === "en" ? "Completed" : "Imekamilika" }
    };
    const s = map[status] || map.pending;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 border-b border-neutral-100 pb-0">
        {[
          { key: "profile", label: tt.tabProfile, icon: User },
          { key: "leave", label: tt.tabLeave, icon: Calendar },
          { key: "records", label: tt.tabRecords, icon: FileText }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
              tab === key ? "bg-red-600 text-white" : "text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <form onSubmit={handleSaveProfile} className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4 max-w-xl">
          <div>
            <h3 className="text-sm font-black text-neutral-900">{tt.profileTitle}</h3>
            <p className="text-xs text-neutral-500 mt-1">{tt.profileDesc}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">{tt.name}</label>
              <input value={name} onChange={e => setName(e.target.value)} required className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">{tt.email}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">{tt.phone}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} required className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">{tt.skills}</label>
              <input value={skillsText} onChange={e => setSkillsText(e.target.value)} placeholder="acting, singing, sound design" className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-100">
            <p className="text-[10px] font-bold uppercase text-neutral-500 mb-2">Emergency Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <input value={emergName} onChange={e => setEmergName(e.target.value)} placeholder={tt.emergencyName} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <input value={emergPhone} onChange={e => setEmergPhone(e.target.value)} placeholder={tt.emergencyPhone} className="border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
              <input value={emergRel} onChange={e => setEmergRel(e.target.value)} placeholder={tt.emergencyRelationship} className="border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
            </div>
          </div>

          {saveErr && <p className="text-[11px] text-red-600 flex items-center gap-1.5"><AlertCircle size={12} /> {saveErr}</p>}
          {saveMsg && <p className="text-[11px] text-green-600 flex items-center gap-1.5"><CheckCircle2 size={12} /> {saveMsg}</p>}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? tt.saving : tt.saveProfile}
          </button>
        </form>
      )}

      {tab === "leave" && (
        <div className="space-y-3 max-w-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-neutral-900">{tt.leaveTitle}</h3>
              <p className="text-xs text-neutral-500 mt-1">{tt.leaveDesc}</p>
            </div>
            {!showLeaveForm && (
              <button
                onClick={() => setShowLeaveForm(true)}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={12} /> {tt.newRequest}
              </button>
            )}
          </div>

          {showLeaveForm && (
            <form onSubmit={handleSubmitLeave} className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">{tt.startDate}</label>
                  <input type="date" required value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">{tt.endDate}</label>
                  <input type="date" required value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">{tt.reason}</label>
                <textarea required value={leaveReason} onChange={e => setLeaveReason(e.target.value)} rows={2} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              {leaveErr && <p className="text-[11px] text-red-600">{leaveErr}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowLeaveForm(false)} className="px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:bg-neutral-50 rounded-lg cursor-pointer">{tt.cancel}</button>
                <button type="submit" disabled={leaveSubmitting} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer">{tt.submitRequest}</button>
              </div>
            </form>
          )}

          {canApproveLeave && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase text-blue-700 tracking-wider flex items-center gap-1.5">
                <Users size={12} /> {tt.teamRequestsTitle}
              </p>
              {teamRequests.length === 0 ? (
                <p className="text-xs text-blue-400">{tt.noTeamRequests}</p>
              ) : (
                <div className="space-y-2">
                  {teamRequests.map(req => (
                    <div key={req.id} className="bg-white border border-blue-100 rounded-lg p-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-neutral-800">{req.userName}</p>
                        <p className="text-[11px] text-neutral-500">{req.startDate} → {req.endDate}</p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">{req.reason}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRespondToLeave(req, "approved")}
                          disabled={respondingId === req.id}
                          className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
                          title={tt.approve}
                        >
                          {respondingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        </button>
                        <button
                          onClick={() => handleRespondToLeave(req, "rejected")}
                          disabled={respondingId === req.id}
                          className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg cursor-pointer disabled:opacity-50"
                          title={tt.reject}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {leaveRequests.length === 0 ? (
              <p className="text-xs text-neutral-500 py-6 text-center">{tt.noRequests}</p>
            ) : (
              leaveRequests.map(lr => (
                <div key={lr.id} className="bg-white border border-neutral-200 rounded-lg p-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <Clock size={11} className="text-neutral-500" /> {lr.startDate} → {lr.endDate}
                    </p>
                    {lr.reference && <p className="text-[10px] text-neutral-400 mt-0.5">{lr.reference}</p>}
                    <p className="text-[11px] text-neutral-500 mt-1">{lr.reason}</p>
                    {lr.respondedBy && <p className="text-[10px] text-neutral-500 mt-1">{tt.respondedBy}: {lr.respondedBy}</p>}
                  </div>
                  {statusBadge(lr.status)}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "records" && (
        <div className="space-y-4 max-w-xl">
          <div>
            <h3 className="text-sm font-black text-neutral-900">{tt.recordsTitle}</h3>
            <p className="text-xs text-neutral-500 mt-1">{tt.recordsDesc}</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase text-neutral-500 mb-2 flex items-center gap-1.5"><FileText size={12} /> {tt.contractStatus}</p>
            {myContractRenewal ? (
              <div className="text-xs space-y-1">
                <p className="flex items-center gap-2">
                  <span className="text-neutral-500">{tt.submittedOn}:</span> {myContractRenewal.submissionDate}
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-neutral-500">{tt.paymentStatus}:</span>
                  <span className={`font-bold ${myContractRenewal.paymentStatus === "paid" ? "text-emerald-600" : "text-amber-600"}`}>
                    {myContractRenewal.paymentStatus}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-neutral-500">Status:</span> {statusBadge(myContractRenewal.status === "pending_review" ? "pending" : myContractRenewal.status)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">{tt.noContract}</p>
            )}
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase text-neutral-500 mb-2 flex items-center gap-1.5"><Award size={12} /> {tt.leadershipTitle}</p>
            {myAppointments.length > 0 ? (
              <div className="space-y-2">
                {myAppointments.map(a => (
                  <div key={a.id} className="text-xs flex items-center gap-2">
                    <Briefcase size={11} className="text-neutral-500" />
                    <span className="font-bold">{a.role}</span>
                    <span className="text-neutral-500">— {a.appointmentDate}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500">{tt.noLeadership}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
