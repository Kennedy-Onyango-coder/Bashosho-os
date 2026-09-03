import React from "react";
import { UserProfile, UserRole, getCanonicalRoleKey, getUserRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import RolePermissionsMatrix from "./RolePermissionsMatrix";
import SafeguardingOfficerMigrationWidget from "./SafeguardingOfficerMigrationWidget";
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Briefcase, 
  X, 
  Check, 
  RefreshCw,
  Lock
} from "lucide-react";

interface Role {
  id: string;
  name: string;
  originalName: string;
  isSystem: boolean;
  description?: string;
}

interface RoleManagementPanelProps {
  lang: "en" | "sw";
  allProfiles: UserProfile[];
  fetchProfiles: () => void;
  currentUser?: UserProfile;
}

const t = {
  en: {
    sectionTitle: "Manage Organization Roles & Access Permissions",
    sectionDesc: "Add custom roles, rename existing ones, delete obsolete roles with secure cascading member reassignment, or change roles for individual staff members.",
    rolesListHeader: "Active Staff Roles",
    systemRoleLabel: "System Role",
    customRoleLabel: "Custom Role",
    userCountLabel: "assigned member(s)",
    editRoleTitle: "Edit Role",
    deleteRoleTitle: "Delete Role",
    createRoleTitle: "Create New Role",
    roleNamePlaceholder: "e.g., Social Media Intern",
    roleDescPlaceholder: "Brief description of responsibilities...",
    createBtn: "Create Role",
    saveBtn: "Save Changes",
    cancelBtn: "Cancel",
    deleteBtn: "Delete",
    reassignTitle: "Reassign Member Role",
    reassignDesc: "Select an individual staff member to assign them to a different active role.",
    memberSelectLabel: "Select Staff Member",
    targetRoleLabel: "Target Active Role",
    reassignSubmitBtn: "Reassign Member",
    successCreate: "Role created successfully!",
    successUpdate: "Role updated and affected members cascaded successfully!",
    successDelete: "Role deleted and affected members reassigned successfully!",
    successReassign: "Member role reassigned successfully!",
    errorFetch: "Failed to load roles from system.",
    deleteWarning: "This role cannot be deleted because it is assigned to system-critical access controls.",
    deleteCascadeAlert: "Warning: There are {count} members assigned to this role. Please select another role to reassign them to before deletion.",
    selectReassignRole: "Choose Role for Reassignment",
    roleNameLabel: "Role Name",
    roleDescLabel: "Role Description (Optional)",
    placeholderSelectMember: "Choose a member...",
    placeholderSelectRole: "Choose a role..."
  },
  sw: {
    sectionTitle: "Kusimamia Majukumu & Ruhusa za Kazi",
    sectionDesc: "Ongeza majukumu mapya, badilisha majina ya sasa, futa majukumu yasiyotumika huku ukiwahamishia wanachama kwenye majukumu mengine salama, au badilisha jukumu la mwanachama binafsi.",
    rolesListHeader: "Majukumu Amilifu ya Ofisi",
    systemRoleLabel: "Jukumu la Mfumo",
    customRoleLabel: "Jukumu Maalum",
    userCountLabel: "mwanachama/wanachama",
    editRoleTitle: "Hariri Jukumu",
    deleteRoleTitle: "Futa Jukumu",
    createRoleTitle: "Unda Jukumu Jipya",
    roleNamePlaceholder: "mfano, Msimamizi wa Mitandao",
    roleDescPlaceholder: "Maelezo mafupi ya majukumu...",
    createBtn: "Unda Jukumu",
    saveBtn: "Hifadhi Mabadiliko",
    cancelBtn: "Ghairi",
    deleteBtn: "Futa",
    reassignTitle: "Rejesha / Badilisha Jukumu la Mwanachama",
    reassignDesc: "Chagua mwanachama mmoja ili kumpa jukumu lingine amilifu katika ofisi.",
    memberSelectLabel: "Chagua Mwanachama",
    targetRoleLabel: "Jukumu Linalolengwa",
    reassignSubmitBtn: "Badilisha Jukumu",
    successCreate: "Jukumu jipya limeundwa kwa ufanisi!",
    successUpdate: "Jukumu limehaririwa na wasifu wa wanachama umesasishwa!",
    successDelete: "Jukumu limefutwa na wanachama wamepangiwa jukumu lingine!",
    successReassign: "Mwanachama amepewa jukumu jipya kikamilifu!",
    errorFetch: "Imeshindwa kupakia majukumu kutoka kwa mfumo.",
    deleteWarning: "Jukumu hili haliwezi kufutwa kwa sababu limeunganishwa na udhibiti muhimu wa mfumo wetu.",
    deleteCascadeAlert: "Onyo: Kuna wanachama {count} walio na jukumu hili. Tafadhali chagua jukumu lingine la kuwahamisha kabla ya kufuta.",
    selectReassignRole: "Chagua Jukumu la Kuwahamishia",
    roleNameLabel: "Jina la Jukumu",
    roleDescLabel: "Maelezo ya Jukumu (Sio Lazima)",
    placeholderSelectMember: "Chagua mwanachama...",
    placeholderSelectRole: "Chagua jukumu..."
  }
};

export default function RoleManagementPanel({ lang, allProfiles, fetchProfiles, currentUser }: RoleManagementPanelProps) {
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = React.useState(false);
  const [rolesError, setRolesError] = React.useState("");
  const [rolesSuccess, setRolesSuccess] = React.useState("");

  const [managingPermissionsRole, setManagingPermissionsRole] = React.useState<Role | null>(null);

  // Create role states
  const [newRoleName, setNewRoleName] = React.useState("");
  const [newRoleDesc, setNewRoleDesc] = React.useState("");
  const [creatingRole, setCreatingRole] = React.useState(false);

  // Edit role states
  const [editingRole, setEditingRole] = React.useState<Role | null>(null);
  const [editRoleName, setEditRoleName] = React.useState("");
  const [editRoleDesc, setEditRoleDesc] = React.useState("");
  const [savingRole, setSavingRole] = React.useState(false);

  // Delete role states (requires reassignment if profiles are using it)
  const [deletingRole, setDeletingRole] = React.useState<Role | null>(null);
  const [reassignToRole, setReassignToRole] = React.useState("");
  const [deletingRoleLoading, setDeletingRoleLoading] = React.useState(false);

  // Reassign / Edit member states
  const [reassignUserId, setReassignUserId] = React.useState("");
  const [reassignTargetRole, setReassignTargetRole] = React.useState("");
  const [reassigningLoading, setReassigningLoading] = React.useState(false);

  const [editMemberName, setEditMemberName] = React.useState("");
  const [editMemberEmail, setEditMemberEmail] = React.useState("");
  const [editMemberPhone, setEditMemberPhone] = React.useState("");
  const [editMemberStatus, setEditMemberStatus] = React.useState("Active");
  const [editMemberAvatar, setEditMemberAvatar] = React.useState("");
  const [uploadingMemberPhoto, setUploadingMemberPhoto] = React.useState(false);

  React.useEffect(() => {
    if (reassignUserId) {
      const selected = allProfiles.find(p => p.id === reassignUserId);
      if (selected) {
        setReassignTargetRole(selected.role || "");
        setEditMemberName(selected.name || "");
        setEditMemberEmail(selected.email || "");
        setEditMemberPhone(selected.phone || "");
        setEditMemberStatus(selected.status || "Active");
        setEditMemberAvatar(selected.avatar || "");
      }
    } else {
      setReassignTargetRole("");
      setEditMemberName("");
      setEditMemberEmail("");
      setEditMemberPhone("");
      setEditMemberStatus("Active");
      setEditMemberAvatar("");
    }
  }, [reassignUserId, allProfiles]);

  const handleMemberPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      alert(lang === "en" ? "Photo exceeds 1.5MB limit." : "Picha inazidi 1.5MB.");
      return;
    }

    setUploadingMemberPhoto(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              image: reader.result as string
            })
          });
          const data = await res.json();
          if (res.ok && data.url) {
            setEditMemberAvatar(data.url);
          } else {
            throw new Error(data.error || "Upload failed");
          }
        } catch (err: any) {
          console.warn("Upload failed, falling back to local Base64.", err);
          setEditMemberAvatar(reader.result as string);
        } finally {
          setUploadingMemberPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setUploadingMemberPhoto(false);
    }
  };

  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const data = await res.json();
        setRoles(data);
      } else {
        const errData = await res.json();
        setRolesError(errData.error || t[lang].errorFetch);
      }
    } catch (err) {
      console.error(err);
      setRolesError(t[lang].errorFetch);
    } finally {
      setLoadingRoles(false);
    }
  };

  React.useEffect(() => {
    fetchRoles();
  }, []);

  const clearMessages = () => {
    setTimeout(() => {
      setRolesSuccess("");
      setRolesError("");
    }, 5000);
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    setCreatingRole(true);
    setRolesError("");
    setRolesSuccess("");

    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDesc.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRolesSuccess(t[lang].successCreate);
        setNewRoleName("");
        setNewRoleDesc("");
        fetchRoles();
        clearMessages();
      } else {
        setRolesError(data.error || "Failed to create role");
      }
    } catch (err: any) {
      setRolesError(err.message || "Failed to create role");
    } finally {
      setCreatingRole(false);
    }
  };

  const startEditRole = (role: Role) => {
    setEditingRole(role);
    setEditRoleName(role.name);
    setEditRoleDesc(role.description || "");
    // scroll to edit form
    const editForm = document.getElementById("role-edit-form-anchor");
    if (editForm) {
      editForm.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSaveRoleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole || !editRoleName.trim()) return;

    setSavingRole(true);
    setRolesError("");
    setRolesSuccess("");

    try {
      const res = await fetch(`/api/roles/${editingRole.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editRoleName.trim(),
          description: editRoleDesc.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRolesSuccess(t[lang].successUpdate);
        setEditingRole(null);
        setEditRoleName("");
        setEditRoleDesc("");
        fetchRoles();
        fetchProfiles();
        clearMessages();
      } else {
        setRolesError(data.error || "Failed to update role");
      }
    } catch (err: any) {
      setRolesError(err.message || "Failed to update role");
    } finally {
      setSavingRole(false);
    }
  };

  const startDeleteRole = (role: Role) => {
    setDeletingRole(role);
    // Suggest first available other role
    const otherRoles = roles.filter(r => r.id !== role.id);
    if (otherRoles.length > 0) {
      setReassignToRole(otherRoles[0].name);
    }
    // scroll to delete form
    const deleteForm = document.getElementById("role-delete-form-anchor");
    if (deleteForm) {
      deleteForm.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleDeleteRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingRole) return;

    setDeletingRoleLoading(true);
    setRolesError("");
    setRolesSuccess("");

    try {
      const res = await fetch(`/api/roles/${deletingRole.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reassignTo: reassignToRole
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRolesSuccess(t[lang].successDelete);
        setDeletingRole(null);
        setReassignToRole("");
        fetchRoles();
        fetchProfiles();
        clearMessages();
      } else {
        setRolesError(data.error || data.details || "Failed to delete role");
      }
    } catch (err: any) {
      setRolesError(err.message || "Failed to delete role");
    } finally {
      setDeletingRoleLoading(false);
    }
  };

  const handleReassignUserRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignUserId) return;

    setReassigningLoading(true);
    setRolesError("");
    setRolesSuccess("");

    try {
      const selected = allProfiles.find(p => p.id === reassignUserId);
      if (!selected) {
        throw new Error(lang === "en" ? "Member profile not found." : "Wasifu wa mwanachama haujapatikana.");
      }

      if (!editMemberName.trim() || !editMemberEmail.trim()) {
        throw new Error(lang === "en" ? "Name and email are required." : "Jina na barua pepe zinahitajika.");
      }

      const targetRoleObj = roles.find(r => r.name.toLowerCase() === reassignTargetRole.toLowerCase());
      const targetRoleKey = (targetRoleObj as any)?.roleKey || getCanonicalRoleKey(reassignTargetRole);

      const updatedProfile: UserProfile = {
        ...selected,
        name: editMemberName.trim(),
        role: reassignTargetRole,
        roleKey: targetRoleKey,
        email: editMemberEmail.trim().toLowerCase(),
        phone: editMemberPhone.trim(),
        status: editMemberStatus as any,
        avatar: editMemberAvatar,
      };

      // Save complete record update to Firestore via StorageService
      await StorageService.saveRecord("profiles", updatedProfile);

      setRolesSuccess(lang === "en" ? "Member profile and role updated successfully!" : "Wasifu na jukumu la mwanachama vimesasishwa!");
      setReassignUserId("");
      setReassignTargetRole("");
      setEditMemberName("");
      setEditMemberEmail("");
      setEditMemberPhone("");
      setEditMemberStatus("Active");
      setEditMemberAvatar("");
      
      fetchProfiles();
      
      // If updating the currently logged-in user, notify the application
      const activeUser = JSON.parse(localStorage.getItem("bashosh_os_active_user") || "{}");
      if (activeUser && activeUser.id === selected.id) {
        const updatedSession = { ...activeUser, ...updatedProfile };
        localStorage.setItem("bashosh_os_active_user", JSON.stringify(updatedSession));
        window.dispatchEvent(new CustomEvent("bashosh_os_profile_updated", { detail: updatedSession }));
      }
      
      clearMessages();
    } catch (err: any) {
      setRolesError(err.message || "Failed to update profile");
    } finally {
      setReassigningLoading(false);
    }
  };

  // Helper to count members with a given role name
  const getRoleUserCount = (roleName: string) => {
    const roleObj = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    return allProfiles.filter(p => {
      if ((roleObj as any)?.roleKey) {
        return getUserRoleKey(p) === (roleObj as any).roleKey;
      }
      return p.role && p.role.toLowerCase() === roleName.toLowerCase();
    }).length;
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-6 text-neutral-900" id="role-management-panel">
      {/* Header */}
      <div>
        <span className="text-red-700 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5 flex items-center gap-1 w-fit">
          <Shield size={12} className="text-red-600" /> 
          {lang === "en" ? "ADMINISTRATIVE ROLE CONTROL" : "UDHIBITI WA MAJUKUMU"}
        </span>
        <h3 className="text-sm font-black text-neutral-900 mt-2 uppercase font-sans">
          {t[lang].sectionTitle}
        </h3>
        <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
          {t[lang].sectionDesc}
        </p>
      </div>

      {/* Success/Error Toast Alert Area */}
      {rolesSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-semibold flex items-center gap-2" id="roles-success-alert">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <span>{rolesSuccess}</span>
        </div>
      )}

      {rolesError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 font-semibold flex items-center gap-2" id="roles-error-alert">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span>{rolesError}</span>
        </div>
      )}

      {getUserRoleKey(currentUser) === "chairperson" && (
        <SafeguardingOfficerMigrationWidget lang={lang} onMigrated={fetchProfiles} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Roles List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="text-xs font-black uppercase text-neutral-500 tracking-wider flex items-center gap-1.5">
              <Briefcase size={12} className="text-neutral-500" />
              {t[lang].rolesListHeader}
            </h4>
            <button 
              onClick={fetchRoles}
              disabled={loadingRoles}
              className="text-neutral-500 hover:text-neutral-600 disabled:opacity-50 p-1 cursor-pointer transition-colors"
              title="Refresh Roles"
              aria-label="Refresh roles"
            >
              <RefreshCw size={12} className={loadingRoles ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {loadingRoles && roles.length === 0 ? (
              <div className="text-center py-8 text-xs text-neutral-500">
                <span className="w-4 h-4 rounded-full border-2 border-red-500 border-t-transparent animate-spin inline-block mr-2 align-middle"></span>
                Loading system roles...
              </div>
            ) : roles.length === 0 ? (
              <div className="text-center py-8 text-xs text-neutral-500 border border-dashed rounded-xl">
                No active roles found.
              </div>
            ) : (
              roles.map(role => {
                const count = getRoleUserCount(role.name);
                return (
                  <div 
                    key={role.id} 
                    className="border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50 p-3.5 rounded-xl transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    id={`role-card-${role.id}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-neutral-900">{role.name}</span>
                        {role.isSystem ? (
                          <span className="text-[9px] font-mono font-bold bg-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded uppercase">
                            {t[lang].systemRoleLabel}
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-bold bg-red-50 text-red-700 border border-red-100 px-1.5 py-0.2 rounded uppercase">
                            {t[lang].customRoleLabel}
                          </span>
                        )}
                        <span className="text-[10px] text-neutral-500 flex items-center gap-1 font-mono">
                          <Users size={10} className="text-neutral-500" />
                          {count} {t[lang].userCountLabel}
                        </span>
                      </div>
                      {role.description && (
                        <p className="text-[11px] text-neutral-500 leading-relaxed max-w-md">{role.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-start">
                      <button
                        onClick={() => setManagingPermissionsRole(role)}
                        className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 cursor-pointer transition-colors shadow-2xs"
                        title={lang === "en" ? "Manage Permissions" : "Simamia Ruhusa"}
                        id={`btn-permissions-role-${role.id}`}
                      >
                        <Lock size={12} />
                      </button>
                      <button
                        onClick={() => startEditRole(role)}
                        className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 cursor-pointer transition-colors shadow-2xs"
                        title={t[lang].editRoleTitle}
                        id={`btn-edit-role-${role.id}`}
                      >
                        <Edit size={12} />
                      </button>
                      
                      {!role.isSystem && (
                        <button
                          onClick={() => startDeleteRole(role)}
                          className="p-1.5 rounded-lg border border-red-100 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 cursor-pointer transition-colors shadow-2xs"
                          title={t[lang].deleteRoleTitle}
                          id={`btn-delete-role-${role.id}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Interactive Forms Column */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Edit Role Form (Conditional Anchor) */}
          {editingRole && (
            <div className="border border-yellow-200 bg-yellow-50/30 rounded-xl p-4 space-y-3" id="role-edit-form-anchor">
              <div className="flex items-center justify-between border-b border-yellow-200 pb-2">
                <h5 className="text-xs font-bold uppercase text-yellow-800 flex items-center gap-1.5">
                  <Edit size={12} /> {t[lang].editRoleTitle}: {editingRole.name}
                </h5>
                <button 
                  onClick={() => setEditingRole(null)}
                  className="text-yellow-600 hover:text-yellow-900 p-0.5 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleSaveRoleEdit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                    {t[lang].roleNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={editRoleName}
                    onChange={(e) => setEditRoleName(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                    {t[lang].roleDescLabel}
                  </label>
                  <textarea
                    rows={2}
                    value={editRoleDesc}
                    onChange={(e) => setEditRoleDesc(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingRole(null)}
                    className="px-3 py-1.5 text-[11px] font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                  >
                    {t[lang].cancelBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={savingRole}
                    className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-lg cursor-pointer shadow-xs transition-colors"
                  >
                    {savingRole ? "Saving..." : t[lang].saveBtn}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Delete / Reassign cascade form */}
          {deletingRole && (
            <div className="border border-red-200 bg-red-50/20 rounded-xl p-4 space-y-3" id="role-delete-form-anchor">
              <div className="flex items-center justify-between border-b border-red-200 pb-2">
                <h5 className="text-xs font-bold uppercase text-red-800 flex items-center gap-1.5">
                  <Trash2 size={12} /> {t[lang].deleteRoleTitle}: {deletingRole.name}
                </h5>
                <button 
                  onClick={() => setDeletingRole(null)}
                  className="text-red-500 hover:text-red-900 p-0.5 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {getRoleUserCount(deletingRole.name) > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 flex items-start gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    {t[lang].deleteCascadeAlert.replace("{count}", getRoleUserCount(deletingRole.name).toString())}
                  </span>
                </div>
              ) : null}

              <form onSubmit={handleDeleteRoleSubmit} className="space-y-3.5">
                {getRoleUserCount(deletingRole.name) > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {t[lang].selectReassignRole}
                    </label>
                    <select
                      required
                      value={reassignToRole}
                      onChange={(e) => setReassignToRole(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      {roles
                        .filter(r => r.id !== deletingRole.id)
                        .map(r => (
                          <option key={r.id} value={r.name}>{r.name}</option>
                        ))
                      }
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDeletingRole(null)}
                    className="px-3 py-1.5 text-[11px] font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                  >
                    {t[lang].cancelBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={deletingRoleLoading}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-lg cursor-pointer shadow-xs transition-colors"
                  >
                    {deletingRoleLoading ? "Deleting..." : t[lang].deleteBtn}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Create New Role Form */}
          <div className="border border-neutral-100 bg-neutral-50/20 p-4 rounded-xl space-y-3" id="create-role-container">
            <h5 className="text-xs font-black uppercase text-neutral-500 tracking-wider flex items-center gap-1.5 border-b pb-1.5">
              <Plus size={12} className="text-red-600" />
              {t[lang].createRoleTitle}
            </h5>

            <form onSubmit={handleCreateRole} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                  {t[lang].roleNameLabel} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={t[lang].roleNamePlaceholder}
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                  id="input-new-role-name"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                  {t[lang].roleDescLabel}
                </label>
                <textarea
                  rows={2}
                  placeholder={t[lang].roleDescPlaceholder}
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 leading-relaxed"
                  id="textarea-new-role-desc"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={creatingRole || !newRoleName.trim()}
                  className="bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-[11px] font-bold px-4 py-2 rounded-lg cursor-pointer shadow-xs transition-colors"
                  id="btn-create-role-submit"
                >
                  {creatingRole ? "Creating..." : t[lang].createBtn}
                </button>
              </div>
            </form>
          </div>

          {/* Manage Member Profile, Role & ID Photo */}
          <div className="border border-neutral-100 bg-neutral-50/20 p-4 rounded-xl space-y-3" id="reassign-member-container">
            <h5 className="text-xs font-black uppercase text-neutral-500 tracking-wider flex items-center gap-1.5 border-b pb-1.5">
              <RefreshCw size={12} className="text-red-600" />
              {lang === "en" ? "Manage Member Profile, Role & Photo" : "Dhibiti Wasifu, Jukumu na Picha ya Mwanachama"}
            </h5>
            <p className="text-[10px] text-neutral-500 leading-normal">
              {lang === "en" 
                ? "Select a member to view, edit their name, contact info, membership status, role assignments, or upload their official ID passport photo."
                : "Chagua mwanachama ili kutazama, kuhariri jina lao, maelezo ya mawasiliano, hali ya uanachama, majukumu, au kupakia picha yao ya kitambulisho."}
            </p>

            <form onSubmit={handleReassignUserRoleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                  {t[lang].memberSelectLabel} *
                </label>
                <select
                  required
                  value={reassignUserId}
                  onChange={(e) => setReassignUserId(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                  id="select-reassign-member"
                >
                  <option value="">{t[lang].placeholderSelectMember}</option>
                  {allProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role || "No Role"})</option>
                  ))}
                </select>
              </div>

              {reassignUserId && (
                <div className="space-y-3 p-3 bg-neutral-50 border border-neutral-100 rounded-lg animate-fade-in">
                  {/* Photo Uploader */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-2.5 rounded-lg border border-neutral-200">
                    <div className="w-11 h-14 bg-neutral-100 border border-neutral-200 rounded overflow-hidden flex items-center justify-center relative shrink-0">
                      <img
                        src={editMemberAvatar || `https://i.pravatar.cc/150?img=12`}
                        alt="Member"
                        className="w-full h-full object-cover"
                      />
                      {uploadingMemberPhoto && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-[8px] text-white font-bold">
                          ...
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 text-center sm:text-left flex-grow">
                      <label className="block text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
                        {lang === "en" ? "Official ID Passport Photo" : "Picha ya Pasipoti ya Kitambulisho"}
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer transition-colors inline-block">
                          <span> {lang === "en" ? "Choose File" : "Chagua Picha"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleMemberPhotoChange}
                          />
                        </label>
                        <span className="text-[8.5px] text-neutral-500 font-mono">Max 1.5MB</span>
                      </div>
                    </div>
                  </div>

                  {/* Name Field */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {lang === "en" ? "Full Name *" : "Jina Kamili *"}
                    </label>
                    <input
                      type="text"
                      required
                      value={editMemberName}
                      onChange={(e) => setEditMemberName(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  {/* Email Field */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {lang === "en" ? "Email Address *" : "Anwani ya Barua Pepe *"}
                    </label>
                    <input
                      type="email"
                      required
                      value={editMemberEmail}
                      onChange={(e) => setEditMemberEmail(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  {/* Phone Field */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {lang === "en" ? "Phone Number" : "Nambari ya Simu"}
                    </label>
                    <input
                      type="text"
                      value={editMemberPhone}
                      onChange={(e) => setEditMemberPhone(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  {/* Status Dropdown */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {lang === "en" ? "Membership Status" : "Hali ya Uanachama"}
                    </label>
                    <select
                      value={editMemberStatus}
                      onChange={(e) => setEditMemberStatus(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="Active">{lang === "en" ? "Active" : "Amilifu"}</option>
                      <option value="Suspended">{lang === "en" ? "Suspended" : "Amesitishwa"}</option>
                      <option value="Inactive">{lang === "en" ? "Inactive" : "Sio Amilifu"}</option>
                    </select>
                  </div>

                  {/* Target Role Dropdown */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {t[lang].targetRoleLabel} *
                    </label>
                    <select
                      required
                      value={reassignTargetRole}
                      onChange={(e) => setReassignTargetRole(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                      id="select-reassign-target-role"
                    >
                      <option value="">{t[lang].placeholderSelectRole}</option>
                      {roles.filter(r => (r as any).roleKey !== "safeguarding_officer").map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={reassigningLoading || !reassignUserId || uploadingMemberPhoto}
                  className="bg-[#E31E24] hover:bg-[#c21419] disabled:opacity-50 text-white text-[11px] font-bold px-4 py-2 rounded-lg cursor-pointer shadow-xs transition-colors"
                  id="btn-reassign-submit"
                >
                  {reassigningLoading ? "Saving..." : (lang === "en" ? "Save Member Changes" : "Hifadhi Wasifu wa Mwanachama")}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>

      {managingPermissionsRole && (
        <RolePermissionsMatrix
          lang={lang}
          roleId={managingPermissionsRole.id}
          roleName={managingPermissionsRole.name}
          isSystemRole={managingPermissionsRole.isSystem}
          onClose={() => setManagingPermissionsRole(null)}
        />
      )}
    </div>
  );
}
