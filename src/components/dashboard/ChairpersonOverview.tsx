import React from "react";
import { Users, Wallet, TrendingUp, ShieldAlert, Landmark, FileText, Megaphone, Plus, Palmtree, FileCheck, X } from "lucide-react";
import { StorageService } from "../../lib/storage";
import { Broadcast } from "../../types";
import StatCard from "./StatCard";
import DashboardTrendChart from "./DashboardTrendChart";
import NotificationFeed, { NotificationItem } from "./NotificationFeed";
import QuickActions, { QuickAction } from "./QuickActions";
import GlobalSearch from "./GlobalSearch";

interface ChairpersonOverviewProps {
  lang: "en" | "sw";
  onNavigateToTab: (tab: string) => void;
  currentUserNameAndRole: string;
}

// Fixed system reference date, matching the convention used elsewhere in this app
// (getDaysPending in Dashboard.tsx) so relative-time figures stay stable rather than
// drifting with the real clock during a demo/review.
const SYSTEM_DATE = new Date();

export default function ChairpersonOverview({ lang, onNavigateToTab, currentUserNameAndRole }: ChairpersonOverviewProps) {
  const [showBroadcastModal, setShowBroadcastModal] = React.useState(false);
  const [broadcastMessage, setBroadcastMessage] = React.useState("");
  const [broadcastChannel, setBroadcastChannel] = React.useState<"sms" | "whatsapp" | "email" | "all">("all");
  const [broadcastSending, setBroadcastSending] = React.useState(false);
  const [broadcastError, setBroadcastError] = React.useState("");

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    setBroadcastSending(true);
    setBroadcastError("");
    const newBroadcast: Broadcast = {
      id: `b-${Date.now()}`,
      message: broadcastMessage,
      channel: broadcastChannel,
      sentBy: currentUserNameAndRole,
      sentDate: new Date().toISOString()
    };
    try {
      await StorageService.saveRecord("broadcasts", newBroadcast);
      setBroadcastMessage("");
      setShowBroadcastModal(false);
    } catch (err: any) {
      setBroadcastError(err?.message || (lang === "en" ? "Failed to send broadcast." : "Imeshindwa kutuma tangazo."));
    } finally {
      setBroadcastSending(false);
    }
  };

  const profiles = StorageService.getProfiles();
  const incomes = StorageService.getIncomes();
  const expenditures = StorageService.getExpenditures();
  const leaveRequests = StorageService.getLeaveRequests();
  const contractRenewals = StorageService.getContractRenewals();
  const safeguarding = StorageService.getSafeguarding();
  const grants = StorageService.getGrants();
  const documents = StorageService.getDocuments();
  const budgets = StorageService.getBudgets();
  const orgSettings = StorageService.getOrgSettings();

  const activeMembers = profiles.filter(p => p.isActive).length;
  const activeOutreaches = budgets.filter(b => b.status === "approved").length;
  const handbookVersion = orgSettings.handbookVersion || "1.0";
  const handbookAcknowledged = profiles.filter(p => p.handbookAcknowledgedVersion === handbookVersion).length;

  const totalIncome = incomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const totalExpenditure = expenditures
    .filter(e => e.status === "approved")
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netBalance = totalIncome - totalExpenditure;

  const pendingExpenditures = expenditures.filter(e => e.status === "pending_treasurer" || e.status === "pending_chairperson").length;
  const pendingLeave = leaveRequests.filter(l => l.status === "pending").length;
  const pendingRenewals = contractRenewals.filter(c => c.status === "pending_review").length;
  const openSafeguarding = safeguarding.filter(s => s.status !== "resolved").length;

  const urgentGrants = grants.filter(g => {
    if (g.status === "submitted" || g.status === "awarded" || g.status === "declined") return false;
    const deadlineDate = new Date(g.deadline);
    if (isNaN(deadlineDate.getTime())) return false;
    const diffDays = Math.ceil((deadlineDate.getTime() - SYSTEM_DATE.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 14;
  }).length;

  const fmt = (n: number) => `KSh ${n.toLocaleString()}`;

  // "This Week" digest — computed straight from data already loaded above, no extra
  // fetches. A plain aggregation of real events, not an AI-generated summary, so it's
  // never wrong about what actually happened.
  const sevenDaysAgo = new Date(SYSTEM_DATE);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
  const newMembersThisWeek = profiles.filter(p => p.joinDate && p.joinDate >= sevenDaysAgoStr).length;
  const incomeThisWeek = incomes.filter(i => i.date && i.date >= sevenDaysAgoStr).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const expenditureCountThisWeek = expenditures.filter(e => e.status === "approved" && e.requestDate && e.requestDate >= sevenDaysAgoStr).length;
  const renewalsApprovedThisWeek = contractRenewals.filter(c => c.status === "approved" && c.reviewedDate && c.reviewedDate >= sevenDaysAgoStr).length;
  const totalDecisionsPending = pendingExpenditures + pendingLeave + pendingRenewals + urgentGrants + openSafeguarding;

  const notifications: NotificationItem[] = [
    {
      id: "expenditures",
      label: lang === "en" ? "Expenditure requests awaiting your approval" : "Maombi ya matumizi yanayosubiri idhini yako",
      count: pendingExpenditures,
      icon: <Wallet size={15} />,
      onClick: () => onNavigateToTab("finance")
    },
    {
      id: "leave",
      label: lang === "en" ? "Leave requests pending" : "Maombi ya likizo yanayosubiri",
      count: pendingLeave,
      icon: <Palmtree size={15} />,
      onClick: () => onNavigateToTab("dashboard")
    },
    {
      id: "renewals",
      label: lang === "en" ? "Contract renewals to review" : "Upyaji wa mikataba wa kukagua",
      count: pendingRenewals,
      icon: <FileCheck size={15} />,
      onClick: () => onNavigateToTab("dashboard")
    },
    {
      id: "grants",
      label: lang === "en" ? "Grant deadlines within 14 days" : "Tarehe za mwisho za ruzuku ndani ya siku 14",
      count: urgentGrants,
      icon: <Landmark size={15} />,
      onClick: () => onNavigateToTab("grants")
    },
    {
      id: "safeguarding",
      label: lang === "en" ? "Open safeguarding reports" : "Ripoti za ulinzi zilizo wazi",
      count: openSafeguarding,
      sensitive: true,
      icon: <ShieldAlert size={15} />,
      onClick: () => onNavigateToTab("dashboard")
    }
  ];

  const quickActions: QuickAction[] = [
    { id: "add-expense", label: lang === "en" ? "Add expense" : "Ongeza matumizi", icon: <Plus size={15} />, onClick: () => onNavigateToTab("finance") },
    { id: "broadcast", label: lang === "en" ? "Post broadcast" : "Tuma tangazo", icon: <Megaphone size={15} />, onClick: () => setShowBroadcastModal(true) },
    { id: "documents", label: lang === "en" ? "Manage documents" : "Simamia hati", icon: <FileText size={15} />, onClick: () => onNavigateToTab("documents") },
    { id: "grants", label: lang === "en" ? "Review grants" : "Kagua ruzuku", icon: <Landmark size={15} />, onClick: () => onNavigateToTab("grants") }
  ];

  return (
    <div className="space-y-6">
      <GlobalSearch
        profiles={profiles}
        documents={documents}
        grants={grants}
        onOpenDocuments={() => onNavigateToTab("documents")}
        onOpenGrants={() => onNavigateToTab("grants")}
        lang={lang}
      />

      {/* Weekly digest — real events from the last 7 days, plus a single count of
          everything currently waiting on a decision from the Chairperson. */}
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">{lang === "en" ? "This Week" : "Wiki Hii"}</p>
          {totalDecisionsPending > 0 && (
            <span className="text-[10px] font-bold uppercase bg-red-600 text-white px-2 py-0.5 rounded-full">
              {totalDecisionsPending} {lang === "en" ? "need your decision" : "zinahitaji uamuzi wako"}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-lg font-black font-mono text-white">{newMembersThisWeek}</p>
            <p className="text-[9px] text-neutral-500 uppercase font-bold tracking-wider">{lang === "en" ? "New Members" : "Wanachama Wapya"}</p>
          </div>
          <div>
            <p className="text-lg font-black font-mono text-emerald-400">{fmt(incomeThisWeek)}</p>
            <p className="text-[9px] text-neutral-500 uppercase font-bold tracking-wider">{lang === "en" ? "Income Received" : "Mapato"}</p>
          </div>
          <div>
            <p className="text-lg font-black font-mono text-white">{expenditureCountThisWeek}</p>
            <p className="text-[9px] text-neutral-500 uppercase font-bold tracking-wider">{lang === "en" ? "Expenses Approved" : "Matumizi Yaliyoidhinishwa"}</p>
          </div>
          <div>
            <p className="text-lg font-black font-mono text-white">{renewalsApprovedThisWeek}</p>
            <p className="text-[9px] text-neutral-500 uppercase font-bold tracking-wider">{lang === "en" ? "Contracts Renewed" : "Mikataba Iliyorejeshwa"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label={lang === "en" ? "Active members" : "Wanachama hai"} value={String(activeMembers)} icon={<Users size={17} />} accent="community" />
        <StatCard label={lang === "en" ? "Total income" : "Mapato jumla"} value={fmt(totalIncome)} icon={<TrendingUp size={17} />} accent="finance" onClick={() => onNavigateToTab("finance")} />
        <StatCard label={lang === "en" ? "Total expenditure" : "Matumizi jumla"} value={fmt(totalExpenditure)} icon={<Wallet size={17} />} accent="finance" onClick={() => onNavigateToTab("finance")} />
        <StatCard
          label={lang === "en" ? "Net balance" : "Salio halisi"}
          value={fmt(netBalance)}
          icon={<Landmark size={17} />}
          accent={netBalance >= 0 ? "finance" : "danger"}
          onClick={() => onNavigateToTab("finance")}
        />
        <StatCard
          label={lang === "en" ? "Active outreaches" : "Miradi hai"}
          value={String(activeOutreaches)}
          icon={<Megaphone size={17} />}
          accent="community"
        />
        <StatCard
          label={lang === "en" ? "Handbook acknowledged" : "Wamekubali mwongozo"}
          value={`${handbookAcknowledged}/${activeMembers}`}
          icon={<FileCheck size={17} />}
          accent={handbookAcknowledged === activeMembers ? "finance" : "community"}
          onClick={() => onNavigateToTab("handbook")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-neutral-200 mb-3">
            {lang === "en" ? "Income vs. expenditure \u2014 last 6 months" : "Mapato dhidi ya matumizi \u2014 miezi 6 iliyopita"}
          </p>
          <DashboardTrendChart incomes={incomes} expenditures={expenditures} referenceDate={SYSTEM_DATE} lang={lang} />
        </div>
        <div className="lg:col-span-5 space-y-3">
          <p className="text-sm font-semibold text-neutral-200">
            {lang === "en" ? "Needs your attention" : "Inahitaji uangalifu wako"}
          </p>
          <NotificationFeed items={notifications} lang={lang} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-200">{lang === "en" ? "Quick actions" : "Vitendo vya haraka"}</p>
        <QuickActions actions={quickActions} />
      </div>

      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowBroadcastModal(false)}>
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-neutral-100">{lang === "en" ? "Post broadcast" : "Tuma tangazo"}</p>
              <button onClick={() => setShowBroadcastModal(false)} className="text-neutral-500 hover:text-neutral-300" aria-label={lang === "en" ? "Close" : "Funga"}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">{lang === "en" ? "Channel" : "Njia"}</label>
                <select
                  value={broadcastChannel}
                  onChange={(e) => setBroadcastChannel(e.target.value as any)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100"
                >
                  <option value="all">{lang === "en" ? "All channels" : "Njia zote"}</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">{lang === "en" ? "Email" : "Barua pepe"}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">{lang === "en" ? "Message" : "Ujumbe"}</label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  rows={4}
                  required
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 resize-none"
                  placeholder={lang === "en" ? "Write your update..." : "Andika taarifa yako..."}
                />
              </div>
              {broadcastError && <p className="text-xs text-red-400">{broadcastError}</p>}
              <button
                type="submit"
                disabled={broadcastSending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2.5 transition-colors duration-150"
              >
                {broadcastSending ? (lang === "en" ? "Sending..." : "Inatuma...") : (lang === "en" ? "Send" : "Tuma")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
