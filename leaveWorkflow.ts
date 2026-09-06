// leaveWorkflow.ts
// =============================================================================
// BASHOSHO LEAVE MANAGEMENT — authoritative workflow logic
// =============================================================================
// One authoritative leave record per request, server-owned, never client-trusted.
// A request can change status, but it must NEVER become untraceable: every request
// carries a permanent human-readable reference (LV-YYYY-NNNNN) and an immutable
// audit trail, and remains visible in the register regardless of status.
//
// Pure helpers (this first section) are unit-tested in scripts/test-leave-workflow.ts;
// the db-backed service functions at the bottom are what server.ts calls and what the
// end-to-end lifecycle test drives directly against the mock Firestore.
//
// Backward compatibility: legacy records only ever had
//   { id, userId, userName, startDate, endDate, reason, status: "pending"|"approved"|"rejected", respondedBy? }
// Every new field is additive and optional. "pending" is treated as "submitted".
// =============================================================================

import { db } from "./server-firebase";

// --------------------------- Status model --------------------------------------

export const LEGACY_PENDING = "pending";
export const ACTIONABLE_STATUSES = ["submitted", "under_review", LEGACY_PENDING] as const;
export const DECIDED_STATUSES = ["approved", "rejected", "cancelled", "completed"] as const;

export function normalizeLegacyStatus(status?: string): string {
  if (!status) return "submitted";
  if (status === LEGACY_PENDING) return "submitted";
  return status;
}

export function isActionable(status?: string): boolean {
  return (ACTIONABLE_STATUSES as readonly string[]).includes(String(status));
}

export function isDecided(status?: string): boolean {
  return (DECIDED_STATUSES as readonly string[]).includes(String(status));
}

export function isOpenLeave(status?: string): boolean {
  // An approved leave that has started or is upcoming still "occupies" the person.
  return status === "approved" || status === "on_leave";
}

export const LEAVE_TYPES = [
  { key: "annual", en: "Annual Leave", sw: "Likizo ya Mwaka" },
  { key: "sick", en: "Sick Leave", sw: "Likizo ya Ugonjwa" },
  { key: "compassionate", en: "Compassionate Leave", sw: "Likizo ya Huruma" },
  { key: "maternity", en: "Maternity/Paternity Leave", sw: "Likizo ya Mama/Baba" },
  { key: "unpaid", en: "Unpaid Leave", sw: "Likizo bila Malipo" },
  { key: "other", en: "Other", sw: "Nyingine" }
] as const;

export function leaveTypeLabel(key?: string): string {
  const t = (LEAVE_TYPES as readonly { key: string; en: string }[]).find(x => x.key === key);
  return t ? t.en : (key || "Leave");
}

// --------------------------- Date / day helpers --------------------------------

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/** Inclusive day count between two ISO dates (0 or negative when inverted). */
export function computeLeaveDays(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) return 0;
  const a = new Date(startDate + "T00:00:00Z").getTime();
  const b = new Date(endDate + "T00:00:00Z").getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

export function daysUntil(isoDate?: string, from: string = todayISO()): number | null {
  if (!isoDate) return null;
  const a = new Date(isoDate + "T00:00:00Z").getTime();
  const b = new Date(from + "T00:00:00Z").getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / 86400000);
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

// --------------------------- Validation -----------------------------------------

export interface LeaveValidationResult {
  ok: boolean;
  error?: string;
  days?: number;
}

export function validateLeaveInput(input: { startDate?: string; endDate?: string; reason?: string; leaveType?: string }): LeaveValidationResult {
  if (!input.startDate || !input.endDate) {
    return { ok: false, error: "Start and end dates are both required." };
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(input.startDate) || !dateRe.test(input.endDate)) {
    return { ok: false, error: "Dates must be in YYYY-MM-DD format." };
  }
  const days = computeLeaveDays(input.startDate, input.endDate);
  if (!(days > 0)) {
    return { ok: false, error: "The end date must be on or after the start date." };
  }
  if (days > 365) {
    return { ok: false, error: "A single leave request cannot exceed 365 days." };
  }
  if (!input.reason || !String(input.reason).trim()) {
    return { ok: false, error: "Please give a brief reason for this leave." };
  }
  if (String(input.reason).trim().length > 2000) {
    return { ok: false, error: "The reason is too long (2000 characters maximum)." };
  }
  return { ok: true, days };
}

// --------------------------- Permanent reference -------------------------------

/** LV-2026-00001 — permanent, human-readable, never changes once assigned. */
export function formatLeaveReference(year: number, sequence: number): string {
  return `LV-${year}-${String(sequence).padStart(5, "0")}`;
}

// --------------------------- Approver routing ----------------------------------

export interface ApproverCandidate {
  id: string;
  name: string;
  roleKey?: string;
  role?: string;
  /** Optional explicit override stored on the person's profile. */
  leaveApproverId?: string;
}

export interface ApproverResolution {
  approverId: string;
  approverName: string;
  basis: "profile_override" | "role_routing";
}

/**
 * Resolves who is responsible for approving this person's leave, following
 * Bashosho's actual structure rather than one hard-coded person:
 *
 *   1. explicit profile override (`leaveApproverId`) — a configured supervisor or
 *      designated approver, if the org sets one;
 *   2. role routing — members/volunteers/interns → Programs Director;
 *      leadership (Programs Director, Secretary, Treasurer, Vice Chairperson,
 *      Communications, Member Representative, Executive Director) → Chairperson;
 *      the Chairperson's own leave → Vice Chairperson, so nobody is ever routed
 *      to approve themselves.
 *
 * Returns null when nobody suitable exists — the caller must surface
 * "Approver not configured" and notify an administrator, never orphan the request.
 */
export function resolveApprover(
  requester: { id: string; roleKey?: string; role?: string; leaveApproverId?: string },
  candidates: ApproverCandidate[]
): ApproverResolution | null {
  const active = candidates.filter(c => c.id && c.id !== requester.id);
  const byId = (id: string) => candidates.find(c => c.id === id);

  if (requester.leaveApproverId) {
    const override = byId(requester.leaveApproverId);
    if (override && override.id !== requester.id) {
      return { approverId: override.id, approverName: override.name, basis: "profile_override" };
    }
  }

  const requesterRole = String(requester.roleKey || requester.role || "").toLowerCase();
  const isChairperson = requesterRole.includes("chairperson") && !requesterRole.includes("vice");
  const isLeadership = /programs_director|secretary|treasurer|vice_chairperson|communications|member_representative|executive_director|leadership/.test(requesterRole);

  const findRole = (needle: string) =>
    active.find(c => String(c.roleKey || c.role || "").toLowerCase().includes(needle));

  if (isChairperson) {
    const vice = findRole("vice_chairperson") || findRole("vice");
    if (vice) return { approverId: vice.id, approverName: vice.name, basis: "role_routing" };
    return null; // Chairperson with no Vice — needs an administrator decision.
  }

  if (isLeadership) {
    const chair = findRole("chairperson");
    if (chair) return { approverId: chair.id, approverName: chair.name, basis: "role_routing" };
  }

  const programs = findRole("programs_director") || findRole("programs");
  if (programs) return { approverId: programs.id, approverName: programs.name, basis: "role_routing" };

  const chair = findRole("chairperson");
  if (chair) return { approverId: chair.id, approverName: chair.name, basis: "role_routing" };

  return null;
}

// --------------------------- Automation configuration ---------------------------

/** Reminder timing is configuration, not hard-coded behaviour. */
export interface LeaveAutomationConfig {
  /** Approver nudge after N days pending (default 2), second at 2×, escalate at 3×. */
  approvalReminderDays: number;
  /** Days before start for the employee "leave begins in N days" reminders. */
  upcomingReminderDays: number[];
  /** Days after the end date before a return is considered overdue. */
  returnOverdueDays: number;
  /** Auto-complete an unconfirmed return this many days after the end date. */
  autoCompleteDaysAfterEnd: number;
  /** Approved leave automatically becomes ON_LEAVE when the start date arrives. */
  autoStartOnLeave: boolean;
}

export const DEFAULT_LEAVE_AUTOMATION: LeaveAutomationConfig = {
  approvalReminderDays: 2,
  upcomingReminderDays: [7, 3, 1, 0],
  returnOverdueDays: 3,
  autoCompleteDaysAfterEnd: 7,
  autoStartOnLeave: true
};

export function addDaysISO(iso: string, days: number): string {
  const t = new Date(iso + "T00:00:00Z").getTime();
  if (!Number.isFinite(t)) return iso;
  return new Date(t + days * 86400000).toISOString().split("T")[0];
}

// --------------------------- Reminder planning (idempotent) ---------------------

export interface PlannedReminder {
  /** Stable key — a reminder is sent at most once per key per request. */
  key: string;
  audience: "approver" | "employee" | "admin";
  dueDate: string;
  title: string;
  body: string;
}

/**
 * Every reminder this request still needs, given today's date and what has already
 * been sent (the per-request ledger makes repeated scheduler runs a no-op).
 * Returns only reminders whose dueDate <= today AND not already in the ledger.
 */
export function planDueReminders(
  req: LeaveWorkflowRecord,
  today: string,
  cfg: LeaveAutomationConfig,
  nowISO: string
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const sent = req.reminders || {};
  const push = (r: PlannedReminder) => {
    if (sent[r.key]) return;               // already sent — idempotent
    if (r.dueDate > today) return;         // not yet due
    out.push(r);
  };

  const ref = req.reference || req.id;
  const normalized = normalizeLegacyStatus(req.status);

  // 1. Approver nudges while the request is still awaiting a decision.
  if (isActionable(req.status) && req.approverId) {
    const submittedDay = (req.submittedAt || nowISO).split("T")[0];
    const base = cfg.approvalReminderDays;
    push({
      key: "approver_reminder_1", audience: "approver", dueDate: addDaysISO(submittedDay, base),
      title: `Leave request ${ref} is awaiting your review`,
      body: `${req.userName} requested ${leaveTypeLabel(req.leaveType)} from ${req.startDate} to ${req.endDate}.`
    });
    push({
      key: "approver_reminder_2", audience: "approver", dueDate: addDaysISO(submittedDay, base * 2),
      title: `Second reminder: leave ${ref} still awaiting review`,
      body: `${req.userName}'s request (${req.startDate} to ${req.endDate}) has been pending for ${base * 2} days.`
    });
    if (!req.escalatedAt) {
      push({
        key: "approver_escalation", audience: "admin", dueDate: addDaysISO(submittedDay, base * 3),
        title: `Leave ${ref} approval overdue — escalation`,
        body: `${req.userName}'s request has waited ${base * 3} days. Please review or reassign the approver.`
      });
    }
  }

  // 2. Employee reminders once leave is approved/upcoming.
  if (isOpenLeave(normalized) || normalized === "on_leave") {
    for (const n of cfg.upcomingReminderDays) {
      const due = addDaysISO(req.startDate, -n);
      if (due > req.startDate) continue;
      const label = n === 0 ? "Your approved leave starts today" : `Your leave begins in ${n} day${n === 1 ? "" : "s"}`;
      push({
        key: `employee_upcoming_${n}`, audience: "employee", dueDate: due,
        title: n === 0 ? `${ref}: your leave starts today` : `${ref}: leave begins in ${n} day${n === 1 ? "" : "s"}`,
        body: `${label} (${req.startDate} to ${req.endDate}).`
      });
    }
    push({
      key: "employee_return_reminder", audience: "employee", dueDate: addDaysISO(req.endDate, -1),
      title: `${ref}: your leave ends tomorrow`,
      body: `Your leave ends on ${req.endDate}. Please confirm your return afterwards.`
    });
    push({
      key: "employee_return_confirm", audience: "employee", dueDate: addDaysISO(req.endDate, 1),
      title: `${ref}: please confirm your return`,
      body: `Your leave ended on ${req.endDate}. Confirm your return so the record can be completed.`
    });
    if (!req.returnConfirmedAt) {
      push({
        key: "admin_return_overdue", audience: "admin", dueDate: addDaysISO(req.endDate, cfg.returnOverdueDays),
        title: `${ref}: return not confirmed`,
        body: `${req.userName} has not confirmed their return since ${req.endDate}.`
      });
    }
  }

  return out;
}

// --------------------------- Lifecycle transitions ------------------------------

/** APPROVED → ON_LEAVE when the start date arrives. */
export function shouldStartLeave(req: LeaveWorkflowRecord, today: string): boolean {
  return normalizeLegacyStatus(req.status) === "approved" && req.startDate <= today;
}

/** ON_LEAVE → COMPLETED once the return is confirmed (or the auto-complete grace lapses). */
export function shouldCompleteLeave(req: LeaveWorkflowRecord, today: string, cfg: LeaveAutomationConfig): boolean {
  if (normalizeLegacyStatus(req.status) !== "on_leave") return false;
  if (req.returnConfirmedAt) return true;
  return today >= addDaysISO(req.endDate, cfg.autoCompleteDaysAfterEnd);
}

// --------------------------- Progress timeline ----------------------------------

export interface TimelineStep {
  key: string;
  label: string;
  done: boolean;
  at?: string;
  current: boolean;
}

export interface LeaveWorkflowRecord {
  id: string;
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  respondedBy?: string;
  reference?: string;
  leaveType?: string;
  submittedAt?: string;
  days?: number;
  approverId?: string;
  approverName?: string;
  approverNotConfigured?: boolean;
  underReviewAt?: string;
  decisionDate?: string;
  decisionComment?: string;
  decidedById?: string;
  cancelledAt?: string;
  cancelledById?: string;
  cancelledByName?: string;
  cancelReason?: string;
  returnConfirmedAt?: string;
  returnConfirmedById?: string;
  completedAt?: string;
  auditTrail?: LeaveAuditTrailEvent[];
  reminders?: Record<string, string>;
  escalatedAt?: string;
  conflictWarnings?: { title: string; date: string; role?: string }[];
}

export interface LeaveAuditTrailEvent {
  id: string;
  type: string;
  at: string;
  byId?: string;
  byName?: string;
  note?: string;
}

export function buildTimeline(req: LeaveWorkflowRecord): TimelineStep[] {
  const s = normalizeLegacyStatus(req.status);
  const decided = req.decisionDate || (req.respondedBy ? req.decisionDate ?? "" : "");
  const hasDecision = s === "approved" || s === "rejected" || s === "cancelled";
  return [
    { key: "submitted", label: "Submitted", done: true, at: req.submittedAt, current: false },
    {
      key: "assigned",
      label: req.approverNotConfigured ? "Approver not configured" : `Assigned to ${req.approverName || "approver"}`,
      done: !!(req.approverId || req.respondedBy),
      current: false
    },
    {
      key: "review",
      label: req.underReviewAt ? "Under review" : "Awaiting approval",
      done: !!req.underReviewAt || hasDecision,
      current: isActionable(req.status) && !hasDecision
    },
    {
      key: "decision",
      label: s === "approved" ? "Approved" : s === "rejected" ? "Rejected" : s === "cancelled" ? "Cancelled" : "Decision",
      done: hasDecision,
      at: decided || undefined,
      current: false
    },
    {
      key: "leave_begins", label: "Leave begins",
      done: s === "on_leave" || s === "completed",
      at: s === "on_leave" || s === "completed" ? req.startDate : undefined,
      current: s === "approved"
    },
    {
      key: "return", label: "Return",
      done: !!req.returnConfirmedAt, at: req.returnConfirmedAt,
      current: s === "on_leave" && !req.returnConfirmedAt
    },
    { key: "completed", label: "Completed", done: s === "completed", at: req.completedAt, current: false }
  ];
}

/** Human-readable status for dashboards, register rows and detail views. */
export function statusDisplay(status?: string): { label: string; tone: "neutral" | "amber" | "green" | "red" | "blue" } {
  const s = normalizeLegacyStatus(status);
  switch (s) {
    case "draft": return { label: "Draft", tone: "neutral" };
    case "submitted": return { label: "Pending", tone: "amber" };
    case "under_review": return { label: "Under review", tone: "amber" };
    case "approved": return { label: "Approved — upcoming", tone: "green" };
    case "on_leave": return { label: "On leave", tone: "blue" };
    case "completed": return { label: "Completed", tone: "green" };
    case "rejected": return { label: "Rejected", tone: "red" };
    case "cancelled": return { label: "Cancelled", tone: "neutral" };
    default: return { label: String(status || "Unknown"), tone: "neutral" };
  }
}

// =========================== SERVICE LAYER (db-backed) ==========================
// These functions are the ONLY way leave state changes on the server. Every one is
// transactional where state can race, returns the authoritative record, and appends
// to an immutable audit trail. server.ts endpoints are thin wrappers around them.

export class LeaveServiceError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isLeaveServiceError(err: any): err is LeaveServiceError {
  return !!err && typeof err.status === "number" && typeof err.code === "string";
}

/** Safe error shape for the frontend: clear reason, no internals. */
export function toSafeLeaveError(err: any): { status: number; code: string; message: string; referenceId?: string } {
  if (isLeaveServiceError(err)) {
    return { status: err.status, code: err.code, message: err.message };
  }
  return {
    status: 500,
    code: "LEAVE_INTERNAL_ERROR",
    message: "Something went wrong while saving this leave request. Nothing was changed — please try again."
  };
}

type Actor = { id: string; name: string };

function auditEvent(type: string, actor?: Actor, note?: string): LeaveAuditTrailEvent {
  return {
    id: `lea-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    type,
    at: new Date().toISOString(),
    byId: actor?.id,
    byName: actor?.name,
    note
  };
}

function withAudit(req: LeaveWorkflowRecord, event: LeaveAuditTrailEvent): LeaveWorkflowRecord {
  return { ...req, auditTrail: [...(req.auditTrail || []), event] };
}

/**
 * In-app notification. Deterministic document id (`notif-<type>-<requestId>[-<key>]`)
 * makes repeated automation runs overwrite the same doc instead of spamming duplicates.
 */
async function notifyUser(
  userId: string,
  type: string,
  title: string,
  body: string,
  requestId?: string,
  dedupeKey?: string
): Promise<void> {
  try {
    const id = `notif-${type}-${requestId || "general"}${dedupeKey ? `-${dedupeKey}` : ""}`;
    await db.collection("notifications").doc(id).set({
      id,
      userId,
      type,
      title,
      body,
      requestId: requestId || undefined,
      createdAt: new Date().toISOString(),
      readAt: null
    });
  } catch (err) {
    // A notification failure must never break the authoritative leave write.
    console.error("leave notification failed:", err);
  }
}

// --------------------------- Reference allocation -------------------------------

interface LeaveCounterDoc { year: number; lastSequence: number }

/** Atomic per-year sequence so two simultaneous submissions can never share a reference. */
async function allocateReferenceInTx(tx: any, year: number): Promise<string> {
  const counterRef = db.collection("system_meta").doc(`leave_counter_${year}`);
  const snap = await tx.get(counterRef);
  const current = (snap.exists ? snap.data() : null) as LeaveCounterDoc | null;
  const lastSequence = current && typeof current.lastSequence === "number" ? current.lastSequence : 0;
  const next = lastSequence + 1;
  tx.set(counterRef, { year, lastSequence: next }, { merge: true });
  return formatLeaveReference(year, next);
}

// --------------------------- Submit ---------------------------------------------

export interface SubmitLeaveInput {
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string;
  leaveType?: string;
  /** Resolved candidates for approver routing (profiles). */
  profiles: ApproverCandidate[];
  /** Non-blocking activity conflicts, pre-computed by the caller. */
  conflictWarnings?: { title: string; date: string; role?: string }[];
}

export interface SubmitLeaveOutcome {
  id: string;
  reference: string;
  status: string;
  approverId?: string;
  approverName?: string;
  approverNotConfigured?: boolean;
}

export async function submitLeaveRequest(input: SubmitLeaveInput): Promise<SubmitLeaveOutcome> {
  const validation = validateLeaveInput(input);
  if (!validation.ok) {
    throw new LeaveServiceError(400, "LEAVE_VALIDATION_FAILED", validation.error!);
  }
  if (!input.userId) {
    throw new LeaveServiceError(400, "LEAVE_USER_REQUIRED", "The leave request must belong to a person.");
  }

  // Overlap protection against the person's own open or pending leave.
  const existingSnap = await db.collection("leave_requests").get();
  for (const doc of existingSnap.docs) {
    const r = doc.data() as LeaveWorkflowRecord;
    if (r.userId !== input.userId) continue;
    const s = normalizeLegacyStatus(r.status);
    if (!(isActionable(r.status) || isOpenLeave(s) || s === "on_leave")) continue;
    if (rangesOverlap(input.startDate, input.endDate, r.startDate, r.endDate)) {
      throw new LeaveServiceError(409, "LEAVE_OVERLAPS_EXISTING",
        `This request overlaps an existing leave request${r.reference ? ` (${r.reference})` : ""} from ${r.startDate} to ${r.endDate}.`);
    }
  }

  const nowISO = new Date().toISOString();
  const today = todayISO();
  const year = Number(input.startDate.slice(0, 4)) || new Date().getFullYear();
  const routing = resolveApprover(
    { id: input.userId, roleKey: input.profiles.find(p => p.id === input.userId)?.roleKey, leaveApproverId: input.profiles.find(p => p.id === input.userId)?.leaveApproverId },
    input.profiles
  );
  const requesterProfile = input.profiles.find(p => p.id === input.userId);

  const id = `leave-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  return db.runTransaction(async (tx: any) => {
    const reference = await allocateReferenceInTx(tx, year);
    let record: LeaveWorkflowRecord = {
      id,
      userId: input.userId,
      userName: requesterProfile?.name || input.userName,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: String(input.reason).trim(),
      status: "submitted",
      reference,
      leaveType: input.leaveType || "annual",
      submittedAt: nowISO,
      days: validation.days,
      conflictWarnings: input.conflictWarnings || [],
      auditTrail: []
    };
    if (routing) {
      record.approverId = routing.approverId;
      record.approverName = routing.approverName;
      record.approverNotConfigured = false;
    } else {
      record.approverNotConfigured = true;
    }
    record = withAudit(record, auditEvent("REQUEST_SUBMITTED", { id: input.userId, name: record.userName }, `${input.startDate} → ${input.endDate}`));
    if (routing) {
      record = withAudit(record, auditEvent("APPROVER_ASSIGNED", { id: routing.approverId, name: routing.approverName }, routing.basis));
    }
    tx.set(db.collection("leave_requests").doc(id), record);
    return {
      id,
      reference,
      status: record.status,
      approverId: record.approverId,
      approverName: record.approverName,
      approverNotConfigured: record.approverNotConfigured
    };
  }).then(async (outcome: SubmitLeaveOutcome) => {
    // Notifications after commit — the authoritative record exists either way.
    await notifyUser(outcome.approverId || "", outcome.approverNotConfigured ? "LEAVE_ESCALATED" : "LEAVE_APPROVAL_REQUIRED",
      outcome.approverNotConfigured
        ? `Leave ${outcome.reference} has no configured approver`
        : `New leave request ${outcome.reference} needs your approval`,
      outcome.approverNotConfigured
        ? `${input.userName} submitted leave (${input.startDate} to ${input.endDate}) but no approver is configured for them. Please assign one.`
        : `${input.userName} requested ${leaveTypeLabel(input.leaveType)} from ${input.startDate} to ${input.endDate}.`,
      outcome.id
    );
    await notifyUser(input.userId, "LEAVE_SUBMITTED",
      `Leave request ${outcome.reference} submitted`,
      `Your ${leaveTypeLabel(input.leaveType)} request (${input.startDate} to ${input.endDate}) has been received${outcome.approverName ? ` and routed to ${outcome.approverName}` : ""}.`,
      outcome.id
    );
    if (outcome.approverNotConfigured) {
      for (const admin of input.profiles.filter(p => String(p.roleKey || "").includes("chairperson"))) {
        await notifyUser(admin.id, "LEAVE_ESCALATED", `Approver not configured for ${input.userName}`,
          `Leave ${outcome.reference} (${input.startDate} to ${input.endDate}) is waiting without an approver.`, outcome.id, "no_approver");
      }
    }
    return outcome;
  });
}

// --------------------------- Decision (approve / reject) ------------------------

export interface DecisionInput {
  requestId: string;
  decision: "approve" | "reject";
  reason?: string;
  actor: Actor;
  /** True when the actor is an authorized administrator (chairperson). */
  actorIsChairperson: boolean;
  /** Role keys allowed to act on any request (from the permission system). */
  actorRoleKey: string;
}

export interface DecisionOutcome {
  status: "success" | "alreadyDecided";
  request: LeaveWorkflowRecord;
}

/**
 * Authoritative approve/reject. Concurrency-safe: the request's current status is read
 * INSIDE the transaction, so only one valid decision can ever win. A second actor
 * receives `alreadyDecided` (HTTP 409 from the endpoint) — never a corrupted state.
 */
export async function decideLeaveRequest(input: DecisionInput): Promise<DecisionOutcome> {
  if (input.decision !== "approve" && input.decision !== "reject") {
    throw new LeaveServiceError(400, "LEAVE_INVALID_DECISION", "Decision must be 'approve' or 'reject'.");
  }
  if (input.decision === "reject" && !(input.reason || "").trim()) {
    throw new LeaveServiceError(400, "LEAVE_REJECTION_REASON_REQUIRED", "A reason is required when rejecting a leave request.");
  }

  const ref = db.collection("leave_requests").doc(input.requestId);

  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new LeaveServiceError(404, "LEAVE_NOT_FOUND", "This leave request could not be found.");
    }
    const req = snap.data() as LeaveWorkflowRecord;

    // --- Authorization (server-side, never UI-dependent) ---
    const isAssignedApprover = !!req.approverId && req.approverId === input.actor.id;
    const isAuthorized = isAssignedApprover || input.actorIsChairperson ||
      (req.respondedBy === input.actor.name && isDecided(req.status));
    if (!isAuthorized) {
      throw new LeaveServiceError(403, "LEAVE_NOT_AUTHORIZED",
        "Access denied: only the assigned approver or an authorized administrator can decide this request.");
    }

    // --- Self-approval is enforced here, not by hiding a button ---
    if (req.userId === input.actor.id) {
      throw new LeaveServiceError(403, "LEAVE_SELF_APPROVAL_BLOCKED",
        "You cannot approve or reject your own leave request. Another authorized approver must decide it.");
    }

    // --- Actionable check → concurrency safety ---
    if (!isActionable(req.status)) {
      return { status: "alreadyDecided", request: req };
    }

    const nowISO = new Date().toISOString();
    const nextStatus = input.decision === "approve" ? "approved" : "rejected";
    let updated: LeaveWorkflowRecord = {
      ...req,
      status: nextStatus,
      respondedBy: input.actor.name,
      decidedById: input.actor.id,
      decisionDate: nowISO,
      decisionComment: input.decision === "reject" ? (input.reason || "").trim() : (input.reason || "").trim() || undefined,
      underReviewAt: req.underReviewAt || nowISO
    };
    updated = withAudit(updated, auditEvent(
      input.decision === "approve" ? "APPROVED" : "REJECTED",
      input.actor,
      input.decision === "reject" ? (input.reason || "").trim() : undefined
    ));
    tx.set(ref, updated, { merge: true });
    return { status: "success", request: updated };
  }).then(async (outcome: DecisionOutcome) => {
    if (outcome.status === "success") {
      const approved = outcome.request.status === "approved";
      await notifyUser(outcome.request.userId,
        approved ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        approved
          ? `Leave request ${outcome.request.reference || outcome.request.id} approved`
          : `Leave request ${outcome.request.reference || outcome.request.id} rejected`,
        approved
          ? `Your leave (${outcome.request.startDate} to ${outcome.request.endDate}) was approved by ${input.actor.name}.`
          : `Your leave (${outcome.request.startDate} to ${outcome.request.endDate}) was rejected by ${input.actor.name}. Reason: ${(input.reason || "").trim() || "Not provided"}.`,
        outcome.request.id
      );
    }
    return outcome;
  });
}

// --------------------------- Review start ---------------------------------------

export async function startLeaveReview(requestId: string, actor: Actor): Promise<LeaveWorkflowRecord> {
  const ref = db.collection("leave_requests").doc(requestId);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new LeaveServiceError(404, "LEAVE_NOT_FOUND", "This leave request could not be found.");
    const req = snap.data() as LeaveWorkflowRecord;
    const isAssignedApprover = !!req.approverId && req.approverId === actor.id;
    if (!isAssignedApprover && actor.name !== "system") {
      // Review-start is a soft action: only the assigned approver may mark it.
      throw new LeaveServiceError(403, "LEAVE_NOT_AUTHORIZED", "Only the assigned approver can start a review.");
    }
    if (req.userId === actor.id) {
      throw new LeaveServiceError(403, "LEAVE_SELF_APPROVAL_BLOCKED", "You cannot review your own leave request.");
    }
    if (!isActionable(req.status) || req.underReviewAt) return req;
    const updated = withAudit({ ...req, status: "under_review", underReviewAt: new Date().toISOString() },
      auditEvent("REVIEW_STARTED", actor));
    tx.set(ref, updated, { merge: true });
    return updated;
  });
}

// --------------------------- Cancellation ---------------------------------------

/** A cancelled request is never deleted — it stays traceable in the register. */
export async function cancelLeaveRequest(
  requestId: string,
  actor: Actor,
  reason: string,
  actorIsAdministrator: boolean
): Promise<LeaveWorkflowRecord> {
  if (!(reason || "").trim()) {
    throw new LeaveServiceError(400, "LEAVE_CANCEL_REASON_REQUIRED", "Please give a short reason for cancelling.");
  }
  const ref = db.collection("leave_requests").doc(requestId);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new LeaveServiceError(404, "LEAVE_NOT_FOUND", "This leave request could not be found.");
    const req = snap.data() as LeaveWorkflowRecord;
    const isOwner = req.userId === actor.id;
    if (!isOwner && !actorIsAdministrator) {
      throw new LeaveServiceError(403, "LEAVE_NOT_AUTHORIZED", "You can only cancel your own leave request.");
    }
    const s = normalizeLegacyStatus(req.status);
    if (isDecided(req.status)) {
      throw new LeaveServiceError(409, "LEAVE_ALREADY_CLOSED",
        `This leave request has already been ${s} and can no longer be cancelled.`);
    }
    const updated = withAudit({
      ...req,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledById: actor.id,
      cancelledByName: actor.name,
      cancelReason: (reason || "").trim()
    }, auditEvent("CANCELLED", actor, (reason || "").trim()));
    tx.set(ref, updated, { merge: true });
    return updated;
  }).then(async (updated: LeaveWorkflowRecord) => {
    if (updated.approverId && updated.approverId !== actor.id) {
      await notifyUser(updated.approverId, "LEAVE_CANCELLED",
        `Leave request ${updated.reference || updated.id} cancelled`,
        `${actor.name} cancelled their leave request (${updated.startDate} to ${updated.endDate}).`, updated.id);
    }
    return updated;
  });
}

// --------------------------- Return confirmation --------------------------------

export async function confirmLeaveReturn(
  requestId: string,
  actor: Actor,
  actorIsAdministrator: boolean
): Promise<LeaveWorkflowRecord> {
  const ref = db.collection("leave_requests").doc(requestId);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new LeaveServiceError(404, "LEAVE_NOT_FOUND", "This leave request could not be found.");
    const req = snap.data() as LeaveWorkflowRecord;
    if (req.userId !== actor.id && !actorIsAdministrator) {
      throw new LeaveServiceError(403, "LEAVE_NOT_AUTHORIZED", "Only the person on leave can confirm their return.");
    }
    if (normalizeLegacyStatus(req.status) !== "on_leave") {
      throw new LeaveServiceError(409, "LEAVE_NOT_ON_LEAVE",
        "Return can only be confirmed for leave that is currently on leave.");
    }
    if (req.returnConfirmedAt) return req;
    const nowISO = new Date().toISOString();
    const updated = withAudit({
      ...req,
      returnConfirmedAt: nowISO,
      returnConfirmedById: actor.id,
      status: "completed",
      completedAt: nowISO
    }, auditEvent("RETURN_CONFIRMED", actor));
    tx.set(ref, updated, { merge: true });
    return updated;
  }).then(async (updated: LeaveWorkflowRecord) => {
    if (updated.approverId) {
      await notifyUser(updated.approverId, "LEAVE_COMPLETED",
        `Leave ${updated.reference || updated.id} completed`,
        `${updated.userName} confirmed their return; the leave record is complete.`, updated.id);
    }
    return updated;
  });
}

// --------------------------- Automation tick (idempotent) -----------------------

export interface AutomationRunResult {
  ranAt: string;
  requestsScanned: number;
  transitions: number;
  remindersSent: number;
  escalations: number;
}

/**
 * One idempotent automation pass: status transitions + due reminders + escalation.
 * Safe to run any number of times — the per-request reminder ledger and deterministic
 * notification ids mean a repeat run changes nothing and sends nothing twice.
 */
export async function runLeaveAutomationTick(cfg: LeaveAutomationConfig = DEFAULT_LEAVE_AUTOMATION): Promise<AutomationRunResult> {
  const nowISO = new Date().toISOString();
  const today = todayISO();
  const result: AutomationRunResult = { ranAt: nowISO, requestsScanned: 0, transitions: 0, remindersSent: 0, escalations: 0 };

  // Who receives "admin"-audience alerts (escalations / return-overdue).
  const profilesSnap = await db.collection("profiles").get();
  const admins = profilesSnap.docs
    .map(d => d.data() as any)
    .filter(p => String(p.roleKey || "").includes("chairperson") && p.id)
    .map(p => ({ id: p.id, name: p.name }));

  const snap = await db.collection("leave_requests").get();
  for (const doc of snap.docs) {
    let req = doc.data() as LeaveWorkflowRecord;
    result.requestsScanned++;
    let changed = false;

    // 1. Automatic status transitions.
    if (cfg.autoStartOnLeave && shouldStartLeave(req, today)) {
      req = withAudit({ ...req, status: "on_leave" }, auditEvent("LEAVE_STARTED", { id: "system", name: "System (automation)" }));
      changed = true;
      result.transitions++;
      await notifyUser(req.userId, "LEAVE_STARTING", `Leave ${req.reference || req.id} has started`,
        `Your approved leave (${req.startDate} to ${req.endDate}) starts today.`, req.id);
    }
    if (shouldCompleteLeave(req, today, cfg)) {
      req = withAudit({
        ...req,
        status: "completed",
        completedAt: req.completedAt || nowISO
      }, auditEvent("COMPLETED", { id: "system", name: "System (automation)" },
        req.returnConfirmedAt ? "Return confirmed" : "Auto-completed after return window"));
      changed = true;
      result.transitions++;
    }

    // 2. Due reminders + escalation (ledger-gated → idempotent).
    const due = planDueReminders(req, today, cfg, nowISO);
    if (due.length > 0) {
      const ledger = { ...(req.reminders || {}) };
      for (const r of due) {
        ledger[r.key] = nowISO;
        result.remindersSent++;
        if (r.key === "approver_escalation") {
          result.escalations++;
          req = { ...req, escalatedAt: nowISO };
          changed = true;
          if (req.approverId) await notifyUser(req.approverId, "LEAVE_ESCALATED", r.title, r.body, req.id, r.key);
          for (const a of admins) {
            await notifyUser(a.id, "LEAVE_ESCALATED", r.title, r.body, req.id, `${r.key}-${a.id}`);
          }
        } else if (r.audience === "approver") {
          if (req.approverId) await notifyUser(req.approverId, "LEAVE_APPROVAL_REQUIRED", r.title, r.body, req.id, r.key);
        } else if (r.audience === "employee") {
          await notifyUser(req.userId, "LEAVE_REMINDER", r.title, r.body, req.id, r.key);
        } else {
          for (const a of admins) {
            await notifyUser(a.id, "LEAVE_REMINDER", r.title, r.body, req.id, `${r.key}-${a.id}`);
          }
        }
      }
      req = { ...req, reminders: ledger };
      changed = true;
    }

    if (changed) {
      await db.collection("leave_requests").doc(doc.id).set(req, { merge: true });
    }
  }
  return result;
}

// --------------------------- Reconciliation & backfill --------------------------

export interface LeaveReconciliationItem {
  id: string;
  reference?: string;
  userName: string;
  status: string;
  submittedAt?: string;
  approverName?: string;
  issues: string[];
}

/**
 * Diagnostic scan for the administrator: every leave request with a data-quality issue.
 * NEVER changes any record and NEVER invents a decision — it only reports what can be
 * established from authoritative evidence, so nothing traceable stays hidden.
 */
export async function reconcileLeaveRegister(): Promise<{ scanned: number; problems: LeaveReconciliationItem[] }> {
  const snap = await db.collection("leave_requests").get();
  const profilesSnap = await db.collection("profiles").get();
  const profiles = profilesSnap.docs.map(d => d.data() as ApproverCandidate);
  const problems: LeaveReconciliationItem[] = [];

  for (const doc of snap.docs) {
    const r = doc.data() as LeaveWorkflowRecord;
    const issues: string[] = [];
    if (!r.reference) issues.push("Missing permanent leave reference");
    if (!r.submittedAt) issues.push("Missing submission timestamp");
    if (!r.approverId && !r.respondedBy) issues.push("No approver assigned");
    if (r.approverId && !profiles.some(p => p.id === r.approverId)) issues.push("Assigned approver no longer exists");
    if (isActionable(r.status) && r.submittedAt) {
      const pendingDays = Math.floor((Date.now() - new Date(r.submittedAt).getTime()) / 86400000);
      if (pendingDays > 7) issues.push(`Awaiting decision for ${pendingDays} days`);
    }
    if (!r.auditTrail || r.auditTrail.length === 0) issues.push("No audit history recorded");
    if (issues.length > 0) {
      problems.push({
        id: doc.id, reference: r.reference, userName: r.userName,
        status: statusDisplay(r.status).label, submittedAt: r.submittedAt,
        approverName: r.approverName || r.respondedBy, issues
      });
    }
  }
  return { scanned: snap.size, problems };
}

export interface BackfillResult {
  scanned: number;
  referencesAssigned: number;
  approversAssigned: number;
  submissionDatesSet: number;
}

/**
 * NON-DESTRUCTIVE, ADDITIVE, IDEMPOTENT migration for legacy records:
 * assigns missing references (continuing the same sequence), resolves missing
 * approvers, and backfills submission dates from the record id where possible.
 * It NEVER changes a status and NEVER fabricates a decision.
 */
export async function backfillLegacyLeaveRequests(): Promise<BackfillResult> {
  const result: BackfillResult = { scanned: 0, referencesAssigned: 0, approversAssigned: 0, submissionDatesSet: 0 };
  const snap = await db.collection("leave_requests").get();
  result.scanned = snap.size;
  const profilesSnap = await db.collection("profiles").get();
  const profiles = profilesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ApproverCandidate));

  // Continue the existing reference sequence rather than restarting it.
  let maxSeq = 0;
  let refYear = new Date().getFullYear();
  for (const doc of snap.docs) {
    const m = (doc.data() as LeaveWorkflowRecord).reference?.match(/^LV-(\d{4})-(\d{5})$/);
    if (m) { refYear = Math.max(refYear, Number(m[1])); maxSeq = Math.max(maxSeq, Number(m[2])); }
  }
  let nextSeq = maxSeq;

  for (const doc of snap.docs) {
    const r = doc.data() as LeaveWorkflowRecord;
    const patch: Partial<LeaveWorkflowRecord> = {};
    let changed = false;

    if (!r.reference) {
      nextSeq += 1;
      patch.reference = formatLeaveReference(refYear, nextSeq);
      result.referencesAssigned++;
      changed = true;
    }
    if (!r.submittedAt) {
      // Derive from the legacy id (`leave-<ms>` / `lv-<ms>`) — evidence, not invention.
      const ms = Number((doc.id.match(/(\d{10,})/) || [])[1]);
      if (Number.isFinite(ms) && ms > 0) {
        patch.submittedAt = new Date(ms).toISOString();
        result.submissionDatesSet++;
        changed = true;
      }
    }
    if (!r.approverId && !r.respondedBy && isActionable(r.status)) {
      const p = profiles.find(x => x.id === r.userId);
      const routing = resolveApprover({ id: r.userId, roleKey: p?.roleKey, leaveApproverId: p?.leaveApproverId }, profiles);
      if (routing) {
        patch.approverId = routing.approverId;
        patch.approverName = routing.approverName;
        result.approversAssigned++;
        changed = true;
      }
    }
    if (r.days === undefined) {
      const d = computeLeaveDays(r.startDate, r.endDate);
      if (d > 0) { patch.days = d; changed = true; }
    }
    if (changed) await db.collection("leave_requests").doc(doc.id).set(patch, { merge: true });
  }
  return result;
}

// --------------------------- Leave balances (configured, not invented) ----------

export interface LeaveBalance {
  configured: boolean;
  entitlementDays?: number;
  usedDays: number;
  pendingDays: number;
  remainingDays?: number;
}

/**
 * Balances come from the org's configured policy (`org_settings.leavePolicy.annualDays`).
 * If the org has not configured an entitlement, `configured: false` and nothing is
 * invented. Pending requests reduce *available* balance but never count as used;
 * rejected/cancelled requests never consume anything.
 */
export async function computeLeaveBalance(userId: string, entitlementDays?: number): Promise<LeaveBalance> {
  const snap = await db.collection("leave_requests").get();
  let usedDays = 0;
  let pendingDays = 0;
  for (const doc of snap.docs) {
    const r = doc.data() as LeaveWorkflowRecord;
    if (r.userId !== userId) continue;
    const days = r.days ?? computeLeaveDays(r.startDate, r.endDate);
    const s = normalizeLegacyStatus(r.status);
    if (s === "approved" || s === "on_leave" || s === "completed") usedDays += days;
    else if (isActionable(r.status)) pendingDays += days;
  }
  const configured = typeof entitlementDays === "number" && entitlementDays > 0;
  return {
    configured,
    entitlementDays: configured ? entitlementDays : undefined,
    usedDays,
    pendingDays,
    remainingDays: configured ? Math.max(0, entitlementDays! - usedDays - pendingDays) : undefined
  };
}