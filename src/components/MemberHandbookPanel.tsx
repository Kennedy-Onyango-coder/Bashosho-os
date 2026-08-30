import React from "react";
import { UserProfile, OrgSettings, HandbookSection, UserRole, getCanonicalRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import { BookOpen, CheckCircle2, AlertTriangle, Printer, Search, ArrowRight, ShieldCheck, FileText, UserCheck, Clock, X } from "lucide-react";

interface MemberHandbookPanelProps {
  currentUser: UserProfile;
  lang: "en" | "sw";
  onAcknowledge?: (version: string) => void;
  onNavigateToSettings?: () => void;
}

export default function MemberHandbookPanel({
  currentUser,
  lang,
  onAcknowledge,
  onNavigateToSettings,
}: MemberHandbookPanelProps) {
  const [settings, setSettings] = React.useState<OrgSettings>(() => StorageService.getOrgSettings());
  const [selectedLang, setSelectedLang] = React.useState<"en" | "sw">(lang);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isChecked, setIsChecked] = React.useState(false);
  const [acknowledging, setAcknowledging] = React.useState(false);
  const [ackSuccess, setAckSuccess] = React.useState(false);

  // Sync settings
  React.useEffect(() => {
    setSettings(StorageService.getOrgSettings());
  }, []);

  const sections: HandbookSection[] = (settings.handbookSections || []).slice().sort((a, b) => a.order - b.order);

  const filteredSections = sections.filter((s) => {
    const query = searchQuery.toLowerCase();
    const title = (s.title[selectedLang] || s.title.en || "").toLowerCase();
    const body = (s.body[selectedLang] || s.body.en || "").toLowerCase();
    return title.includes(query) || body.includes(query);
  });

  const currentVersion = settings.handbookVersion || "1.0";
  const userAckVersion = currentUser.handbookAcknowledgedVersion;
  const isUpToDate = userAckVersion === currentVersion;

  const userRoleKey = currentUser.roleKey || getCanonicalRoleKey(currentUser.role);
  const isExecutive = [
    "chairperson",
    "vice_chairperson",
    "secretary",
  ].includes(userRoleKey);

  // Compliance metrics for Executive
  const allUsers = StorageService.getUsers();
  const activeMembers = allUsers.filter((u) => u.status === "Active" || u.isActive);
  const ackedMembers = activeMembers.filter((u) => u.handbookAcknowledgedVersion === currentVersion);
  const pendingMembers = activeMembers.filter((u) => u.handbookAcknowledgedVersion !== currentVersion);

  const handleConfirmAck = async () => {
    if (!isChecked) return;
    setAcknowledging(true);

    try {
      const res = await fetch("/api/auth/acknowledge-handbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: currentVersion }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Server rejected the acknowledgment.");
      }
      const confirmed = await res.json();
      const updatedUser: UserProfile = {
        ...currentUser,
        handbookAcknowledgedVersion: confirmed.handbookAcknowledgedVersion,
        handbookAcknowledgedAt: confirmed.handbookAcknowledgedAt,
      };

      StorageService.saveUser(updatedUser);
      onAcknowledge?.(confirmed.handbookAcknowledgedVersion);
      setAckSuccess(true);
      setTimeout(() => setAckSuccess(false), 4000);
    } catch (err: any) {
      alert("Failed to record acknowledgement: " + err.message);
    } finally {
      setAcknowledging(false);
    }
  };

  const handlePrintHandbook = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const sectionsHtml = sections
      .map(
        (s) => `
        <div style="margin-bottom: 24px; page-break-inside: avoid;">
          <h3 style="font-size: 14px; font-weight: 700; color: #111827; border-bottom: 1.5px solid #E31E24; padding-bottom: 4px; margin-bottom: 8px;">
            ${s.title[selectedLang] || s.title.en}
          </h3>
          <p style="font-size: 11px; line-height: 1.6; color: #374151; white-space: pre-line;">
            ${s.body[selectedLang] || s.body.en}
          </p>
        </div>
      `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${settings.name} — Member Handbook v${currentVersion}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1f2937; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #00A651; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 20px; font-weight: 800; color: #E31E24; text-transform: uppercase; margin: 0; }
            .subtitle { font-size: 11px; color: #4b5563; margin-top: 4px; font-weight: 600; }
            .meta { font-size: 10px; color: #6b7280; margin-top: 10px; font-family: monospace; }
            .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; text-align: center; font-size: 9px; color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">${settings.name}</h1>
            <div class="subtitle">CONSTITUTION & OFFICIAL MEMBER HANDBOOK BYLAWS</div>
            <div class="meta">${settings.registrationNumber} | Version ${currentVersion} (Published: ${settings.handbookUpdatedAt || "2026-07-22"})</div>
          </div>
          <div>
            ${sectionsHtml}
          </div>
          <div class="footer">
            Official Bashosho Talents CBO Document • Safeguarding Contact: ${settings.safeguardingContact || "+254 798 132 410"}
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left" id="member-handbook-root">
      {/* Module Header */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#E31E24] font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
              CONSTITUTIONAL GOVERNANCE
            </span>
            <span className="text-emerald-700 font-mono text-[9px] font-bold tracking-widest uppercase bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
              v{currentVersion}
            </span>
          </div>
          <h2 className="text-xl font-black text-neutral-900 mt-1.5 font-sans flex items-center gap-2">
            <BookOpen size={22} className="text-[#E31E24]" />
            {selectedLang === "en" ? "Rules & Member Handbook" : "Kanuni na Mwongozo wa Wanachama"}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {selectedLang === "en"
              ? `Official bylaws, code of conduct, anti-SGBV guidelines, and membership obligations for ${settings.name}.`
              : `Mwongozo rasmi wa sheria, maadili, usalama wa kijinsia na haki za mwanachama wa ${settings.name}.`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Language Switcher */}
          <div className="bg-neutral-100 p-1 rounded-xl border border-neutral-200 flex items-center gap-1 text-xs">
            <button
              onClick={() => setSelectedLang("en")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                selectedLang === "en"
                  ? "bg-white text-neutral-900 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setSelectedLang("sw")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                selectedLang === "sw"
                  ? "bg-[#00A651] text-white shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Kiswahili
            </button>
          </div>

          <button
            onClick={handlePrintHandbook}
            className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Printer size={14} />
            {selectedLang === "en" ? "Print" : "Chapa"}
          </button>

          {isExecutive && onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="bg-[#E31E24] hover:bg-[#c91a1f] text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors shadow-xs"
            >
              ️ {selectedLang === "en" ? "Edit Handbook" : "Hariri Mwongozo"}
            </button>
          )}
        </div>
      </div>

      {/* Acknowledgement Status Banner */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs">
        {isUpToDate ? (
          <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <h4 className="font-extrabold text-emerald-950">
                {selectedLang === "en"
                  ? `Handbook Version ${currentVersion} Acknowledged`
                  : `Mwongozo Toleo la ${currentVersion} Umekubaliwa`}
              </h4>
              <p className="text-emerald-800 font-medium">
                {selectedLang === "en"
                  ? `You digitally signed and acknowledged this handbook version on ${
                      currentUser.handbookAcknowledgedAt || "record"
                    }. Thank you for upholding CBO integrity.`
                  : `Ulianika sahihi ya kidijitali na kukubali toleo hili mnamo ${
                      currentUser.handbookAcknowledgedAt || "tarehe ya usajili"
                    }.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 text-amber-950 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <h4 className="font-extrabold text-amber-950 text-sm">
                  {selectedLang === "en"
                    ? `Action Required: Please Review & Acknowledge Member Handbook (v${currentVersion})`
                    : `Hatua Inahitajika: Tafadhali Kagua na Ukubali Mwongozo Mpya wa Wanachama (Toleo la ${currentVersion})`}
                </h4>
                <p className="text-amber-800 leading-relaxed font-medium">
                  {selectedLang === "en"
                    ? `An updated version of the Bashosho Talents CBO Member Handbook (v${currentVersion}) has been published on ${
                        settings.handbookUpdatedAt || "2026-07-22"
                      }. All active members must review and confirm agreement.`
                    : `Toleo jipya la Mwongozo wa Wanachama wa Bashosho Talents (v${currentVersion}) limechapishwa. Wanachama wote lazima wakague na kukubali.`}
                </p>
              </div>
            </div>

            {ackSuccess ? (
              <div className="bg-emerald-600 text-white p-3 rounded-lg text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} />
                {selectedLang === "en"
                  ? `Acknowledgement recorded successfully for v${currentVersion}!`
                  : `Mkataba wa mwongozo umethibitishwa kikamilifu!`}
              </div>
            ) : (
              <div className="pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-amber-900 select-none">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => setIsChecked(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-400 cursor-pointer"
                  />
                  <span>
                    {selectedLang === "en"
                      ? `I have read, understood, and agree to abide by all bylaws in Handbook v${currentVersion}`
                      : `Nimesoma, nimeelewa na ninakubali kufuata kanuni zote za Mwongozo v${currentVersion}`}
                  </span>
                </label>

                <button
                  onClick={handleConfirmAck}
                  disabled={!isChecked || acknowledging}
                  className="bg-[#00A651] hover:bg-[#008f45] disabled:bg-amber-200 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-sm shrink-0 flex items-center gap-1.5"
                >
                  {acknowledging ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      {selectedLang === "en"
                        ? `Confirm & Sign v${currentVersion}`
                        : `Thibitisha na Weka Sahihi v${currentVersion}`}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Executive Compliance Monitor */}
      {isExecutive && (
        <div className="bg-neutral-900 text-white border border-neutral-800 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
            <div>
              <span className="text-[#00A651] font-mono text-[9px] font-bold tracking-widest uppercase bg-emerald-950 border border-emerald-900 rounded px-1.5 py-0.5">
                EXECUTIVE COMPLIANCE AUDIT
              </span>
              <h3 className="text-sm font-black text-white mt-1 uppercase font-sans">
                Handbook Acknowledgement Status (v{currentVersion})
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-emerald-400 font-bold">
                 {ackedMembers.length} Signed
              </span>
              <span className="text-neutral-600">|</span>
              <span className="text-amber-400 font-bold">
                ️ {pendingMembers.length} Pending
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-neutral-800/80 p-3.5 rounded-xl border border-neutral-700/60">
              <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider block">
                Total Compliance Rate
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-white">
                  {activeMembers.length > 0
                    ? Math.round((ackedMembers.length / activeMembers.length) * 100)
                    : 0}
                  %
                </span>
                <span className="text-xs text-neutral-500">
                  ({ackedMembers.length} of {activeMembers.length} active members)
                </span>
              </div>
            </div>

            <div className="bg-neutral-800/80 p-3.5 rounded-xl border border-neutral-700/60">
              <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider block">
                Handbook Revision Date
              </span>
              <span className="text-lg font-bold text-neutral-200 font-mono mt-1 block">
                {settings.handbookUpdatedAt || "2026-07-22"}
              </span>
            </div>
          </div>

          {pendingMembers.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-amber-400" />
                Members Pending Acknowledgement (v{currentVersion}):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {pendingMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex justify-between items-center bg-neutral-800 p-2.5 rounded-lg border border-neutral-700 text-xs"
                  >
                    <div>
                      <p className="font-bold text-neutral-200">{m.name}</p>
                      <p className="text-[10px] text-neutral-500 font-mono">
                        {m.memberNumber} • {m.phone || "No phone"}
                      </p>
                    </div>
                    <span className="text-[9px] bg-amber-950 text-amber-300 font-mono px-2 py-0.5 rounded border border-amber-800 font-bold">
                      Pending v{currentVersion}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs flex items-center gap-3">
        <Search size={18} className="text-neutral-500 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            selectedLang === "en"
              ? "Search handbook bylaws, policies, or rules..."
              : "Tafuta kanuni, sheria au maadili katika mwongozo..."
          }
          className="w-full text-xs text-neutral-900 bg-transparent focus:outline-none placeholder:text-neutral-500 font-medium"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="text-neutral-500 hover:text-neutral-700 font-bold text-xs px-2 cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Sections Accordion/List */}
      <div className="space-y-4">
        {filteredSections.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center text-neutral-500 text-xs">
            No handbook sections matched "{searchQuery}".
          </div>
        ) : (
          filteredSections.map((sec, idx) => {
            const title = sec.title[selectedLang] || sec.title.en;
            const body = sec.body[selectedLang] || sec.body.en;

            return (
              <div
                key={sec.id}
                id={`handbook-section-${sec.id}`}
                className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-3 transition-all hover:border-neutral-300"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                  <h3 className="text-sm font-extrabold text-neutral-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-red-50 text-[#E31E24] text-xs font-black flex items-center justify-center border border-red-100 shrink-0">
                      {idx + 1}
                    </span>
                    {title}
                  </h3>
                  <span className="text-[10px] font-mono text-neutral-500 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-200">
                    Section {sec.order}
                  </span>
                </div>

                <div className="text-xs text-neutral-700 leading-relaxed font-sans whitespace-pre-line space-y-2">
                  {body}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Safeguarding Note */}
      <div className="bg-neutral-100 border border-neutral-200 rounded-2xl p-4 text-center text-xs text-neutral-600 space-y-1">
        <p className="font-bold text-neutral-800">
          {selectedLang === "en" ? "Safeguarding & Whistleblower Channel" : "Njia ya Siri ya Kutoa Taarifa"}
        </p>
        <p className="text-[11px] text-neutral-500">
          {settings.safeguardingContact || "Safeguarding Officer: +254 798 132 410 (barshoshotalents@gmail.com)"}
        </p>
      </div>
    </div>
  );
}
