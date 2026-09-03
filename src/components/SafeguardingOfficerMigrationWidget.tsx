import React from "react";
import { ArrowRightCircle, CheckCircle2, ShieldOff } from "lucide-react";

interface SafeguardingOfficerMigrationWidgetProps {
  lang: "en" | "sw";
  onMigrated: () => void;
}

// The migration mechanism the master doc explicitly asks for: "existing user → new
// appropriate role → verify zero remaining users → remove legacy role. Do not leave
// the legacy role indefinitely." Programs Director is the retired role's real
// successor (see rolePermissions.ts — same safeguarding-module access level). Once
// this reports zero remaining holders, the `safeguarding_officer` case in
// buildDefaultPermissionsForRole and its remaining references can finally be deleted
// with actual confidence, rather than kept "just in case" forever.
export default function SafeguardingOfficerMigrationWidget({ lang, onMigrated }: SafeguardingOfficerMigrationWidgetProps) {
  const [status, setStatus] = React.useState<{ remainingCount: number; remainingUsers: { id: string; name: string }[] } | null>(null);
  const [migrating, setMigrating] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const fetchStatus = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/roles/safeguarding_officer_migration_status");
      if (res.ok) setStatus(await res.json());
    } catch (err) {
      console.error("Failed to check safeguarding_officer migration status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleMigrate = async () => {
    if (!status || status.remainingCount === 0) return;
    const confirmed = window.confirm(
      lang === "en"
        ? `Move ${status.remainingCount} ${status.remainingCount === 1 ? "person" : "people"} (${status.remainingUsers.map(u => u.name).join(", ")}) from the retired Safeguarding & MEL Officer role to Programs Director?`
        : `Hamisha watu ${status.remainingCount} kutoka jukumu la zamani hadi Mkurugenzi wa Mipango?`
    );
    if (!confirmed) return;
    setMigrating(true);
    try {
      const res = await fetch("/api/roles/migrate_safeguarding_officer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRoleKey: "programs_director" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Migration failed");
      await fetchStatus();
      onMigrated();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setMigrating(false);
    }
  };

  if (loading || !status) return null;

  return (
    <div className={`border rounded-xl p-4 ${status.remainingCount > 0 ? "bg-amber-50 border-amber-200" : "bg-neutral-50 border-neutral-200"}`}>
      <p className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
        <ShieldOff size={14} className={status.remainingCount > 0 ? "text-amber-600" : "text-neutral-400"} />
        {lang === "en" ? "Retired role: Safeguarding & MEL Officer" : "Jukumu la zamani: Afisa wa Ulinzi na MEL"}
      </p>
      {status.remainingCount === 0 ? (
        <p className="text-[11px] text-neutral-500 mt-1.5 flex items-center gap-1">
          <CheckCircle2 size={12} className="text-emerald-600" />
          {lang === "en"
            ? "Nobody currently holds this retired role — safe to remove from the system entirely whenever convenient."
            : "Hakuna anayeshikilia jukumu hili sasa — salama kuondoa kabisa."}
        </p>
      ) : (
        <>
          <p className="text-[11px] text-neutral-600 mt-1.5">
            {lang === "en"
              ? `${status.remainingCount} ${status.remainingCount === 1 ? "person" : "people"} still ${status.remainingCount === 1 ? "holds" : "hold"} this retired role: ${status.remainingUsers.map(u => u.name).join(", ")}.`
              : `Watu ${status.remainingCount} bado wana jukumu hili la zamani: ${status.remainingUsers.map(u => u.name).join(", ")}.`}
          </p>
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="mt-2 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-black text-white disabled:opacity-50 cursor-pointer"
          >
            <ArrowRightCircle size={13} /> {migrating
              ? (lang === "en" ? "Migrating..." : "Inahamisha...")
              : (lang === "en" ? "Migrate to Programs Director" : "Hamisha kwa Mkurugenzi wa Mipango")}
          </button>
        </>
      )}
    </div>
  );
}
