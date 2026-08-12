import React from "react";
import { Users, Search, MessageSquare, Trash2, Lock, CheckCircle2, Clock, X } from "lucide-react";
import Modal from "./Modal";

interface DirectoryMember {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  roleKey?: string;
  status?: string;
  joinDate?: string;
  avatar?: string;
  memberNumber?: string;
  emergencyContact?: { name: string; phone: string; relationship: string };
  contractStatus: {
    dueDate: string;
    locked: boolean;
    daysUntilDue: number;
    paymentStatus: string;
  };
}

interface AdminMembersDirectoryProps {
  lang: "en" | "sw";
}

/** Some older profile records stored the raw roleKey (e.g. "vice_chairperson") in the
 *  display `role` field instead of a human-readable label. This is a defensive
 *  fallback so the directory never shows raw snake_case to the Chairperson — it
 *  doesn't fix the underlying data, just how it's displayed here. */
function displayRole(role: string): string {
  if (!role) return "—";
  if (/^[a-z_]+$/.test(role)) {
    return role.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  return role;
}

export default function AdminMembersDirectory({ lang }: AdminMembersDirectoryProps) {
  const [members, setMembers] = React.useState<DirectoryMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [requestTarget, setRequestTarget] = React.useState<DirectoryMember | null>(null);
  const [requestMessage, setRequestMessage] = React.useState("");
  const [sendingRequest, setSendingRequest] = React.useState(false);
  const [detailMember, setDetailMember] = React.useState<DirectoryMember | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/admin/members_directory");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load members directory");
      setMembers(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchMembers(); }, []);

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.phone || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.role || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSendRequest = async () => {
    if (!requestTarget || !requestMessage.trim()) return;
    setSendingRequest(true);
    try {
      const res = await fetch("/api/admin/request_info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: requestTarget.id, message: requestMessage.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send request");
      setRequestTarget(null);
      setRequestMessage("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSendingRequest(false);
    }
  };

  const handleDeleteProfile = async (member: DirectoryMember) => {
    if (!window.confirm(
      lang === "en"
        ? `Permanently delete ${member.name}'s profile? This should only be used for genuine duplicates or signup mistakes — this cannot be undone.`
        : `Futa wasifu wa ${member.name} kabisa? Hii inapaswa kutumika tu kwa nakala za makosa — hatua hii haiwezi kutenduliwa.`
    )) return;
    try {
      const res = await fetch(`/api/profiles/${member.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete profile");
      }
      setMembers(prev => prev.filter(m => m.id !== member.id));
      setDetailMember(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
          <Users className="text-[#E31E24]" size={20} />
          {lang === "en" ? "Members Directory" : "Orodha ya Wanachama"}
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          {lang === "en"
            ? "Full details on every member, volunteer, and leader — join date, contract status, and contact info in one place."
            : "Maelezo kamili ya kila mwanachama, mwanajitolea, na kiongozi — tarehe ya kujiunga, hali ya mkataba, na mawasiliano."}
        </p>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === "en" ? "Search by name, email, phone, or role..." : "Tafuta kwa jina, barua pepe, simu, au wadhifa..."}
          className="w-full pl-8 pr-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      {errorMsg && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{errorMsg}</div>}

      {loading ? (
        <p className="text-xs text-neutral-400 py-10 text-center">{lang === "en" ? "Loading members..." : "Inapakia..."}</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-neutral-400 py-10 text-center">{lang === "en" ? "No members found." : "Hakuna wanachama waliopatikana."}</p>
      ) : (
        <div className="border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-100">
          {filtered.map(m => (
            <div key={m.id} className="p-3 flex items-center gap-3 hover:bg-neutral-50 text-xs">
              <button onClick={() => setDetailMember(m)} className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center shrink-0">
                  {m.avatar ? <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-neutral-400 font-bold">{m.name?.[0]}</span>}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-neutral-800 truncate">{m.name}</p>
                  <p className="text-[10px] text-neutral-400 font-mono">{displayRole(m.role)} · {lang === "en" ? "joined" : "alijiunga"} {m.joinDate || "—"}</p>
                </div>
              </button>
              <div className="shrink-0">
                {m.contractStatus.locked ? (
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center gap-1"><Lock size={10} /> {lang === "en" ? "Locked" : "Imefungwa"}</span>
                ) : m.contractStatus.paymentStatus === "paid" ? (
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><CheckCircle2 size={10} /> {lang === "en" ? "Active" : "Hai"}</span>
                ) : (
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><Clock size={10} /> {m.contractStatus.paymentStatus.replace("_", " ")}</span>
                )}
              </div>
              <button
                onClick={() => { setRequestTarget(m); setRequestMessage(""); }}
                title={lang === "en" ? "Request information" : "Omba Taarifa"}
                className="text-neutral-400 hover:text-blue-600 cursor-pointer shrink-0"
              >
                <MessageSquare size={14} />
              </button>
              <button
                onClick={() => handleDeleteProfile(m)}
                title={lang === "en" ? "Delete profile" : "Futa Wasifu"}
                className="text-neutral-400 hover:text-red-600 cursor-pointer shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Request info modal */}
      <Modal isOpen={!!requestTarget} onClose={() => setRequestTarget(null)} maxWidth="max-w-sm">
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900">{lang === "en" ? "Request Information" : "Omba Taarifa"}</h3>
          <p className="text-xs text-neutral-500">{requestTarget?.name}</p>
          <textarea
            value={requestMessage}
            onChange={e => setRequestMessage(e.target.value)}
            rows={3}
            placeholder={lang === "en" ? "e.g. Please update your emergency contact and phone number." : "mfano: Tafadhali sasisha nambari yako ya dharura na simu."}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs"
          />
          <p className="text-[10px] text-neutral-400">
            {lang === "en" ? "This creates a task on their dashboard asking them to respond." : "Hii inaunda jukumu kwenye dashibodi yao ikiwauliza kujibu."}
          </p>
          <button
            onClick={handleSendRequest}
            disabled={sendingRequest || !requestMessage.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
          >
            {sendingRequest ? (lang === "en" ? "Sending..." : "Inatuma...") : (lang === "en" ? "Send Request" : "Tuma Ombi")}
          </button>
        </div>
      </Modal>

      {/* Member detail modal */}
      <Modal isOpen={!!detailMember} onClose={() => setDetailMember(null)} maxWidth="max-w-md">
        {detailMember && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center shrink-0">
                {detailMember.avatar ? <img src={detailMember.avatar} alt={detailMember.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-neutral-400 font-bold text-xl">{detailMember.name?.[0]}</span>}
              </div>
              <div>
                <h3 className="text-base font-black text-neutral-900">{detailMember.name}</h3>
                <p className="text-xs font-mono text-neutral-500">{displayRole(detailMember.role)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Joined" : "Alijiunga"}</span><span className="font-bold text-neutral-900">{detailMember.joinDate || "—"}</span></div>
              <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Member No." : "Namba"}</span><span className="font-bold text-neutral-900">{detailMember.memberNumber || "—"}</span></div>
              <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">Email</span><span className="font-bold text-neutral-900 break-all">{detailMember.email || "—"}</span></div>
              <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Phone" : "Simu"}</span><span className="font-bold text-neutral-900">{detailMember.phone || "—"}</span></div>
              <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Emergency Contact" : "Dharura"}</span><span className="font-bold text-neutral-900">{detailMember.emergencyContact?.name ? `${detailMember.emergencyContact.name} (${detailMember.emergencyContact.phone || "—"})` : "—"}</span></div>
              <div><span className="text-neutral-400 font-bold uppercase text-[10px] block">{lang === "en" ? "Contract Due" : "Mwisho wa Mkataba"}</span><span className="font-bold text-neutral-900">{detailMember.contractStatus.dueDate}</span></div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-neutral-100">
              <button
                onClick={() => { setDetailMember(null); setRequestTarget(detailMember); setRequestMessage(""); }}
                className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-3 py-2 rounded-lg border border-blue-200 cursor-pointer"
              >
                {lang === "en" ? "Request Info" : "Omba Taarifa"}
              </button>
              <button
                onClick={() => handleDeleteProfile(detailMember)}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold px-3 py-2 rounded-lg border border-red-200 cursor-pointer"
              >
                {lang === "en" ? "Delete Profile" : "Futa Wasifu"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
