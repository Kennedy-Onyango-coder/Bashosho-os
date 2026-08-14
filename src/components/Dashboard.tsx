import React from "react";
import Modal from "./Modal";
import { UserRole, UserProfile, Document, BudgetEngagement, ExpenditureRequest, SafeguardingReport, Asset, AttendanceSheet, Partner, Broadcast, LeaveRequest, SiteContent, LeadershipAppointment, Class, getCanonicalRoleKey, getUserRoleKey } from "../types";
import { StorageService, generateMemberNumber } from "../lib/storage";
import MembershipIDCard from "./MembershipIDCard";
import DocumentEditor from "./DocumentEditor";
import ContractRenewalPanel from "./ContractRenewalPanel";
import PrintWrapper from "./PrintWrapper";
import LeadershipAppointmentsPanel from "./LeadershipAppointmentsPanel";
import ChairpersonOverview from "./dashboard/ChairpersonOverview";
import ProgramsDirectorOverview from "./dashboard/ProgramsDirectorOverview";
import ViceChairpersonOverview from "./dashboard/ViceChairpersonOverview";
import TreasurerOverview from "./dashboard/TreasurerOverview";
import SecretaryOverview, { getMemberAttendanceStats } from "./dashboard/SecretaryOverview";
import SafeguardingOfficerOverview from "./dashboard/SafeguardingOfficerOverview";
import StatCard from "./dashboard/StatCard";
import VolunteerRecognitionPanel from "./VolunteerRecognitionPanel";
import GrowthTrackerPanel from "./GrowthTrackerPanel";
import MyPaymentsPanel from "./MyPaymentsPanel";
import ContractStatusBanner from "./ContractStatusBanner";
import { User, ShieldAlert, LayoutDashboard, FileText, Crown, AlertTriangle, Lock, Sparkles, CheckCircle2, Calendar, MapPin, Megaphone, Landmark, Scale, BarChart3, Printer, Wrench, Palmtree, Star, Flame, Check, X, Plus, Info, ChevronRight, FileCheck, RefreshCw, IdCard, Clock, Eye, Package, CheckCircle, Wallet } from "lucide-react";

interface DashboardProps {
  currentUser: UserProfile;
  lang: "en" | "sw";
  onPrintReport: (title: string, data: React.ReactNode) => void;
  onNavigateToTab: (tab: string) => void;
}

function getDaysPending(dateStr: string): number {
  const reqDate = new Date(dateStr);
  if (isNaN(reqDate.getTime())) return 0;
  // Use a fixed reference date matching the system year (e.g. July 2026) to make aging static and realistic
  const systemDate = new Date();
  const diffTime = systemDate.getTime() - reqDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 1;
}

export default function Dashboard({
  currentUser,
  lang,
  onPrintReport,
  onNavigateToTab
}: DashboardProps) {
  // Database States
  const [profiles, setProfiles] = React.useState<UserProfile[]>([]);
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [budgets, setBudgets] = React.useState<BudgetEngagement[]>([]);
  const [expenditures, setExpenditures] = React.useState<ExpenditureRequest[]>([]);
  const [safeguarding, setSafeguarding] = React.useState<SafeguardingReport[]>([]);
  const [attendance, setAttendance] = React.useState<AttendanceSheet[]>([]);
  
  // Local UI states
  const [selectedVerifyMember, setSelectedVerifyMember] = React.useState<UserProfile | null>(null);
  const [showInviteModal, setShowInviteModal] = React.useState(false);
  const [showSgModal, setShowSgModal] = React.useState(false);
  const [showMyIDModal, setShowMyIDModal] = React.useState(false);
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [dismissedApptId, setDismissedApptId] = React.useState<string | null>(null);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await StorageService.pullFromServer();
      setProfiles(StorageService.getProfiles());
      setDocuments(StorageService.getDocuments());
      setBudgets(StorageService.getBudgets());
      setExpenditures(StorageService.getExpenditures());
      setSafeguarding(StorageService.getSafeguarding());
      setAttendance(StorageService.getAttendance());
      setAssets(StorageService.getAssets());
      alert(lang === "en" ? "Data successfully synchronized with live server!" : "Data imesasishwa kikamilifu na seva!");
    } catch (err: any) {
      alert(lang === "en" ? `Sync failed: ${err.message || "Network error"}` : `Usawazishaji umefeli: ${err.message || "Hitilafu ya mtandao"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMemberDashboardPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      alert(lang === "en" ? "Photo exceeds 1.5MB limit." : "Picha inazidi 1.5MB.");
      return;
    }

    setUploadingPhoto(true);

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
            // Use the dedicated self-service avatar endpoint — regular members/volunteers
            // don't have (and shouldn't have) permission to hit the general /api/profiles
            // endpoint, which is reserved for staff editing role/profile data.
            const avatarRes = await fetch("/api/profiles/me/avatar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ avatar: data.url })
            });
            if (!avatarRes.ok) {
              const avatarErr = await avatarRes.json().catch(() => ({}));
              throw new Error(avatarErr.error || "Failed to save photo to your profile");
            }
            const updatedProfile = {
              ...currentUser,
              avatar: data.url
            };
            localStorage.setItem("bashosh_os_active_user", JSON.stringify(updatedProfile));
            window.dispatchEvent(new CustomEvent("bashosh_os_profile_updated", { detail: updatedProfile }));
            alert(lang === "en" ? "Official ID Passport Photo updated successfully!" : "Picha yako ya kitambulisho imesasishwa kikamilifu!");
          } else {
            throw new Error(data.error || "Upload failed");
          }
        } catch (err: any) {
          console.warn("Upload failed, falling back to local Base64.", err);
          const updatedProfile = {
            ...currentUser,
            avatar: reader.result as string
          };
          localStorage.setItem("bashosh_os_active_user", JSON.stringify(updatedProfile));
          window.dispatchEvent(new CustomEvent("bashosh_os_profile_updated", { detail: updatedProfile }));
          alert(lang === "en" ? "Photo loaded locally (offline fallback mode)." : "Picha imepakiwa kijeshi (nje ya mtandao).");
        } finally {
          setUploadingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Upload failed");
      setUploadingPhoto(false);
    }
  };
  
  // Bank Reconciliation States
  const [showReconcileModal, setShowReconcileModal] = React.useState(false);
  const [isReconciling, setIsReconciling] = React.useState(false);
  const [reconcileSuccess, setReconcileSuccess] = React.useState(false);
  const [reconcileDate, setReconcileDate] = React.useState("2026-07-10");
  const [unreconciledCount, setUnreconciledCount] = React.useState(1);
  
  // Invite form states
  const [inviteName, setInviteName] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [invitePhone, setInvitePhone] = React.useState("+254 ");
  const [inviteRole, setInviteRole] = React.useState<any>(UserRole.VOLUNTEER);

  // Dynamic roles from DB
  const [dbRoles, setDbRoles] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch("/api/roles")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDbRoles(data);
        }
      })
      .catch(console.error);
  }, []);

  // Leadership appointment states
  const [termStart, setTermStart] = React.useState(new Date().toISOString().split("T")[0]);
  const [termEnd, setTermEnd] = React.useState("");
  const [responsibilities, setResponsibilities] = React.useState("");
  const [siteContent, setSiteContent] = React.useState<SiteContent | null>(null);
  const [leadershipAppointments, setLeadershipAppointments] = React.useState<LeadershipAppointment[]>([]);
  const [printingAppointment, setPrintingAppointment] = React.useState<LeadershipAppointment | null>(null);
  const [draftedLetter, setDraftedLetter] = React.useState<string>("");
  const [draftingLetter, setDraftingLetter] = React.useState<boolean>(false);

  // Safeguarding form states
  const [sgTitle, setSgTitle] = React.useState("");
  const [sgDesc, setSgDesc] = React.useState("");
  const [sgReporter, setSgReporter] = React.useState("");

  // Attendance Clock-in State
  const [clockInState, setClockInState] = React.useState<"idle" | "in" | "out">("idle");
  const [activeVenue, setActiveVenue] = React.useState("Kiambiu Rehearsal Hall");

  // Partners State
  const [partners, setPartners] = React.useState<Partner[]>([]);

  // Vice Chairperson Broadcast form state
  const [broadcastMessage, setBroadcastMessage] = React.useState("");
  const [loggingContactPartner, setLoggingContactPartner] = React.useState<Partner | null>(null);
  const [contactLogNotes, setContactLogNotes] = React.useState("");
  const [contactLogMethod, setContactLogMethod] = React.useState<"call" | "email" | "meeting" | "whatsapp" | "other">("call");
  const [contactLogNextFollowUp, setContactLogNextFollowUp] = React.useState("");
  const [savingContactLog, setSavingContactLog] = React.useState(false);
  const [broadcastChannel, setBroadcastChannel] = React.useState<"SMS" | "WhatsApp" | "Email">("SMS");
  const [broadcastSuccess, setBroadcastSuccess] = React.useState(false);

  // New expansion states
  const [broadcasts, setBroadcasts] = React.useState<Broadcast[]>([]);
  const [leaveRequests, setLeaveRequests] = React.useState<LeaveRequest[]>([]);
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [classes, setClasses] = React.useState<Class[]>([]);
  const [showLeaveModal, setShowLeaveModal] = React.useState(false);
  const [leaveStartDate, setLeaveStartDate] = React.useState("");
  const [leaveEndDate, setLeaveEndDate] = React.useState("");
  const [leaveReason, setLeaveReason] = React.useState("");
  const [checkoutAssetId, setCheckoutAssetId] = React.useState("");
  const [checkoutEventId, setCheckoutEventId] = React.useState("");
  const [showCheckoutModal, setShowCheckoutModal] = React.useState(false);
  const [showCheckoutForm, setShowCheckoutForm] = React.useState(false);
  const [readBroadcastIds, setReadBroadcastIds] = React.useState<string[]>(() => {
    const val = localStorage.getItem("bashosh_os_read_broadcasts");
    return val ? JSON.parse(val) : [];
  });
  const [dashboardSubTab, setDashboardSubTab] = React.useState<"overview" | "renewals" | "appointments">("overview");

  React.useEffect(() => {
    const refreshAllDashboardData = () => {
      setProfiles(StorageService.getProfiles());
      setDocuments(StorageService.getDocuments());
      setBudgets(StorageService.getBudgets());
      setExpenditures(StorageService.getExpenditures());
      
      // Fetch safeguarding reports on-demand only for authorized roles
      const userRoleKey = getUserRoleKey(currentUser);
      if (currentUser && (userRoleKey === UserRole.SAFEGUARDING_OFFICER || userRoleKey === UserRole.CHAIRPERSON)) {
        StorageService.fetchSafeguardingOnDemand().then(reports => {
          setSafeguarding(reports);
        });
      } else {
        setSafeguarding([]);
      }

      setAttendance(StorageService.getAttendance());
      setPartners(StorageService.getPartners());
      setClasses(StorageService.getClasses());      setBroadcasts(StorageService.getBroadcasts());
      setLeaveRequests(StorageService.getLeaveRequests());
      setAssets(StorageService.getAssets());

      fetch("/api/leadership_appointments")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setLeadershipAppointments(data);
          }
        })
        .catch(console.error);
    };

    refreshAllDashboardData();

    // Fetch site content for templates
    fetch("/api/public/site_content")
      .then(res => res.json())
      .then(data => {
        setSiteContent(data);
      })
      .catch(console.error);

    window.addEventListener("bashosh_os_data_updated", refreshAllDashboardData);
    return () => {
      window.removeEventListener("bashosh_os_data_updated", refreshAllDashboardData);
    };
  }, [currentUser]);

  React.useEffect(() => {
    if (!siteContent || !siteContent.roleTemplates) return;
    const template = siteContent.roleTemplates.find((t: any) => t.role === inviteRole);
    if (template) {
      setResponsibilities(template.responsibilities.en);
    } else {
      setResponsibilities("");
    }
  }, [inviteRole, siteContent]);

  // Calculations
  const pendingExp = expenditures.filter(e => e.status.startsWith("pending")).length;
  const activeMembersCount = profiles.filter(p => p.status === "Active" && p.isActive).length;
  const volunteerHours = attendance.reduce((sum, sheet) => {
    return sum + sheet.records.reduce((sub, rec) => sub + (rec.userId === currentUser.id ? (rec.volunteerHours || 0) : 0), 0);
  }, 0);
  
  const totalEarnedStipends = attendance.reduce((sum, sheet) => {
    return sum + sheet.records.reduce((sub, rec) => sub + (rec.userId === currentUser.id ? (rec.stipend || 0) : 0), 0);
  }, 0);

  // CBO Member Expansion Calculations & Helpers
  const upcomingEvents = attendance.filter(sheet => {
    const isFuture = new Date(sheet.date) > new Date();
    const isListed = sheet.records.some(rec => rec.userId === currentUser.id);
    return isFuture && isListed;
  });

  const myCheckedOutAssets = assets.filter(asset => {
    return asset.checkoutHistory.some(ch => !ch.actualReturnDate && ch.userName === currentUser.name);
  });

  const myAttendanceHistory = attendance.filter(sheet => {
    const isPast = new Date(sheet.date) <= new Date();
    const isListed = sheet.records.some(rec => rec.userId === currentUser.id);
    return isPast && isListed;
  });

  const getMyAttendanceRecord = (sheet: AttendanceSheet) => {
    return sheet.records.find(rec => rec.userId === currentUser.id);
  };

  const getUserRoleInEvent = (sheet: AttendanceSheet) => {
    const rec = sheet.records.find(r => r.userId === currentUser.id);
    return (rec as any)?.role || "Cast/Volunteer";
  };

  const isRead = (bId: string) => readBroadcastIds.includes(bId);

  const markAsRead = (bId: string) => {
    if (!readBroadcastIds.includes(bId)) {
      const updated = [...readBroadcastIds, bId];
      setReadBroadcastIds(updated);
      localStorage.setItem("bashosh_os_read_broadcasts", JSON.stringify(updated));
    }
  };

  const markAllAsRead = () => {
    const allIds = broadcasts.map(b => b.id);
    setReadBroadcastIds(allIds);
    localStorage.setItem("bashosh_os_read_broadcasts", JSON.stringify(allIds));
  };

  // Two-way broadcast replies
  const [replyDrafts, setReplyDrafts] = React.useState<Record<string, string>>({});
  const [expandedThreadId, setExpandedThreadId] = React.useState<string | null>(null);
  const [postingReplyId, setPostingReplyId] = React.useState<string | null>(null);

  const handlePostReply = async (broadcastId: string) => {
    const message = (replyDrafts[broadcastId] || "").trim();
    if (!message) return;
    setPostingReplyId(broadcastId);
    try {
      const res = await fetch(`/api/broadcasts/${broadcastId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post reply");
      setBroadcasts(prev => prev.map(b => b.id === broadcastId ? { ...b, replies: [...(b.replies || []), data.reply] } : b));
      setReplyDrafts(prev => ({ ...prev, [broadcastId]: "" }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPostingReplyId(null);
    }
  };

  // Treasurer / Comms Calculations
  const totalRevenue = budgets.reduce((acc, b) => acc + (b.status === "approved" ? b.revenue : 0), 0);
  const totalApprovedExpense = expenditures
    .filter(e => e?.status === "approved")
    .reduce((acc, e) => acc + (e?.amount || 0), 0);
  const cashReserves = totalRevenue - totalApprovedExpense + 74500; // Base starting reserves
  const pendingTreasurerCount = expenditures.filter(e => e.status === "pending_treasurer").length;

  // Invitation Handler
  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || !invitePhone.trim()) return;

    const isVolunteer = dbRoles.some(r => r.name === inviteRole && r.originalName === "Volunteer Staff") || inviteRole === UserRole.VOLUNTEER;
    const isProgramMember = dbRoles.some(r => r.name === inviteRole && r.originalName === "Program Member") || inviteRole === UserRole.PROGRAM_MEMBER;

    const newProfile: UserProfile = {
      id: `m-${Date.now()}`,
      name: inviteName,
      email: inviteEmail,
      phone: invitePhone.trim(),
      role: inviteRole,
      roleKey: getCanonicalRoleKey(inviteRole),
      isActive: true,
      joinDate: new Date().toISOString().split("T")[0],
      memberNumber: generateMemberNumber(profiles, inviteRole),
      status: isVolunteer ? "Volunteer" : "Active",
      skills: ["Performing Arts", "GBV Awareness"],
      mustChangePassword: true,
      emergencyContact: {
        name: "Admin Contact",
        phone: "+254 798 132 410",
        relationship: "CBO Head Office"
      }
    };

    const updated = [...profiles, newProfile];
    setProfiles(updated);
    StorageService.saveRecord("profiles", newProfile).catch(console.error);

    const isLeadershipRole = !isProgramMember && !isVolunteer;
    if (isLeadershipRole) {
      const apptId = `la-${Date.now()}`;
      const newAppointment: LeadershipAppointment = {
        id: apptId,
        profileId: newProfile.id,
        role: inviteRole,
        termStart,
        termEnd: termEnd || undefined,
        responsibilities,
        appointedBy: currentUser.name,
        appointmentDate: new Date().toISOString().split("T")[0],
        acknowledged: false
      };

      StorageService.saveLeadershipAppointment(newAppointment)
        .then(() => {
          setLeadershipAppointments(prev => [...prev, newAppointment]);
          fetch("/api/leadership_appointments")
            .then(res => res.json())
            .then(data => {
              if (Array.isArray(data)) {
                setLeadershipAppointments(data);
              }
            });
        })
        .catch(console.error);
    }

    // Reset Form
    setInviteName("");
    setInviteEmail("");
    setInvitePhone("+254 ");
    setInviteRole(UserRole.VOLUNTEER);
    setTermStart(new Date().toISOString().split("T")[0]);
    setTermEnd("");
    setResponsibilities("");
    setShowInviteModal(false);
  };

  const handleGenerateAppointmentLetter = async (appt: LeadershipAppointment) => {
    setDraftingLetter(true);
    setDraftedLetter("");
    try {
      // Fetch latest leadership appointments list to get the actual verificationUrl computed by the backend
      const latestRes = await fetch("/api/leadership_appointments");
      let freshAppt = appt;
      if (latestRes.ok) {
        const latestData = await latestRes.json();
        if (Array.isArray(latestData)) {
          setLeadershipAppointments(latestData);
          const matched = latestData.find((a: any) => a.id === appt.id);
          if (matched) {
            freshAppt = matched;
          }
        }
      }
      setPrintingAppointment(freshAppt);

      const appointee = profiles.find(p => p.id === freshAppt.profileId);
      const appointeeName = appointee ? appointee.name : "Appointee";
      const response = await fetch("/api/document_templates/generate_draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Formal Letter of Appointment`,
          docType: "appointment_letter",
          title: `Letter of Appointment for ${appointeeName}`,
          appointeeName,
          role: freshAppt.role,
          termStart: freshAppt.termStart,
          termEnd: freshAppt.termEnd,
          responsibilities: freshAppt.responsibilities,
          chairpersonName: currentUser.name
        })
      });
      const data = await response.json();
      if (response.ok && data.draft) {
        setDraftedLetter(data.draft);
      } else {
        throw new Error(data.error || "Failed to draft appointment letter");
      }
    } catch (err: any) {
      console.error(err);
      alert(lang === "en" ? `Failed to draft letter: ${err.message}` : `Imeshindwa kuandaa barua: ${err.message}`);
      setPrintingAppointment(null);
    } finally {
      setDraftingLetter(false);
    }
  };

  // Safeguarding submission handler
  const handleAddSafeguarding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sgTitle.trim() || !sgDesc.trim()) return;

    const newReport: SafeguardingReport = {
      id: `sg-${Date.now()}`,
      title: sgTitle,
      description: sgDesc,
      reportedDate: new Date().toISOString(),
      status: "received",
      notes: "Awaiting review from Safeguarding & MEL Officer",
      assignedTo: "Peter Kamau",
      reporterName: sgReporter || undefined
    };

    const updated = [newReport, ...safeguarding];
    setSafeguarding(updated);
    StorageService.saveRecord("safeguarding", newReport).catch(console.error);

    // Reset Form
    setSgTitle("");
    setSgDesc("");
    setSgReporter("");
    setShowSgModal(false);
  };

  // Clock In / Out Simulator
  const handleClockToggle = () => {
    if (clockInState === "idle") {
      setClockInState("in");
      
      // Save clock action in attendance roster
      let updatedSheet: AttendanceSheet | null = null;
      const updatedAttendance = attendance.map(sheet => {
        if (sheet.id === "att-1") {
          updatedSheet = {
            ...sheet,
            records: sheet.records.map(rec => {
              if (rec.userId === currentUser.id) {
                return {
                  ...rec,
                  status: "present" as const,
                  checkInTime: new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
                  geoTagged: true
                };
              }
              return rec;
            })
          };
          return updatedSheet;
        }
        return sheet;
      });
      setAttendance(updatedAttendance);
      if (updatedSheet) {
        StorageService.saveRecord("attendance", updatedSheet).catch(console.error);
      }
    } else if (clockInState === "in") {
      setClockInState("out");
      
      // Save clock out in attendance roster
      let updatedSheet: AttendanceSheet | null = null;
      const updatedAttendance = attendance.map(sheet => {
        if (sheet.id === "att-1") {
          updatedSheet = {
            ...sheet,
            records: sheet.records.map(rec => {
              if (rec.userId === currentUser.id) {
                return {
                  ...rec,
                  checkOutTime: new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
                  volunteerHours: 3.5 // Simulate 3.5 hrs worked
                };
              }
              return rec;
            })
          };
          return updatedSheet;
        }
        return sheet;
      });
      setAttendance(updatedAttendance);
      if (updatedSheet) {
        StorageService.saveRecord("attendance", updatedSheet).catch(console.error);
      }
    }
  };

  // Leave Requests Handlers
  const handleRequestLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStartDate || !leaveEndDate || !leaveReason.trim()) return;

    const newRequest: LeaveRequest = {
      id: `lv-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      startDate: leaveStartDate,
      endDate: leaveEndDate,
      reason: leaveReason,
      status: "pending"
    };

    const updated = [newRequest, ...leaveRequests];
    setLeaveRequests(updated);
    StorageService.saveRecord("leave_requests", newRequest).catch(console.error);

    // Reset Form
    setLeaveStartDate("");
    setLeaveEndDate("");
    setLeaveReason("");
    setShowLeaveModal(false);
  };

  const handleSaveContactLog = async () => {
    if (!loggingContactPartner || !contactLogNotes.trim()) return;
    setSavingContactLog(true);
    try {
      const res = await fetch(`/api/partners/${loggingContactPartner.id}/log_contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: contactLogNotes.trim(), method: contactLogMethod, nextFollowUpDate: contactLogNextFollowUp || undefined })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to log contact");
      }
      // Fetch fresh rather than trusting the local offline cache, which only syncs
      // periodically and would likely still show the pre-update partner record.
      const freshRes = await fetch("/api/partners");
      if (freshRes.ok) setPartners(await freshRes.json());
      setLoggingContactPartner(null);
      setContactLogNotes(""); setContactLogMethod("call"); setContactLogNextFollowUp("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingContactLog(false);
    }
  };

  const handleApproveLeave = (leaveId: string) => {
    let updatedReq: LeaveRequest | null = null;
    const updated = leaveRequests.map(req => {
      if (req.id === leaveId) {
        updatedReq = { ...req, status: "approved" as const };
        return updatedReq;
      }
      return req;
    });
    setLeaveRequests(updated);
    if (updatedReq) {
      StorageService.saveRecord("leave_requests", updatedReq).catch(console.error);
    }
  };

  const handleRejectLeave = (leaveId: string) => {
    let updatedReq: LeaveRequest | null = null;
    const updated = leaveRequests.map(req => {
      if (req.id === leaveId) {
        updatedReq = { ...req, status: "rejected" as const };
        return updatedReq;
      }
      return req;
    });
    setLeaveRequests(updated);
    if (updatedReq) {
      StorageService.saveRecord("leave_requests", updatedReq).catch(console.error);
    }
  };

  const isUserOnLeave = (userId: string, dateStr: string = new Date().toISOString().split("T")[0]) => {
    const date = new Date(dateStr);
    return leaveRequests.some(req => 
      req.userId === userId && 
      req.status === "approved" && 
      new Date(req.startDate) <= date && 
      new Date(req.endDate) >= date
    );
  };

  // Equipment Checkout Handlers
  const handleCheckoutEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutAssetId || !checkoutEventId) return;

    const assetToCheckout = assets.find(a => a.id === checkoutAssetId);
    const targetEvent = attendance.find(evt => evt.id === checkoutEventId);
    if (!assetToCheckout || !targetEvent) return;

    const checkoutRecord = {
      id: `ch-${Date.now()}`,
      userName: currentUser.name,
      eventName: targetEvent.title,
      checkoutDate: new Date().toISOString().split("T")[0],
      expectedReturnDate: targetEvent.date
    };

    let updatedAsset: Asset | null = null;
    const updatedAssets = assets.map(asset => {
      if (asset.id === checkoutAssetId) {
        updatedAsset = {
          ...asset,
          checkoutHistory: [...asset.checkoutHistory, checkoutRecord]
        };
        return updatedAsset;
      }
      return asset;
    });

    setAssets(updatedAssets);
    if (updatedAsset) {
      StorageService.saveRecord("assets", updatedAsset).catch(console.error);
    }

    // Reset Form
    setCheckoutAssetId("");
    setCheckoutEventId("");
    setShowCheckoutModal(false);
  };

  const handleReturnEquipment = (assetId: string) => {
    let updatedAsset: Asset | null = null;
    const updatedAssets = assets.map(asset => {
      if (asset.id === assetId) {
        updatedAsset = {
          ...asset,
          checkoutHistory: asset.checkoutHistory.map(ch => {
            if (!ch.actualReturnDate && ch.userName === currentUser.name) {
              return { ...ch, actualReturnDate: new Date().toISOString().split("T")[0] };
            }
            return ch;
          })
        };
        return updatedAsset;
      }
      return asset;
    });

    setAssets(updatedAssets);
    if (updatedAsset) {
      StorageService.saveRecord("assets", updatedAsset).catch(console.error);
    }
  };

  return (
    <div className="space-y-8" id="unified-dashboard-wrapper">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#E31E24] to-[#a31216] rounded-3xl p-6 text-white text-left shadow-md flex flex-wrap justify-between items-center relative overflow-hidden">
        {/* Abstract design elements to look custom, not boilerplate */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[#00A651] transform skew-x-12 translate-x-24 opacity-15 pointer-events-none"></div>
        <div className="z-10">
          <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-white/20 text-white px-2.5 py-1 rounded-full">
            {lang === "en" ? "SESSION ACTIVE" : "KIKAO KINAENDELEA"}
          </span>
          <h2 className="text-2xl font-black mt-2 font-sans text-neutral-50 tracking-tight">
            {lang === "en" ? `Mambo, ${currentUser.name}!` : `Karibu, ${currentUser.name}!`}
          </h2>
          <p className="text-xs text-red-100 mt-1 max-w-xl font-medium leading-relaxed">
            {lang === "en" 
              ? `Logged in as ${currentUser.role}. Welcome to Bashosho OS — managing mental health, gender advocacy, and youth theatre in Kiambiu, Nairobi.`
              : `Umeingia kama ${currentUser.role}. Karibu kwenye Mfumo wa Bashosho — kupanga miradi ya afya ya akili, kupinga GBV, na sanaa za vijana Kiambiu.`}
          </p>
        </div>

        {/* Quick action triggers */}
        <div className="flex gap-2.5 mt-4 sm:mt-0 z-10 flex-wrap">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            id="manual-sync-now-trigger"
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-white/20 shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            title={lang === "en" ? "Synchronize with live server database" : "Sawazisha na Hifadhidata ya Seva"}
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            <span>{isSyncing ? (lang === "en" ? "Syncing..." : "Inasawazisha...") : (lang === "en" ? "Sync Now" : "Sawazisha Sasa")}</span>
          </button>
          <button
            onClick={() => setShowMyIDModal(true)}
            id="view-my-id-card-trigger"
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-white/20 shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <IdCard size={14} /> {lang === "en" ? "My CBO Card" : "Kadi Yangu"}
          </button>
          <button
            onClick={() => setShowSgModal(true)}
            id="report-safeguarding-trigger"
            className="bg-white text-[#E31E24] hover:bg-neutral-50 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#E31E24] animate-ping"></span>
            <ShieldAlert size={14} className="text-[#E31E24]" /> {lang === "en" ? "Report Safeguarding" : "Ripoti Ulinzi"}
          </button>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-neutral-200 pb-px gap-6 text-xs font-bold uppercase tracking-wider text-left mb-2">
        <button
          onClick={() => setDashboardSubTab("overview")}
          className={`pb-3 px-1 transition-all border-b-2 flex items-center gap-1.5 ${
            dashboardSubTab === "overview"
              ? "border-[#E31E24] text-neutral-900"
              : "border-transparent text-neutral-400 hover:text-neutral-600"
          } cursor-pointer`}
        >
          <LayoutDashboard size={14} /> {lang === "en" ? "Overview" : "Muhtasari"}
        </button>
        <button
          onClick={() => setDashboardSubTab("renewals")}
          className={`pb-3 px-1 transition-all border-b-2 flex items-center gap-1.5 ${
            dashboardSubTab === "renewals"
              ? "border-[#E31E24] text-neutral-900"
              : "border-transparent text-neutral-400 hover:text-neutral-600"
          } cursor-pointer`}
        >
          <FileText size={14} /> {lang === "en" ? "Contract & Renewal" : "Mkataba na Usajili upya"}
          {StorageService.getContractRenewals().filter(r => r.status === "pending_review").length > 0 &&
            ["chairperson", "programs_director", "vice_chairperson"].includes(getUserRoleKey(currentUser)) && (
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse inline-block"></span>
            )}
        </button>
        <button
          onClick={() => setDashboardSubTab("appointments")}
          className={`pb-3 px-1 transition-all border-b-2 flex items-center gap-1.5 ${
            dashboardSubTab === "appointments"
              ? "border-[#E31E24] text-neutral-900"
              : "border-transparent text-neutral-400 hover:text-neutral-600"
          } cursor-pointer`}
        >
          <Crown size={14} /> {lang === "en" ? "Leadership Appointments" : "Teuzi za Uongozi"}
        </button>
      </div>

      {dashboardSubTab === "renewals" ? (
        <ContractRenewalPanel
          currentUser={currentUser}
          lang={lang}
          onRefreshUser={() => {
            setProfiles(StorageService.getProfiles());
          }}
        />
      ) : dashboardSubTab === "appointments" ? (
        <LeadershipAppointmentsPanel
          currentUser={currentUser}
          lang={lang}
          profiles={profiles}
          appointments={leadershipAppointments}
          onGenerateLetter={(appt) => handleGenerateAppointmentLetter(appt)}
          onDeleteAppointment={async (appt) => {
            try {
              const res = await fetch(`/api/leadership_appointments/${appt.id}`, { method: "DELETE" });
              if (res.ok) {
                setLeadershipAppointments(prev => prev.filter(a => a.id !== appt.id));
              } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || "Failed to delete appointment record.");
              }
            } catch (err) {
              console.error("Failed to delete appointment:", err);
              alert("Failed to delete appointment record.");
            }
          }}
        />
      ) : (
        <>
          {/* Contract renewal reminder/lock banner — visible to every role, hides
              itself when there's genuinely nothing to show. */}
          <ContractStatusBanner lang={lang} onGoToRenewals={() => setDashboardSubTab("renewals")} />

          {/* Visible to every role — payments only appear here once a cast/crew
              payment list has been approved, and the panel itself hides when a
              person has no payment history yet, so it never clutters an empty
              dashboard. */}
          <MyPaymentsPanel lang={lang} />
          {/* DASHBOARD SWITCHING LOGIC BASED ON ROLE */}

          {/* 1. CHAIRPERSON & EXECUTIVE DIRECTOR (ADMIN) */}
          {(getUserRoleKey(currentUser) === UserRole.CHAIRPERSON) && (
        <div className="space-y-6 text-left">
          <ChairpersonOverview
            lang={lang}
            onNavigateToTab={onNavigateToTab}
            currentUserNameAndRole={`${currentUser.name} (${currentUser.role})`}
          />

          {(() => {
            const urgentGrants = StorageService.getGrants().filter(g => {
              if (g.status === "submitted" || g.status === "awarded" || g.status === "declined") return false;
              const deadlineDate = new Date(g.deadline);
              if (isNaN(deadlineDate.getTime())) return false;
              const systemDate = new Date();
              const diffTime = deadlineDate.getTime() - systemDate.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays >= 0 && diffDays <= 14;
            });

            if (urgentGrants.length === 0) return null;

            return (
              <div className="bg-red-50 border-l-4 border-red-600 p-5 rounded-r-2xl shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                  <AlertTriangle size={16} className="text-red-600 shrink-0" />
                  <span>{lang === "en" ? "Urgent Grant Application Deadlines" : "Muda wa Mwisho wa Ruzuku Unakaribia"}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {urgentGrants.map(grant => {
                    const daysLeft = Math.ceil((new Date(grant.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={grant.id} className="text-xs text-neutral-800 flex justify-between items-center bg-white p-3 rounded-xl border border-red-100 shadow-2xs">
                        <div>
                          <p className="font-bold text-neutral-900">{grant.name}</p>
                          <p className="text-[11px] text-neutral-500 font-medium">{grant.funder} • Ksh {(grant?.amount || 0).toLocaleString()}</p>
                        </div>
                        <div className="font-mono text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-lg shrink-0">
                          {daysLeft} {lang === "en" ? "days left!" : "siku zilizobaki!"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Quick Metrics cards — superseded by the ChairpersonOverview stat cards above
              (active members, pending sign-offs / expenditure, safeguarding, active
              outreaches, and handbook acknowledgements are all covered there now). */}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Main - Pending Approvals list & Actions */}
            <div className="lg:col-span-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4">
                <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans">
                  {lang === "en" ? "Executive Action items" : "Mambo Yanayohitaji Hatua Zako"}
                </h3>
                <span className="text-[10px] font-bold text-gray-400 font-mono uppercase bg-gray-50 px-2 py-0.5 rounded">
                  {lang === "en" ? "Admin Controls" : "Udhibiti wa Admin"}
                </span>
              </div>

              {pendingExp === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                   {lang === "en" ? "No pending expenditure sign-offs at this time." : "Hakuna matumizi yanayosubiri saini yako kwa sasa."}
                </div>
              ) : (
                <div className="space-y-4">
                  {expenditures.filter(e => e.status === "pending_chairperson").map((req) => (
                    <div key={req.id} className="border border-gray-200 rounded-xl p-4 flex flex-wrap justify-between items-center hover:bg-gray-50 transition-colors">
                      <div className="text-left space-y-1">
                        <span className="bg-purple-100 text-purple-700 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                          {lang === "en" ? "EXCEEDS THRESHOLD" : "IMEPITA KIWANGO"}
                        </span>
                        <h4 className="text-sm font-bold text-[#1B1B1B]">{req.description}</h4>
                        <p className="text-xs text-gray-500 font-medium">
                          {lang === "en" ? "Requested by" : "Iliombwa na"} <strong className="text-gray-700">{req.requestedBy}</strong> • {req.requestDate}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-base font-black text-[#1B1B1B] font-mono">
                          Ksh {(req?.amount || 0).toLocaleString()}
                        </span>
                        <button
                          onClick={() => onNavigateToTab("finance")}
                          id={`action-chairperson-approve-${req.id}`}
                          className="bg-[#E31E24] hover:bg-[#c91a1f] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                        >
                          {lang === "en" ? "Review & Sign" : "Kagua na Utie Saini"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Panel - Quick Invitations & Funder-Readiness Checklist */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b border-gray-200 pb-3 mb-4">
                    {lang === "en" ? "Invite New Member" : "Sajili Mwanachama"}
                  </h3>
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                    {lang === "en"
                      ? "In alignment with the Bashosho Constitution, administrative accounts can only be issued by the Chairperson. Register community volunteers to activate their profiles."
                      : "Kulingana na Katiba ya Bashosho, akaunti za viongozi na wanachama zinaweza tu kuundwa na Mwenyekiti."}
                  </p>
                </div>

                <button
                  onClick={() => setShowInviteModal(true)}
                  id="create-account-invite-btn"
                  className="w-full bg-[#E31E24] hover:bg-[#c91a1f] text-white text-xs font-bold py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <line x1="19" y1="8" x2="19" y2="14"></line>
                    <line x1="22" y1="11" x2="16" y2="11"></line>
                  </svg>
                  {lang === "en" ? "Issue Invite Link" : "Unda Akaunti Mpya"}
                </button>
              </div>

              {/* Funder-Readiness Compliance Checklist */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm text-left">
                <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b border-gray-200 pb-3 mb-4">
                  {lang === "en" ? "Funder-Readiness Checklist" : "Ukaguzi wa Utayari wa Mfadhili"}
                </h3>
                <div className="space-y-3.5 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-500 font-bold"></span>
                    <div>
                      <span className="font-bold text-neutral-800">{lang === "en" ? "Financial Ledger Clean" : "Daftari la Fedha Safi"}</span>
                      <p className="text-[10px] text-gray-500 leading-relaxed">{lang === "en" ? "Ledger aggregated and fully audited by Treasurer" : "Daftari limekaguliwa na Mhazini"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className={safeguarding.filter(s => s.status !== "resolved").length === 0 ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                      {safeguarding.filter(s => s.status !== "resolved").length === 0 ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                    </span>
                    <div>
                      <span className="font-bold text-neutral-800">{lang === "en" ? "Safeguarding Incident Status" : "Hali ya Visa vya Usalama"}</span>
                      <p className="text-[10px] text-gray-500 leading-relaxed">
                        {safeguarding.filter(s => s.status !== "resolved").length === 0 
                          ? (lang === "en" ? "No open safeguarding cases outstanding" : "Hakuna kesi wazi za usalama") 
                          : (lang === "en" ? `${safeguarding.filter(s => s.status !== "resolved").length} open cases need resolution` : `${safeguarding.filter(s => s.status !== "resolved").length} kesi ziko wazi`)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-500 font-bold"></span>
                    <div>
                      <span className="font-bold text-neutral-800">{lang === "en" ? "Budget Engagements Linked" : "Bajeti za Miradi Zimeunganishwa"}</span>
                      <p className="text-[10px] text-gray-500 leading-relaxed">{lang === "en" ? "Active outreaches backed by signed budgets" : "Kila mradi una bajeti yake iliyotiwa saini"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-500 font-bold"></span>
                    <div>
                      <span className="font-bold text-neutral-800">{lang === "en" ? "MEL Documentation Active" : "Rekodi za MEL Ziko Sawa"}</span>
                      <p className="text-[10px] text-gray-500 leading-relaxed">{lang === "en" ? "Rehearsal and forum theater attendance logs tracked" : "Mahudhurio ya wasanii na wasikilizaji yamehifadhiwa"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-500 font-bold"></span>
                    <div>
                      <span className="font-bold text-neutral-800">{lang === "en" ? "Registered Members Active" : "Kumbukumbu za Wanachama"}</span>
                      <p className="text-[10px] text-gray-500 leading-relaxed">{lang === "en" ? "Profiles assigned active status and digital IDs" : "Wanachama wote wana vitambulisho vyao"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PROGRAMS DIRECTOR ( casting, schedules, clock in rosters ) */}
      {(getUserRoleKey(currentUser) === UserRole.PROGRAMS_DIRECTOR) && (
        <div className="space-y-6 text-left">
          {/* Programs stats — previously 3 hardcoded placeholder numbers (1 rehearsal, 2
              classes, 56.5 hrs). Now computed live from real classes/attendance data. */}
          <ProgramsDirectorOverview lang={lang} onNavigateToTab={onNavigateToTab} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Quick clock in panel */}
            <div className="lg:col-span-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4">
                {lang === "en" ? "Simulate Active Outreach Clock-In" : "Simulisha Mahudhurio na Saa"}
              </h3>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                {lang === "en"
                  ? "As Programs Director, you can trigger rehearsals check-ins or live sessions clock-ins to log volunteer hours instantly."
                  : "Kama Mkurugenzi wa Miradi, unaweza kuratibu saa za kuingia na kutoka kwa wasanii ili kupiga hesabu ya posho zao."}
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex justify-between items-center mb-4">
                <div className="text-left">
                  <span className="block text-[10px] font-mono font-bold text-gray-400 uppercase">ACTIVE VENUE</span>
                  <span className="text-xs font-bold text-[#1B1B1B]">{activeVenue}</span>
                </div>
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${clockInState === "in" ? "bg-[#00A651] animate-pulse" : "bg-neutral-300"}`}></span>
              </div>

              <button
                onClick={handleClockToggle}
                id="director-clock-toggle-btn"
                className={`w-full py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer ${
                  clockInState === "idle"
                    ? "bg-[#00A651] hover:bg-[#008f43] text-white"
                    : clockInState === "in"
                    ? "bg-[#E31E24] hover:bg-[#c91a1f] text-white"
                    : "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                }`}
                disabled={clockInState === "out"}
              >
                {clockInState === "idle" && (lang === "en" ? "Begin Rehearsal Session Check-In" : "Anza Kurekodi Mazoezi")}
                {clockInState === "in" && (lang === "en" ? "End Session & Clock-Out All Performers" : "Maliza Kikao na Utishe Saini")}
                {clockInState === "out" && (lang === "en" ? "Session Logged & Completed" : "Kikao Kimekamilika na Kuhifadhiwa")}
              </button>
            </div>

            {/* Active schedules */}
            <div className="lg:col-span-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4">
                {lang === "en" ? "Upcoming Outreach Schedules" : "Ratiba za Miradi na Outreaches"}
              </h3>
              <div className="space-y-4">
                {budgets.map((b) => (
                  <div key={b.id} className="border border-gray-200 rounded-xl p-4 text-left flex justify-between items-center">
                    <div>
                      <span className="bg-[#E31E24]/10 text-[#E31E24] font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#E31E24]/20 uppercase">
                        {b.status.toUpperCase()}
                      </span>
                      <h4 className="text-xs font-bold text-[#1B1B1B] mt-1.5">{b.title}</h4>
                      <p className="text-[10px] text-gray-500 font-semibold">{b.date}</p>
                    </div>
                    <button
                      onClick={() => onNavigateToTab("documents")}
                      id={`write-report-btn-${b.id}`}
                      className="bg-gray-50 hover:bg-gray-100 text-[#1B1B1B] text-[10px] font-bold px-3 py-1.5 rounded border border-gray-200 transition-colors cursor-pointer"
                    >
                      {lang === "en" ? "Draft Report" : "Andika Ripoti"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Volunteers & Session Sign-in Roster */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans">
                {lang === "en" ? "Active Volunteers / Session Sign-in State" : "Hali ya Mahudhurio ya Wasanii"}
              </h3>
              <span className={`inline-block px-2.5 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wide ${
                clockInState === "in" ? "bg-[#00A651]/10 text-[#00A651]" : "bg-neutral-100 text-neutral-500"
              }`}>
                {clockInState === "in" ? (lang === "en" ? "ACTIVE OUTREACH RUNNING" : "KIKAO KINAENDELEA") : (lang === "en" ? "NO ACTIVE SESSION" : "KIKAO HALIJAANZA")}
              </span>
            </div>

            {clockInState === "in" ? (
              <div className="space-y-4 text-left">
                <div className="bg-[#00A651]/5 border border-[#00A651]/20 rounded-lg p-3 text-xs flex justify-between items-center">
                  <span className="font-semibold text-[#00A651]">
                    {lang === "en" ? " 4 volunteers checked-in at Kiambiu Rehearsal Hall" : " Wasanii 4 wamesajiliwa leo Kiambiu Rehearsal Hall"}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono"> GPS REFERENCE: 1.2921° S, 36.8531° E</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { name: "Mercy Wanjiku", role: "Lead Actor", time: "14:02 PM", status: "GPS Verified" },
                    { name: "John Onyango", role: "Actor & Facilitator", time: "14:05 PM", status: "GPS Verified" },
                    { name: "Peter Kamau", role: "Drums & Audio", time: "14:10 PM", status: "GPS Verified" },
                    { name: "Sarah Nduta", role: "SGBV Peer Educator", time: "14:12 PM", status: "GPS Verified" }
                  ].map((vol, idx) => {
                    const matchedProfile = profiles.find(p => p.name === vol.name);
                    const onLeave = matchedProfile ? isUserOnLeave(matchedProfile.id) : false;
                    return (
                      <div key={idx} className={`border rounded-xl p-4 text-left flex flex-col justify-between ${onLeave ? "bg-amber-50/50 border-amber-200" : "bg-gray-50/50 border-gray-150"}`}>
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <h4 className="text-xs font-bold text-neutral-800">{vol.name}</h4>
                            {onLeave && <span className="bg-amber-100 text-amber-800 text-[8px] px-1 py-0.5 rounded uppercase font-bold font-mono">On Leave</span>}
                          </div>
                          <span className="text-[9px] font-medium text-gray-500 uppercase">{vol.role}</span>
                        </div>
                        <div className="mt-3 flex justify-between items-center text-[10px] font-mono text-gray-400">
                          <span>IN: {vol.time}</span>
                          <span className={onLeave ? "text-amber-600 font-bold inline-flex items-center gap-1" : "text-[#00A651] font-bold"}>
                            {onLeave ? <><ShieldAlert size={12} /> Restricted</> : ` ${vol.status}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 text-xs">
                 {lang === "en" 
                  ? "No rehearsal session currently running. Click 'Begin Rehearsal Session Check-In' above to start tracking real-time attendance." 
                  : "Hakuna kikao kinachoendelea kwa sasa. Bonyeza 'Anza Kurekodi Mazoezi' hapo juu ili kuanza kusajili mahudhurio."}
              </div>
            )}
          </div>

          {/* Leave & Unavailability Requests Panel */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4">
              {lang === "en" ? "Leave & Unavailability Requests" : "Maombi ya Likizo / Kutopatikana"}
            </h3>
            {leaveRequests.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                 {lang === "en" ? "No leave or unavailability requests submitted." : "Hakuna maombi ya likizo yaliyowasilishwa."}
              </div>
            ) : (
              <div className="space-y-4">
                {leaveRequests.map((req) => (
                  <div key={req.id} className="border border-gray-200 rounded-xl p-4 flex flex-wrap justify-between items-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <div className="text-left space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-800 text-sm">{req.userName}</span>
                        <span className={`px-2 py-0.5 text-[8px] font-mono font-bold rounded uppercase ${
                          req.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                          req.status === "rejected" ? "bg-red-100 text-red-800" :
                          "bg-amber-100 text-amber-800 animate-pulse"
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-semibold">
                         {req.startDate} {lang === "en" ? "to" : "hadi"} {req.endDate}
                      </p>
                      <p className="text-xs text-neutral-600 font-serif max-w-lg mt-1 italic">
                        "{req.reason}"
                      </p>
                    </div>

                    {req.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveLeave(req.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          {lang === "en" ? "Approve" : "Kubali"}
                        </button>
                        <button
                          onClick={() => handleRejectLeave(req.id)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          {lang === "en" ? "Reject" : "Kataa"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2b. VICE CHAIRPERSON ( partnerships/comms, broadcast composer, logistics ) */}
      {(getUserRoleKey(currentUser) === UserRole.VICE_CHAIRPERSON) && (
        <div className="space-y-6 text-left" id="vice-chairperson-panel">
          {/* Top statistics or overview cards */}
          <ViceChairpersonOverview lang={lang} partners={partners} budgets={budgets} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Side: Partner CRM Summary */}
            <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4">
                {lang === "en" ? "Partner CRM Summary" : "Orodha ya Wadau na Ufuatiliaji"}
              </h3>
              <div className="space-y-4">
                {[...partners].sort((a, b) => (a.nextFollowUpDate || "9999").localeCompare(b.nextFollowUpDate || "9999")).map((partner) => {
                  const log = [...(partner.contactLog || [])].sort((a, b) => b.date.localeCompare(a.date));
                  const lastContact = log[0];
                  const today = new Date().toISOString().split("T")[0];
                  const overdue = partner.nextFollowUpDate && partner.nextFollowUpDate < today;
                  const dueSoon = partner.nextFollowUpDate && !overdue && partner.nextFollowUpDate <= new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
                  return (
                    <div key={partner.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors flex justify-between items-start flex-wrap gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 bg-neutral-200/50 px-2 py-0.5 rounded">
                          {partner.category.replace("_", " ")}
                        </span>
                        <h4 className="text-xs font-extrabold text-[#1B1B1B] mt-1">{partner.name}</h4>
                        <p className="text-[10px] text-gray-500 font-medium">Contact: {partner.contactPerson} ({partner.email})</p>
                        {partner.notes && <p className="text-[11px] text-gray-600 font-serif italic mt-1">"{partner.notes}"</p>}
                        {lastContact && <p className="text-[10px] text-neutral-500 mt-1">{lang === "en" ? "Latest note" : "Kumbukumbu ya mwisho"}: {lastContact.notes}</p>}
                      </div>
                      <div className="text-right space-y-1 font-mono text-[10px] shrink-0">
                        <div>
                          <span className="text-gray-400 font-medium">LAST CONTACT:</span>{" "}
                          <strong className="text-neutral-700">{lastContact ? lastContact.date : (lang === "en" ? "Never logged" : "Bado")}</strong>
                        </div>
                        <div>
                          <span className="text-gray-400 font-medium">NEXT FOLLOW-UP:</span>{" "}
                          <strong className="text-neutral-700">{partner.nextFollowUpDate || (lang === "en" ? "Not set" : "Haijawekwa")}</strong>
                        </div>
                        {partner.nextFollowUpDate && (
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full font-bold text-[8px] uppercase ${
                            overdue ? "bg-red-100 text-red-700 border border-red-200" : dueSoon ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-100"
                          }`}>
                            {overdue ? (lang === "en" ? "Overdue" : "Imechelewa") : dueSoon ? (lang === "en" ? "Due Soon" : "Karibuni") : (lang === "en" ? "Scheduled" : "Imepangwa")}
                          </span>
                        )}
                        <button
                          onClick={() => setLoggingContactPartner(partner)}
                          className="block mt-1.5 text-[10px] font-bold text-blue-600 hover:underline cursor-pointer ml-auto"
                        >
                          {lang === "en" ? "Log Contact" : "Rekodi Mawasiliano"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {partners.length === 0 && (
                  <p className="text-xs text-neutral-400 italic text-center py-6">{lang === "en" ? "No partners recorded yet." : "Hakuna wadau bado."}</p>
                )}
              </div>
            </div>

            {/* Right Side: Broadcast Message & Confirmed Engagements */}
            <div className="lg:col-span-5 space-y-6">
              {/* Broadcast Composer */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4 flex items-center gap-1.5">
                  <span></span>
                  <span>{lang === "en" ? "Broadcast Composer" : "Tuma Ujumbe kwa Wadau"}</span>
                </h3>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  {lang === "en"
                    ? "Send immediate updates or newsletters to all registered stakeholders and active partner contacts."
                    : "Tuma taarifa kwa urahisi kwa wadau na mashirika washirika wote kwa mpigo mmoja."}
                </p>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!broadcastMessage.trim()) return;
                  
                  const newBroadcast: Broadcast = {
                    id: `b-${Date.now()}`,
                    message: broadcastMessage,
                    channel: broadcastChannel.toLowerCase() as any,
                    sentBy: `${currentUser.name} (${currentUser.role})`,
                    sentDate: new Date().toISOString()
                  };
                  
                  const updatedBroadcasts = [newBroadcast, ...broadcasts];
                  setBroadcasts(updatedBroadcasts);
                  StorageService.saveRecord("broadcasts", newBroadcast).catch(console.error);

                  setBroadcastSuccess(true);
                  setTimeout(() => setBroadcastSuccess(false), 5000);
                  setBroadcastMessage("");
                }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                      {lang === "en" ? "Broadcast Channel" : "Njia ya Kutuma"}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["SMS", "WhatsApp", "Email"] as const).map((channel) => (
                        <button
                          key={channel}
                          type="button"
                          onClick={() => setBroadcastChannel(channel)}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                            broadcastChannel === channel
                              ? "bg-[#E31E24] text-white border-[#E31E24]"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {channel}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                      {lang === "en" ? "Message / Announcement" : "Ujumbe Wenyewe"}
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      placeholder={lang === "en" ? "e.g., Dear partners, we invite you to our forum theatre outreach this Thursday..." : "mfano, Habari wadau, tunawakaribisha katika mazoezi yetu..."}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 leading-relaxed font-sans"
                    ></textarea>
                  </div>

                  {broadcastSuccess && (
                    <div className="bg-[#00A651]/10 text-[#00A651] text-xs font-bold p-3 rounded-lg border border-[#00A651]/20">
                      {lang === "en" ? " Broadcast queued successfully to all partner contacts!" : " Ujumbe umetumwa kikamilifu kwa wadau wote!"}
                    </div>
                  )}

                  <button
                    type="submit"
                    id="send-broadcast-btn"
                    className="w-full bg-[#00A651] hover:bg-[#008f43] text-white text-xs font-bold py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    {lang === "en" ? "Send Broadcast Announcement" : "Tuma Ujumbe Sasa"}
                  </button>
                </form>
              </div>

              {/* Confirmed Engagements needing logistics */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4">
                  {lang === "en" ? "Confirmed Engagements (Logistics)" : "Uratibu wa Miradi Iliyokubaliwa"}
                </h3>
                <div className="space-y-3">
                  {budgets.filter(b => b.status === "approved").map((b) => (
                    <div key={b.id} className="border border-gray-200 rounded-xl p-4 text-left bg-gray-50/50">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <h4 className="text-xs font-bold text-[#1B1B1B]">{b.title}</h4>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#00A651]/10 text-[#00A651] uppercase font-mono tracking-wider border border-[#00A651]/20">
                          CONFIRMED
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-semibold mt-1">Date: {b.date}</p>
                      <div className="mt-3 pt-3 border-t border-gray-200/60 flex justify-between items-center text-[10px] text-gray-400">
                        <span>Stipends & Costing: Approved</span>
                        <button
                          onClick={() => onNavigateToTab("documents")}
                          className="text-[#E31E24] hover:underline font-bold"
                        >
                          {lang === "en" ? "View Budget" : "Angalia Bajeti"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Partner Pipeline Kanban Board */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4">
              {lang === "en" ? "Partner Pipeline / Engagement Board" : "Mwenendo wa Uhusiano na Wadau (Pipeline)"}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { stage: "prospecting", title: "Prospecting / Initial Outreach", color: "bg-gray-100 text-gray-800 border-gray-200" },
                { stage: "proposal_submitted", title: "Proposal Submitted", color: "bg-blue-50 text-blue-800 border-blue-200" },
                { stage: "negotiating", title: "Negotiation / MOU Review", color: "bg-amber-50 text-amber-800 border-amber-200" },
                { stage: "signed", title: "Partnership Signed & Active", color: "bg-emerald-50 text-emerald-800 border-emerald-200" }
              ].map((column) => {
                const columnPartners = partners.filter(p => p.pipelineStage === column.stage);
                return (
                  <div key={column.stage} className="flex flex-col h-full bg-neutral-50/50 rounded-xl p-4 border border-neutral-150">
                    <div className="flex items-center justify-between mb-3 border-b border-neutral-200/60 pb-2">
                      <span className="text-[10px] font-black tracking-tight uppercase text-neutral-600 block pr-1 leading-relaxed max-w-[120px]">
                        {column.title}
                      </span>
                      <span className="bg-neutral-200 text-neutral-700 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
                        {columnPartners.length}
                      </span>
                    </div>

                    <div className="space-y-3 flex-1 min-h-[120px]">
                      {columnPartners.length === 0 ? (
                        <div className="text-[10px] text-gray-400 font-medium py-6 text-center border border-dashed border-gray-200 rounded-lg">
                          {lang === "en" ? "No partners" : "Bila wadau"}
                        </div>
                      ) : (
                        columnPartners.map(p => (
                          <div key={p.id} className="bg-white border border-gray-200 p-3 rounded-lg shadow-2xs text-left hover:border-red-400 transition-colors">
                            <span className="text-[8px] font-mono font-black tracking-wider uppercase text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                              {p.category.replace("_", " ")}
                            </span>
                            <h4 className="text-[11px] font-black text-neutral-800 mt-1.5 leading-tight">{p.name}</h4>
                            <p className="text-[9px] text-neutral-500 mt-1 truncate">Lead: {p.contactPerson}</p>
                            <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between text-[8px] font-mono text-neutral-400">
                              <span>MOU Ref: {p.id.toUpperCase()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Log Contact modal — Vice Chairperson's real partner follow-up tracker */}
      <Modal isOpen={!!loggingContactPartner} onClose={() => setLoggingContactPartner(null)} maxWidth="max-w-sm">
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900">{lang === "en" ? "Log Contact" : "Rekodi Mawasiliano"}</h3>
          <p className="text-xs text-neutral-500">{loggingContactPartner?.name}</p>
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "How did you reach them?" : "Njia ya Mawasiliano"}</label>
            <select value={contactLogMethod} onChange={e => setContactLogMethod(e.target.value as any)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs">
              <option value="call">{lang === "en" ? "Phone Call" : "Simu"}</option>
              <option value="email">Email</option>
              <option value="meeting">{lang === "en" ? "In-Person Meeting" : "Mkutano"}</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="other">{lang === "en" ? "Other" : "Nyingine"}</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Notes" : "Maelezo"} *</label>
            <textarea value={contactLogNotes} onChange={e => setContactLogNotes(e.target.value)} rows={3} placeholder={lang === "en" ? "What was discussed?" : "Mlijadili nini?"} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Next Follow-Up Date (optional)" : "Tarehe ya Ufuatiliaji (si lazima)"}</label>
            <input type="date" value={contactLogNextFollowUp} onChange={e => setContactLogNextFollowUp(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
          </div>
          <button
            onClick={handleSaveContactLog}
            disabled={savingContactLog || !contactLogNotes.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
          >
            {savingContactLog ? (lang === "en" ? "Saving..." : "Inahifadhi...") : (lang === "en" ? "Save Contact Log" : "Hifadhi")}
          </button>
        </div>
      </Modal>

      {/* 2c. TREASURER ( cash position, claims review, recent invoices, ledger link ) */}
      {(getUserRoleKey(currentUser) === UserRole.TREASURER) && (
        <div className="space-y-6 text-left" id="treasurer-panel">
          {/* Top Metrics Row */}
          <TreasurerOverview
            lang={lang}
            cashReserves={cashReserves}
            pendingTreasurerCount={pendingTreasurerCount}
            budgets={budgets}
            incomes={StorageService.getIncomes()}
            expenditures={expenditures}
            onNavigateToTab={onNavigateToTab}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Recent Invoices list */}
            <div className="lg:col-span-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4">
                {lang === "en" ? "Recent Expenditure Requests / Invoices" : "Madai ya Hivi Karibuni na Hali Zake"}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-neutral-400 font-mono font-bold uppercase tracking-wider text-[10px]">
                      <th className="pb-3 pr-2">{lang === "en" ? "Description" : "Maelezo"}</th>
                      <th className="pb-3 px-2">{lang === "en" ? "Requested By" : "Mwombaji"}</th>
                      <th className="pb-3 px-2">{lang === "en" ? "Amount" : "Kiasi"}</th>
                      <th className="pb-3 pl-2 text-right">{lang === "en" ? "Status" : "Hali"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-neutral-700">
                    {expenditures.slice(0, 6).map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 pr-2 font-serif text-neutral-900">
                          <div>{req.description}</div>
                          {req.status.startsWith("pending") && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${
                                getDaysPending(req.requestDate) > 10
                                  ? "bg-red-50 text-red-600 border border-red-100"
                                  : getDaysPending(req.requestDate) > 5
                                  ? "bg-amber-50 text-amber-600 border border-amber-100"
                                  : "bg-blue-50 text-blue-600 border border-blue-100"
                              }`}>
                                 {getDaysPending(req.requestDate)} {lang === "en" ? "days pending" : "siku zinasubiri"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-neutral-500">{req.requestedBy}</td>
                        <td className="py-3 px-2 font-mono font-bold text-[#1B1B1B]">Ksh {(req?.amount || 0).toLocaleString()}</td>
                        <td className="py-3 pl-2 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-md font-mono text-[9px] font-bold uppercase ${
                            req.status === "approved"
                              ? "bg-[#00A651]/10 text-[#00A651]"
                              : req.status === "rejected"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700 animate-pulse"
                          }`}>
                            {req.status.replace("pending_", "pending ").toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right side widgets: Ledger Access & Bank Reconciliation */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4">
                    {lang === "en" ? "Financial Ledger Access" : "Mfumo wa Ledger ya Kifedha"}
                  </h3>
                  <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                    {lang === "en"
                      ? "As Treasurer, you have primary authority over the Finance Ledger. Review all pending claims, disburse volunteer stipends, and approve project budgets directly."
                      : "Kama Mhazini, una mamlaka kuu ya kusimamai hesabu za CBO. Kagua madai, lipa posho za wasanii, na uidhinishe bajeti hapa."}
                  </p>
                </div>

                <button
                  onClick={() => onNavigateToTab("finance")}
                  id="treasurer-ledger-shortcut-btn"
                  className="w-full bg-[#E31E24] hover:bg-[#c91a1f] text-white text-xs font-bold py-3 rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                   {lang === "en" ? "Open Finance Ledger" : "Fungua Daftari la Fedha"}
                </button>
              </div>

              {/* Bank Reconciliation Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4">
                  {lang === "en" ? "Bank Reconciliation" : "Usawazishaji wa Benki"}
                </h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                      <span className="text-[8px] text-neutral-400 font-mono font-bold block uppercase">{lang === "en" ? "LAST RECONCILED" : "ILISAWAZISHWA MWISHO"}</span>
                      <span className="text-[11px] font-bold text-neutral-700 mt-1 block">{reconcileDate}</span>
                    </div>
                    <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                      <span className="text-[8px] text-neutral-400 font-mono font-bold block uppercase">{lang === "en" ? "UNRECONCILED" : "BILA KULINGANISHWA"}</span>
                      <span className={`text-[11px] font-bold mt-1 block ${unreconciledCount > 0 ? "text-amber-600 font-black animate-pulse" : "text-emerald-600"}`}>
                        {unreconciledCount > 0 ? (lang === "en" ? `${unreconciledCount} transactions` : `${unreconciledCount} muamala`) : (lang === "en" ? "Fully Matched" : "Safi Kabisa")}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowReconcileModal(true);
                      setReconcileSuccess(false);
                    }}
                    id="run-reconcile-modal-btn"
                    className="w-full bg-neutral-900 hover:bg-neutral-950 text-white text-xs font-bold py-2.5 rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                     {lang === "en" ? "Run Reconciliation Check" : "Anza Usawazishaji"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SECRETARY ( minutes, profiles register ) */}
      {(getUserRoleKey(currentUser) === UserRole.SECRETARY) && (
        <div className="space-y-6 text-left">
          <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4">
            <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans">
              {lang === "en" ? "Membership Records & Directory" : "Daftari la Uanachama na Vijana"}
            </h3>
            <button
              onClick={() => onNavigateToTab("documents")}
              id="draft-minutes-btn"
              className="bg-[#E31E24] hover:bg-[#c91a1f] text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors"
            >
               {lang === "en" ? "Draft New Meeting Minutes" : "Andika Kumbukumbu Mpya"}
            </button>
          </div>

          {/* Membership summary — new, computed from real profile/attendance data */}
          <SecretaryOverview lang={lang} profiles={profiles} attendance={StorageService.getAttendance()} />

          {/* Active Members Activity Tracker */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6">
            <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4">
              {lang === "en" ? "Active Members Activity & Print Hub" : "Shughuli za Wanachama na Vitambulisho"}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-neutral-400 font-mono font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pr-2">{lang === "en" ? "Member Name" : "Jina la Mwanachama"}</th>
                    <th className="pb-3 px-2">{lang === "en" ? "Staff/Volunteer Role" : "Jukumu"}</th>
                    <th className="pb-3 px-2">{lang === "en" ? "Clock-In Streak" : "Mfululizo wa Mahudhurio"}</th>
                    <th className="pb-3 px-2">{lang === "en" ? "Total Hours" : "Jumla ya Saa"}</th>
                    <th className="pb-3 pl-2 text-right">{lang === "en" ? "Quick Action" : "Hatua ya Haraka"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-neutral-700">
                  {profiles.slice(0, 4).map((member) => {
                    // Real per-member attendance stats — this table previously showed
                    // hardcoded placeholder streak/hours text ("8 sessions", "28.5 Hrs")
                    // cycled by row position, unrelated to the actual member shown.
                    const { sessions, hours } = getMemberAttendanceStats(member.id, StorageService.getAttendance());
                    return (
                      <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 pr-2 font-bold text-neutral-900">{member.name}</td>
                        <td className="py-3 px-2 text-neutral-500 font-mono text-[10px] uppercase">{member.role}</td>
                        <td className="py-3 px-2 text-amber-600 font-bold">{sessions} {lang === "en" ? "sessions" : "vikao"}</td>
                        <td className="py-3 px-2 font-mono font-bold text-neutral-800">{hours.toFixed(1)} Hrs</td>
                        <td className="py-3 pl-2 text-right">
                          <button
                            onClick={() => onPrintReport("Bashosho ID Card - " + member.name, (
                              <div className="flex justify-center items-center py-10 bg-neutral-100">
                                <div className="max-w-xs w-full">
                                  <MembershipIDCard member={member} onVerify={() => {}} />
                                </div>
                              </div>
                            ))}
                            id={`print-id-card-${member.id}`}
                            className="bg-neutral-950 hover:bg-black text-white text-[10px] font-bold px-2.5 py-1.5 rounded transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <Printer size={12} /> {lang === "en" ? "Print ID Card" : "Chapa Kitambulisho"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map((p) => (
              <MembershipIDCard key={p.id} member={p} onVerify={setSelectedVerifyMember} />
            ))}
          </div>
        </div>
      )}

      {/* 4. SAFEGUARDING & MEL OFFICER / CHAIRPERSON ( highly restricted safeguarding reports panel ) */}
      {(getUserRoleKey(currentUser) === UserRole.SAFEGUARDING_OFFICER || getUserRoleKey(currentUser) === UserRole.CHAIRPERSON) && (
        <div className="space-y-6 text-left" id="safeguarding-restricted-officer-panel">
          {getUserRoleKey(currentUser) === UserRole.SAFEGUARDING_OFFICER && (
            <SafeguardingOfficerOverview lang={lang} reports={safeguarding} />
          )}
          <div className="bg-[#E31E24]/5 border border-[#E31E24]/20 rounded-xl p-5 flex gap-3 items-start">
            <span className="text-xl"></span>
            <div>
              <h4 className="text-sm font-bold text-[#E31E24] uppercase tracking-wide">
                {lang === "en" ? "RESTRICTED ACCESS PORTAL" : "UKURASA ULIOZUIWA NA KULINDWA"}
              </h4>
              <p className="text-xs text-red-700 mt-1 leading-relaxed font-semibold">
                {lang === "en"
                  ? "Authorized review of community safety and safeguarding logs. To prevent disclosure leaks, details are fully restricted from general staff dashboards."
                  : "Mamlaka ya kukagua malalamiko ya usalama Kiambiu. Habari hizi zimelindwa ili kuzuia kuvuja kwa siri."}
              </p>
              {getUserRoleKey(currentUser) === UserRole.CHAIRPERSON && (
                <div className="mt-2 text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200/50 rounded px-2.5 py-1.5 flex items-center gap-1.5 font-medium font-sans animate-pulse">
                  <Eye size={14} className="shrink-0 text-amber-700" />
                  <span>
                    {lang === "en"
                      ? "Chairperson access to this sensitive safeguarding panel is strictly logged for audit purposes."
                      : "Ufikiaji wa Mwenyekiti kwenye ukurasa huu nyeti wa usalama unarekodiwa kikamilifu kwa madhumuni ya ukaguzi."}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4">
              {lang === "en" ? "Confidential Incident Reports" : "Ripoti za Siri za Visa Kiambiu"}
            </h3>

            {/* Aggregate status counts only \u2014 no report content, no new data exposure beyond
                what's already fully visible in the list directly below to this same authorized viewer. */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-neutral-800 font-mono">{safeguarding.filter(s => s.status === "received").length}</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-0.5">{lang === "en" ? "Received" : "Zimepokelewa"}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-amber-700 font-mono">{safeguarding.filter(s => s.status === "under_review").length}</p>
                <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mt-0.5">{lang === "en" ? "Under review" : "Zinakaguliwa"}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-emerald-700 font-mono">{safeguarding.filter(s => s.status === "resolved").length}</p>
                <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mt-0.5">{lang === "en" ? "Resolved" : "Zimetatuliwa"}</p>
              </div>
            </div>

            <div className="space-y-5">
              {safeguarding.map((report) => (
                <div key={report.id} className="border border-gray-200 rounded-xl p-5 bg-gray-50/50 space-y-3 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-baseline flex-wrap gap-2">
                    <h4 className="text-sm font-bold text-neutral-900">{report.title}</h4>
                    <span className="text-[10px] font-mono font-bold text-gray-400">
                      {new Date(report.reportedDate).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-600 leading-relaxed font-serif">
                    {report.description}
                  </p>

                  <div className="pt-2 flex justify-between items-center text-[10px] font-mono text-gray-500 flex-wrap gap-3">
                    <div>
                      <span>{lang === "en" ? "Reported By" : "Iliowasilishwa na"}: </span>
                      <strong className="text-neutral-700">{report.reporterName || (lang === "en" ? "Anonymous" : "Siri / Bila Jina")}</strong>
                    </div>
                    <div className="flex gap-2">
                      <span className="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-100">
                        STATUS: {report.status.toUpperCase()}
                      </span>
                      <span className="bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded border border-gray-200">
                        ASSIGNED: {report.assignedTo}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. GENERAL MEMBER / VOLUNTEER DASHBOARD */}
      {(getUserRoleKey(currentUser) === UserRole.PROGRAM_MEMBER || getUserRoleKey(currentUser) === UserRole.VOLUNTEER) && (
        <div className="space-y-6 text-left">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ID Card Display */}
            <div className="lg:col-span-5 flex flex-col justify-center items-center">
              <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-3 w-full text-left">
                {lang === "en" ? "Your Membership Digital ID" : "Kadi Yako ya Dijitali"}
              </h3>
              <MembershipIDCard member={currentUser} onVerify={setSelectedVerifyMember} />
              
              {/* Member Passport Photo Upload Widget */}
              <div className="w-full max-w-sm mt-4 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-red-50 rounded-lg text-red-600">
                    <User size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-neutral-800 uppercase">
                      {lang === "en" ? "Upload Official Passport Photo" : "Pakia Picha ya Kitambulisho"}
                    </h4>
                    <p className="text-[10px] text-neutral-400">
                      {lang === "en" ? "Ensure your face is clear for the CBO card" : "Hakikisha sura inaonekana vizuri kwa kadi"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                  <label className="bg-[#E31E24] hover:bg-[#c21419] text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-xs transition-colors inline-block shrink-0">
                    <span>{uploadingPhoto ? (lang === "en" ? "Uploading..." : "Inapandisha...") : (lang === "en" ? "Select Image" : "Chagua Picha")}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingPhoto}
                      className="hidden"
                      onChange={handleMemberDashboardPhotoChange}
                    />
                  </label>
                  <span className="text-[9px] text-neutral-400 font-mono">
                    Max 1.5MB • JPEG/PNG
                  </span>
                </div>
              </div>

              <div className="w-full max-w-sm mt-4 space-y-4">
                <VolunteerRecognitionPanel lang={lang} currentUser={currentUser} volunteerHours={volunteerHours} />
                <GrowthTrackerPanel lang={lang} currentUser={currentUser} classes={classes} />
              </div>
            </div>

            {/* Performance/Stipends quick tracks */}
            <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b border-gray-200 pb-3 mb-4">
                  {lang === "en" ? "Your Member Contributions" : "Michango na Mapato Yako"}
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <StatCard
                    label={lang === "en" ? "Volunteer hours" : "Saa za kujitolea"}
                    value={`${volunteerHours} Hrs`}
                    icon={<Clock size={17} />}
                    accent="community"
                  />
                  <StatCard
                    label={lang === "en" ? "Total stipends paid" : "Jumla ya posho zilizolipwa"}
                    value={`KSh ${totalEarnedStipends.toLocaleString()}`}
                    icon={<Wallet size={17} />}
                    accent="finance"
                  />
                </div>
              </div>

              <div className="bg-[#E31E24]/5 border border-[#E31E24]/10 p-4 rounded-xl text-xs text-red-700 leading-relaxed font-semibold">
                 {lang === "en"
                  ? "Thank you for your active participation in forum theatre outreaches inside Kiambiu. Your efforts directly aid Nairobi youth advocacy and safeguarding campaigns!"
                  : "Asante kwa kujitolea kwako katika sanaa za jukwaani Kiambiu. Jitihada zako zinasaidia kupunguza GBV na kuelimisha vijana Nairobi!"}
              </div>
            </div>
          </div>

          {/* Member Features Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            {/* Left Column - Events, Announcements, History */}
            <div className="lg:col-span-7 space-y-6">
              {/* Upcoming Events */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4 flex items-center justify-between">
                  <span> {lang === "en" ? "My Upcoming Events" : "Matukio Yangu Yajayo"}</span>
                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase">Casting</span>
                </h3>
                {upcomingEvents.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 text-xs">
                     {lang === "en" ? "No upcoming events scheduled." : "Hakuna matukio yajayo yaliyopangwa."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingEvents.map(evt => {
                      const role = getUserRoleInEvent(evt);
                      return (
                        <div key={evt.id} className="border border-gray-150 rounded-xl p-4 bg-gray-50/50 flex justify-between items-center">
                          <div className="text-left space-y-1">
                            <span className="bg-[#E31E24]/10 text-[#E31E24] font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#E31E24]/20 uppercase">
                              {evt.type.toUpperCase()}
                            </span>
                            <h4 className="text-xs font-black text-[#1B1B1B] mt-1">{evt.title}</h4>
                            <p className="text-[10px] text-gray-500 font-semibold"> {evt.venue}</p>
                          </div>
                          <div className="text-right space-y-1">
                            <span className="text-xs font-bold text-neutral-800 block"> {evt.date}</span>
                            <span className="text-[10px] font-mono text-gray-400 uppercase font-semibold">{role}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Broadcast Inbox */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4 flex items-center justify-between">
                  <span> {lang === "en" ? "Broadcast Inbox" : "Kikasha cha Matangazo"}</span>
                  {broadcasts.some(b => !isRead(b.id)) && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[9px] text-neutral-400 hover:text-neutral-600 font-bold uppercase tracking-wider font-mono cursor-pointer"
                    >
                      {lang === "en" ? "Mark all as read" : "Soma zote"}
                    </button>
                  )}
                </h3>
                {broadcasts.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 text-xs">
                     {lang === "en" ? "No broadcasts received." : "Hakuna matangazo yaliyopokelewa."}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {broadcasts.map(b => {
                      const read = isRead(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => markAsRead(b.id)}
                          className={`border p-4 rounded-xl text-left transition-all cursor-pointer ${
                            read ? "bg-white border-gray-150 opacity-80" : "bg-red-50/20 border-red-200 shadow-2xs"
                          }`}
                        >
                          <div className="flex justify-between items-baseline mb-1">
                            <div className="flex items-center gap-1.5">
                              {!read && <span className="w-2 h-2 rounded-full bg-[#E31E24] animate-pulse"></span>}
                              <span className="text-[10px] font-bold text-gray-400 font-mono uppercase">
                                 {b.channel.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-[9px] font-mono text-gray-400">
                              {new Date(b.sentDate).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-800 leading-relaxed font-sans">{b.message}</p>
                          <div className="mt-2 text-[9px] font-mono text-gray-400 border-t border-gray-100 pt-1 flex justify-between items-center">
                            <span>Sent by: {b.sentBy}</span>
                            <span className="flex items-center gap-2">
                              {read && <span className="text-emerald-600">Read</span>}
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedThreadId(expandedThreadId === b.id ? null : b.id); }}
                                className="text-neutral-500 hover:text-[#E31E24] font-bold cursor-pointer"
                              >
                                {(b.replies?.length || 0) > 0
                                  ? `${b.replies!.length} ${lang === "en" ? "repl" + (b.replies!.length === 1 ? "y" : "ies") : "majibu"}`
                                  : (lang === "en" ? "Reply" : "Jibu")}
                              </button>
                            </span>
                          </div>

                          {expandedThreadId === b.id && (
                            <div onClick={(e) => e.stopPropagation()} className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                              {(b.replies || []).map(r => (
                                <div key={r.id} className="bg-neutral-50 rounded-lg px-2.5 py-1.5">
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] font-bold text-neutral-700">{r.userName}</span>
                                    <span className="text-[9px] font-mono text-neutral-400">{new Date(r.timestamp).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-[11px] text-neutral-600">{r.message}</p>
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <input
                                  value={replyDrafts[b.id] || ""}
                                  onChange={(e) => setReplyDrafts(prev => ({ ...prev, [b.id]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === "Enter") handlePostReply(b.id); }}
                                  placeholder={lang === "en" ? "Write a reply..." : "Andika jibu..."}
                                  className="flex-1 bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-[11px]"
                                />
                                <button
                                  onClick={() => handlePostReply(b.id)}
                                  disabled={postingReplyId === b.id || !(replyDrafts[b.id] || "").trim()}
                                  className="bg-neutral-900 hover:bg-black text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40"
                                >
                                  {lang === "en" ? "Send" : "Tuma"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Attendance History */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4 flex items-center justify-between">
                  <span> {lang === "en" ? "My Attendance History" : "Historia ya Mahudhurio Yangu"}</span>
                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase">MEL logs</span>
                </h3>
                {myAttendanceHistory.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 text-xs">
                     {lang === "en" ? "No past attendance records found." : "Hakuna rekodi za mahudhurio za nyuma."}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-neutral-400 font-mono font-bold uppercase tracking-wider text-[10px]">
                          <th className="pb-2 pr-2">{lang === "en" ? "Event / Outreach" : "Mradi / Outreach"}</th>
                          <th className="pb-2 px-2">{lang === "en" ? "Date" : "Tarehe"}</th>
                          <th className="pb-2 px-2 text-center">{lang === "en" ? "Hours" : "Saa"}</th>
                          <th className="pb-2 pl-2 text-right">{lang === "en" ? "Stipend Paid" : "Posho"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium text-neutral-700">
                        {myAttendanceHistory.map(sheet => {
                          const rec = getMyAttendanceRecord(sheet);
                          if (!rec) return null;
                          return (
                            <tr key={sheet.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-2.5 pr-2 font-bold text-neutral-900">{sheet.title}</td>
                              <td className="py-2.5 px-2 text-neutral-500 font-mono">{sheet.date}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-neutral-800">{rec.volunteerHours || 0} Hrs</td>
                              <td className="py-2.5 pl-2 text-right font-mono font-bold text-emerald-600">Ksh {(rec.stipend || 0).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Equipment & Leave Request */}
            <div className="lg:col-span-5 space-y-6">
              {/* My Equipment */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Package size={16} className="text-gray-500" /> {lang === "en" ? "My Equipment" : "Vifaa Vyangu"}</span>
                  <button
                    onClick={() => setShowCheckoutForm(!showCheckoutForm)}
                    className="text-[10px] text-[#E31E24] font-bold hover:underline cursor-pointer"
                  >
                    {showCheckoutForm ? (lang === "en" ? "Cancel" : "Ghairi") : (lang === "en" ? "+ Borrow Item" : "+ Azima Kifaa")}
                  </button>
                </h3>

                {showCheckoutForm ? (
                  <form onSubmit={handleCheckoutEquipment} className="space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-150 text-xs mb-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                        {lang === "en" ? "Select Asset" : "Chagua Kifaa"}
                      </label>
                      <select
                        required
                        value={checkoutAssetId}
                        onChange={(e) => setCheckoutAssetId(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      >
                        <option value="">-- {lang === "en" ? "Choose available asset" : "Chagua kifaa kilichopo"} --</option>
                        {assets
                          .filter(asset => !asset.checkoutHistory.some(ch => !ch.actualReturnDate))
                          .map(asset => (
                            <option key={asset.id} value={asset.id}>
                              {asset.name} ({asset.category.replace("_", " ")})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                        {lang === "en" ? "Link to Event" : "Unganisha na Mradi"}
                      </label>
                      <select
                        required
                        value={checkoutEventId}
                        onChange={(e) => setCheckoutEventId(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      >
                        <option value="">-- {lang === "en" ? "Select target event" : "Chagua mradi"} --</option>
                        {upcomingEvents.map(evt => (
                          <option key={evt.id} value={evt.id}>{evt.title} ({evt.date})</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-[#00A651] hover:bg-[#008f43] text-white font-bold py-1.5 rounded-lg transition-colors cursor-pointer text-xs"
                    >
                      {lang === "en" ? "Check Out Item" : "Kamilisha Kuazima"}
                    </button>
                  </form>
                ) : null}

                {myCheckedOutAssets.length === 0 ? (
                  <div className="py-4 text-center text-gray-400 text-xs">
                     {lang === "en" ? "You have no equipment checked out currently." : "Huna vifaa ulivyoazima kwa sasa."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myCheckedOutAssets.map(asset => {
                      const activeCheckout = asset.checkoutHistory.find(ch => !ch.actualReturnDate && ch.userName === currentUser.name);
                      return (
                        <div key={asset.id} className="border border-gray-150 rounded-xl p-3 bg-gray-50/50 flex justify-between items-center text-xs">
                          <div className="text-left">
                            <span className="font-bold text-[#1B1B1B] block">{asset.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono block">Serial: {asset.serialNumber}</span>
                            {activeCheckout && (
                              <span className="text-[9px] text-amber-600 font-semibold block mt-1">
                                 {lang === "en" ? "Expected return" : "Inatarajiwa kurudishwa"}: {activeCheckout.expectedReturnDate}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleReturnEquipment(asset.id)}
                            className="px-2.5 py-1 bg-neutral-900 hover:bg-black text-white text-[10px] font-bold rounded-md transition-colors cursor-pointer"
                          >
                            {lang === "en" ? "Return Item" : "Rudisha"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Request Leave */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans border-b pb-3 mb-4">
                   {lang === "en" ? "Request Leave & Unavailability" : "Omba Likizo / Kutopatikana"}
                </h3>

                <form onSubmit={handleRequestLeave} className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-150 text-xs mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                        {lang === "en" ? "Start Date" : "Siku ya Kuanza"}
                      </label>
                      <input
                        type="date"
                        required
                        value={leaveStartDate}
                        onChange={(e) => setLeaveStartDate(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                        {lang === "en" ? "End Date" : "Siku ya Kumaliza"}
                      </label>
                      <input
                        type="date"
                        required
                        value={leaveEndDate}
                        onChange={(e) => setLeaveEndDate(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                      {lang === "en" ? "Reason / Cause" : "Sababu"}
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder={lang === "en" ? "e.g., Back home family emergency / exams..." : "sababu mfano, mitihani / dharura ya kifamilia..."}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-sans"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-neutral-900 hover:bg-black text-white font-bold py-1.5 rounded-lg transition-colors cursor-pointer text-xs uppercase font-mono tracking-wider"
                  >
                    {lang === "en" ? "Submit Leave Request" : "Wasilisha Ombi"}
                  </button>
                </form>

                {/* History of leaves */}
                <div className="space-y-2 mt-4 font-sans">
                  <h4 className="text-[10px] font-bold text-gray-400 font-mono uppercase tracking-wider mb-2">
                    {lang === "en" ? "Your Request History" : "Historia ya Maombi Yako"}
                  </h4>
                  {leaveRequests.filter(req => req.userId === currentUser.id).length === 0 ? (
                    <div className="text-gray-400 text-xs py-2 text-center">
                      {lang === "en" ? "No leave requests submitted yet." : "Bado hujaomba likizo yoyote."}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {leaveRequests
                        .filter(req => req.userId === currentUser.id)
                        .map(req => (
                          <div key={req.id} className="border border-gray-150 p-3 rounded-lg text-xs bg-gray-50/30 flex justify-between items-center">
                            <div className="text-left space-y-1">
                              <span className="font-bold text-neutral-800"> {req.startDate} {lang === "en" ? "to" : "hadi"} {req.endDate}</span>
                              <p className="text-[10px] text-gray-400 font-serif leading-tight">"{req.reason}"</p>
                            </div>
                            <span className={`px-2 py-0.5 text-[8px] font-mono font-bold rounded uppercase ${
                              req.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                              req.status === "rejected" ? "bg-red-100 text-red-800" :
                              "bg-amber-100 text-amber-800 animate-pulse"
                            }`}>
                              {req.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* VERIFY MEMBERSHIP MODAL (triggered by QR scan) */}
      <Modal
        isOpen={!!selectedVerifyMember}
        onClose={() => setSelectedVerifyMember(null)}
        title={lang === "en" ? "Membership Verified" : "Uanachama Umethibitishwa"}
        maxWidth="max-w-sm"
      >
        <div className="text-center space-y-4 font-sans">
          {selectedVerifyMember && (
            <>
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner border border-emerald-100">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  {lang === "en" 
                    ? "This digital ID matches an ACTIVE official registration inside the Bashosho Talents CBO database."
                    : "Kadi hii inalingana na usajili hai katika kanzidata ya mradi wa Bashosho Talents CBO."}
                </p>
              </div>

              <div className="border border-neutral-100 rounded-xl p-3 text-left space-y-1 bg-neutral-50 text-xs">
                <p><strong>{lang === "en" ? "Name" : "Jina"}:</strong> {selectedVerifyMember.name}</p>
                <p><strong>{lang === "en" ? "Role" : "Jukumu"}:</strong> {selectedVerifyMember.role}</p>
                <p><strong>{lang === "en" ? "ID Number" : "Nambari ya Kadi"}:</strong> {selectedVerifyMember.memberNumber}</p>
                <p><strong>{lang === "en" ? "Status" : "Hali"}:</strong> <span className="text-emerald-600 font-bold uppercase">{selectedVerifyMember.status}</span></p>
              </div>

              <button
                onClick={() => setSelectedVerifyMember(null)}
                id="close-verify-modal-btn"
                className="w-full py-2 bg-neutral-800 hover:bg-neutral-950 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                {lang === "en" ? "Done" : "Kamilisha"}
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* MEMBER INVITE MODAL */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title={lang === "en" ? "Invite New CBO Member" : "Unda Akaunti Mpya ya Mwanachama"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                  {lang === "en" ? "Full Name" : "Majina Kamili"}
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g., Joseph Mwangi"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                  {lang === "en" ? "Email Address" : "Barua Pepe"}
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g., joseph@gmail.com"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                  {lang === "en" ? "Phone Number" : "Nambari ya Simu"}
                </label>
                <input
                  type="tel"
                  required
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="e.g., +254 712 345678"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                  {lang === "en" ? "Assign Staff Role" : "Jukumu / Kazi"}
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                >
                  {dbRoles.length > 0 ? (
                    dbRoles.map((r: any) => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))
                  ) : (
                    Object.values(UserRole).map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))
                  )}
                </select>
              </div>

              {!(dbRoles.some(r => r.name === inviteRole && r.originalName === "Volunteer Staff") || inviteRole === UserRole.VOLUNTEER) && 
               !(dbRoles.some(r => r.name === inviteRole && r.originalName === "Program Member") || inviteRole === UserRole.PROGRAM_MEMBER) && (
                <div className="space-y-4 p-3 bg-neutral-50 rounded-xl border border-neutral-200 mt-2 text-xs">
                  <h4 className="text-[10px] font-bold text-red-600 uppercase tracking-widest font-mono">
                    {lang === "en" ? " Leadership Appointment Details" : " Maelezo ya Teuzi za Uongozi"}
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                        {lang === "en" ? "Term Start Date" : "Tarehe ya Kuanza"}
                      </label>
                      <input
                        type="date"
                        required
                        value={termStart}
                        onChange={(e) => setTermStart(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none font-medium text-neutral-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                        {lang === "en" ? "Term End Date (Optional)" : "Tarehe ya Mwisho (Sio lazima)"}
                      </label>
                      <input
                        type="date"
                        value={termEnd}
                        onChange={(e) => setTermEnd(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none font-medium text-neutral-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                      {lang === "en" ? "Responsibilities & Duties" : "Majukumu na Kazi"}
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={responsibilities}
                      onChange={(e) => setResponsibilities(e.target.value)}
                      placeholder={lang === "en" ? "Outline key duties..." : "Eleza majukumu makuu..."}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none font-medium text-neutral-800"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 border border-neutral-200 text-xs font-semibold rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  {lang === "en" ? "Cancel" : "Ghairi"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {lang === "en" ? "Send Invite" : "Wasilisha Alika"}
                </button>
              </div>
            </form>
      </Modal>

      {/* MY DIGITAL ID MODAL */}
      <Modal
        isOpen={showMyIDModal}
        onClose={() => setShowMyIDModal(false)}
        title={
          <span className="text-xs font-black uppercase tracking-wider text-[#E31E24] font-sans inline-flex items-center gap-1.5">
            <IdCard size={14} /> {lang === "en" ? "My Membership ID Card" : "Kadi Yangu ya Uanachama"}
          </span>
        }
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col items-center font-sans text-left">
          <div className="flex justify-center py-2 w-full">
            <MembershipIDCard 
              member={currentUser} 
              onVerify={(m) => { 
                setSelectedVerifyMember(m); 
                setShowMyIDModal(false); 
              }} 
            />
          </div>

          <p className="text-[10px] text-neutral-400 text-center mt-4 leading-relaxed font-semibold">
            {lang === "en"
              ? "Click 'Print Card' on the bottom right of the card to print. Click on the card itself to verify its digital registration status."
              : "Bonyeza 'Print Card' chini ya kadi ili kupiga chapa. Bonyeza kadi yenyewe kuthibitisha usajili wake wa dijitali."}
          </p>
        </div>
      </Modal>

      {/* SAFEGUARDING REPORT MODAL */}
      <Modal
        isOpen={showSgModal}
        onClose={() => setShowSgModal(false)}
        title={
          <span className="text-base font-bold text-red-600 font-sans">
            {lang === "en" ? "Submit Confidential Safeguarding Report" : "Wasilisha Ripoti ya Siri ya Usalama"}
          </span>
        }
        maxWidth="max-w-md"
      >
        <div className="font-sans">
          <p className="text-[11px] text-neutral-500 mb-4 leading-relaxed">
            {lang === "en"
              ? "This form routes directly and strictly to the Safeguarding & MEL Officer (Peter Kamau) and the Chairperson. Keep empty to submit anonymously."
              : "Ujumbe huu utatumwa kwa siri kuu kwa Mwenyekiti na Afisa wa Ulinzi pekee. Unaweza kuacha jina tupu kuwasilisha bila jina."}
          </p>

          <form onSubmit={handleAddSafeguarding} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                {lang === "en" ? "Reporter Name (Optional)" : "Jina Lako (Sio lazima)"}
              </label>
              <input
                type="text"
                value={sgReporter}
                onChange={(e) => setSgReporter(e.target.value)}
                placeholder={lang === "en" ? "e.g., Jane Doe (or leave blank to remain Anonymous)" : "Mfano, Amina Juma (au wacha wazi)"}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                {lang === "en" ? "Incident / Case Title" : "Kichwa cha Ripoti"}
              </label>
              <input
                type="text"
                required
                value={sgTitle}
                onChange={(e) => setSgTitle(e.target.value)}
                placeholder="e.g., Disclosure follow-up on Kiambiu community hall outreach"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                {lang === "en" ? "Detailed Description of Concerns" : "Maelezo Kamili ya Kisa"}
              </label>
              <textarea
                required
                rows={5}
                value={sgDesc}
                onChange={(e) => setSgDesc(e.target.value)}
                placeholder="Please state details clearly, including venue, date, and any individuals involved. Confidentiality is fully protected."
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none font-serif leading-relaxed"
              ></textarea>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSgModal(false)}
                className="px-3 py-1.5 border border-neutral-200 text-xs font-semibold rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                {lang === "en" ? "Cancel" : "Ghairi"}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {lang === "en" ? "Submit Confidential Report" : "Wasilisha kwa Siri"}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* BANK RECONCILIATION MODAL */}
      <Modal
        isOpen={showReconcileModal}
        onClose={() => setShowReconcileModal(false)}
        title={lang === "en" ? "Bank Reconciliation Check" : "Uhuru na Usawazishaji wa Benki"}
        maxWidth="max-w-lg"
      >
        <div className="font-sans">
          {isReconciling ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-xs text-neutral-500 font-mono animate-pulse">
                {lang === "en" ? "Scanning CBO Cash Ledger vs Bank Feed..." : "Inakagua Daftari la Fedha dhidi ya Benki..."}
              </div>
            </div>
          ) : reconcileSuccess ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs space-y-1.5 text-left">
                <p className="font-extrabold"> {lang === "en" ? "Reconciliation Successful" : "Usawazishaji Umekamilika"}</p>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  {lang === "en" 
                    ? "All cash ledger records perfectly matched with official MPESA statement deposits and withdrawals." 
                    : "Kumbukumbu zote za fedha zinalingana kabisa na muamala ya MPESA na benki."}
                </p>
              </div>

              <div className="border border-neutral-100 rounded-xl p-3 bg-neutral-50 space-y-2 text-[11px] font-mono text-neutral-600 text-left">
                <div className="flex justify-between border-b pb-1.5">
                  <span>{lang === "en" ? "Match Rate" : "Kiwango cha Kulingana"}</span>
                  <strong className="text-emerald-600">100% (Fully Matched)</strong>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span>{lang === "en" ? "Total Reconciled Amount" : "Jumla ya Fedha"}</span>
                  <strong className="text-neutral-900">Ksh {totalApprovedExpense.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span>{lang === "en" ? "Last Reconciled" : "Tarehe ya Mwisho"}</span>
                  <strong className="text-neutral-900">{new Date().toISOString().split("T")[0]}</strong>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowReconcileModal(false);
                }}
                className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-950 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer text-center"
              >
                {lang === "en" ? "Close & Lock Ledger" : "Funga na Ufunge Daftari"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500 leading-relaxed">
                {lang === "en"
                  ? "This tool compares all recorded CBO Expenditures and Income records against the bank's active feed to highlight unmatched or offline transactions."
                  : "Chombo hiki kinalinganisha matumizi yote ya CBO na mapato dhidi ya muamala ya benki ili kuonyesha tofauti yoyote."}
              </p>

              <div className="border border-neutral-150 rounded-xl p-3 bg-gray-50 text-xs text-neutral-700 space-y-2.5 text-left">
                <p className="font-bold uppercase text-[9px] text-gray-400 font-mono tracking-wider">{lang === "en" ? "PENDING AUTO-MATCH" : "ZINAZOSUBIRI KULINGANISHWA"}</p>
                
                <div className="border border-amber-200 bg-amber-50/50 p-2.5 rounded-lg flex justify-between items-center text-xs text-left">
                  <div>
                    <strong className="text-amber-800 font-sans block">{lang === "en" ? "MPESA / Equity Bank Ref: FT261902" : "Muamala MPESA: FT261902"}</strong>
                    <span className="text-[10px] text-gray-500">Amount: Ksh 5,000 for GBV Rehearsals</span>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-mono font-bold px-1.5 py-0.5 rounded">
                    {lang === "en" ? "Unmatched" : "Bila jibu"}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-3 py-1.5 border border-neutral-200 text-xs font-semibold rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  {lang === "en" ? "Cancel" : "Ghairi"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsReconciling(true);
                    setTimeout(() => {
                      setIsReconciling(false);
                      setReconcileSuccess(true);
                      setReconcileDate(new Date().toISOString().split("T")[0]);
                      setUnreconciledCount(0);
                    }, 1200);
                  }}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {lang === "en" ? "Run Auto-Match Check" : "Anza Kulinganisha"}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* APPOINTMENT LETTER PRINT OVERLAY */}
      <Modal
        isOpen={!!(printingAppointment && draftedLetter)}
        onClose={() => {
          setPrintingAppointment(null);
          setDraftedLetter("");
        }}
        maxWidth="max-w-4xl"
      >
        {printingAppointment && draftedLetter && (
          <div className="relative w-full bg-white text-left font-sans">
            <PrintWrapper
              title={lang === "en" ? "LETTER OF LEADERSHIP APPOINTMENT" : "BARUA YA TEUZI YA UONGOZI"}
              docType="LEADERSHIP APPOINTMENT"
              authorName={printingAppointment.appointedBy}
              authorRole="Chairperson"
              authorSignatureUrl={currentUser?.name === printingAppointment.appointedBy ? currentUser?.signatureUrl : undefined}
              dateString={printingAppointment.appointmentDate}
              verificationUrl={printingAppointment.verificationUrl}
              watermarkText="BASHOSHO TALENTS CBO — OFFICIAL"
            >
              <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap text-left text-neutral-800 p-2">
                {draftedLetter}
              </div>
            </PrintWrapper>
          </div>
        )}
      </Modal>

      {/* APPOINTMENT LETTER DRAFTING SPINNER */}
      <Modal
        isOpen={draftingLetter}
        onClose={() => {}}
        showCloseButton={false}
        maxWidth="max-w-sm"
      >
        <div className="p-4 text-center space-y-4 font-sans">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h4 className="text-sm font-bold text-neutral-950 uppercase tracking-wider">
            {lang === "en" ? "Drafting Appointment Letter..." : "Kuandaa Barua ya Uteuzi..."}
          </h4>
          <p className="text-xs text-neutral-500 font-medium leading-relaxed">
            {lang === "en"
              ? "Our secure system is drafting the formal letter of appointment with customized responsibilities and watermarked letterhead."
              : "Mfumo unatayarisha barua rasmi ya uteuzi yenye majukumu mahususi na nembo rasmi ya CBO."}
          </p>
        </div>
      </Modal>

      {/* APPOINTMENT ACKNOWLEDGMENT MODAL */}
      {(() => {
        const pendingAcknowledgeAppt = leadershipAppointments.find(
          (appt) => appt.profileId === currentUser.id && !appt.acknowledged && appt.id !== dismissedApptId
        );
        return (
          <Modal
            isOpen={!!pendingAcknowledgeAppt}
            onClose={() => {
              if (pendingAcknowledgeAppt) setDismissedApptId(pendingAcknowledgeAppt.id);
            }}
            title={
              pendingAcknowledgeAppt ? (
                <div>
                  <span className="text-[10px] font-bold text-[#E31E24] uppercase tracking-widest font-mono block">
                    {lang === "en" ? "Official Leadership Appointment" : "Uteuzi Rasmi wa Uongozi"}
                  </span>
                  <h3 className="text-lg font-black text-neutral-950 tracking-tight font-sans mt-0.5">
                    {lang === "en" ? "Appointment Awaiting Your Acknowledgment" : "Uteuzi Unasubiri Uthibitisho Wako"}
                  </h3>
                </div>
              ) : ""
            }
            maxWidth="max-w-lg"
          >
            {pendingAcknowledgeAppt && (
              <div className="space-y-6 text-left font-sans">
                <p className="text-xs text-neutral-500 font-medium">
                  {lang === "en"
                    ? "Kennedy Onyango, Chairperson of Bashosho Talents CBO, has appointed you to a formal leadership role within the organization. Please review the details below."
                    : "Kennedy Onyango, Mwenyekiti wa Bashosho Talents CBO, amekuteua katika nafasi rasmi ya uongozi. Tafadhali kagua maelezo hapa chini."}
                </p>

                <div className="p-4 bg-neutral-50 border border-neutral-150 rounded-xl space-y-3.5 text-xs text-neutral-800">
                  <div className="grid grid-cols-2 gap-4 border-b border-neutral-200 pb-3">
                    <div>
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase font-mono">{lang === "en" ? "Designated Title" : "Cheo cha Kazi"}</span>
                      <p className="font-bold text-[#E31E24] mt-0.5 text-sm uppercase font-mono"> {pendingAcknowledgeAppt.role}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase font-mono">{lang === "en" ? "Term of Office" : "Kipindi cha Kazi"}</span>
                      <p className="font-semibold text-neutral-900 mt-0.5">
                        {pendingAcknowledgeAppt.termStart} {lang === "en" ? "to" : "hadi"} {pendingAcknowledgeAppt.termEnd || (lang === "en" ? "Indefinite" : "Hadi ukomo")}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase font-mono">{lang === "en" ? "Outline of Key Responsibilities" : "Majukumu Makuu ya Kazi"}</span>
                    <p className="font-serif leading-relaxed text-neutral-700 mt-1 whitespace-pre-wrap max-h-[160px] overflow-y-auto pr-1">
                      {pendingAcknowledgeAppt.responsibilities}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/leadership_appointments/${pendingAcknowledgeAppt.id}/acknowledge`, {
                          method: "POST"
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setLeadershipAppointments(prev =>
                            prev.map(appt => appt.id === pendingAcknowledgeAppt.id ? { ...appt, acknowledged: true } : appt)
                          );
                          setProfiles(prev =>
                            prev.map(p => p.id === currentUser.id ? { ...p, status: "Active" } : p)
                          );
                          alert(lang === "en" ? " Appointment acknowledged successfully! Welcome to the leadership team." : " Uteuzi umethibitishwa! Karibu kwenye timu ya uongozi.");
                        } else {
                          throw new Error(data.error || "Acknowledge request failed");
                        }
                      } catch (err: any) {
                        console.error(err);
                        alert(err.message);
                      }
                    }}
                    className="w-full py-3 bg-[#E31E24] hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors cursor-pointer text-center"
                  >
                     {lang === "en" ? "I Acknowledge and Accept this Appointment" : " Ninakubali na Kuthibitisha Uteuzi huu"}
                  </button>
                  <button
                    onClick={() => setDismissedApptId(pendingAcknowledgeAppt.id)}
                    className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer text-center"
                  >
                    {lang === "en" ? "Remind Me Later" : "Kumbusha Baadaye"}
                  </button>
                  <p className="text-[10px] font-mono text-center text-neutral-400 pt-1">
                    {lang === "en"
                      ? "By accepting, you agree to the community guidelines and code of conduct."
                      : "Kwa kukubali, unakubaliana na misingi na maadili ya jamii yetu."}
                  </p>
                </div>
              </div>
            )}
          </Modal>
        );
      })()}
    </div>
  );
}
