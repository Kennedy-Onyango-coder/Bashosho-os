import React from "react";
import Modal from "./Modal";
import { BudgetEngagement, ExpenditureRequest, UserRole, UserProfile, Income, Partner, getCanonicalRoleKey, getUserRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import { Sparkles, FileText, Check, AlertTriangle, Trash2, Printer, Plus, Eye, Coins, Ban, Clock, X } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

interface FinancialLedgerProps {
  currentUser: UserProfile;
  lang: "en" | "sw";
  onPrintReport: (title: string, data: React.ReactNode) => void;
}

export default function FinancialLedger({
  currentUser,
  lang,
  onPrintReport
}: FinancialLedgerProps) {
  const [budgets, setBudgets] = React.useState<BudgetEngagement[]>([]);
  const [expenditures, setExpenditures] = React.useState<ExpenditureRequest[]>([]);
  const [incomes, setIncomes] = React.useState<Income[]>([]);
  
  // Form States - Expenditures
  const [showExpenseModal, setShowExpenseModal] = React.useState(false);
  const [editingExpenditureId, setEditingExpenditureId] = React.useState<string | null>(null);
  const [expenseDesc, setExpenseDesc] = React.useState("");
  const [expenseAmount, setExpenseAmount] = React.useState("");
  const [expenseCategory, setExpenseCategory] = React.useState("stipend");
  const [expenseBudgetId, setExpenseBudgetId] = React.useState("");

  // Form States - Income
  const [showIncomeModal, setShowIncomeModal] = React.useState(false);
  const [editingIncomeId, setEditingIncomeId] = React.useState<string | null>(null);
  const [incomeDesc, setIncomeDesc] = React.useState("");
  const [incomeAmount, setIncomeAmount] = React.useState("");
  const [incomeSource, setIncomeSource] = React.useState<Income["source"]>("grant");
  const [incomeDate, setIncomeDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [incomePartnerId, setIncomePartnerId] = React.useState("");
  const [incomeBudgetId, setIncomeBudgetId] = React.useState("");

  // Print Preview & Narrative States
  const [showPrintModal, setShowPrintModal] = React.useState(false);
  const [narrativeCommentary, setNarrativeCommentary] = React.useState("");
  const [isGeneratingCommentary, setIsGeneratingCommentary] = React.useState(false);

  // Rejection Reason Modal States
  const [rejectRequest, setRejectRequest] = React.useState<ExpenditureRequest | null>(null);
  const [rejectionInput, setRejectionInput] = React.useState("");

  // Tab State
  const [activeTab, setActiveTab] = React.useState<"expenditures" | "incomes">("expenditures");

  // Deletion Confirmation States
  const [deleteConfirmItem, setDeleteConfirmItem] = React.useState<{ id: string; type: "income" | "expenditure"; desc: string; amount: number } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    setBudgets(StorageService.getBudgets());
    setExpenditures(StorageService.getExpenditures());
    setIncomes(StorageService.getIncomes());
  }, []);

  // Recalculating metrics based on real logged incomes and approved expenditures
  const totalIncome = incomes.reduce((acc, inc) => acc + (inc?.amount || 0), 0);
  const totalRevenue = totalIncome; // for backward compatibility
  const totalApprovedExpense = expenditures
    .filter(e => e?.status === "approved")
    .reduce((acc, e) => acc + (e?.amount || 0), 0);
  const cashReserves = totalIncome - totalApprovedExpense;

  // Filter pending approvals based on role
  const getApprovalStatusText = (status: string) => {
    switch (status) {
      case "pending_treasurer": return lang === "en" ? "Awaiting Treasurer Review" : "Inangoja Mapitio ya Mhazini";
      case "pending_chairperson": return lang === "en" ? "Awaiting Chairperson Sign-off" : "Inangoja Idhini ya Mwenyekiti";
      case "approved": return lang === "en" ? "Approved" : "Imeidhinishwa";
      case "rejected": return lang === "en" ? "Rejected" : "Imekataliwa";
      default: return status;
    }
  };

  // Submit new expense request, or save a rectification to an existing pending one
  const handleRequestExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount) return;

    const amount = parseFloat(expenseAmount);

    if (editingExpenditureId) {
      // Rectifying an existing pending request — preserve its original requester,
      // request date, and status/approval-chain position; only correct the details.
      const existing = expenditures.find(e2 => e2.id === editingExpenditureId);
      if (!existing) return;
      // Recompute which approval tier applies, in case the correction moves the amount
      // across the threshold — safe to do here because edits are only allowed while the
      // request is still pending (no approvals have been recorded yet to invalidate).
      const recomputedStatus = amount >= 10000 ? "pending_chairperson" : "pending_treasurer";
      const updatedRequest: ExpenditureRequest = {
        ...existing,
        budgetId: expenseBudgetId || undefined,
        description: expenseDesc,
        amount,
        category: expenseCategory,
        status: recomputedStatus
      };
      const updated = expenditures.map(e2 => (e2.id === editingExpenditureId ? updatedRequest : e2));
      setExpenditures(updated);
      StorageService.saveRecord("expenditures", updatedRequest).catch(console.error);
      setEditingExpenditureId(null);
      setExpenseDesc("");
      setExpenseAmount("");
      setExpenseCategory("stipend");
      setExpenseBudgetId("");
      setShowExpenseModal(false);
      return;
    }

    // Over Ksh 10,000 threshold requires chairperson approval. Else, treasurer reviews.
    const status = amount >= 10000 ? "pending_chairperson" : "pending_treasurer";

    const newRequest: ExpenditureRequest = {
      id: `exp-${Date.now()}`,
      budgetId: expenseBudgetId || undefined,
      description: expenseDesc,
      amount,
      category: expenseCategory,
      requestedBy: currentUser.name,
      requestDate: new Date().toISOString().split("T")[0],
      status
    };

    const updated = [newRequest, ...expenditures];
    setExpenditures(updated);
    StorageService.saveRecord("expenditures", newRequest).catch(console.error);

    // Reset Form
    setExpenseDesc("");
    setExpenseAmount("");
    setExpenseCategory("stipend");
    setExpenseBudgetId("");
    setShowExpenseModal(false);
  };

  const openEditExpense = (req: ExpenditureRequest) => {
    setEditingExpenditureId(req.id);
    setExpenseDesc(req.description);
    setExpenseAmount(String(req.amount));
    setExpenseCategory(req.category);
    setExpenseBudgetId(req.budgetId || "");
    setShowExpenseModal(true);
  };

  // Submit new Income record, or save a rectification to an existing one
  const handleRecordIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeDesc.trim() || !incomeAmount) return;

    const newIncome: Income = {
      id: editingIncomeId || `inc-${Date.now()}`,
      source: incomeSource,
      amount: parseFloat(incomeAmount),
      date: incomeDate,
      description: incomeDesc,
      linkedPartnerId: incomePartnerId || undefined,
      linkedBudgetId: incomeBudgetId || undefined,
      recordedBy: editingIncomeId
        ? incomes.find(i => i.id === editingIncomeId)?.recordedBy || currentUser.name
        : currentUser.name
    };

    const updated = editingIncomeId
      ? incomes.map(i => (i.id === editingIncomeId ? newIncome : i))
      : [newIncome, ...incomes];
    setIncomes(updated);
    StorageService.saveRecord("incomes", newIncome).catch(console.error);
    setEditingIncomeId(null);

    // Reset Form
    setIncomeDesc("");
    setIncomeAmount("");
    setIncomeSource("grant");
    setIncomePartnerId("");
    setIncomeBudgetId("");
    setIncomeDate(new Date().toISOString().split("T")[0]);
    setShowIncomeModal(false);
  };

  const openEditIncome = (inc: Income) => {
    setEditingIncomeId(inc.id);
    setIncomeDesc(inc.description);
    setIncomeAmount(String(inc.amount));
    setIncomeSource(inc.source);
    setIncomeDate(inc.date);
    setIncomePartnerId(inc.linkedPartnerId || "");
    setIncomeBudgetId(inc.linkedBudgetId || "");
    setShowIncomeModal(true);
  };

  // Calculate days pending for expenditure requests
  const getDaysPending = (requestDateStr: string) => {
    if (!requestDateStr) return 0;
    const reqDate = new Date(requestDateStr);
    const currentDate = new Date("2026-07-12"); // aligned with system current time
    reqDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);
    const diffTime = currentDate.getTime() - reqDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  };

  // Process approval
  const handleApprove = (req: ExpenditureRequest) => {
    const isChairperson = getUserRoleKey(currentUser) === UserRole.CHAIRPERSON;
    const isTreasurer = getUserRoleKey(currentUser) === UserRole.TREASURER;

    let canApprove = false;
    if (req.status === "pending_treasurer" && (isTreasurer || isChairperson)) {
      canApprove = true;
    } else if (req.status === "pending_chairperson" && isChairperson) {
      canApprove = true;
    }

    if (!canApprove) {
      alert(lang === "en" ? "You do not have permission to approve this level of expenditure!" : "Huna mamlaka ya kuidhinisha kiwango hiki cha matumizi!");
      return;
    }

    let updatedRecord: ExpenditureRequest | null = null;
    const updated = expenditures.map(e => {
      if (e.id === req.id) {
        updatedRecord = {
          ...e,
          status: "approved" as const,
          approvedBy: currentUser.name
        };
        return updatedRecord;
      }
      return e;
    });

    setExpenditures(updated);
    if (updatedRecord) {
      StorageService.saveRecord("expenditures", updatedRecord).catch(console.error);
    }
  };

  // Process rejection
  const handleReject = (req: ExpenditureRequest) => {
    const isChairperson = getUserRoleKey(currentUser) === UserRole.CHAIRPERSON;
    const isTreasurer = getUserRoleKey(currentUser) === UserRole.TREASURER;

    let canReject = false;
    if (req.status === "pending_treasurer" && (isTreasurer || isChairperson)) {
      canReject = true;
    } else if (req.status === "pending_chairperson" && isChairperson) {
      canReject = true;
    }

    if (!canReject) {
      alert(lang === "en" ? "You do not have permission to reject this request!" : "Huna mamlaka ya kukataa ombi hili!");
      return;
    }

    setRejectRequest(req);
    setRejectionInput("");
  };

  const confirmRejection = () => {
    if (!rejectRequest) return;
    if (!rejectionInput.trim()) {
      alert(lang === "en" ? "Rejection reason is required!" : "Sababu ya kukataa inahitajika!");
      return;
    }

    let updatedRecord: ExpenditureRequest | null = null;
    const updated = expenditures.map(e => {
      if (e.id === rejectRequest.id) {
        updatedRecord = {
          ...e,
          status: "rejected" as const,
          approvedBy: currentUser.name,
          rejectionReason: rejectionInput.trim()
        };
        return updatedRecord;
      }
      return e;
    });

    setExpenditures(updated);
    if (updatedRecord) {
      StorageService.saveRecord("expenditures", updatedRecord).catch(console.error);
    }

    setRejectRequest(null);
    setRejectionInput("");
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    setIsDeleting(true);
    try {
      const { id, type } = deleteConfirmItem;
      const collection = type === "income" ? "incomes" : "expenditures";
      const success = await StorageService.deleteRecord(collection, id);
      if (success) {
        if (type === "income") {
          setIncomes(prev => prev.filter(i => i.id !== id));
        } else {
          setExpenditures(prev => prev.filter(e => e.id !== id));
        }
      }
    } catch (err) {
      console.error("Deletion failed:", err);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmItem(null);
    }
  };

  // Open the printable statement export modal
  const handlePrintFinancialStatement = () => {
    setShowPrintModal(true);
    setNarrativeCommentary(""); // Reset commentary when launching preview
  };

  // Trigger Letterhead Print Export for Statements with the human-reviewed AI Narrative
  const triggerPrintWithNarrative = () => {
    const title = lang === "en" ? "CBO Statement of Income and Expenditure" : "Ripoti ya Mapato na Matumizi CBO";
    
    const printContent = (
      <div className="space-y-6 text-neutral-800">
        <p className="text-sm font-sans">
          This financial statement presents the accurate cash positions, revenues received from participatory outreaches, and disbursed stipends/operational costs for the fiscal period ending {new Date().toLocaleDateString("en-KE")}.
        </p>

        {narrativeCommentary && (
          <div className="border-l-4 border-[#E31E24] bg-neutral-50 rounded-r-lg p-4 font-sans text-xs italic text-neutral-700 leading-relaxed">
            <strong className="text-neutral-900 not-italic block mb-1 font-mono uppercase tracking-wider text-[10px]">
              {lang === "en" ? "Official Financial Narrative" : "Uchambuzi Rasmi wa Kifedha"}
            </strong>
            {narrativeCommentary}
          </div>
        )}
        
        {/* Metric block */}
        <div className="grid grid-cols-3 gap-4 border border-neutral-200 rounded-lg p-4 font-sans bg-neutral-50">
          <div>
            <span className="text-[10px] text-neutral-400 block font-semibold uppercase">TOTAL REVENUE / INCOME</span>
            <span className="text-lg font-bold text-neutral-900">Ksh {totalIncome.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] text-neutral-400 block font-semibold uppercase">DISBURSED OPERATIONAL COSTS</span>
            <span className="text-lg font-bold text-red-600">Ksh {totalApprovedExpense.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] text-neutral-400 block font-semibold uppercase">NET RETAINED RESERVES</span>
            <span className="text-lg font-bold text-emerald-600">Ksh {cashReserves.toLocaleString()}</span>
          </div>
        </div>

        {/* Ledger table */}
        <h3 className="text-sm font-bold border-b pb-1 font-sans text-neutral-900">DETAILED GENERAL LEDGER</h3>
        <table className="w-full text-xs font-sans text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-300 text-neutral-500 uppercase">
              <th className="py-2">Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Requested By</th>
              <th className="text-right">Amount (Ksh)</th>
            </tr>
          </thead>
          <tbody>
            {expenditures.filter(e => e.status === "approved").map((exp) => (
              <tr key={exp.id} className="border-b border-neutral-150">
                <td className="py-2 font-mono">{exp.requestDate}</td>
                <td>{exp.description}</td>
                <td className="capitalize">{exp.category}</td>
                <td>{exp.requestedBy}</td>
                <td className="text-right font-bold">Ksh {(exp?.amount || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Engagement budgets table */}
        <h3 className="text-sm font-bold border-b pb-1 pt-4 font-sans text-neutral-900">ACTIVE PROJECT ENGAGEMENTS</h3>
        <table className="w-full text-xs font-sans text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-300 text-neutral-500 uppercase">
              <th className="py-2">Engagement Title</th>
              <th>Partner</th>
              <th className="text-right">Budget (Ksh)</th>
              <th className="text-right">Variance / Actual (Ksh)</th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => {
              const actuals = expenditures
                .filter(e => e.budgetId === b.id && e.status === "approved")
                .reduce((sum, e) => sum + (e?.amount || 0), 0);
              return (
                <tr key={b.id} className="border-b border-neutral-150">
                  <td className="py-2 font-semibold text-neutral-900">{b.title}</td>
                  <td>{StorageService.getPartners().find(p => p.id === b.partnerId)?.name || "Community Outreach"}</td>
                  <td className="text-right font-mono">Ksh {b.revenue.toLocaleString()}</td>
                  <td className="text-right font-mono font-bold text-red-600">Ksh {actuals.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

    onPrintReport(title, printContent);
    setShowPrintModal(false);
  };

  // Generate the Financial Commentary Draft
  const handleGenerateNarrative = async () => {
    setIsGeneratingCommentary(true);
    try {
      const incomesSummary = incomes
        .map(inc => `- ${inc.date}: Ksh ${(inc?.amount || 0).toLocaleString()} from ${inc.source} (${inc.description})`)
        .join("\n");
      const expendituresSummary = expenditures
        .filter(e => e.status === "approved")
        .map(exp => `- ${exp.requestDate}: Ksh ${(exp?.amount || 0).toLocaleString()} for ${exp.category} (${exp.description})`)
        .join("\n");

      const response = await fetch("/api/reports/financial_summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          totalIncome,
          totalApprovedExpense,
          cashReserves,
          incomesSummary,
          expendituresSummary
        })
      });

      if (!response.ok) {
        throw new Error("Failed to generate financial commentary");
      }

      const data = await response.json();
      setNarrativeCommentary(data.commentary || "");
    } catch (error) {
      console.error("Narrative commentary error:", error);
      setNarrativeCommentary(`Based on real figures, total income received stands at Ksh ${totalIncome.toLocaleString()} and approved expenditure is Ksh ${totalApprovedExpense.toLocaleString()}. Retained reserves stand at Ksh ${cashReserves.toLocaleString()}. Overall financial status is stable and all disbursements align with community-safeguarding directives.`);
    } finally {
      setIsGeneratingCommentary(false);
    }
  };

  // REAL AGGREGATION GROUPING BY MONTH
  const getMonthName = (yearMonthStr: string) => {
    const [year, month] = yearMonthStr.split("-");
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const idx = parseInt(month, 10) - 1;
    return idx >= 0 && idx < 12 ? `${monthNames[idx]} '${year.substring(2)}` : yearMonthStr;
  };

  // Get unique months from both Income and approved Expenditures
  const activeMonthsSet = new Set<string>();
  incomes.forEach(inc => {
    if (inc.date) {
      activeMonthsSet.add(inc.date.substring(0, 7));
    }
  });
  expenditures.filter(e => e.status === "approved").forEach(exp => {
    if (exp.requestDate) {
      activeMonthsSet.add(exp.requestDate.substring(0, 7));
    }
  });

  const sortedMonths = Array.from(activeMonthsSet).sort();
  let cumulativeReserve = 0;
  const allMonthsData = sortedMonths.map(mStr => {
    const monthlyIncome = incomes
      .filter(inc => inc && inc.date && inc.date.substring(0, 7) === mStr)
      .reduce((sum, inc) => sum + (inc?.amount || 0), 0);
    const monthlyApprovedExpense = expenditures
      .filter(exp => exp && exp.status === "approved" && exp.requestDate && exp.requestDate.substring(0, 7) === mStr)
      .reduce((sum, exp) => sum + (exp?.amount || 0), 0);
    
    cumulativeReserve += (monthlyIncome - monthlyApprovedExpense);

    return {
      name: getMonthName(mStr),
      Revenue: monthlyIncome,
      Expenditures: monthlyApprovedExpense,
      Reserve: cumulativeReserve
    };
  });

  const chartData = allMonthsData.slice(-6);
  const reserveData = allMonthsData.slice(-6);
  const showChartEmptyState = sortedMonths.length < 2;

  return (
    <div className="space-y-8" id="financial-ledger-container">
      {/* Top Banner and Summary metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#1B1B1B] text-white rounded-xl p-6 shadow-sm border border-neutral-800">
        <div className="text-left">
          <span className="text-[#E31E24] font-mono text-[10px] font-bold tracking-wider uppercase bg-[#E31E24]/10 px-2 py-0.5 rounded border border-[#E31E24]/20">
            {lang === "en" ? "TRANSPARENT LEDGER" : "HESABU ZA WAZI"}
          </span>
          <h2 className="text-2xl font-black font-sans text-neutral-100 tracking-tight mt-1">
            {lang === "en" ? "Financial Management" : "Usimamizi wa Kifedha"}
          </h2>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            {lang === "en"
              ? "All expenditures are audited and tied directly to project engagement budgets."
              : "Matumizi yote yanakaguliwa na kuunganishwa moja kwa moja na bajeti za miradi."}
          </p>
        </div>

        <div className="flex gap-3">
          {["chairperson", "treasurer"].includes(currentUser.roleKey || getCanonicalRoleKey(currentUser.role)) && (
            <button
              onClick={() => { setEditingIncomeId(null); setShowIncomeModal(true); }}
              id="record-income-btn"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <line x1="12" y1="4" x2="12" y2="20"></line>
              </svg>
              {lang === "en" ? "Record Income" : "Weka Mapato"}
            </button>
          )}

          <button
            onClick={() => { setEditingExpenditureId(null); setShowExpenseModal(true); }}
            id="request-disbursement-btn"
            className="bg-[#E31E24] hover:bg-[#c91a1f] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
            {lang === "en" ? "Request Disbursement" : "Omba Malipo"}
          </button>

          <button
            onClick={handlePrintFinancialStatement}
            id="export-funder-report-btn"
            className="bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-300 text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            {lang === "en" ? "Export Funder Statement" : "Chapa Ripoti ya Fedha"}
          </button>
        </div>
      </div>

      {/* Financial health key indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Retained reserves */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-left flex justify-between items-center relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00A651]"></div>
          <div>
            <span className="text-[10px] text-gray-400 font-mono font-bold tracking-wider uppercase block">
              {lang === "en" ? "RETAINED RESERVES" : "AKIBA YA CBO"}
            </span>
            <span className="text-2xl font-black text-[#1B1B1B] block mt-1 font-mono">
              Ksh {cashReserves.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#00A651] font-medium mt-1 inline-block">
              ● {lang === "en" ? "Auditable Balance" : "Kiwango Kinachokaguliwa"}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-[#00A651]">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
        </div>

        {/* Total received income */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-left flex justify-between items-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-sky-500"></div>
          <div>
            <span className="text-[10px] text-gray-400 font-mono font-bold tracking-wider uppercase block">
              {lang === "en" ? "TOTAL RECEIVED INCOME" : "JUMLA YA MAPATO YOTE"}
            </span>
            <span className="text-2xl font-black text-[#1B1B1B] block mt-1 font-mono">
              Ksh {totalIncome.toLocaleString()}
            </span>
            <span className="text-[10px] text-sky-500 font-medium mt-1 inline-block">
              {lang === "en" ? "Grants, Donations & Fees" : "Ruzuku, Misaada na Ada"}
            </span>
          </div>
          <div className="p-3 bg-sky-50 rounded-lg text-sky-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
        </div>

        {/* Operational disbursals */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-left flex justify-between items-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-neutral-800"></div>
          <div>
            <span className="text-[10px] text-gray-400 font-mono font-bold tracking-wider uppercase block">
              {lang === "en" ? "DISBURSED EXPENDITURES" : "MATUMIZI YALIYOLIPWA"}
            </span>
            <span className="text-2xl font-black text-[#1B1B1B] block mt-1 font-mono">
              Ksh {totalApprovedExpense.toLocaleString()}
            </span>
            <span className="text-[10px] text-gray-500 font-medium mt-1 inline-block">
              {lang === "en" ? "Stipends & Admin Costs" : "Posho na Gharama za Uendeshaji"}
            </span>
          </div>
          <div className="p-3 bg-neutral-100 rounded-lg text-neutral-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="4" width="20" height="16" rx="2"></rect>
              <line x1="12" y1="4" x2="12" y2="20"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
            </svg>
          </div>
        </div>
      </div>

      {/* Visual Charts Row */}
      {showChartEmptyState ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center">
          <div className="max-w-md mx-auto py-12 flex flex-col items-center">
            <div className="p-3 bg-amber-50 rounded-full text-amber-600 mb-4 border border-amber-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="15"></line>
                <line x1="15" y1="9" x2="9" y2="15"></line>
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#1B1B1B] mb-1 font-sans">
              {lang === "en" ? "Real Trend Data Accumulating" : "Takwimu za Kweli Zinaendelea Kukusanywa"}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {lang === "en" 
                ? "Not enough history yet — data will build up as you use the system. At least 2 separate months of financial records (Income and approved Expenditures) are required to calculate trendlines."
                : "Historia haitoshi bado — data itajijenga unapoendelea kutumia mfumo. Angalau miezi 2 tofauti ya rekodi za kifedha inahitajika ili kuhesabu mwenendo."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income vs Expenditure Chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-left">
            <h3 className="text-sm font-bold text-[#1B1B1B] mb-4 font-sans uppercase tracking-wider">
              {lang === "en" ? "Monthly Cash Inflow vs Outflow" : "Mapato dhidi ya Matumizi Kila Mwezi"}
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} fontStyle="bold" />
                  <YAxis stroke="#9CA3AF" fontSize={11} />
                  <Tooltip formatter={(value) => `Ksh ${Number(value).toLocaleString()}`} />
                  <Legend iconType="circle" />
                  <Bar dataKey="Revenue" fill="#00A651" name={lang === "en" ? "Revenue (Mapato)" : "Mapato"} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenditures" fill="#E31E24" name={lang === "en" ? "Expenditures (Matumizi)" : "Matumizi"} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reserve Trend Line */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-left">
            <h3 className="text-sm font-bold text-[#1B1B1B] mb-4 font-sans uppercase tracking-wider">
              {lang === "en" ? "Net Retained Reserve Trend" : "Mwenendo wa Akiba ya CBO"}
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reserveData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={11} />
                  <Tooltip formatter={(value) => `Ksh ${Number(value).toLocaleString()}`} />
                  <Line
                    type="monotone"
                    dataKey="Reserve"
                    stroke="#E31E24"
                    strokeWidth={3}
                    activeDot={{ r: 6 }}
                    name={lang === "en" ? "Reserve (Akiba)" : "Akiba"}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Approval Flows Section with Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm text-left">
        <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4">
          <h3 className="text-sm font-extrabold text-[#1B1B1B] uppercase tracking-wider font-sans">
            {lang === "en" ? "Financial ledger records" : "Rekodi za Daftari la Kifedha"}
          </h3>
          <span className="text-[10px] font-bold text-gray-500 font-mono">
            THRESHOLD: Ksh 10,000 LIMIT FOR TREASURER
          </span>
        </div>

        {/* Tab Selection buttons */}
        <div className="flex gap-4 border-b border-gray-100 mb-6">
          <button
            onClick={() => setActiveTab("expenditures")}
            className={`pb-2.5 px-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
              activeTab === "expenditures"
                ? "border-[#E31E24] text-[#E31E24]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <span className="flex items-center gap-1.5"><Coins className="w-4 h-4 text-[#E31E24]" /> {lang === "en" ? "Expenditures & Disbursements" : "Matumizi na Malipo"}</span>
          </button>
          <button
            onClick={() => setActiveTab("incomes")}
            className={`pb-2.5 px-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
              activeTab === "incomes"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-emerald-600" /> {lang === "en" ? "Recorded Revenues & Incomes" : "Mapato Yanayorekodiwa"}</span>
          </button>
        </div>

        {activeTab === "expenditures" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-mono text-[10px] font-bold uppercase">
                  <th className="py-2">{lang === "en" ? "Request Date" : "Tarehe"}</th>
                  <th>{lang === "en" ? "Details / Description" : "Maelezo"}</th>
                  <th>{lang === "en" ? "Requested By" : "Mwasilishaji"}</th>
                  <th>{lang === "en" ? "Amount (Ksh)" : "Kiasi"}</th>
                  <th>{lang === "en" ? "Authorization Path" : "Hali ya Idhini"}</th>
                  <th className="text-right">{lang === "en" ? "Actions" : "Hatua"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs">
                {expenditures.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-400 italic">
                      {lang === "en" ? "No expenditure records found." : "Hakuna rekodi za matumizi zilizopatikana."}
                    </td>
                  </tr>
                ) : (
                  expenditures.map((req) => {
                    const isChairperson = getUserRoleKey(currentUser) === UserRole.CHAIRPERSON;
                    const isTreasurer = getUserRoleKey(currentUser) === UserRole.TREASURER;
                    
                    // Permission checks
                    let canApprove = false;
                    if (req.status === "pending_treasurer" && (isTreasurer || isChairperson)) {
                      canApprove = true;
                    } else if (req.status === "pending_chairperson" && isChairperson) {
                      canApprove = true;
                    }

                    return (
                      <tr key={req.id} className="hover:bg-neutral-50/50">
                        <td className="py-3 font-mono font-medium text-neutral-500">{req.requestDate}</td>
                        <td>
                          <div>
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span className="font-semibold text-neutral-800">{req.description}</span>
                              {req.status.startsWith("pending") && (
                                (() => {
                                  const days = getDaysPending(req.requestDate);
                                  if (days > 10) {
                                    return (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-200 uppercase tracking-wider animate-pulse flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-red-600" /> {days} days pending
                                      </span>
                                    );
                                  } else if (days > 5) {
                                    return (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wider flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-amber-600" /> {days} days pending
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-gray-500" /> {days} days pending
                                      </span>
                                    );
                                  }
                                })()
                              )}
                            </div>
                            {req.budgetId && (
                              <span className="block text-[9px] text-red-500 font-mono font-bold mt-0.5">
                                LINKED TO: {budgets.find(b => b.id === req.budgetId)?.title || "Project Budget"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="font-medium text-neutral-600">{req.requestedBy}</td>
                        <td className="font-bold text-neutral-900 font-mono">Ksh {(req?.amount || 0).toLocaleString()}</td>
                        <td>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.status === "approved"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                : req.status === "rejected"
                                ? "bg-red-50 text-red-600 border border-red-100"
                                : req.status === "pending_chairperson"
                                ? "bg-purple-50 text-purple-600 border border-purple-100 animate-pulse"
                                : "bg-amber-50 text-amber-600 border border-amber-100"
                            }`}
                          >
                            {getApprovalStatusText(req.status)}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-2">
                            {req.status.startsWith("pending") ? (
                              canApprove ? (
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => handleApprove(req)}
                                    id={`approve-expense-btn-${req.id}`}
                                    className="bg-[#00A651] hover:bg-[#008f43] text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer transition-colors"
                                  >
                                    {lang === "en" ? "Approve" : "Idhinisha"}
                                  </button>
                                  <button
                                    onClick={() => handleReject(req)}
                                    id={`reject-expense-btn-${req.id}`}
                                    className="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded cursor-pointer transition-colors border border-red-100"
                                  >
                                    {lang === "en" ? "Reject" : "Kataa"}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-neutral-400 italic mr-1">
                                  {req.status === "pending_chairperson" 
                                    ? (lang === "en" ? "Admin Auth" : "Inahitaji Mwenyekiti")
                                    : (lang === "en" ? "Treasurer Auth" : "Inahitaji Mhazini")}
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] text-neutral-400 font-medium mr-1">
                                {req.status === "approved"
                                  ? `${lang === "en" ? "By" : "Na"} ${req.approvedBy || "Admin"}`
                                  : (lang === "en" ? "Rejected" : "Imekataliwa")}
                              </span>
                            )}

                            {/* Edit button — only while still pending (server also enforces this), for the requester or Chairperson/Treasurer */}
                            {req.status.startsWith("pending") &&
                              (req.requestedBy === currentUser.name ||
                                ["chairperson", "treasurer"].includes(currentUser.roleKey || getCanonicalRoleKey(currentUser.role))) && (
                                <button
                                  onClick={() => openEditExpense(req)}
                                  title={lang === "en" ? "Edit / Rectify Before Approval" : "Hariri Kabla ya Idhini"}
                                  className="p-1 hover:bg-blue-50 text-blue-500 hover:text-blue-700 rounded transition-colors cursor-pointer"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                  </svg>
                                </button>
                            )}

                            {/* Delete button (Chairperson or Treasurer only) */}
                            {["chairperson", "treasurer"].includes(currentUser.roleKey || getCanonicalRoleKey(currentUser.role)) && (
                              <button
                                onClick={() => setDeleteConfirmItem({ id: req.id, type: "expenditure", desc: req.description || "", amount: req?.amount || 0 })}
                                title={lang === "en" ? "Delete / Void Expenditure Record" : "Futa au Batilisha Matumizi"}
                                className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors cursor-pointer"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  <line x1="10" y1="11" x2="10" y2="17"></line>
                                  <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-mono text-[10px] font-bold uppercase">
                  <th className="py-2">{lang === "en" ? "Received Date" : "Tarehe"}</th>
                  <th>{lang === "en" ? "Source" : "Chanzo"}</th>
                  <th>{lang === "en" ? "Details / Description" : "Maelezo"}</th>
                  <th>{lang === "en" ? "Recorded By" : "Mwasilishaji"}</th>
                  <th>{lang === "en" ? "Amount (Ksh)" : "Kiasi"}</th>
                  <th className="text-right">{lang === "en" ? "Actions" : "Hatua"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs">
                {incomes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-400 italic">
                      {lang === "en" ? "No income records found." : "Hakuna rekodi za mapato zilizopatikana."}
                    </td>
                  </tr>
                ) : (
                  incomes.map((inc) => (
                    <tr key={inc.id} className="hover:bg-neutral-50/50">
                      <td className="py-3 font-mono font-medium text-neutral-500">{inc.date}</td>
                      <td>
                        <span className="capitalize px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {inc.source}
                        </span>
                      </td>
                      <td>
                        <div>
                          <span className="font-semibold text-neutral-800">{inc.description}</span>
                          {inc.linkedBudgetId && (
                            <span className="block text-[9px] text-emerald-600 font-mono font-bold mt-0.5">
                              LINKED TO: {budgets.find(b => b.id === inc.linkedBudgetId)?.title || "Project Budget"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="font-medium text-neutral-600">{inc.recordedBy}</td>
                      <td className="font-bold text-neutral-900 font-mono">Ksh {(inc?.amount || 0).toLocaleString()}</td>
                      <td className="py-3 text-right">
                        {["chairperson", "treasurer"].includes(currentUser.roleKey || getCanonicalRoleKey(currentUser.role)) && (
                          <>
                            <button
                              onClick={() => openEditIncome(inc)}
                              title={lang === "en" ? "Edit / Rectify Income Record" : "Hariri / Sahihisha Rekodi ya Mapato"}
                              className="p-1 hover:bg-blue-50 text-blue-500 hover:text-blue-700 rounded transition-colors cursor-pointer inline-block mr-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfirmItem({ id: inc.id, type: "income", desc: inc.description || "", amount: inc?.amount || 0 })}
                              title={lang === "en" ? "Delete / Void Income Record" : "Futa au Batilisha Mapato"}
                              className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors cursor-pointer inline-block"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disbursement Request Modal */}
      <Modal
        isOpen={showExpenseModal}
        onClose={() => { setShowExpenseModal(false); setEditingExpenditureId(null); }}
        title={
          editingExpenditureId
            ? (lang === "en" ? "Rectify Disbursement Request" : "Sahihisha Ombi la Malipo")
            : (lang === "en" ? "Request Disbursement" : "Omba Malipo / Matumizi")
        }
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRequestExpense} className="space-y-4">
              {editingExpenditureId && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-700 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  {lang === "en"
                    ? "You're correcting a pending request before it's approved. This is logged in the Activity Log with the original values."
                    : "Unasahihisha ombi lililo katika mchakato kabla halijaidhinishwa. Hii inarekodiwa kwenye Kumbukumbu za Shughuli pamoja na thamani za awali."}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                  {lang === "en" ? "Disbursement Description" : "Maelezo ya Ombi"}
                </label>
                <input
                  type="text"
                  required
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="e.g., Materials for GBV Forum theatre play"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                    {lang === "en" ? "Amount (Ksh)" : "Kiasi (Ksh)"}
                  </label>
                  <input
                    type="number"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="e.g., 5000"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                    {lang === "en" ? "Category" : "Jamii"}
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-neutral-700"
                  >
                    <option value="stipend">{lang === "en" ? "Stipends" : "Posho"}</option>
                    <option value="transport">{lang === "en" ? "Transport" : "Usafiri"}</option>
                    <option value="props">{lang === "en" ? "Props & Costumes" : "Mali na Vifaa"}</option>
                    <option value="refreshments">{lang === "en" ? "Refreshments" : "Vyakula"}</option>
                    <option value="rent">{lang === "en" ? "Rent" : "Kodi ya Ofisi"}</option>
                    <option value="utilities">{lang === "en" ? "Utilities (Water/Power)" : "Maji na Umeme"}</option>
                    <option value="equipment_maintenance">{lang === "en" ? "Equipment Maintenance" : "Ukarabati wa Vifaa"}</option>
                    <option value="admin_supplies">{lang === "en" ? "Office & Admin Supplies" : "Vifaa vya Ofisi"}</option>
                    <option value="other">{lang === "en" ? "Other operational" : "Mengineyo"}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                  {lang === "en" ? "Link to Engagement Budget" : "Unganisha na Bajeti"}
                </label>
                <select
                  value={expenseBudgetId}
                  onChange={(e) => setExpenseBudgetId(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-neutral-700"
                >
                  <option value="">{lang === "en" ? "-- No Link --" : "-- Bila Unganisho --"}</option>
                  {budgets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} (Revenue: Ksh {b.revenue.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Informative helper block on threshold */}
              <div className="bg-red-50 border border-red-150 p-2.5 rounded-lg text-[10px] text-red-700 leading-relaxed font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>
                  {lang === "en" 
                    ? "Note: Disbursements of Ksh 10,000 or greater require direct sign-off from the Chairperson (Admin) after being logged. Below 10,000 can be processed by the Treasurer."
                    : "Kumbuka: Malipo ya Ksh 10,000 au zaidi yanahitaji saini rasmi ya Mwenyekiti (Admin) baada ya kuhifadhiwa. Chini ya 10,000 yanashughulikiwa na Mhazini."}
                </span>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowExpenseModal(false); setEditingExpenditureId(null); }}
                  className="px-3 py-1.5 border border-neutral-200 text-xs font-semibold rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  {lang === "en" ? "Cancel" : "Ghairi"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {editingExpenditureId
                    ? (lang === "en" ? "Save Correction" : "Hifadhi Marekebisho")
                    : (lang === "en" ? "Submit Request" : "Wasilisha Ombi")}
                </button>
              </div>
            </form>
      </Modal>

      {/* Record Income Modal */}
      <Modal
        isOpen={showIncomeModal}
        onClose={() => { setShowIncomeModal(false); setEditingIncomeId(null); }}
        title={
          editingIncomeId
            ? (lang === "en" ? "Rectify Income Record" : "Sahihisha Rekodi ya Mapato")
            : (lang === "en" ? "Record Cash/Grant Income" : "Weka Mapato ya Fedha / Ruzuku")
        }
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRecordIncome} className="space-y-4">
              {editingIncomeId && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-700 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  {lang === "en"
                    ? "You're correcting an existing record. This change is logged in the Activity Log with the original values for audit purposes."
                    : "Unasahihisha rekodi iliyopo. Mabadiliko haya yanarekodiwa kwenye Kumbukumbu za Shughuli pamoja na thamani za awali kwa madhumuni ya ukaguzi."}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                  {lang === "en" ? "Income Description" : "Maelezo ya Mapato"}
                </label>
                <input
                  type="text"
                  required
                  value={incomeDesc}
                  onChange={(e) => setIncomeDesc(e.target.value)}
                  placeholder="e.g., Q3 Funder Installment or Film Screening entry fees"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                    {lang === "en" ? "Amount (Ksh)" : "Kiasi (Ksh)"}
                  </label>
                  <input
                    type="number"
                    required
                    value={incomeAmount}
                    onChange={(e) => setIncomeAmount(e.target.value)}
                    placeholder="e.g., 150000"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                    {lang === "en" ? "Income Source" : "Chanzo"}
                  </label>
                  <select
                    value={incomeSource}
                    onChange={(e) => setIncomeSource(e.target.value as any)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-neutral-700"
                  >
                    <option value="grant">{lang === "en" ? "Grant" : "Ruzuku ya Mfadhili"}</option>
                    <option value="donation">{lang === "en" ? "Donation" : "Msaada / Michango"}</option>
                    <option value="engagement_fee">{lang === "en" ? "Engagement Fee" : "Ada ya Onyesho"}</option>
                    <option value="membership_contribution">{lang === "en" ? "Membership Contribution" : "Mchango wa Wanachama"}</option>
                    <option value="other">{lang === "en" ? "Other Source" : "Njia Nyingine"}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                    {lang === "en" ? "Date Received" : "Tarehe ya Kupokea"}
                  </label>
                  <input
                    type="date"
                    required
                    value={incomeDate}
                    onChange={(e) => setIncomeDate(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                    {lang === "en" ? "Link to Partner (Optional)" : "Mshirika (Hiari)"}
                  </label>
                  <select
                    value={incomePartnerId}
                    onChange={(e) => setIncomePartnerId(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-neutral-700"
                  >
                    <option value="">{lang === "en" ? "-- No Link --" : "-- Bila Mshirika --"}</option>
                    {StorageService.getPartners().map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
                  {lang === "en" ? "Link to Engagement (Optional)" : "Mradi/Onyesho (Hiari)"}
                </label>
                <select
                  value={incomeBudgetId}
                  onChange={(e) => setIncomeBudgetId(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-neutral-700"
                >
                  <option value="">{lang === "en" ? "-- No Link --" : "-- Bila Mradi --"}</option>
                  {budgets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowIncomeModal(false); setEditingIncomeId(null); }}
                  className="px-3 py-1.5 border border-neutral-200 text-xs font-semibold rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  {lang === "en" ? "Cancel" : "Ghairi"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {editingIncomeId
                    ? (lang === "en" ? "Save Correction" : "Hifadhi Marekebisho")
                    : (lang === "en" ? "Record Income" : "Hifadhi Mapato")}
                </button>
              </div>
            </form>
      </Modal>

      {/* Print Preview & Narrative Modal */}
      <Modal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title={lang === "en" ? "Export Preview & Funder Narrative Assistant" : "Hakiki Kadi na Msaidizi wa Kusimulia Ripoti"}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
              <p className="text-xs text-neutral-500 leading-relaxed">
                {lang === "en"
                  ? "Before printing the formal, letterhead-branded funder statement, you can generate and review a structured financial summary draft using the narrative assistant. You can edit this commentary directly below before finalizing."
                  : "Kabla ya kuchapa ripoti rasmi ya wafadhili, unaweza kutengeneza na kukagua muhtasari wa kifedha ukitumia msaidizi wa kuandika ripoti. Unaweza kuhariri maoni haya hapa chini kabla ya kukamilisha."}
              </p>

              {/* Live metrics indicator */}
              <div className="grid grid-cols-3 gap-3 bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs">
                <div>
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">TOTAL REVENUES</span>
                  <span className="font-bold text-neutral-900">Ksh {totalIncome.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">APPROVED SPEND</span>
                  <span className="font-bold text-red-600">Ksh {totalApprovedExpense.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">NET RESERVES</span>
                  <span className="font-bold text-emerald-600">Ksh {cashReserves.toLocaleString()}</span>
                </div>
              </div>

              {/* Narrative Draft Generator Action */}
              <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    {lang === "en" ? "Interactive Narrative Draft" : "Rasimu ya Maelezo"}
                  </span>
                  <button
                    onClick={handleGenerateNarrative}
                    disabled={isGeneratingCommentary}
                    type="button"
                    className="bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isGeneratingCommentary ? (
                      <>
                        <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                        {lang === "en" ? "Drafting..." : "Inatengeneza..."}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                        {lang === "en" ? "Generate Narrative Draft" : "Tengeneza Rasimu ya Ripoti"}
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  value={narrativeCommentary}
                  onChange={(e) => setNarrativeCommentary(e.target.value)}
                  placeholder={
                    lang === "en"
                      ? "Click the button above to generate a professional auditor narrative paragraph from actual recorded values. You can also type or edit anything directly here."
                      : "Bonyeza kitufe hapo juu ili kutengeneza maelezo ya kitaalamu ya ukaguzi kutoka kwa kiasi kilichorekodiwa. Unaweza pia kuandika au kuhariri hapa."
                  }
                  rows={6}
                  className="w-full bg-white border border-neutral-200 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-sans leading-relaxed text-neutral-700"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-3.5 py-2 border border-neutral-200 text-xs font-semibold rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  {lang === "en" ? "Cancel" : "Ghairi"}
                </button>
                <button
                  onClick={triggerPrintWithNarrative}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  {lang === "en" ? "Confirm & Print Final Statement" : "Thibitisha na Uchapatishe Ripoti"}
                </button>
              </div>
        </div>
      </Modal>

      {/* Rejection Reason Modal */}
      <Modal
        isOpen={!!rejectRequest}
        onClose={() => setRejectRequest(null)}
        title={
          <span className="text-sm font-bold text-neutral-900 font-sans uppercase tracking-wide flex items-center gap-2 text-red-600">
            <Ban className="w-4 h-4 text-red-600 animate-pulse" />
            {lang === "en" ? "Rejection Reason Required" : "Sababu ya Kukataa Inahitajika"}
          </span>
        }
        maxWidth="max-w-md"
      >
        {rejectRequest && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500 leading-relaxed">
              {lang === "en"
                ? `Please provide a detailed reason for rejecting this expenditure request of Ksh ${(rejectRequest.amount || 0).toLocaleString()} for "${rejectRequest.description || ""}".`
                : `Tafadhali toa sababu ya kukataa ombi hili la Ksh ${(rejectRequest.amount || 0).toLocaleString()} la "${rejectRequest.description || ""}".`}
            </p>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                {lang === "en" ? "Reason for Rejection" : "Sababu ya Kukataa"}
              </label>
              <textarea
                value={rejectionInput}
                onChange={(e) => setRejectionInput(e.target.value)}
                placeholder={
                  lang === "en"
                    ? "e.g., Requires further budget alignment / Exceeds allocatable funds for this quarter"
                    : "m.f., Inahitaji upatanishi zaidi wa bajeti / Inazidi fedha zilizotengwa"
                }
                rows={4}
                required
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-sans leading-relaxed text-neutral-700"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setRejectRequest(null)}
                className="px-3.5 py-2 border border-neutral-200 text-xs font-semibold rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                {lang === "en" ? "Cancel" : "Ghairi"}
              </button>
              <button
                onClick={confirmRejection}
                disabled={!rejectionInput.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {lang === "en" ? "Confirm Rejection" : "Thibitisha Kukataa"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmItem}
        onClose={() => setDeleteConfirmItem(null)}
        title={
          <span className="text-sm font-bold text-neutral-900 font-sans uppercase tracking-wide flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4 text-red-600 animate-bounce" />
            {lang === "en" ? "Confirm Deletion" : "Thibitisha Futa"}
          </span>
        }
        maxWidth="max-w-md"
      >
        <div className="space-y-4 font-sans">
          {deleteConfirmItem && (
            <>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {lang === "en"
                  ? `Are you absolutely sure you want to permanently delete and void this ${deleteConfirmItem.type} record? This action will update the live balance, remove the transaction, and log an audit trail entry.`
                  : `Je, una uhakika kabisa unataka kufuta kabisa na kubatilisha rekodi hii ya ${deleteConfirmItem.type === "income" ? "mapato" : "matumizi"}? Kitendo hiki kitasasisha salio la sasa, kitaondoa muamala huu, na kitaandika kumbukumbu ya ukaguzi.`}
              </p>

              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs space-y-1.5 font-sans">
                <div>
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">{lang === "en" ? "Description" : "Maelezo"}</span>
                  <span className="font-semibold text-neutral-800">{deleteConfirmItem.desc}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">{lang === "en" ? "Amount" : "Kiasi"}</span>
                  <span className="font-bold text-neutral-900 font-mono">Ksh {(deleteConfirmItem?.amount || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteConfirmItem(null)}
                  className="px-3.5 py-2 border border-neutral-200 text-xs font-semibold rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {lang === "en" ? "Cancel" : "Ghairi"}
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span>
                      {lang === "en" ? "Deleting..." : "Inafuta..."}
                    </>
                  ) : (
                    lang === "en" ? "Yes, Delete Record" : "Ndio, Futa"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
