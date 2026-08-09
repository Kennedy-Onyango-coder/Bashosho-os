import React from "react";
import { X, ShieldCheck, Loader2, Save, AlertTriangle } from "lucide-react";
import {
  PERMISSION_MODULE_KEYS,
  PERMISSION_ACTIONS,
  PermissionModuleKey,
  PermissionAction,
  RolePermissions,
  emptyModulePermissionSet
} from "../types";

interface RolePermissionsMatrixProps {
  lang: "en" | "sw";
  roleId: string;
  roleName: string;
  isSystemRole: boolean;
  onClose: () => void;
}

const MODULE_LABELS: Record<PermissionModuleKey, { en: string; sw: string }> = {
  dashboard: { en: "Dashboard", sw: "Dashibodi" },
  documents: { en: "CBO Archives", sw: "Nyaraka za CBO" },
  finance: { en: "Finance Ledger", sw: "Fedha na Malipo" },
  assets: { en: "Asset Register", sw: "Rasilimali / Mali" },
  grants: { en: "Grants Board", sw: "Bodi ya Ruzuku" },
  classes: { en: "Classes & Certs", sw: "Madarasa na Vyeti" },
  invoices: { en: "Partner Invoices", sw: "Ankara za Washiriki" },
  handbook: { en: "Rules & Handbook", sw: "Mwongozo na Katiba" },
  settings: { en: "Org Settings", sw: "Mipangilio ya CBO" },
  signup_reviews: { en: "Signup Applications", sw: "Maombi ya Kujiunga" },
  cms_editor: { en: "Homepage CMS Editor", sw: "Uhariri wa Tovuti" },
  beneficiaries: { en: "Register Beneficiaries", sw: "Sajili Wafaidika" },
  roles: { en: "Role Management", sw: "Usimamizi wa Majukumu" },
  safeguarding: { en: "Safeguarding Reports", sw: "Ripoti za Ulinzi" },
  leadership_appointments: { en: "Leadership Appointments", sw: "Uteuzi wa Uongozi" },
  contract_renewals: { en: "Contract Renewals", sw: "Upyaji wa Mikataba" },
  activity_log: { en: "Activity Log", sw: "Kumbukumbu za Shughuli" },
  tasks: { en: "Tasks & Action Items", sw: "Majukumu na Vitendo" },
  program_sessions: { en: "Program Outcomes", sw: "Matokeo ya Mipango" },
  volunteer_recognition: { en: "Volunteer Recognition", sw: "Utambuzi wa Wanaojitolea" }
};

const ACTION_LABELS: Record<PermissionAction, { en: string; sw: string }> = {
  view: { en: "View", sw: "Ona" },
  create: { en: "Create", sw: "Unda" },
  edit: { en: "Edit", sw: "Hariri" },
  delete: { en: "Delete", sw: "Futa" },
  approve: { en: "Approve", sw: "Idhinisha" }
};

const t = {
  en: {
    title: "Manage Permissions",
    desc: "Control exactly what this role can see and do, module by module. Changes take effect immediately for everyone with this role.",
    module: "Module",
    save: "Save Permissions",
    saving: "Saving...",
    close: "Close",
    loadError: "Failed to load current permissions for this role.",
    saveError: "Failed to save permissions.",
    saveSuccess: "Permissions updated.",
    chairNote: "The Chairperson role always has full access to everything and cannot be restricted, to prevent the organization from ever locking itself out of its own settings.",
    selectAllRow: "Grant all"
  },
  sw: {
    title: "Simamia Ruhusa",
    desc: "Dhibiti hasa jukumu hili linachoweza kuona na kufanya, kila sehemu kwa sehemu. Mabadiliko yanaanza mara moja kwa kila mtu mwenye jukumu hili.",
    module: "Sehemu",
    save: "Hifadhi Ruhusa",
    saving: "Inahifadhi...",
    close: "Funga",
    loadError: "Imeshindwa kupakia ruhusa za sasa za jukumu hili.",
    saveError: "Imeshindwa kuhifadhi ruhusa.",
    saveSuccess: "Ruhusa zimesasishwa.",
    chairNote: "Jukumu la Mwenyekiti daima lina ruhusa kamili kwa kila kitu na haliwezi kuzuiwa, ili kuzuia shirika kujifungia nje ya mipangilio yake yenyewe.",
    selectAllRow: "Ruhusu zote"
  }
};

export default function RolePermissionsMatrix({ lang, roleId, roleName, isSystemRole, onClose }: RolePermissionsMatrixProps) {
  const tt = t[lang];
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [permissions, setPermissions] = React.useState<Record<PermissionModuleKey, Record<PermissionAction, boolean>>>(() => {
    const p: any = {};
    for (const m of PERMISSION_MODULE_KEYS) p[m] = emptyModulePermissionSet();
    return p;
  });

  const isChairperson = roleId === "chairperson";

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/role_permissions");
        if (!res.ok) throw new Error("Failed to fetch");
        const all: RolePermissions[] = await res.json();
        const mine = all.find(r => r.roleId === roleId);
        if (mine && !cancelled) {
          const merged: any = {};
          for (const m of PERMISSION_MODULE_KEYS) {
            merged[m] = { ...emptyModulePermissionSet(), ...(mine.permissions?.[m] || {}) };
          }
          setPermissions(merged);
        }
      } catch (err) {
        if (!cancelled) setError(tt.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  const toggle = (moduleKey: PermissionModuleKey, action: PermissionAction) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [action]: !prev[moduleKey][action] }
    }));
  };

  const grantAllForModule = (moduleKey: PermissionModuleKey) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: { view: true, create: true, edit: true, delete: true, approve: true }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/role_permissions/${roleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      setSuccess(tt.saveSuccess);
      setTimeout(() => onClose(), 900);
    } catch (err) {
      setError(tt.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-neutral-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
              <ShieldCheck size={16} className="text-red-600" /> {tt.title}: {roleName}
            </h3>
            <p className="text-[11px] text-neutral-500 mt-1 max-w-lg">{tt.desc}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {isChairperson ? (
          <div className="p-6 flex items-start gap-3 bg-amber-50">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">{tt.chairNote}</p>
          </div>
        ) : loading ? (
          <div className="p-10 flex items-center justify-center text-neutral-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-4">
            {error && <p className="text-[11px] text-red-600 mb-2 px-2">{error}</p>}
            {success && <p className="text-[11px] text-green-600 mb-2 px-2">{success}</p>}
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="text-left text-neutral-400 uppercase font-mono text-[9px]">
                  <th className="py-2 px-2">{tt.module}</th>
                  {PERMISSION_ACTIONS.map(a => (
                    <th key={a} className="py-2 px-2 text-center">{ACTION_LABELS[a][lang]}</th>
                  ))}
                  <th className="py-2 px-2 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MODULE_KEYS.map(m => (
                  <tr key={m} className="border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="py-2 px-2 font-bold text-neutral-800">{MODULE_LABELS[m][lang]}</td>
                    {PERMISSION_ACTIONS.map(a => (
                      <td key={a} className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!permissions[m]?.[a]}
                          onChange={() => toggle(m, a)}
                          className="w-3.5 h-3.5 accent-red-600 cursor-pointer"
                        />
                      </td>
                    ))}
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => grantAllForModule(m)}
                        className="text-[9px] font-mono text-red-600 hover:underline cursor-pointer"
                      >
                        {tt.selectAllRow}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isChairperson && (
          <div className="p-4 border-t border-neutral-100 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold text-neutral-600 hover:bg-neutral-100 cursor-pointer">
              {tt.close}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? tt.saving : tt.save}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
