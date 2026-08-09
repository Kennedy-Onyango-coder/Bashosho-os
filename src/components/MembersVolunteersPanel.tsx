import React from "react";
import { Users, UserCheck, HeartHandshake, FileCheck, RefreshCw, Search, X, Phone, Mail, Calendar, Shield, Award, ChevronRight } from "lucide-react";
import { UserProfile, UserRole, getUserRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import StatCard from "./dashboard/StatCard";
import { getMemberAttendanceStats } from "./dashboard/SecretaryOverview";
import BeneficiaryRegistration from "./BeneficiaryRegistration";

interface MembersVolunteersPanelProps {
  lang: "en" | "sw";
}

const AUTO_SYNC_INTERVAL_MS = 25000;

function statusBadge(profile: UserProfile) {
  if (!profile.isActive) return { label: "Inactive", cls: "bg-neutral-100 text-neutral-500 border-neutral-200" };
  if (profile.status === "Volunteer") return { label: "Volunteer", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  return { label: "Active", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

export default function MembersVolunteersPanel({ lang }: MembersVolunteersPanelProps) {
  const [subTab, setSubTab] = React.useState<"roster" | "beneficiaries">("roster");
  const [profiles, setProfiles] = React.useState<UserProfile[]>([]);
  const [attendance, setAttendance] = React.useState(StorageService.getAttendance());
  const [orgSettings, setOrgSettings] = React.useState(StorageService.getOrgSettings());
  const [lastSynced, setLastSynced] = React.useState(new Date());
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "volunteer" | "inactive">("all");
  const [selectedMember, setSelectedMember] = React.useState<UserProfile | null>(null);
  const [secondsAgo, setSecondsAgo] = React.useState(0);

  const refreshLocal = React.useCallback(() => {
    setProfiles(StorageService.getProfiles());
    setAttendance(StorageService.getAttendance());
    setOrgSettings(StorageService.getOrgSettings());
  }, []);

  const syncNow = React.useCallback(async () => {
    setIsSyncing(true);
    try {
      await StorageService.pullFromServer();
    } catch {
      // Offline or request failed — keep showing last-known local data rather than
      // clearing the roster; the next successful sync will catch it up.
    } finally {
      refreshLocal();
      setLastSynced(new Date());
      setIsSyncing(false);
    }
  }, [refreshLocal]);

  React.useEffect(() => {
    refreshLocal();
    syncNow();
    const interval = setInterval(syncNow, AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastSynced.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastSynced]);

  const filtered = profiles.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.memberNumber?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
    const matchesRole = roleFilter === "all" || getUserRoleKey(p) === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "inactive" && !p.isActive) ||
      (statusFilter === "volunteer" && p.isActive && p.status === "Volunteer") ||
      (statusFilter === "active" && p.isActive && p.status !== "Volunteer");
    return matchesSearch && matchesRole && matchesStatus;
  });

  const activeMembers = profiles.filter((p) => p.isActive && p.status !== "Volunteer").length;
  const volunteers = profiles.filter((p) => p.isActive && p.status === "Volunteer").length;
  const handbookVersion = orgSettings.handbookVersion || "1.0";
  const handbookCompliant = profiles.filter((p) => p.handbookAcknowledgedVersion === handbookVersion).length;

  const uniqueRoles = Array.from(new Set(profiles.map((p) => p.role))).sort();

  return (
    <div className="space-y-6 text-left" id="members-volunteers-module">
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-6 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-emerald-400 font-mono text-[9px] font-bold tracking-widest uppercase bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
            {lang === "en" ? "MEMBERSHIP REGISTRY" : "ORODHA YA WANACHAMA"}
          </span>
          <h2 className="text-xl font-black text-white mt-1.5 font-sans">
            {lang === "en" ? "Members & Volunteers" : "Wanachama na Wajitolea"}
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {lang === "en"
              ? "Full roster of registered members and volunteers, with live status and attendance."
              : "Orodha kamili ya wanachama na wajitolea waliosajiliwa, na hali yao ya sasa."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-emerald-300">
            <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${isSyncing ? "animate-pulse" : ""}`} />
            {isSyncing
              ? (lang === "en" ? "Syncing..." : "Inasawazisha...")
              : (lang === "en" ? `Synced ${secondsAgo}s ago` : `Imesawazishwa sekunde ${secondsAgo} zilizopita`)}
          </div>
          <button
            onClick={syncNow}
            disabled={isSyncing}
            className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title={lang === "en" ? "Refresh now" : "Sawazisha sasa"}
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={lang === "en" ? "Registered total" : "Jumla waliosajiliwa"} value={String(profiles.length)} icon={<Users size={17} />} accent="neutral" />
        <StatCard label={lang === "en" ? "Active members" : "Wanachama hai"} value={String(activeMembers)} icon={<UserCheck size={17} />} accent="community" />
        <StatCard label={lang === "en" ? "Volunteers" : "Wajitolea"} value={String(volunteers)} icon={<HeartHandshake size={17} />} accent="community" />
        <StatCard
          label={lang === "en" ? "Handbook compliant" : "Wamekubali mwongozo"}
          value={`${handbookCompliant}/${profiles.length}`}
          icon={<FileCheck size={17} />}
          accent={handbookCompliant === profiles.length ? "finance" : "danger"}
        />
      </div>

      <div className="flex items-center gap-1 border-b border-neutral-200">
        <button
          onClick={() => setSubTab("roster")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            subTab === "roster" ? "border-b-red-600 text-red-600" : "border-b-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          {lang === "en" ? "Members & Volunteers" : "Wanachama na Wajitolea"}
        </button>
        <button
          onClick={() => setSubTab("beneficiaries")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            subTab === "beneficiaries" ? "border-b-red-600 text-red-600" : "border-b-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          {lang === "en" ? "Program Beneficiaries" : "Wafaidika wa Programu"}
        </button>
      </div>

      {subTab === "beneficiaries" ? (
        <BeneficiaryRegistration lang={lang} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 items-center bg-white border border-neutral-200 rounded-xl p-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === "en" ? "Search by name, member #, or email..." : "Tafuta kwa jina, namba, au barua pepe..."}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2 text-xs font-semibold cursor-pointer"
            >
              <option value="all">{lang === "en" ? "All roles" : "Majukumu yote"}</option>
              {uniqueRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2 text-xs font-semibold cursor-pointer"
            >
              <option value="all">{lang === "en" ? "All statuses" : "Hali zote"}</option>
              <option value="active">{lang === "en" ? "Active" : "Hai"}</option>
              <option value="volunteer">{lang === "en" ? "Volunteer" : "Mjitolea"}</option>
              <option value="inactive">{lang === "en" ? "Inactive" : "Sio hai"}</option>
            </select>
          </div>

          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">{lang === "en" ? "Member" : "Mwanachama"}</th>
                    <th className="py-3 px-4">{lang === "en" ? "Role" : "Jukumu"}</th>
                    <th className="py-3 px-4">{lang === "en" ? "Status" : "Hali"}</th>
                    <th className="py-3 px-4">{lang === "en" ? "Sessions" : "Vikao"}</th>
                    <th className="py-3 px-4">{lang === "en" ? "Handbook" : "Mwongozo"}</th>
                    <th className="py-3 px-4">{lang === "en" ? "Joined" : "Alijiunga"}</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtered.map((p) => {
                    const badge = statusBadge(p);
                    const { sessions } = getMemberAttendanceStats(p.id, attendance);
                    const handbookOk = p.handbookAcknowledgedVersion === handbookVersion;
                    return (
                      <tr key={p.id} className="hover:bg-neutral-50/70 transition-colors cursor-pointer" onClick={() => setSelectedMember(p)}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-black shrink-0 overflow-hidden">
                              {p.avatar ? <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" /> : p.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-neutral-900 truncate">{p.name}</p>
                              <p className="text-[10px] text-neutral-400 font-mono">{p.memberNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-neutral-600 font-medium">{p.role}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-neutral-700">{sessions}</td>
                        <td className="py-3 px-4">
                          {handbookOk ? (
                            <span className="text-emerald-600 font-bold text-[10px] flex items-center gap-1"><FileCheck size={11} /> {lang === "en" ? "Yes" : "Ndio"}</span>
                          ) : (
                            <span className="text-amber-600 font-bold text-[10px]">{lang === "en" ? "Pending" : "Inasubiri"}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-neutral-500">{p.joinDate}</td>
                        <td className="py-3 px-4 text-right">
                          <ChevronRight size={14} className="text-neutral-300" />
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-neutral-400 text-xs">
                        {lang === "en" ? "No members match your filters." : "Hakuna wanachama wanaolingana na uchujaji wako."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Member detail drawer */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={() => setSelectedMember(null)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-black overflow-hidden">
                  {selectedMember.avatar ? <img src={selectedMember.avatar} alt={selectedMember.name} className="w-full h-full object-cover" /> : selectedMember.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-neutral-900">{selectedMember.name}</p>
                  <p className="text-xs text-red-600 font-bold">{selectedMember.role}</p>
                </div>
              </div>
              <button onClick={() => setSelectedMember(null)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-neutral-50 rounded-lg p-3">
                <span className="block text-[9px] font-bold text-neutral-400 uppercase">{lang === "en" ? "Member #" : "Namba"}</span>
                <span className="font-mono font-bold text-neutral-800">{selectedMember.memberNumber}</span>
              </div>
              <div className="bg-neutral-50 rounded-lg p-3">
                <span className="block text-[9px] font-bold text-neutral-400 uppercase">{lang === "en" ? "Status" : "Hali"}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusBadge(selectedMember).cls}`}>{statusBadge(selectedMember).label}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <p className="flex items-center gap-2 text-neutral-700"><Phone size={13} className="text-neutral-400" /> {selectedMember.phone || "\u2014"}</p>
              <p className="flex items-center gap-2 text-neutral-700"><Mail size={13} className="text-neutral-400" /> {selectedMember.email || "\u2014"}</p>
              <p className="flex items-center gap-2 text-neutral-700"><Calendar size={13} className="text-neutral-400" /> {lang === "en" ? "Joined" : "Alijiunga"} {selectedMember.joinDate}</p>
              {(selectedMember.validFrom || selectedMember.validUntil) && (
                <p className="flex items-center gap-2 text-neutral-700"><Shield size={13} className="text-neutral-400" /> {lang === "en" ? "Valid until" : "Hadi"} {selectedMember.validUntil || "\u2014"}</p>
              )}
            </div>

            {selectedMember.skills?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1.5 flex items-center gap-1"><Award size={11} /> {lang === "en" ? "Skills" : "Ujuzi"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMember.skills.map((s) => (
                    <span key={s} className="bg-neutral-100 text-neutral-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {selectedMember.emergencyContact?.name && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                <p className="text-[9px] font-bold text-amber-700 uppercase">{lang === "en" ? "Emergency contact" : "Mawasiliano ya dharura"}</p>
                <p className="font-bold text-neutral-800 mt-1">{selectedMember.emergencyContact.name} ({selectedMember.emergencyContact.relationship})</p>
                <p className="text-neutral-600 font-mono">{selectedMember.emergencyContact.phone}</p>
              </div>
            )}

            <div className="bg-neutral-50 rounded-lg p-3 text-xs">
              <p className="text-[9px] font-bold text-neutral-400 uppercase">{lang === "en" ? "Attendance" : "Mahudhurio"}</p>
              {(() => {
                const stats = getMemberAttendanceStats(selectedMember.id, attendance);
                return (
                  <p className="font-bold text-neutral-800 mt-1">
                    {stats.sessions} {lang === "en" ? "sessions" : "vikao"} &middot; {stats.hours.toFixed(1)} {lang === "en" ? "hrs logged" : "saa"}
                  </p>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
