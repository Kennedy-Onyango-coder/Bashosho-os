import React from "react";
import { OrgSettings, UserRole, UserProfile, HandbookSection, getCanonicalRoleKey, getUserRoleKey } from "../types";
import { StorageService, SEED_HANDBOOK_SECTIONS } from "../lib/storage";
import { ShieldAlert, User, Mail, Phone, Key, Trash2, CheckCircle, AlertTriangle, Info, Lock, Settings, Database, Download, ArrowUp, ArrowDown, Plus, ChevronDown, ChevronUp, BookOpen, ShieldCheck } from "lucide-react";
import RoleManagementPanel from "./RoleManagementPanel";

interface OrgSettingsScreenProps {
  currentUser: UserProfile;
  lang: "en" | "sw";
}

export default function OrgSettingsScreen({ currentUser, lang }: OrgSettingsScreenProps) {
  const [settings, setSettings] = React.useState<OrgSettings>({
    name: "BASHOSHO TALENTS CBO",
    registrationNumber: "Reg No. DSD/KAM/CBO/5/4/22/269",
    contactDetails: "P.O. Box 48931-00100 Nairobi, Kenya",
    missionText: "Connecting Youths Through Talents",
    physicalAddress: "Community Center Hall, Kiambiu, Nairobi",
    emailAndPhone: "Email: barshoshotalents@gmail.com | Cell: +254 798 132 410",
  });

  const [savedSuccess, setSavedSuccess] = React.useState(false);
  
  // Profile / Admin management states
  const [allProfiles, setAllProfiles] = React.useState<UserProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = React.useState(false);
  const [profileSuccess, setProfileSuccess] = React.useState("");
  const [profileError, setProfileError] = React.useState("");

  const [adminName, setAdminName] = React.useState(currentUser?.name || "");
  const [adminEmail, setAdminEmail] = React.useState(currentUser?.email || "");
  const [adminPhone, setAdminPhone] = React.useState(currentUser?.phone || "");
  const [adminPin, setAdminPin] = React.useState("");
  const [adminAvatar, setAdminAvatar] = React.useState(currentUser?.avatar || "");
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);

  const handleAdminPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      setProfileError(lang === "en" ? "Photo exceeds 1.5MB limit." : "Picha inazidi 1.5MB.");
      return;
    }

    setUploadingPhoto(true);
    setProfileError("");
    setProfileSuccess("");

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
            setAdminAvatar(data.url);
            setProfileSuccess(lang === "en" ? "Photo uploaded successfully!" : "Picha imepakiwa kikamilifu!");
          } else {
            throw new Error(data.error || "Upload failed");
          }
        } catch (err: any) {
          console.warn("Upload failed, falling back to local Base64.", err);
          setAdminAvatar(reader.result as string);
          setProfileSuccess(lang === "en" ? "Photo loaded locally (offline mode)." : "Picha imepakiwa kijeshi (nje ya mtandao).");
        } finally {
          setUploadingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setProfileError(err.message || "Failed to upload photo");
      setUploadingPhoto(false);
    }
  };

  // Administrative password reset states
  const [resetSelectedUserId, setResetSelectedUserId] = React.useState("");
  const [resetNewPassword, setResetNewPassword] = React.useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = React.useState("");
  const [resetErrorMessage, setResetErrorMessage] = React.useState("");
  const [isResetting, setIsResetting] = React.useState(false);

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetSuccessMessage("");
    setResetErrorMessage("");

    if (!resetSelectedUserId) {
      setResetErrorMessage(lang === "en" ? "Please select a member to reset." : "Tafadhali chagua mwanachama wa kumrejeshea nenosiri.");
      return;
    }

    if (!resetNewPassword) {
      setResetErrorMessage(lang === "en" ? "Please enter a new PIN or password." : "Tafadhali weka PIN au nenosiri jipya.");
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch("/api/auth/admin-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: resetSelectedUserId,
          newPassword: resetNewPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Reset failed");
      }

      setResetSuccessMessage(data.message || (lang === "en" ? "Password reset successful!" : "Nenosiri limerejeshwa kikamilifu!"));
      setResetNewPassword("");
      setResetSelectedUserId("");
    } catch (err: any) {
      setResetErrorMessage(err.message || "Reset failed");
    } finally {
      setIsResetting(false);
    }
  };

  const fetchProfiles = () => {
    setLoadingProfiles(true);
    fetch("/api/profiles")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAllProfiles(data);
          // Sync current logged in user details if found
          const myProfile = data.find(p => p.id === currentUser.id);
          if (myProfile) {
            setAdminName(myProfile.name);
            setAdminEmail(myProfile.email);
            setAdminPhone(myProfile.phone);
            setAdminAvatar(myProfile.avatar || "");
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoadingProfiles(false));
  };

  React.useEffect(() => {
    setSettings(StorageService.getOrgSettings());
    fetchProfiles();
  }, []);

  const handleChange = (field: keyof OrgSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveOrgSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleUpdateAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess("");
    setProfileError("");

    if (!adminName.trim() || !adminEmail.trim() || !adminPhone.trim()) {
      setProfileError(lang === "en" ? "Name, email, and phone are required." : "Jina, barua pepe na nambari ya simu zinahitajika.");
      return;
    }

    try {
      const foundCurrent = allProfiles.find(p => p.id === currentUser.id) || {
        id: currentUser.id,
        role: currentUser.role,
        isActive: true,
        joinDate: new Date().toISOString().split("T")[0],
        memberNumber: "BT-CBO-ADMIN",
        status: "Active",
        skills: ["Leadership"],
        emergencyContact: { name: "System Admin Placeholder", phone: "+254 700 000000", relationship: "CBO Admin" }
      };

      const updatedProfile: UserProfile = {
        ...foundCurrent,
        name: adminName.trim(),
        email: adminEmail.trim().toLowerCase(),
        phone: adminPhone.trim(),
        avatar: adminAvatar,
      };

      // Save updated profile record via StorageService
      await StorageService.saveRecord("profiles", updatedProfile);

      // Sync active session user in localStorage
      const storedUser = localStorage.getItem("bashosh_os_active_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.id === currentUser.id) {
          localStorage.setItem("bashosh_os_active_user", JSON.stringify({
            ...parsed,
            name: adminName.trim(),
            email: adminEmail.trim().toLowerCase(),
            phone: adminPhone.trim(),
            avatar: adminAvatar,
          }));
        }
      }

      // Propagate the updated profile globally via custom event
      window.dispatchEvent(new CustomEvent("bashosh_os_profile_updated", { detail: updatedProfile }));
      setProfileSuccess(lang === "en" ? "Profile updated successfully!" : "Wasifu umesasishwa kikamilifu!");

      // Update PIN if specified
      if (adminPin.trim()) {
        if (adminPin.trim().length < 4) {
          throw new Error(lang === "en" ? "PIN must be at least 4 characters." : "PIN lazima iwe angalau herufi 4.");
        }
        const pinRes = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: adminPin.trim() })
        });
        if (!pinRes.ok) {
          const pinData = await pinRes.json();
          throw new Error(pinData.error || "Failed to update PIN");
        }
        setAdminPin("");
      }

      setProfileSuccess(lang === "en" ? "Admin profile updated successfully! Please reload to apply changes." : "Wasifu umesasishwa kikamilifu! Ukurasa utapakia upya sasa.");
      fetchProfiles();

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile");
    }
  };

  const handleDeleteOtherAdmin = async (profileId: string) => {
    if (!window.confirm(lang === "en" ? "Are you sure you want to delete this administrative account?" : "Je, una uhakika unataka kufuta akaunti hii ya utawala?")) {
      return;
    }
    try {
      await StorageService.deleteRecord("profiles", profileId);
      setProfileSuccess(lang === "en" ? "Account deleted successfully." : "Akaunti imefutwa kikamilifu.");
      fetchProfiles();
    } catch (err: any) {
      setProfileError(err.message || "Failed to delete account");
    }
  };

  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUpdateSection = (
    index: number,
    field: "title_en" | "title_sw" | "body_en" | "body_sw",
    val: string
  ) => {
    setSettings((prev) => {
      const currentSections = (prev.handbookSections || SEED_HANDBOOK_SECTIONS).slice();
      const target = { ...currentSections[index] };
      if (field === "title_en") target.title = { ...target.title, en: val };
      if (field === "title_sw") target.title = { ...target.title, sw: val };
      if (field === "body_en") target.body = { ...target.body, en: val };
      if (field === "body_sw") target.body = { ...target.body, sw: val };
      currentSections[index] = target;
      return { ...prev, handbookSections: currentSections };
    });
  };

  const handleMoveSection = (index: number, direction: "up" | "down") => {
    setSettings((prev) => {
      const list = (prev.handbookSections || SEED_HANDBOOK_SECTIONS).slice();
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;

      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;

      const reordered = list.map((item, i) => ({ ...item, order: i + 1 }));
      return { ...prev, handbookSections: reordered };
    });
  };

  const handleDeleteSection = (index: number) => {
    if (!window.confirm(lang === "en" ? "Delete this handbook section?" : "Futa sehemu hii ya mwongozo?")) {
      return;
    }
    setSettings((prev) => {
      const list = (prev.handbookSections || SEED_HANDBOOK_SECTIONS).slice();
      list.splice(index, 1);
      const reordered = list.map((item, i) => ({ ...item, order: i + 1 }));
      return { ...prev, handbookSections: reordered };
    });
  };

  const handleAddSection = () => {
    setSettings((prev) => {
      const list = (prev.handbookSections || SEED_HANDBOOK_SECTIONS).slice();
      const newId = `section_${Date.now()}`;
      const newSec: HandbookSection = {
        id: newId,
        title: {
          en: `${list.length + 1}. New Policy Title`,
          sw: `${list.length + 1}. Kichwa cha Sera Mpya [translate]`,
        },
        body: {
          en: "Enter official policy text here...",
          sw: "[translate]",
        },
        order: list.length + 1,
      };
      setOpenSections(p => ({ ...p, [newId]: true }));
      return { ...prev, handbookSections: [...list, newSec] };
    });
  };

  const handlePublishHandbookUpdate = () => {
    const currentVer = parseFloat(settings.handbookVersion || "1.0");
    const newVer = (currentVer + 0.1).toFixed(1);
    const today = new Date().toISOString().split("T")[0];

    const updatedSettings: OrgSettings = {
      ...settings,
      handbookVersion: newVer,
      handbookUpdatedAt: today,
    };

    StorageService.saveOrgSettings(updatedSettings);
    setSettings(updatedSettings);
    setSavedSuccess(true);
    alert(
      lang === "en"
        ? `Handbook v${newVer} published successfully! All active members will be prompted to review and acknowledge the updated policies.`
        : `Mwongozo Toleo v${newVer} umechapishwa kikamilifu! Wanachama wote watahitajika kukagua na kuweka sahihi.`
    );
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const userRoleKey = currentUser.roleKey || getCanonicalRoleKey(currentUser.role);
  const isAuthorized = [
    "chairperson",
    "vice_chairperson",
    "secretary",
  ].includes(userRoleKey);

  if (!isAuthorized) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center max-w-lg mx-auto flex flex-col items-center">
        <Lock size={48} className="text-red-600 mb-4 animate-pulse" />
        <h3 className="text-lg font-bold text-neutral-900 mt-2">
          {lang === "en" ? "Access Restricted" : "Ufikiaji Umezuiliwa"}
        </h3>
        <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
          {lang === "en"
            ? "Only Executive Committee Officers (Chairperson, Vice Chairperson, Secretary) are authorized to edit organization settings and member handbook bylaws."
            : "Ni Viongozi Wakuu tu (Mwenyekiti, Makamu Mwenyekiti, Katibu) wanaoruhusiwa kubadilisha mipangilio na sheria za mwongozo."}
        </p>
      </div>
    );
  }

  const otherAdmins = allProfiles.filter(p => getUserRoleKey(p) === UserRole.CHAIRPERSON && p.id !== currentUser.id);

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left" id="org-settings-root">
      {/* Module Header */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs">
        <span className="text-red-600 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
          {lang === "en" ? "CBO CONSTITUTIONAL METRICS" : "MIPANGILIO YA SHIRIKA"}
        </span>
        <h2 className="text-xl font-black text-neutral-900 mt-1.5 font-sans">
          {lang === "en" ? "Organization Settings & Letterhead" : "Mipangilio ya Shirika na Kichwa cha Barua"}
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          {lang === "en"
            ? "Update CBO details. Changes propagate globally to all official letterhead prints, generated invoices, and student certificates."
            : "Sasisha maelezo ya kikundi. Mabadiliko haya yataonekana kwenye barua zote rasmi, ankara, na vyeti vya mafunzo."}
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
            {lang === "en" ? "Organization / CBO Legal Name" : "Jina Rasmi la Kikundi"} *
          </label>
          <input
            type="text"
            required
            value={settings.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2.5 text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
              {lang === "en" ? "Government Registration Number" : "Nambari ya Usajili wa Serikali"} *
            </label>
            <input
              type="text"
              required
              value={settings.registrationNumber}
              onChange={(e) => handleChange("registrationNumber", e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-sans font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
              {lang === "en" ? "Motto / Slogan / Mission Text" : "Wito au Usemi wa Kikundi"} *
            </label>
            <input
              type="text"
              required
              value={settings.missionText}
              onChange={(e) => handleChange("missionText", e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-serif italic"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
            {lang === "en" ? "Official Box Address / Postal Contact" : "Anwani ya Sanduku la Posta"} *
          </label>
          <input
            type="text"
            required
            value={settings.contactDetails}
            onChange={(e) => handleChange("contactDetails", e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
            {lang === "en" ? "Physical CBO Headquarters Address" : "Mahali Ofisi Ilipo Kiambiu"} *
          </label>
          <input
            type="text"
            required
            value={settings.physicalAddress}
            onChange={(e) => handleChange("physicalAddress", e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
            {lang === "en" ? "Corporate Email & Phone Contact Details" : "Barua Pepe na Nambari za Simu"} *
          </label>
          <input
            type="text"
            required
            value={settings.emailAndPhone}
            onChange={(e) => handleChange("emailAndPhone", e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
            {lang === "en" ? "Safeguarding & Whistleblower Contact Info" : "Mawasiliano ya Usalama na Hifadhi ya Siri"} *
          </label>
          <input
            type="text"
            required
            value={settings.safeguardingContact ?? "Safeguarding Officer: +254 798 132 410 (barshoshotalents@gmail.com)"}
            onChange={(e) => handleChange("safeguardingContact", e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-sans"
          />
        </div>

        <div className="border-t pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen size={16} className="text-[#E31E24]" />
                {lang === "en" ? "Member Handbook Bylaws & Policies Editor" : "Kihariri cha Kanuni za Mwongozo wa Wanachama"}
              </h3>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                {lang === "en"
                  ? `Current published version: v${settings.handbookVersion || "1.0"} (${settings.handbookUpdatedAt || "2026-07-22"})`
                  : `Toleo la sasa lililochapishwa: v${settings.handbookVersion || "1.0"} (${settings.handbookUpdatedAt || "2026-07-22"})`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddSection}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1 border border-neutral-300"
              >
                <Plus size={14} />
                {lang === "en" ? "Add Section" : "Ongeza Sehemu"}
              </button>
              <button
                type="button"
                onClick={handlePublishHandbookUpdate}
                className="bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1 shadow-xs"
              >
                <ShieldCheck size={14} />
                {lang === "en" ? "Publish Update" : "Chapisha Toleo"}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
              {lang === "en" ? "Annual Renewal Fee (Kshs)" : "Ada ya Urejeshaji wa Mwaka (Kshs)"} *
            </label>
            <input
              type="number"
              required
              min={0}
              value={settings.renewalFee ?? 500}
              onChange={(e) => handleChange("renewalFee", parseInt(e.target.value) || 0)}
              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono font-bold max-w-xs"
            />
          </div>

          <div className="border-t border-neutral-200 pt-4 space-y-4">
            <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wide">
              {lang === "en" ? "Performance Revenue Policy" : "Sera ya Mapato ya Maonyesho"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                  {lang === "en" ? "Org Cut on Performance Fees (%)" : "Sehemu ya Shirika (%)"}
                </label>
                <input
                  type="number" min={0} max={100}
                  value={settings.performanceOrgCutPercent ?? 30}
                  onChange={(e) => handleChange("performanceOrgCutPercent", parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono font-bold"
                />
                <p className="text-[9px] text-neutral-500">{lang === "en" ? "Taken automatically when a performance invoice is marked paid." : "Inatolewa kiotomatiki ankara inapolipwa."}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                  {lang === "en" ? "Default Membership Deduction (%)" : "Makato ya Uanachama (%)"}
                </label>
                <input
                  type="number" min={0} max={100}
                  value={settings.performanceMembershipDeductionPercent ?? 10}
                  onChange={(e) => handleChange("performanceMembershipDeductionPercent", parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono font-bold"
                />
                <p className="text-[9px] text-neutral-500">{lang === "en" ? "Default rate suggested on each Cast Payment List." : "Kiwango cha kawaida kinachopendekezwa."}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                  {lang === "en" ? "Petty Cash Threshold (Kshs)" : "Kikomo cha Fedha Ndogo (Kshs)"}
                </label>
                <input
                  type="number" min={0}
                  value={settings.pettyCashThreshold ?? 1000}
                  onChange={(e) => handleChange("pettyCashThreshold", parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono font-bold"
                />
                <p className="text-[9px] text-neutral-500">{lang === "en" ? "Spends at or below this can use the fast Petty Cash log." : "Matumizi chini ya kiwango hiki yanaweza kutumia Fedha Ndogo."}</p>
              </div>
            </div>
          </div>

          {/* Repeatable Section Editor Cards */}
          <div className="space-y-3 pt-2">
            {((settings.handbookSections && settings.handbookSections.length > 0)
              ? settings.handbookSections
              : SEED_HANDBOOK_SECTIONS
            ).map((sec, idx) => {
              const isOpen = openSections[sec.id] ?? false;

              return (
                <div
                  key={sec.id || idx}
                  className="bg-neutral-50 border border-neutral-200 rounded-xl overflow-hidden shadow-2xs"
                >
                  <div
                    onClick={() => toggleSection(sec.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSection(sec.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={!!openSections[sec.id]}
                    className="p-3 bg-white flex items-center justify-between cursor-pointer border-b border-neutral-200 select-none hover:bg-neutral-50/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-700 text-[10px] font-bold flex items-center justify-center border">
                        {idx + 1}
                      </span>
                      <h4 className="text-xs font-bold text-neutral-800">
                        {sec.title.en || `Section ${idx + 1}`}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveSection(idx, "up")}
                        className="p-1 text-neutral-500 hover:text-neutral-800 disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === (settings.handbookSections?.length || SEED_HANDBOOK_SECTIONS.length) - 1}
                        onClick={() => handleMoveSection(idx, "down")}
                        className="p-1 text-neutral-500 hover:text-neutral-800 disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSection(idx)}
                        className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                        title="Delete Section"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSection(sec.id)}
                        className="p-1 text-neutral-500 hover:text-neutral-700 cursor-pointer ml-1"
                      >
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="p-4 space-y-3 bg-neutral-50/80 border-t border-neutral-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-neutral-500">
                            Title (English)
                          </label>
                          <input
                            type="text"
                            value={sec.title.en}
                            onChange={(e) => handleUpdateSection(idx, "title_en", e.target.value)}
                            className="w-full bg-white border border-neutral-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-red-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-neutral-500">
                            Title (Swahili)
                          </label>
                          <input
                            type="text"
                            value={sec.title.sw}
                            onChange={(e) => handleUpdateSection(idx, "title_sw", e.target.value)}
                            className="w-full bg-white border border-neutral-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-red-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-neutral-500">
                            Body Text (English)
                          </label>
                          <textarea
                            rows={5}
                            value={sec.body.en}
                            onChange={(e) => handleUpdateSection(idx, "body_en", e.target.value)}
                            className="w-full bg-white border border-neutral-200 rounded-lg p-2 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-red-500 font-sans"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-neutral-500">
                            Body Text (Swahili)
                          </label>
                          <textarea
                            rows={5}
                            value={sec.body.sw}
                            onChange={(e) => handleUpdateSection(idx, "body_sw", e.target.value)}
                            className="w-full bg-white border border-neutral-200 rounded-lg p-2 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-red-500 font-sans"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700 font-semibold flex items-center gap-1.5 animate-fade-in">
            <CheckCircle size={14} className="text-emerald-600" />
            <span>{lang === "en" ? "Organization Settings updated successfully! All documents updated." : "Mipangilio imehifadhiwa! Nyaraka zote zimesasishwa."}</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-3 border-t">
          <button
            type="button"
            onClick={handlePublishHandbookUpdate}
            className="bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck size={14} />
            {lang === "en" ? "Publish Handbook v" + ((parseFloat(settings.handbookVersion || "1.0") + 0.1).toFixed(1)) : "Chapisha Toleo Jipya"}
          </button>

          <button
            type="submit"
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg cursor-pointer shadow-sm transition-colors"
          >
            {lang === "en" ? "Propagate Settings" : "Hifadhi na Sambaza"}
          </button>
        </div>
      </form>

      {/* CHAIRPERSON PROFILE & CREDENTIALS SECTION */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div>
          <span className="text-red-700 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
            {lang === "en" ? "ADMINISTRATOR CREDENTIALS" : "WASIFU WA MTAWALA"}
          </span>
          <h3 className="text-sm font-black text-neutral-900 mt-2 uppercase font-sans">
            {lang === "en" ? "My Chairperson Profile & Account Settings" : "Wasifu wa Mwenyekiti & Mipangilio ya Akaunti"}
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {lang === "en"
              ? "Update your administrative name, email address, phone, and secure PIN/Password. Your updated email will serve as your active login."
              : "Sasisha jina, barua pepe yako, nambari ya simu, na nenosiri au PIN. Barua pepe uliyoweka ndio itatumika kuingia."}
          </p>
        </div>

        {profileSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{profileSuccess}</span>
          </div>
        )}

        {profileError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800 font-semibold flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleUpdateAdminProfile} className="space-y-4">
          {/* Chairperson Avatar Upload */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
            <div className="w-16 h-20 bg-gray-250 rounded-lg overflow-hidden border border-neutral-300 shadow-inner flex-shrink-0 flex items-center justify-center relative group">
              <img
                src={adminAvatar || `https://i.pravatar.cc/150?img=9`}
                alt="Admin Photo"
                className="w-full h-full object-cover"
              />
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px] font-bold">
                  {lang === "en" ? "Uploading..." : "Inapandisha..."}
                </div>
              )}
            </div>
            <div className="space-y-1.5 text-center sm:text-left flex-grow">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                {lang === "en" ? "Chairperson Photo" : "Picha ya Mwenyekiti"}
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all shadow-sm inline-flex items-center gap-1.5">
                  <span> {lang === "en" ? "Choose Photo" : "Chagua Picha"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAdminPhotoChange}
                  />
                </label>
                <span className="text-[10px] text-neutral-500 font-mono">
                  {lang === "en" ? "Max 1.5MB (Passport style)" : "Isizidi 1.5MB (Mtindo wa Pasipoti)"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                {lang === "en" ? "Full Name" : "Jina Kamili"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-neutral-500">
                  <User size={12} />
                </span>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                {lang === "en" ? "Login Email" : "Barua Pepe"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-neutral-500">
                  <Mail size={12} />
                </span>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                {lang === "en" ? "Phone Number" : "Nambari ya Simu"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-neutral-500">
                  <Phone size={12} />
                </span>
                <input
                  type="text"
                  required
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1 max-w-sm">
            <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
              {lang === "en" ? "Change PIN / Password (At least 6 characters if currently using default 1234)" : "Badilisha PIN / Nenosiri (Angalau herufi 6 ikiwa kwa sasa unatumia chaguo-msingi 1234)"}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-neutral-500">
                <Key size={12} />
              </span>
              <input
                type="password"
                value={adminPin}
                placeholder="Leave blank to keep current PIN"
                onChange={(e) => setAdminPin(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 placeholder:text-neutral-300"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-xs"
            >
              {lang === "en" ? "Save Admin Profile" : "Hifadhi Wasifu wa Mwenyekiti"}
            </button>
          </div>
        </form>

        {/* Other Administrative Accounts (if any exist) */}
        {otherAdmins.length > 0 && (
          <div className="pt-4 border-t space-y-3">
            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert size={12} className="text-red-500" /> {lang === "en" ? "Other Administrative Accounts (Can be Cleared)" : "Akaunti Nyingine za Utawala (Zinaweza Kufutwa)"}
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {otherAdmins.map((p) => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-bold text-neutral-800">{p.name}</p>
                    <p className="text-[10px] font-mono text-neutral-500 flex items-center gap-3">
                      <span>{p.email}</span>
                      <span>•</span>
                      <span>{p.phone}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteOtherAdmin(p.id)}
                    className="p-2 text-neutral-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                    title={lang === "en" ? "Delete administrative profile" : "Futa akaunti"}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ADMINISTRATIVE MEMBER PASSWORD RESET */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <span className="text-red-700 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
            {lang === "en" ? "MEMBER PASSWORD RESET" : "SARESHA UPYA NENOSIRI LA MWANACHAMA"}
          </span>
          <h3 className="text-sm font-black text-neutral-900 mt-2 uppercase font-sans">
            {lang === "en" ? "Reset Member Password / PIN" : "Weka Upya PIN / Nenosiri la Mwanachama"}
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {lang === "en"
              ? "If a member has forgotten their credentials, choose their profile below to reset their login PIN directly."
              : "Ikiwa mwanachama amesahau nenosiri lake, chagua wasifu wake hapa chini ili kumwekea PIN mpya moja kwa moja."}
          </p>
        </div>

        {resetSuccessMessage && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-semibold flex items-center gap-1.5 animate-fade-in">
            <CheckCircle size={14} className="text-emerald-600" />
            <span>{resetSuccessMessage}</span>
          </div>
        )}

        {resetErrorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 font-semibold flex items-center gap-1.5 animate-fade-in">
            <AlertTriangle size={14} className="text-red-600" />
            <span>{resetErrorMessage}</span>
          </div>
        )}

        <form onSubmit={handleAdminResetPassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                {lang === "en" ? "Select Member" : "Chagua Mwanachama"}
              </label>
              <select
                value={resetSelectedUserId}
                onChange={(e) => setResetSelectedUserId(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="">-- {lang === "en" ? "Select a member" : "Chagua mwanachama"} --</option>
                {allProfiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                {lang === "en" ? "New PIN / Password" : "PIN / Nenosiri Jipya"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-neutral-500">
                  <Lock size={12} />
                </span>
                <input
                  type="password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder={lang === "en" ? "Minimum 6 characters recommended" : "Angalau herufi 6 inapendekezwa"}
                  className="w-full bg-white border border-[#E5E5E5] rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 placeholder:text-neutral-300"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isResetting}
              className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isResetting ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin inline-block"></span>
                  {lang === "en" ? "Resetting..." : "Inarekebisha..."}
                </>
              ) : (
                lang === "en" ? "Reset Password" : "Weka Upya Nenosiri"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* DYNAMIC ROLE MANAGEMENT PANEL (CHAIRPERSON ONLY) */}
      <RoleManagementPanel lang={lang} allProfiles={allProfiles} fetchProfiles={fetchProfiles} currentUser={currentUser} />

      {/* ADMIN DATA EXPORT PANEL (CHAIRPERSON ONLY) */}
      <AdminExportPanel lang={lang} />

      {/* DANGER ZONE: DATA PURGE (CHAIRPERSON ONLY) */}
      <AdminPurgePanel lang={lang} />
    </div>
  );
}

function AdminPurgePanel({ lang }: { lang: "en" | "sw" }) {
  const [purging, setPurging] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [purgeError, setPurgeError] = React.useState("");
  const [purgeSuccess, setPurgeSuccess] = React.useState(false);

  const requiredWord = lang === "en" ? "PURGE" : "FUTA";

  const handlePurgeData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText.trim() !== requiredWord) {
      setPurgeError(
        lang === "en"
          ? `Please type "${requiredWord}" to confirm.`
          : `Tafadhali andika "${requiredWord}" ili kudhibitisha.`
      );
      return;
    }

    setPurging(true);
    setPurgeError("");
    setPurgeSuccess(false);

    try {
      const res = await fetch("/api/admin/purge-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Purge request failed.");
      }

      // Clear local caches to prevent stale demo data from returning
      const currentUserRaw = localStorage.getItem("bashosh_os_active_user");
      const currentLang = localStorage.getItem("bashosh_os_language");
      
      StorageService.clearAllLocalData();
      
      if (currentUserRaw) {
        localStorage.setItem("bashosh_os_active_user", currentUserRaw);
      }
      if (currentLang) {
        localStorage.setItem("bashosh_os_language", currentLang);
      }

      setPurgeSuccess(true);
      setConfirmText("");
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err: any) {
      setPurgeError(err.message || "Purge failed");
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-xs space-y-4 text-neutral-900 mt-6">
      <div>
        <span className="text-red-700 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-100 border border-red-200 rounded px-1.5 py-0.5 flex items-center gap-1.5 w-fit">
          <ShieldAlert size={12} className="text-red-600" /> {lang === "en" ? "DANGER ZONE - DESTRUCTIVE ACTION" : "ENEO LA HATARI - TENDO LA MAANGAMIZI"}
        </span>
        <h3 className="text-sm font-black text-red-950 mt-2 uppercase font-sans">
          {lang === "en" ? "Initialize Clean Slate (Clear Mock Data)" : "Anza Upya Safi (Futa Data Zote za Maandamano)"}
        </h3>
        <p className="text-xs text-red-800 mt-1 leading-relaxed font-medium">
          {lang === "en"
            ? "This will permanently delete all dynamic CBO data (Budgets, Expenditures, Incomes, Invoices, Partners, Leave requests, Safeguarding records, and Student Classes). Your active Admin session will be preserved, but all other seeded demo accounts will be removed. This cannot be undone."
            : "Hii itafuta kabisa maelezo yote ya maandamano (Bajeti, Matumizi, Mapato, Ankara, Washirika, Maombi ya likizo, Ripoti za ulinzi, na Madarasa ya wanafunzi). Wasifu wako wa Mwenyekiti utahifadhiwa lakini akaunti zingine zote za maandamano zitafutwa."}
        </p>
      </div>

      {purgeError && (
        <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-1.5">
          <AlertTriangle size={14} className="text-red-600" />
          <span>{purgeError}</span>
        </div>
      )}

      {purgeSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
          <CheckCircle size={14} className="text-emerald-600" />
          <span>{lang === "en" ? "Database successfully purged! App is reloading into a clean slate..." : "Data zote zimefutwa kikamilifu! Mfumo unaanza upya..."}</span>
        </div>
      )}

      <form onSubmit={handlePurgeData} className="space-y-3">
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-red-900 uppercase">
            {lang === "en" 
              ? `Type "${requiredWord}" below to authorize database purge`
              : `Andika "${requiredWord}" hapa chini ili kuruhusu ufutaji`}
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={requiredWord}
            disabled={purging || purgeSuccess}
            className="w-full max-w-xs bg-white border border-red-200 rounded-lg px-3 py-2 text-xs font-bold text-red-950 focus:outline-none focus:ring-1 focus:ring-red-500 uppercase tracking-widest placeholder-red-200 font-sans"
          />
        </div>

        <button
          type="submit"
          disabled={purging || confirmText.trim() !== requiredWord || purgeSuccess}
          className="bg-red-600 hover:bg-red-700 disabled:bg-red-200 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
        >
          {purging ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin inline-block"></span>
              {lang === "en" ? "Purging Firestore..." : "Inafuta Firestore..."}
            </>
          ) : (
            <>
              <Database size={14} /> {lang === "en" ? "Purge & Initialize Database" : "Futa Data & Anza Upya"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function AdminExportPanel({ lang }: { lang: "en" | "sw" }) {
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState("");
  const [exportSuccess, setExportSuccess] = React.useState(false);

  const handleExportData = async () => {
    setExporting(true);
    setExportError("");
    setExportSuccess(false);
    try {
      const res = await fetch("/api/admin/export");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Export denied or failed");
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bashosho_backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 5000);
    } catch (err: any) {
      setExportError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm space-y-4 text-white">
      <div>
        <span className="text-[#E31E24] font-mono text-[9px] font-bold tracking-widest uppercase bg-red-950 border border-red-900 rounded px-1.5 py-0.5">
          {lang === "en" ? "ADMINISTRATIVE DISASTER RECOVERY" : "HAKIKISHA USALAMA WA DATA"}
        </span>
        <h3 className="text-sm font-black text-neutral-100 mt-2 uppercase font-sans">
          {lang === "en" ? "Export Full Encrypted Database" : "Pakua Nakala Kamili ya Data"}
        </h3>
        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
          {lang === "en"
            ? "Download a completely consolidated, cryptographically signed JSON file containing all CBO data, members, financial ledgers, and append-only audit trails for offline backup and recovery."
            : "Pakua nakala kamili ya maelezo yote ya kikundi ikiwemo orodha ya wanachama, ripoti za fedha na kumbukumbu zote za usalama kwa uhifadhi wa nje."}
        </p>
      </div>

      {exportError && (
        <div className="p-3 bg-red-950/50 border border-red-900 rounded-xl text-xs text-red-400 font-semibold flex items-center gap-1.5">
          <AlertTriangle size={14} className="text-red-500" />
          <span>{exportError}</span>
        </div>
      )}

      {exportSuccess && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-900 rounded-xl text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
          <CheckCircle size={14} className="text-emerald-500" />
          <span>{lang === "en" ? "Cryptographically sealed backup file generated and downloaded successfully!" : "Nakala iliyosimbwa imetayarishwa na kupakuliwa kikamilifu!"}</span>
        </div>
      )}

      <div className="flex justify-start">
        <button
          onClick={handleExportData}
          disabled={exporting}
          className="bg-[#E31E24] hover:bg-[#c21419] disabled:bg-neutral-800 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
        >
          {exporting ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin inline-block"></span>
              {lang === "en" ? "Packing & Encrypting Backup..." : "Inapakua na Kusimba..."}
            </>
          ) : (
            <>
              <Download size={14} /> {lang === "en" ? "Download Cryptographic Backup" : "Pakua Nakala ya Siri"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
