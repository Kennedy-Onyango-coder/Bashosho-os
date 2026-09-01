/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { UserProfile, Document, UserRole, getUserRoleKey, getCanonicalRoleKey, RolePermissions, PermissionModuleKey, PermissionAction, emptyModulePermissionSet } from "./types";
import { StorageService } from "./lib/storage";
import { Modal } from "./components/Modal";
import DemoRoleSelector from "./components/DemoRoleSelector";
import LoginScreen from "./components/LoginScreen";
import ForceChangePasswordScreen from "./components/ForceChangePasswordScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import PrintWrapper from "./components/PrintWrapper";
import Dashboard from "./components/Dashboard";
import BashoshoLogo from "./components/BashoshoLogo";
import { motion, AnimatePresence } from "motion/react";
import PublicVerificationScreen from "./components/PublicVerificationScreen";
import HomePage from "./components/HomePage";

// Code-split (section 36/58 of the production audit): these are each only needed once
// a logged-in user actually opens that specific tab, but were previously bundled
// eagerly into the single main JS chunk — every visitor, including a public website
// visitor who never logs in, was downloading the Grants Board, CMS editor, financial
// ledger, and every other admin screen up front. On Bashosho's target audience (phones,
// often on slower Kenyan mobile data), that's real load time wasted on code that may
// never run in that session. React.lazy + the single <Suspense> boundary around the
// tab-content area (below) defers each one to its own chunk, fetched only when its tab
// is first opened. This is purely a loading-strategy change — every component's props,
// behavior, and permission gating stay exactly as they were.
const ActivityLogPanel = React.lazy(() => import("./components/ActivityLogPanel"));
const MemberSelfServicePanel = React.lazy(() => import("./components/MemberSelfServicePanel"));
const DocumentEditor = React.lazy(() => import("./components/DocumentEditor"));
const FinancialLedger = React.lazy(() => import("./components/FinancialLedger"));
const GrantsBoard = React.lazy(() => import("./components/GrantsBoard"));
const ClassesBoard = React.lazy(() => import("./components/ClassesBoard"));
const InvoicingBoard = React.lazy(() => import("./components/InvoicingBoard"));
const OrgSettingsScreen = React.lazy(() => import("./components/OrgSettingsScreen"));
const AssetHiringBoard = React.lazy(() => import("./components/AssetHiringBoard"));
const MemberHandbookPanel = React.lazy(() => import("./components/MemberHandbookPanel"));
const SignupReviews = React.lazy(() => import("./components/SignupReviews"));
const CmsEditor = React.lazy(() => import("./components/CmsEditor"));
const BeneficiaryRegistration = React.lazy(() => import("./components/BeneficiaryRegistration"));
const SecuritySettingsPanel = React.lazy(() => import("./components/SecuritySettingsPanel"));
const TasksBoard = React.lazy(() => import("./components/TasksBoard"));
const ProgramOutcomesBoard = React.lazy(() => import("./components/ProgramOutcomesBoard"));
const MEDashboardBoard = React.lazy(() => import("./components/MEDashboardBoard"));
const AttendanceRegisterBoard = React.lazy(() => import("./components/AttendanceRegisterBoard"));
const AdminMembersDirectory = React.lazy(() => import("./components/AdminMembersDirectory"));
const EventsCalendar = React.lazy(() => import("./components/EventsCalendar"));
const BoardMeetingsPanel = React.lazy(() => import("./components/BoardMeetingsPanel"));
const OnboardingChecklistBoard = React.lazy(() => import("./components/OnboardingChecklistBoard"));
const PeerDirectory = React.lazy(() => import("./components/PeerDirectory"));
import { 
  LayoutDashboard, 
  FileText, 
  Wallet, 
  Package, 
  BarChart3, 
  GraduationCap, 
  Receipt, 
  Settings, 
  UserCheck, 
  Globe, 
  Users, 
  Download,
  AlertTriangle,
  BookOpen,
  UserCircle2,
  ShieldCheck,
  History,
  CheckSquare,
  ClipboardList,
  UsersRound,
  CalendarDays,
  Gavel,
  ListChecks,
  X,
  PieChart
} from "lucide-react";

export default function App() {
  // Global States
  const [currentUser, setCurrentUser] = React.useState<UserProfile | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState<boolean>(true);
  const [isOnline, setIsOnline] = React.useState<boolean>(StorageService.isOnline());
  const [lang, setLang] = React.useState<"en" | "sw">(StorageService.getLanguage());
  const [errorToast, setErrorToast] = React.useState<string | null>(null);

  // Dynamic permission matrix for the current user's role. Fetched once logged in and
  // re-fetched if the role changes (e.g. after a Chairperson edits the matrix and the
  // affected user's session refreshes). Falls back to "no access beyond dashboard" while
  // loading, never to "full access" — fail closed, not open.
  const [myPermissions, setMyPermissions] = React.useState<Record<PermissionModuleKey, ReturnType<typeof emptyModulePermissionSet>> | null>(null);

  const can = React.useCallback((moduleKey: PermissionModuleKey, action: PermissionAction = "view"): boolean => {
    if (!myPermissions) return false;
    return !!myPermissions[moduleKey]?.[action];
  }, [myPermissions]);

  React.useEffect(() => {
    let cancelled = false;
    if (!currentUser) {
      setMyPermissions(null);
      return;
    }
    async function loadMyPermissions() {
      try {
        const res = await fetch("/api/role_permissions/me", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load permissions");
        const data: RolePermissions = await res.json();
        if (!cancelled) setMyPermissions(data.permissions as any);
      } catch (err) {
        console.error("Failed to load current user's permissions:", err);
        // Fail closed: leave myPermissions as-is (or null) rather than granting access.
      }
    }
    loadMyPermissions();
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.role, currentUser?.roleKey]);

  
  // Pending Applications Count State
  const [pendingApplicationsCount, setPendingApplicationsCount] = React.useState<number>(0);
  
  // Navigation State
  const [activeTab, setActiveTab] = React.useState<string>("dashboard");

  // Public/Private routing states
  const [currentPath, setCurrentPath] = React.useState<string>(window.location.pathname);

  React.useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  // PWA Install prompt states
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = React.useState<boolean>(true); // Default to true so it is always discoverable
  const [showManualInstallHelp, setShowManualInstallHelp] = React.useState<boolean>(false);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent browser from showing automatic banner
      e.preventDefault();
      // Store the event
      setDeferredPrompt(e);
      // Ensure the button is shown
      setShowInstallBtn(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      // Trigger browser's native banner
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA Installation Choice: ${outcome}`);
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    } else {
      // Show manual install helper modal for devices or sandboxes where prompt event isn't natively dispatched
      setShowManualInstallHelp(true);
    }
  };

  // Document states
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [editingDoc, setEditingDoc] = React.useState<Document | undefined>(undefined);
  const [isCreatingDoc, setIsCreatingDoc] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");

  // Print Preview Overlay state
  const [printOverlay, setPrintOverlay] = React.useState<{
    show: boolean;
    title: string;
    docType: string;
    content: React.ReactNode;
    authorName?: string;
    authorRole?: string;
    authorSignatureUrl?: string;
    dateString?: string;
    verificationUrl?: string;
  }>({
    show: false,
    title: "",
    docType: "DOCUMENT",
    content: null
  });

  // Assets list (Phase 2 preview)
  const [assets, setAssets] = React.useState<any[]>([]);
  const [assetSearch, setAssetSearch] = React.useState("");

  // Live clock state
  const [timeStr, setTimeStr] = React.useState("");

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, "0");
      const minutes = String(now.getUTCMinutes()).padStart(2, "0");
      setTimeStr(`${hours}:${minutes} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const appEnv = (import.meta as any).env?.VITE_APP_ENV || ((import.meta as any).env?.MODE === "production" ? "PRODUCTION_CLOUD" : "LOCAL_DEVELOPMENT");

  // Load database and session on mount
  React.useEffect(() => {
    const checkAuthAndSync = async () => {
      try {
        // First check and purge stale local cache if schema version changed
        StorageService.checkAndInvalidateCache();

        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          StorageService.setActiveUser(data.user);
          if (data.systemMode) {
            localStorage.setItem("bashosh_os_system_mode", data.systemMode);
          }
          if (StorageService.isOnline()) {
            await StorageService.pullFromServer();
          }
          setDocuments(StorageService.getDocuments());
          setAssets(StorageService.getAssets());
          setCurrentUser(data.user);
        } else {
          // Check local cached session fallback if completely offline
          if (!StorageService.isOnline()) {
            const localUser = StorageService.getActiveUser();
            if (localUser) {
              setCurrentUser(localUser);
            }
          } else {
            setCurrentUser(null);
          }
        }
      } catch (e) {
        const localUser = StorageService.getActiveUser();
        if (localUser) {
          setCurrentUser(localUser);
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuthAndSync();
  }, []);

  // Periodic background polling & window focus sync to guarantee live multi-session sync
  React.useEffect(() => {
    if (!currentUser || !isOnline) return;

    const performLiveSync = async () => {
      if (StorageService.isOnline()) {
        await StorageService.pullFromServer();
      }
    };

    // Poll every 20 seconds
    const interval = setInterval(performLiveSync, 20000);

    // Sync immediately on tab focus or visibility change
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === "visible") {
        performLiveSync();
      }
    };

    window.addEventListener("focus", handleFocusOrVisibility);
    document.addEventListener("visibilitychange", handleFocusOrVisibility);

    // Automatic network reconnection handler
    const handleNetworkOnline = async () => {
      console.log("[Network] Connection restored. Flushing offline queue and pulling server data...");
      setIsOnline(true);
      StorageService.setOnlineMode("online");
      await StorageService.syncOfflineQueue();
      await StorageService.pullFromServer();
      setDocuments(StorageService.getDocuments());
      setAssets(StorageService.getAssets());
    };

    window.addEventListener("online", handleNetworkOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocusOrVisibility);
      document.removeEventListener("visibilitychange", handleFocusOrVisibility);
      window.removeEventListener("online", handleNetworkOnline);
    };
  }, [currentUser, isOnline]);

  React.useEffect(() => {
    const handleError = (e: Event) => {
      const customEvent = e as CustomEvent;
      const message = customEvent.detail?.message || "An error occurred";
      setErrorToast(message);
    };

    const handleProfileUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setCurrentUser(customEvent.detail);
        StorageService.setActiveUser(customEvent.detail);
      }
    };

    window.addEventListener("bashosho_os_error", handleError);
    window.addEventListener("bashosh_os_profile_updated", handleProfileUpdated);
    return () => {
      window.removeEventListener("bashosho_os_error", handleError);
      window.removeEventListener("bashosh_os_profile_updated", handleProfileUpdated);
    };
  }, []);

  React.useEffect(() => {
    if (currentUser) {
      setDocuments(StorageService.getDocuments());
      setAssets(StorageService.getAssets());
    }
  }, [currentUser]);

  // Fetch and poll count of pending applications
  React.useEffect(() => {
    const curRoleKey = getUserRoleKey(currentUser) as UserRole;
  if (currentUser && [UserRole.CHAIRPERSON, UserRole.VICE_CHAIRPERSON].includes(curRoleKey)) {
      const fetchCount = async () => {
        try {
          const res = await fetch("/api/signup_applications");
          if (res.ok) {
            const data = await res.json();
            const pendingCount = data.filter((app: any) => app.status === "pending").length;
            setPendingApplicationsCount(pendingCount);
          }
        } catch (e) {
          console.error("Failed to fetch pending applications count:", e);
        }
      };
      fetchCount();
      const interval = setInterval(fetchCount, 60000); // check every 60 seconds
      return () => clearInterval(interval);
    } else {
      setPendingApplicationsCount(0);
    }
  }, [currentUser]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    StorageService.clearAllLocalData();
    setCurrentUser(null);
    window.location.href = "/";
  };

  // Handle Language toggle
  const handleLangChange = (selectedLang: "en" | "sw") => {
    setLang(selectedLang);
    StorageService.setLanguage(selectedLang);
  };

  // Toggle online connectivity simulation
  const handleToggleOnline = async (online: boolean) => {
    setIsOnline(online);
    StorageService.setOnlineMode(online ? "online" : "offline");
    if (online) {
      const syncedCount = await StorageService.syncOfflineQueue();
      if (syncedCount > 0) {
        // Trigger state refresh
        setDocuments(StorageService.getDocuments());
        setAssets(StorageService.getAssets());
        alert(lang === "en" ? `Sync Successful! ${syncedCount} offline mutations replicated to cloud.` : `Usawazishaji Umekamilika! Matendo ${syncedCount} yamehifadhiwa mtandaoni.`);
      } else {
        await StorageService.pullFromServer();
        setDocuments(StorageService.getDocuments());
        setAssets(StorageService.getAssets());
      }
    }
  };

  // Document Save callback
  const handleSaveDocument = (savedDoc: Document) => {
    const updatedDocs = documents.some(d => d.id === savedDoc.id)
      ? documents.map(d => (d.id === savedDoc.id ? savedDoc : d))
      : [savedDoc, ...documents];

    setDocuments(updatedDocs);
    StorageService.saveRecord("documents", savedDoc).catch(console.error);
    
    // Close forms
    setIsCreatingDoc(false);
    setEditingDoc(undefined);
  };

  // Print Document Trigger
  const handleTriggerPrint = async (doc: Document) => {
    const printContent = (
      <div className="space-y-4 text-left font-serif whitespace-pre-wrap leading-relaxed text-sm">
        {doc.content}
      </div>
    );
    const baseOverlay = {
      show: true,
      title: doc.title,
      docType: doc.type.toUpperCase(),
      authorName: doc.author,
      authorRole: doc.type === "minutes" ? "Secretary" : "Programs Director",
      // Only attach a real signature image when the person printing is actually the
      // document's author — we don't have a lookup of other members' profiles here,
      // and showing an unrelated person's signature (or guessing) would be worse than
      // the honest "Awaiting uploaded signature" placeholder PrintWrapper falls back to.
      authorSignatureUrl: doc.author === currentUser?.name ? currentUser?.signatureUrl : undefined,
      dateString: doc.date,
      content: printContent
    };

    // Pull the freshest copy so the QR embeds the real, server-signed verification
    // link for this exact document rather than a stale/local one — same pattern used
    // for leadership appointment letters.
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const latest = await res.json();
        if (Array.isArray(latest)) {
          setDocuments(latest);
          const matched = latest.find((d: any) => d.id === doc.id);
          setPrintOverlay({ ...baseOverlay, verificationUrl: matched?.verificationUrl });
          return;
        }
      }
    } catch (err) {
      console.error("Failed to refresh document verification link before printing:", err);
    }
    setPrintOverlay({ ...baseOverlay, verificationUrl: doc.verificationUrl });
  };

  // Direct custom printable layouts
  const handleCustomPrint = (title: string, data: React.ReactNode) => {
    setPrintOverlay({
      show: true,
      title,
      docType: "FINANCIAL REPORT",
      content: data,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorSignatureUrl: currentUser.signatureUrl,
      dateString: new Date().toLocaleDateString("en-KE"),
      qrValue: `FIN-${Date.now().toString().slice(-6)}`
    });
  };

  // Filters for documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (currentPath.startsWith("/verify/")) {
    return <PublicVerificationScreen path={currentPath} />;
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#E31E24]"></div>
        <div className="w-12 h-12 rounded-full border-4 border-[#E31E24] border-t-transparent animate-spin mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 font-mono animate-pulse">
          Bashosho OS: Loading Secure Session...
        </p>
      </div>
    );
  }

  if (currentPath !== "/portal") {
    return (
      <HomePage
        lang={lang}
        onChangeLang={handleLangChange}
        onNavigateToPortal={() => navigateTo("/portal")}
      />
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={async (user) => {
          setIsCheckingAuth(true);
          StorageService.setActiveUser(user);
          if (StorageService.isOnline()) {
            try {
              await StorageService.pullFromServer();
            } catch (err) {
              console.warn("Post-login server pull warning:", err);
            }
          }
          setDocuments(StorageService.getDocuments());
          setAssets(StorageService.getAssets());
          setCurrentUser(user);
          setIsCheckingAuth(false);
        }}
        lang={lang}
        onChangeLang={handleLangChange}
        onBackToHome={() => navigateTo("/")}
      />
    );
  }

  if (currentUser.mustChangePassword) {
    return (
      <ForceChangePasswordScreen
        currentUser={currentUser}
        onPasswordChanged={(updatedUser) => {
          setCurrentUser(updatedUser);
          StorageService.setActiveUser(updatedUser);
        }}
        lang={lang}
      />
    );
  }

  const currentHandbookVersion = StorageService.getOrgSettings().handbookVersion || "1.0";
  if (currentUser.handbookAcknowledgedVersion !== currentHandbookVersion) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center py-8 px-4">
        <div className="max-w-3xl w-full">
          <div className="bg-[#1B1B1B] text-white rounded-t-2xl px-6 py-4">
            <p className="text-xs uppercase tracking-wider text-neutral-500 font-bold">Required before you continue</p>
            <h1 className="text-lg font-bold">Please review and agree to the Member Handbook</h1>
          </div>
          <div className="bg-white border border-neutral-200 rounded-b-2xl shadow-sm">
            <ErrorBoundary fallbackTitle="Member Handbook Failure">
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-neutral-500">Loading...</div>}>
              <MemberHandbookPanel
                currentUser={currentUser}
                lang={lang}
                onAcknowledge={(version) => {
                  const updated = {
                    ...currentUser,
                    handbookAcknowledgedVersion: version,
                    handbookAcknowledgedAt: new Date().toISOString().split("T")[0],
                  };
                  setCurrentUser(updated);
                  StorageService.setActiveUser(updated);
                }}
              />
            </React.Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans text-[#1B1B1B] antialiased selection:bg-[#E31E24]/10 selection:text-[#E31E24]">
      
      {/* Top Demo selector and configuration header bar */}
      <DemoRoleSelector
        activeProfile={currentUser}
        onLogout={handleLogout}
        isOnline={isOnline}
        onToggleOnline={handleToggleOnline}
        lang={lang}
        onChangeLang={handleLangChange}
      />

      {/* Main OS Page Container */}
      <div className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Navigation Sidebar panel */}
        <aside className="lg:col-span-3 flex flex-col space-y-4 print:hidden">
          {/* Brand Shield Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full border-4 border-[#E31E24] flex items-center justify-center p-1.5 border-t-[#00A651] border-r-[#00A651] mb-3">
              <BashoshoLogo size={60} showText={false} />
            </div>
            <h1 className="text-base font-bold tracking-tight text-[#E31E24]">
              {lang === "en" ? "BASHOSHO OS" : "MFUMO WA BASHOSHO"}
            </h1>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mt-1">
              {currentUser.role}
            </p>
            <p className="text-[9px] font-bold text-[#00A651] font-mono uppercase mt-0.5">
              Kiambiu Nairobi, CBO
            </p>
          </div>

          {/* Nav Tabs List */}
          {/* 
            NOTE: Role-based navigation visibility below controls client-side presentation.
            All critical API endpoints and data access are enforced server-side via JWT authentication
            and role-based validation middleware (requireRole) on the Express backend.
          */}
          <nav className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm space-y-1">
            <button
              onClick={() => { setActiveTab("dashboard"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
              id="nav-dashboard-tab"
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-[#E31E24] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <LayoutDashboard size={14} className="shrink-0" /> {lang === "en" ? "Dashboard" : "Dashibodi"}
            </button>

            {(() => {
              const uRoleKey = getUserRoleKey(currentUser) as UserRole;
              return (
                <>
                  {can("documents") && (
                    <button
                      onClick={() => { setActiveTab("documents"); }}
                      id="nav-documents-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "documents"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <FileText size={14} className="shrink-0" /> {lang === "en" ? "Archives" : "Nyaraka za CBO"}
                    </button>
                  )}

                  {can("finance") && (
                    <button
                      onClick={() => { setActiveTab("finance"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-finance-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "finance"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Wallet size={14} className="shrink-0" /> {lang === "en" ? "Finance" : "Fedha na Malipo"}
                    </button>
                  )}

                  {can("assets") && (
                    <button
                      onClick={() => { setActiveTab("assets"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-assets-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "assets"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Package size={14} className="shrink-0" /> {lang === "en" ? "Assets" : "Rasilimali / Mali"}
                    </button>
                  )}

                  {/* Supplemental Navigation Tabs */}
                  {can("grants") && (
                    <button
                      onClick={() => { setActiveTab("grants"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-grants-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "grants"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <BarChart3 size={14} className="shrink-0" /> {lang === "en" ? "Grants" : "Bodi ya Ruzuku"}
                    </button>
                  )}

                  <button
                    onClick={() => { setActiveTab("classes"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                    id="nav-classes-tab"
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "classes"
                        ? "bg-[#E31E24] text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <GraduationCap size={14} className="shrink-0" /> {lang === "en" ? "Classes" : "Madarasa na Vyeti"}
                  </button>

                  {can("invoices") && (
                    <button
                      onClick={() => { setActiveTab("invoices"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-invoices-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "invoices"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Receipt size={14} className="shrink-0" /> {lang === "en" ? "Invoices" : "Ankara za Washiriki"}
                    </button>
                  )}

                  <button
                    onClick={() => { setActiveTab("handbook"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                    id="nav-handbook-tab"
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "handbook"
                        ? "bg-[#E31E24] text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <BookOpen size={14} className="shrink-0" /> {lang === "en" ? "Handbook" : "Mwongozo na Katiba"}
                  </button>

                  <button
                    onClick={() => { setActiveTab("security"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                    id="nav-security-tab"
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "security"
                        ? "bg-[#E31E24] text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <ShieldCheck size={14} className="shrink-0" /> {lang === "en" ? "Security" : "Usalama na 2FA"}
                  </button>

                  {can("settings") && (
                    <button
                      onClick={() => { setActiveTab("settings"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-settings-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "settings"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Settings size={14} className="shrink-0" /> {lang === "en" ? "Settings" : "Mipangilio ya CBO"}
                    </button>
                  )}

                  {can("signup_reviews") && (
                    <>
                      <button
                        onClick={() => { setActiveTab("signup_reviews"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                        id="nav-signup-reviews-tab"
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          activeTab === "signup_reviews"
                            ? "bg-[#E31E24] text-white shadow-sm"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <UserCheck size={14} className="shrink-0" /> {lang === "en" ? "Applications" : "Maombi ya Kujiunga"}
                        </span>
                        {pendingApplicationsCount > 0 && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black font-mono leading-none ${
                            activeTab === "signup_reviews" ? "bg-white text-red-600 animate-pulse" : "bg-red-600 text-white"
                          }`}>
                            {pendingApplicationsCount}
                          </span>
                        )}
                      </button>

                      </>
                  )}
                  {can("cms_editor") && (
                      <button
                        onClick={() => { setActiveTab("cms_editor"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                        id="nav-cms-editor-tab"
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          activeTab === "cms_editor"
                            ? "bg-[#E31E24] text-white shadow-sm"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <Globe size={14} className="shrink-0" /> {lang === "en" ? "Website" : "Uhariri wa Tovuti"}
                      </button>
                  )}

                  {can("beneficiaries") && (
                    <button
                      onClick={() => { setActiveTab("beneficiaries"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-beneficiaries-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "beneficiaries"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Users size={14} className="shrink-0" /> {lang === "en" ? "Beneficiaries" : "Sajili Wafaidika"}
                    </button>
                  )}

                  {can("activity_log") && (
                    <button
                      onClick={() => { setActiveTab("activity_log"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-activity-log-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "activity_log"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <History size={14} className="shrink-0" /> {lang === "en" ? "Activity Log" : "Kumbukumbu za Shughuli"}
                    </button>
                  )}

                  {can("tasks") && (
                    <button
                      onClick={() => { setActiveTab("tasks"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-tasks-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "tasks"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <CheckSquare size={14} className="shrink-0" /> {lang === "en" ? "Tasks" : "Majukumu"}
                    </button>
                  )}

                  {can("program_sessions") && (
                    <button
                      onClick={() => { setActiveTab("program_sessions"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-program-sessions-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "program_sessions"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <BarChart3 size={14} className="shrink-0" /> {lang === "en" ? "Program Outcomes" : "Matokeo ya Mipango"}
                    </button>
                  )}

                  {can("program_sessions") && (
                    <button
                      onClick={() => { setActiveTab("me_dashboard"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-me-dashboard-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "me_dashboard"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <PieChart size={14} className="shrink-0" /> {lang === "en" ? "M&E Dashboard" : "Dashibodi ya M&E"}
                    </button>
                  )}

                  {can("attendance_registers") && (
                    <button
                      onClick={() => { setActiveTab("attendance_registers"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-attendance-registers-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "attendance_registers"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <ClipboardList size={14} className="shrink-0" /> {lang === "en" ? "Attendance Registers" : "Rejista za Mahudhurio"}
                    </button>
                  )}

                  {(currentUser?.roleKey || getCanonicalRoleKey(currentUser?.role)) === "chairperson" && (
                    <button
                      onClick={() => { setActiveTab("members_directory"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-members-directory-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "members_directory"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <UsersRound size={14} className="shrink-0" /> {lang === "en" ? "Members Directory" : "Orodha ya Wanachama"}
                    </button>
                  )}

                  {can("events") && (
                    <button
                      onClick={() => { setActiveTab("events"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-events-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "events"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <CalendarDays size={14} className="shrink-0" /> {lang === "en" ? "Events & Calendar" : "Matukio na Kalenda"}
                    </button>
                  )}

                  {can("board_meetings") && (
                    <button
                      onClick={() => { setActiveTab("board_meetings"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-board-meetings-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "board_meetings"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Gavel size={14} className="shrink-0" /> {lang === "en" ? "Board Meetings" : "Mikutano ya Bodi"}
                    </button>
                  )}

                  {can("onboarding_checklists") && (
                    <button
                      onClick={() => { setActiveTab("onboarding_checklists"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      id="nav-onboarding-tab"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === "onboarding_checklists"
                          ? "bg-[#E31E24] text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <ListChecks size={14} className="shrink-0" /> {lang === "en" ? "New Member Onboarding" : "Kuanzisha Wanachama Wapya"}
                    </button>
                  )}

                  <button
                    onClick={() => { setActiveTab("peer_directory"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                    id="nav-peer-directory-tab"
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "peer_directory"
                        ? "bg-[#E31E24] text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <UsersRound size={14} className="shrink-0" /> {lang === "en" ? "Peer Directory" : "Orodha ya Wenzako"}
                  </button>

                  <button
                    onClick={() => { setActiveTab("my_records"); setIsCreatingDoc(false); setEditingDoc(undefined); }}
                    id="nav-my-records-tab"
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "my_records"
                        ? "bg-[#E31E24] text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <UserCircle2 size={14} className="shrink-0" /> {lang === "en" ? "My Records" : "Rekodi Zangu"}
                  </button>
                </>
              );
            })()}
          </nav>

          {/* PWA INSTALL BANNER */}
          {showInstallBtn && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-2xs text-left space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-black text-red-700 tracking-tight font-sans">
                    {lang === "en" ? "INSTALL BASHOSHO OS" : "SAKINISHA MFUMO"}
                  </h4>
                  <p className="text-[10px] text-red-600 mt-1 leading-relaxed font-medium">
                    {lang === "en" 
                      ? "Add Bashosho OS to your phone or desktop for full offline-capable access." 
                      : "Sakinisha mfumo huu kwenye simu au kompyuta yako upate huduma hata bila mtandao."}
                  </p>
                </div>
                <button 
                  onClick={() => setShowInstallBtn(false)}
                  className="text-red-400 hover:text-red-700 font-bold text-xs cursor-pointer p-1 rounded-lg hover:bg-red-100/50 transition-colors"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <button
                onClick={handleInstallApp}
                id="install-pwa-btn"
                className="w-full bg-[#E31E24] hover:bg-red-700 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <Download size={14} className="shrink-0" /> {lang === "en" ? "Install App" : "Sakinisha Sasa"}
              </button>
            </div>
          )}

          {/* Quick Connection Status Info Panel */}
          <div className="bg-[#1B1B1B] text-white border border-neutral-800 rounded-2xl p-4 shadow-sm text-left font-mono text-[10px] space-y-1">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5 mb-1.5">
              <span className="text-neutral-500 font-bold tracking-wider">SYSTEM TELEMETRY</span>
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-[#00A651]" : "bg-amber-500"}`}></span>
            </div>
            <p><span className="text-neutral-500">Node State:</span> <strong className={isOnline ? "text-[#00A651]" : "text-amber-400"}>{isOnline ? "SYNC_ACTIVE" : "OFFLINE_LOCAL"}</strong></p>
            <p><span className="text-neutral-500">Local Time:</span> <strong>{timeStr || "12:15 UTC"}</strong></p>
            <p><span className="text-neutral-500">Security Rule:</span> <strong>{appEnv}</strong></p>
            <p><span className="text-neutral-500">PWA SW:</span> <strong className="text-[#00A651]">PWA_COMPLIANT</strong></p>
          </div>
        </aside>

        {/* Core Stage Workspace - Right */}
        <main className="lg:col-span-9 flex flex-col space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${isCreatingDoc}-${editingDoc?.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
              className="flex-grow"
            >
              {/* TABS CONTROLLER */}
              <React.Suspense fallback={
                <div className="flex items-center justify-center py-24">
                  <div className="w-6 h-6 border-2 border-neutral-300 border-t-[#E31E24] rounded-full animate-spin" />
                </div>
              }>

              {/* TAB 1: DASHBOARD */}
              {activeTab === "dashboard" && (
                <ErrorBoundary fallbackTitle="Dashboard Load Failure">
                  <Dashboard
                    currentUser={currentUser}
                    lang={lang}
                    onPrintReport={handleCustomPrint}
                    onNavigateToTab={setActiveTab}
                  />
                </ErrorBoundary>
              )}

              {/* TAB 2: AI DOCUMENTATION & MINUTES */}
              {activeTab === "documents" && (
                <div className="space-y-6" id="documents-module-stage">
                  {/* Outer Editor vs. Listing toggle */}
                  {isCreatingDoc || editingDoc ? (
                    <ErrorBoundary fallbackTitle="Document Editor Failure">
                      <DocumentEditor
                        document={editingDoc}
                        lang={lang}
                        authorName={currentUser.name}
                        onSave={handleSaveDocument}
                        onCancel={() => { setIsCreatingDoc(false); setEditingDoc(undefined); }}
                      />
                    </ErrorBoundary>
                  ) : (
                    <div className="space-y-6 text-left">
                      {/* Section header bar */}
                      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs">
                        <div>
                          <span className="text-red-600 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
                            {lang === "en" ? "AUDITABLE ARCHIVE" : "MAKABIDHI YA KAWAIDA"}
                          </span>
                          <h2 className="text-xl font-black text-neutral-900 mt-1.5 font-sans">
                            {lang === "en" ? "Minutes, Budgets & Outreach Records" : "Kumbukumbu na Bajeti Rasmi"}
                          </h2>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {lang === "en"
                              ? "Draft, approve, and verify professional narratives in compliance with funding checklists."
                              : "Andika, thibitisha, na ukague ripoti mbalimbali za kikazi kulingana na wadhamini."}
                          </p>
                        </div>

                        <button
                          onClick={() => setIsCreatingDoc(true)}
                          id="new-document-trigger"
                          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                          {lang === "en" ? "Create Document" : "Unda Nyaraka Mpya"}
                        </button>
                      </div>

                      {/* Searches and Filters */}
                      <div className="flex flex-wrap gap-4 items-center justify-between">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={lang === "en" ? "Search documents/minutes..." : "Tafuta ripoti au kumbukumbu..."}
                          className="bg-white border border-neutral-200 rounded-lg px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 max-w-sm w-full font-medium shadow-xs"
                        />

                        <div className="flex gap-2">
                          <button
                            onClick={() => setTypeFilter("all")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              typeFilter === "all" ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-800"
                            }`}
                          >
                            {lang === "en" ? "All" : "Zote"}
                          </button>
                          <button
                            onClick={() => setTypeFilter("minutes")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              typeFilter === "minutes" ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-800"
                            }`}
                          >
                            {lang === "en" ? "Minutes" : "Vikao"}
                          </button>
                          <button
                            onClick={() => setTypeFilter("activity")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              typeFilter === "activity" ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-800"
                            }`}
                          >
                            {lang === "en" ? "Outreach Reports" : "Ripoti ya Outreaches"}
                          </button>
                          <button
                            onClick={() => setTypeFilter("proposal")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              typeFilter === "proposal" ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-800"
                            }`}
                          >
                            {lang === "en" ? "Grant Proposals" : "Mapendekezo ya Ruzuku"}
                          </button>
                        </div>
                      </div>

                      {/* Documents Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredDocuments.map((doc) => (
                          <div key={doc.id} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs text-left space-y-4 hover:border-red-500/20 transition-all">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="bg-neutral-100 text-neutral-600 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase">
                                  {doc.type}
                                </span>
                                <h3 className="text-sm font-bold text-neutral-950 mt-2 line-clamp-1">{doc.title}</h3>
                                <p className="text-[10px] text-neutral-500 font-medium mt-0.5">{doc.date} • {doc.author}</p>
                              </div>
                            </div>

                            <p className="text-xs text-neutral-500 line-clamp-3 leading-relaxed font-serif">
                              {doc.content.replace(/[#*`-]/g, "")}
                            </p>

                            <div className="pt-3 border-t border-neutral-100 flex justify-between items-center text-[10px] font-mono">
                              <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold border border-emerald-100 uppercase">
                                {doc.status}
                              </span>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingDoc(doc)}
                                  id={`edit-doc-btn-${doc.id}`}
                                  className="text-neutral-600 hover:text-neutral-900 font-bold bg-neutral-50 hover:bg-neutral-100 border rounded px-2.5 py-1 cursor-pointer transition-colors"
                                >
                                  {lang === "en" ? "Edit" : "Hariri"}
                                </button>
                                <button
                                  onClick={() => handleTriggerPrint(doc)}
                                  id={`print-doc-btn-${doc.id}`}
                                  className="text-red-600 hover:text-red-700 font-bold bg-red-50 hover:bg-red-100 border border-red-100 rounded px-2.5 py-1 cursor-pointer transition-colors"
                                >
                                  {lang === "en" ? "Print" : "Chapa"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: FINANCE */}
              {activeTab === "finance" && (
                <ErrorBoundary fallbackTitle="Financial Ledger Failure">
                  <FinancialLedger
                    currentUser={currentUser}
                    lang={lang}
                    onPrintReport={handleCustomPrint}
                  />
                </ErrorBoundary>
              )}

              {/* TAB 4: ASSETS & GEAR HIRE ENGINE */}
              {activeTab === "assets" && (
                <ErrorBoundary fallbackTitle="Asset Board Failure">
                  <AssetHiringBoard
                    currentUser={currentUser!}
                    lang={lang}
                    assets={assets}
                    canManage={can("assets", "create")}
                    onRefresh={() => {
                      setAssets(StorageService.getAssets());
                    }}
                  />
                </ErrorBoundary>
              )}

              {/* TAB 5: GRANTS */}
              {activeTab === "grants" && (
                <GrantsBoard
                  currentUser={currentUser}
                  lang={lang}
                />
              )}

              {/* TAB 6: CLASSES & WORKSHOPS */}
              {activeTab === "classes" && (
                <ClassesBoard
                  currentUser={currentUser}
                  lang={lang}
                  onTriggerPrint={(title, content, verificationUrl) => {
                    setPrintOverlay({
                      show: true,
                      title,
                      docType: "CERTIFICATE",
                      content,
                      authorName: currentUser?.name,
                      authorRole: currentUser?.role,
                      authorSignatureUrl: currentUser?.signatureUrl,
                      dateString: new Date().toLocaleDateString("en-KE"),
                      verificationUrl,
                    });
                  }}
                />
              )}

              {/* TAB 7: INVOICES */}
              {activeTab === "invoices" && (
                <InvoicingBoard
                  currentUser={currentUser}
                  lang={lang}
                  onTriggerPrint={(title, content, verificationUrl) => {
                    setPrintOverlay({
                      show: true,
                      title,
                      docType: "OFFICIAL INVOICE",
                      content,
                      authorName: currentUser?.name,
                      authorRole: currentUser?.role,
                      authorSignatureUrl: currentUser?.signatureUrl,
                      dateString: new Date().toLocaleDateString("en-KE"),
                      verificationUrl,
                    });
                  }}
                />
              )}

              {/* TAB 8: ORG SETTINGS */}
              {activeTab === "settings" && (
                <OrgSettingsScreen
                  currentUser={currentUser}
                  lang={lang}
                />
              )}

              {/* TAB 12: RULES & MEMBER HANDBOOK */}
              {activeTab === "handbook" && (
                <ErrorBoundary fallbackTitle="Member Handbook Failure">
                  <MemberHandbookPanel
                    currentUser={currentUser}
                    lang={lang}
                    onAcknowledge={(version) => {
                      const updated = {
                        ...currentUser,
                        handbookAcknowledgedVersion: version,
                        handbookAcknowledgedAt: new Date().toISOString().split("T")[0],
                      };
                      setCurrentUser(updated);
                      StorageService.saveUser(updated);
                    }}
                    onNavigateToSettings={() => setActiveTab("settings")}
                  />
                </ErrorBoundary>
              )}

              {activeTab === "security" && (
                <ErrorBoundary fallbackTitle="Security Settings Failure">
                  <SecuritySettingsPanel lang={lang} />
                </ErrorBoundary>
              )}

              {/* TAB 9: SIGNUP APPLICATIONS REVIEW */}
              {activeTab === "signup_reviews" && (
                <ErrorBoundary fallbackTitle="Signup Applications Review Failure">
                  <SignupReviews lang={lang} />
                </ErrorBoundary>
              )}

              {/* TAB 10: HOMEPAGE CMS EDITOR */}
              {activeTab === "cms_editor" && (
                <ErrorBoundary fallbackTitle="Homepage CMS Editor Failure">
                  <CmsEditor lang={lang} />
                </ErrorBoundary>
              )}

              {/* TAB 11: REGISTER BENEFICIARIES */}
              {activeTab === "beneficiaries" && (
                <ErrorBoundary fallbackTitle="Beneficiary Directory Failure">
                  <BeneficiaryRegistration lang={lang} />
                </ErrorBoundary>
              )}

              {activeTab === "activity_log" && (
                <ErrorBoundary fallbackTitle="Activity Log Failure">
                  <ActivityLogPanel lang={lang} />
                </ErrorBoundary>
              )}

              {activeTab === "tasks" && currentUser && (
                <ErrorBoundary fallbackTitle="Tasks Board Failure">
                  <TasksBoard lang={lang} currentUser={currentUser} canAssign={can("tasks", "create")} canReview={can("tasks", "edit")} />
                </ErrorBoundary>
              )}

              {activeTab === "program_sessions" && currentUser && (
                <ErrorBoundary fallbackTitle="Program Outcomes Failure">
                  <ProgramOutcomesBoard lang={lang} currentUser={currentUser} canEditAll={can("program_sessions", "edit")} />
                </ErrorBoundary>
              )}

              {activeTab === "me_dashboard" && currentUser && (
                <ErrorBoundary fallbackTitle="M&E Dashboard Failure">
                  <MEDashboardBoard lang={lang} />
                </ErrorBoundary>
              )}

              {activeTab === "attendance_registers" && currentUser && (
                <ErrorBoundary fallbackTitle="Attendance Register Failure">
                  <AttendanceRegisterBoard
                    lang={lang}
                    currentUser={currentUser}
                    canSubmit={can("attendance_registers", "create")}
                    canDecide={can("attendance_registers", "edit")}
                  />
                </ErrorBoundary>
              )}

              {activeTab === "members_directory" && (currentUser?.roleKey || getCanonicalRoleKey(currentUser?.role)) === "chairperson" && (
                <ErrorBoundary fallbackTitle="Members Directory Failure">
                  <AdminMembersDirectory lang={lang} />
                </ErrorBoundary>
              )}

              {activeTab === "events" && currentUser && (
                <ErrorBoundary fallbackTitle="Events Calendar Failure">
                  <EventsCalendar lang={lang} currentUser={currentUser} canCreate={can("events", "create")} />
                </ErrorBoundary>
              )}

              {activeTab === "board_meetings" && currentUser && (
                <ErrorBoundary fallbackTitle="Board Meetings Failure">
                  <BoardMeetingsPanel
                    lang={lang}
                    currentUser={currentUser}
                    documents={documents}
                    onCreateMinutesDoc={() => { setActiveTab("documents"); setIsCreatingDoc(true); }}
                  />
                </ErrorBoundary>
              )}

              {activeTab === "onboarding_checklists" && currentUser && (
                <ErrorBoundary fallbackTitle="Onboarding Checklist Failure">
                  <OnboardingChecklistBoard lang={lang} />
                </ErrorBoundary>
              )}

              {activeTab === "peer_directory" && currentUser && (
                <ErrorBoundary fallbackTitle="Peer Directory Failure">
                  <PeerDirectory lang={lang} />
                </ErrorBoundary>
              )}

              {activeTab === "my_records" && currentUser && (
                <ErrorBoundary fallbackTitle="My Records Failure">
                  <MemberSelfServicePanel
                    currentUser={currentUser}
                    lang={lang}
                    onRefreshUser={async () => {
                      try {
                        const res = await fetch("/api/auth/me", { credentials: "include" });
                        if (res.ok) {
                          const data = await res.json();
                          setCurrentUser(data.user || data);
                        }
                      } catch (err) {
                        console.error("Failed to refresh current user:", err);
                      }
                    }}
                  />
                </ErrorBoundary>
              )}
              </React.Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* MANUAL PWA INSTALLATION INSTRUCTION MODAL */}
      <Modal
        isOpen={showManualInstallHelp}
        onClose={() => setShowManualInstallHelp(false)}
        title={lang === "en" ? "How to Install Bashosho OS" : "Sajili Mfumo Kwenye Simu"}
        maxWidth="max-w-sm"
      >
        <div className="text-xs text-neutral-600 space-y-3 leading-relaxed font-sans text-left">
          <p>
            {lang === "en"
              ? "Since you are currently in a secure browser preview, automatic installation might be bypassed. You can install Bashosho OS on any smartphone or computer:"
              : "Kwa kuwa upo kwenye mfumo wa uhakiki wa kivinjari, usakinishaji wa moja kwa moja unaweza kuzuiliwa. Unaweza kusakinisha kwenye simu au kompyuta yako:"}
          </p>
          <ol className="list-decimal pl-4 space-y-2">
            <li>
              {lang === "en"
                ? "Click the 'Share' or 'Menu' (⋯ / ⁝) icon in your browser's address bar."
                : "Bonyeza alama ya 'Shiriki' au 'Menu' (⋯ / ⁝) kwenye anwani ya kivinjari chako."}
            </li>
            <li>
              {lang === "en"
                ? "Select 'Add to Home Screen' or 'Install App'."
                : "Chagua 'Weka kwenye Skrini ya Nyumbani' au 'Sakinisha Programu'."}
            </li>
            <li>
              {lang === "en"
                ? "Open Bashosho OS directly from your app drawer for quick, offline-capable operations."
                : "Fungua Mfumo wa Bashosho moja kwa moja kutoka kwenye skrini yako ukiwa na uwezo wa kufanya kazi hata bila mtandao!"}
            </li>
          </ol>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setShowManualInstallHelp(false)}
              className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
            >
              {lang === "en" ? "Got It" : "Nimeelewa"}
            </button>
          </div>
        </div>
      </Modal>

      {/* PRINT PREVIEW OVERLAY MODAL */}
      <Modal
        isOpen={printOverlay.show}
        onClose={() => setPrintOverlay({ ...printOverlay, show: false })}
        maxWidth="max-w-4xl"
      >
        <div className="w-full text-left font-sans">
          <PrintWrapper
            title={printOverlay.title}
            docType={printOverlay.docType}
            authorName={printOverlay.authorName}
            authorRole={printOverlay.authorRole}
            authorSignatureUrl={printOverlay.authorSignatureUrl}
            dateString={printOverlay.dateString}
            verificationUrl={printOverlay.verificationUrl}
          >
            {printOverlay.content}
          </PrintWrapper>
        </div>
      </Modal>

      {/* STATUS BAR FOOTER */}
      <footer className="h-9 bg-[#1B1B1B] text-neutral-300 px-6 md:px-8 flex items-center justify-between text-[10px] font-mono border-t border-neutral-800 print:hidden mt-auto">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-[#00A651] shadow-[0_0_4px_#00A651]" : "bg-amber-500 shadow-[0_0_4px_#F59E0B]"}`}></span>
            {isOnline 
              ? (lang === "en" ? "System Connected (Online)" : "Mfumo Umeunganishwa (Mtandaoni)")
              : (lang === "en" ? "Offline Mode (Local Storage)" : "Njia ya Nje ya Mtandao (Kuhifadhi Kwenye Kifaa)")}
          </span>
          <span className="text-neutral-700">|</span>
          <span className="hidden sm:inline">© 2026 BASHOSHO TALENTS CBO</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-neutral-500 hidden md:inline">Bashosho OS v1.2.0</span>
          <span className="flex items-center gap-1 text-[#00A651] font-semibold">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
            </svg>
            Secure Session
          </span>
        </div>
      </footer>

      {errorToast && (
        <div className="fixed bottom-12 right-6 z-50 max-w-sm bg-red-600 text-white text-xs font-bold p-4 rounded-xl shadow-lg border border-red-700 flex items-center gap-2 animate-pulse">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{errorToast}</span>
          <button onClick={() => setErrorToast(null)} className="ml-auto font-bold opacity-75 hover:opacity-100 cursor-pointer"></button>
        </div>
      )}
    </div>
  );
}
