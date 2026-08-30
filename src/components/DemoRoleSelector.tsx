import { UserProfile } from "../types";
import { StorageService } from "../lib/storage";

interface DemoRoleSelectorProps {
  activeProfile: UserProfile | null;
  onLogout: () => void;
  isOnline: boolean;
  onToggleOnline: (online: boolean) => void;
  lang: "en" | "sw";
  onChangeLang: (lang: "en" | "sw") => void;
}

export default function DemoRoleSelector({
  activeProfile,
  onLogout,
  isOnline,
  onToggleOnline,
  lang,
  onChangeLang
}: DemoRoleSelectorProps) {
  const syncQueue = StorageService.getSyncQueue();
  const pendingCount = syncQueue.filter(q => q.status === "pending").length;

  return (
    <div className="bg-[#1B1B1B] text-white border-b border-neutral-800 px-4 py-2.5 flex flex-wrap gap-3 items-center justify-between shadow-md demo-role-selector-header print:hidden">
      {/* CBO Header Info */}
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#E31E24] animate-pulse"></span>
        <span className="text-xs font-bold tracking-wider font-sans text-neutral-200">
          BASHOSHO OS
        </span>
        <span className="text-[10px] bg-[#E31E24]/20 text-red-400 px-2 py-0.5 rounded font-semibold font-mono">
          SECURE
        </span>
      </div>

      {/* Selector & Options */}
      <div className="flex flex-wrap items-center gap-4">
        {/* User Profile Block */}
        {activeProfile && (
          <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-xl">
            <div className="text-right">
              <p className="text-xs font-bold text-neutral-200">{activeProfile.name}</p>
              <p className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">{activeProfile.role}</p>
            </div>
            <button
              onClick={onLogout}
              className="bg-neutral-800 hover:bg-red-950 hover:text-red-400 border border-neutral-700 hover:border-red-900 text-neutral-500 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
            >
              {lang === "en" ? "Sign Out" : "Ondoka"}
            </button>
          </div>
        )}

        {/* Connectivity Toggle (Offline simulation) */}
        <button
          onClick={() => {
            if (isOnline) {
              const confirmMsg = lang === "en"
                ? "You'll stop saving changes to the server until you switch back online — continue?"
                : "Utaacha kuhifadhi mabadiliko kwenye kompyuta kuu hadi utakapochagua kurudi mtandaoni — unataka kuendelea?";
              if (window.confirm(confirmMsg)) {
                onToggleOnline(false);
              }
            } else {
              onToggleOnline(true);
            }
          }}
          id="toggle-connectivity-btn"
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
            isOnline
              ? "bg-[#00A651]/10 text-emerald-400 border border-[#00A651]/30 hover:bg-[#00A651]/20"
              : "bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
          }`}
          title={isOnline ? "Switch to Offline Mode" : "Switch to Online Mode"}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-[#00A651]" : "bg-amber-500"}`}></span>
          {isOnline ? "Online (Live Sync)" : "Offline Mode"}
          {pendingCount > 0 && (
            <span className="bg-[#E31E24] text-white text-[9px] px-1 py-0.5 rounded-full leading-none">
              {pendingCount} Sync Pending
            </span>
          )}
        </button>

        {/* Language Toggle */}
        <button
          onClick={() => onChangeLang(lang === "en" ? "sw" : "en")}
          id="lang-toggle-btn"
          className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="m5 8 6 6 6-6"></path>
            <path d="M4 14h16"></path>
          </svg>
          {lang === "en" ? "Kiswahili" : "English"}
        </button>
      </div>
    </div>
  );
}
