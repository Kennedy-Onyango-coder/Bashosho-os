/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  CHAIRPERSON = "chairperson",
  VICE_CHAIRPERSON = "vice_chairperson",
  PROGRAMS_DIRECTOR = "programs_director",
  SECRETARY = "secretary",
  TREASURER = "treasurer",
  SAFEGUARDING_OFFICER = "safeguarding_officer",
  PROGRAM_MEMBER = "program_member",
  VOLUNTEER = "volunteer",
  // Added to match Bashosho Talents CBO's actual Constitution (Sections 10-11), which
  // distinguishes the elected Management Committee from the appointed Programs &
  // Operations Team. These are intentionally NEW, ADDITIVE roleKeys — nothing existing
  // was renamed or removed, so no historical profile or role_permissions doc is affected.
  // Executive Director is deliberately kept separate from CHAIRPERSON (previously the
  // fuzzy matcher below merged "executive director" into "chairperson", which meant
  // anyone holding that title inherited the unconditional chairperson bypass in
  // userHasPermission() — see server.ts). Even where the same real person holds both
  // offices (as the Constitution's Section 6 Founders clause anticipates), the system
  // should be able to tell which hat they're acting under.
  EXECUTIVE_DIRECTOR = "executive_director",
  MEMBER_REPRESENTATIVE = "member_representative",
  COMMUNICATIONS_MARKETING = "communications_marketing"
}

export function getCanonicalRoleKey(roleOrName?: string, docId?: string): string {
  if (docId) {
    const idLower = docId.toLowerCase().trim();
    if (idLower === "chairperson") return UserRole.CHAIRPERSON;
    if (idLower === "vice_chairperson") return UserRole.VICE_CHAIRPERSON;
    if (idLower === "programs_director") return UserRole.PROGRAMS_DIRECTOR;
    if (idLower === "secretary") return UserRole.SECRETARY;
    if (idLower === "treasurer") return UserRole.TREASURER;
    if (idLower === "safeguarding_officer" || idLower === "safeguarding_mel") return UserRole.SAFEGUARDING_OFFICER;
    if (idLower === "program_member") return UserRole.PROGRAM_MEMBER;
    if (idLower === "volunteer" || idLower === "volunteer_staff") return UserRole.VOLUNTEER;
    if (idLower === "executive_director") return UserRole.EXECUTIVE_DIRECTOR;
    if (idLower === "member_representative") return UserRole.MEMBER_REPRESENTATIVE;
    if (idLower === "communications_marketing") return UserRole.COMMUNICATIONS_MARKETING;
  }

  if (!roleOrName) return "";
  const str = roleOrName.toLowerCase().trim();

  // Known canonical role keys passed directly
  if (str === UserRole.CHAIRPERSON) return UserRole.CHAIRPERSON;
  if (str === UserRole.VICE_CHAIRPERSON) return UserRole.VICE_CHAIRPERSON;
  if (str === UserRole.PROGRAMS_DIRECTOR) return UserRole.PROGRAMS_DIRECTOR;
  if (str === UserRole.SECRETARY) return UserRole.SECRETARY;
  if (str === UserRole.TREASURER) return UserRole.TREASURER;
  if (str === UserRole.SAFEGUARDING_OFFICER || str === "safeguarding_mel") return UserRole.SAFEGUARDING_OFFICER;
  if (str === UserRole.PROGRAM_MEMBER) return UserRole.PROGRAM_MEMBER;
  if (str === UserRole.VOLUNTEER || str === "volunteer_staff") return UserRole.VOLUNTEER;
  if (str === UserRole.EXECUTIVE_DIRECTOR) return UserRole.EXECUTIVE_DIRECTOR;
  if (str === UserRole.MEMBER_REPRESENTATIVE) return UserRole.MEMBER_REPRESENTATIVE;
  if (str === UserRole.COMMUNICATIONS_MARKETING) return UserRole.COMMUNICATIONS_MARKETING;

  // Matching display strings
  // "Executive Director" / "CBO Chief" is checked BEFORE and separately from chairperson
  // — these are the appointed operational head of the Programs & Operations Team, not
  // the elected Chairperson, even when the same person holds both offices in practice.
  if (str.includes("executive director") || str.includes("cbo chief")) {
    return UserRole.EXECUTIVE_DIRECTOR;
  }
  if (str.includes("chairperson") || str.includes("chair")) {
    return UserRole.CHAIRPERSON;
  }
  if (str.includes("vice")) {
    return UserRole.VICE_CHAIRPERSON;
  }
  // "Member Representative" must be checked before the generic "member" fallback below,
  // otherwise it silently resolves to plain program_member and loses its Management
  // Committee standing.
  if (str.includes("member") && (str.includes("representative") || str.includes(" rep") || str.endsWith("rep"))) {
    return UserRole.MEMBER_REPRESENTATIVE;
  }
  if (str.includes("communications") || str.includes("marketing")) {
    return UserRole.COMMUNICATIONS_MARKETING;
  }
  // "coordinator" added alongside director/lead/operations — the Constitution's actual
  // title for this seat is "Programs Coordinator", which previously fell through to the
  // generic slugify fallback below instead of resolving to the existing programs_director
  // roleKey (kept as-is, unrenamed, to avoid touching any existing stored data).
  if (str.includes("program") && (str.includes("director") || str.includes("lead") || str.includes("operations") || str.includes("coordinator"))) {
    return UserRole.PROGRAMS_DIRECTOR;
  }
  if (str.includes("secretary")) {
    return UserRole.SECRETARY;
  }
  if (str.includes("treasurer") || str.includes("finance")) {
    return UserRole.TREASURER;
  }
  if (str.includes("safeguard") || str.includes("mel")) {
    return UserRole.SAFEGUARDING_OFFICER;
  }
  if (str.includes("volunteer")) {
    return UserRole.VOLUNTEER;
  }
  if (str.includes("member")) {
    return UserRole.PROGRAM_MEMBER;
  }

  // Fallback: slugify
  return str.replace(/[^a-z0-9]+/g, "_");
}

export function getUserRoleKey(profile?: { roleKey?: string; role?: string } | null): string {
  if (!profile) return "";
  if (profile.roleKey && profile.roleKey.trim()) {
    const rk = profile.roleKey.toLowerCase().trim();
    if (rk === "safeguarding_mel") return UserRole.SAFEGUARDING_OFFICER;
    if (rk === "volunteer_staff") return UserRole.VOLUNTEER;
    return rk;
  }
  return getCanonicalRoleKey(profile.role);
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  roleKey: UserRole | string;
  isActive: boolean;
  joinDate: string;
  avatar?: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  skills: string[];
  status: "Active" | "Inactive" | "Volunteer";
  memberNumber: string;
  mustChangePassword?: boolean;
  verificationUrl?: string;
  validFrom?: string;
  validUntil?: string;
  handbookAcknowledgedVersion?: string;
  totpEnabled?: boolean;
  totpSecret?: string;
  totpBackupCodeHashes?: string[];
  handbookAcknowledgedAt?: string;
  signatureUrl?: string;
  /** Chairperson-granted temporary extension past a lapsed contract deadline — e.g.
   *  "give them 2 more weeks". Locking logic treats this date as the effective
   *  deadline instead of the contract's real expiry when it's later than that expiry. */
  contractGraceUntil?: string;
  /** Server-computed on every profile fetch (see fetchCollection) — whether this
   *  person's contract has actually lapsed past its due date/grace, independent of
   *  the static `status` field above. This is the field the ID card and other
   *  screens should check for real-time lock state. */
  contractLocked?: boolean;
  contractDueDate?: string;
}

export type DocumentType = "minutes" | "budget" | "activity" | "statement";

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  date: string;
  author: string;
  content: string; // Markdown/HTML or JSON for budget
  status: "draft" | "reviewed" | "approved";
  auditTrail: {
    action: string;
    user: string;
    timestamp: string;
    notes?: string;
  }[];
  partnerId?: string; // Linked partner CRM if any
  /** Server-computed, cryptographically signed verification link (see /api/verify/document/:id) */
  verificationUrl?: string;
}

export interface BudgetEngagement {
  id: string;
  title: string;
  date: string;
  partnerId?: string;
  items: {
    id: string;
    description: string;
    category: "stipend" | "props" | "transport" | "refreshments" | "other";
    estimatedAmount: number;
    actualAmount: number;
    status: "pending" | "approved" | "rejected";
    requestedBy: string;
  }[];
  revenue: number; // Partner contract value
  status: "draft" | "submitted" | "approved";
  approvedBy?: string;
}

export interface ExpenditureRequest {
  id: string;
  budgetId?: string; // Linked budget if any
  description: string;
  amount: number;
  category: string;
  requestedBy: string;
  requestDate: string;
  status: "pending_treasurer" | "pending_chairperson" | "approved" | "rejected";
  approvedBy?: string;
  rejectionReason?: string;
  receiptUrl?: string;
  /** Marks an expenditure logged through the fast Petty Cash flow — auto-approved
   *  because it's below the org's petty-cash threshold, and always carries a receipt
   *  photo as evidence, unlike a normal expenditure request which can be approved
   *  without one. */
  isPettyCash?: boolean;
  /** Marks a record entered as part of digitizing an old paper cashbook (e.g. 2022
   *  onward) — already-approved by construction, since the money was already spent
   *  long before this system existed. Kept distinct from a live-approved expenditure
   *  so the audit trail is honest about which records went through real-time review
   *  versus historical backfill. */
  isHistoricalEntry?: boolean;
  /** Multi-approver chain tracking. If empty/undefined, legacy 2-tier status logic applies. */
  approvals?: ExpenditureApproval[];
  /** id of the ExpenditureApprovalTier this request was evaluated against */
  approvalTierId?: string;
  /** Optional: the roleKey of the Programs & Operations Team portfolio this spend falls
   *  under (e.g. "theatre_film_director"), when the expenditure is specific to one
   *  person's operational area rather than general organizational spending. When set,
   *  the approval endpoint blocks the matching role from approving or rejecting this
   *  request — even where that role would otherwise qualify as an approver — because
   *  several Management Committee members also hold an operational portfolio, and
   *  nobody should be able to approve spending in their own program area. See the
   *  Conflict of Interest Policy, Section 3 (segregation rule). Optional and additive:
   *  requests without this field behave exactly as before. */
  programOwnerRoleKey?: string;
}

export interface ExpenditureApproval {
  roleKey: string;
  approverId: string;
  approverName: string;
  timestamp: string;
  decision: "approved" | "rejected";
  notes?: string;
}

export interface SafeguardingReport {
  id: string;
  title: string;
  reporterName?: string; // Optional (can be anonymous)
  reporterContact?: string;
  description: string;
  reportedDate: string;
  status: "received" | "under_review" | "resolved";
  notes: string;
  assignedTo: string; // Safeguarding officer
}

export interface SyncAction {
  id: string;
  action: string;
  payload: any;
  timestamp: string;
  status: "pending" | "synced" | "error";
  type?: "write" | "delete";
}

// Phase 2 Types
export interface Asset {
  id: string;
  name: string;
  category: "camera" | "mic" | "costume" | "prop" | "laptop" | "sound" | "furniture" | "other";
  serialNumber: string;
  purchaseDate: string;
  purchaseCost: number;
  condition: "excellent" | "good" | "fair" | "poor" | "repair_needed";
  custodian: string;
  location: string;
  photoUrl?: string;
  availableForHire?: boolean;
  dailyRate?: number;
  /** How the CBO came to own this asset — purchased outright, or received as a donation. */
  acquisitionType?: "purchased" | "donated";
  /** Only meaningful when acquisitionType is "donated". */
  donatedBy?: string;
  /** Whether a purchase/donation receipt exists for this asset (paper or digital). */
  hasReceipt?: boolean;
  /** Free-text reference to the receipt — a filed document number, folder name, or link. */
  receiptRef?: string;
  /** Every physical inspection this asset has been through — the record behind the
   *  6-month re-inspection cycle. Most recent entry's date drives the "next inspection
   *  due" calculation shown in the UI. */
  inspectionHistory?: {
    id: string;
    date: string;
    inspectedBy: string;
    condition: Asset["condition"];
    notes?: string;
  }[];
  /** Every time this asset's custodian changed — a real chain-of-custody log, not just
   *  the current holder. */
  assignmentHistory?: {
    id: string;
    custodian: string;
    assignedDate: string;
    assignedBy: string;
    notes?: string;
  }[];
  /** Server-computed, cryptographically signed verification link for the printable
   *  asset card (see /api/verify/asset/:id) */
  verificationUrl?: string;
  externalRentals?: {
    id: string;
    clientName: string;
    clientPhone: string;
    startDate: string;
    endDate: string;
    totalAmount: number;
    paymentStatus: "paid" | "unpaid";
    status: "out" | "returned";
  }[];
  checkoutHistory: {
    id: string;
    userName: string;
    eventName: string;
    checkoutDate: string;
    expectedReturnDate: string;
    actualReturnDate?: string;
  }[];
}

export interface AttendanceSheet {
  id: string;
  title: string;
  date: string;
  type: "rehearsal" | "performance" | "meeting" | "class" | "external" | "training" | "street_performance" | "field_performance" | "office_attendance";
  venue: string;
  records: {
    userId: string;
    userName: string;
    status: "present" | "absent" | "excused";
    checkInTime?: string;
    checkOutTime?: string;
    geoTagged?: boolean;
    volunteerHours?: number; // calculation base
    stipend?: number;
    /** Optional — attendees on a transcribed paper register (e.g. street performance
     *  audience or a community member) often aren't registered CBO members. */
    phone?: string;
    role?: string;
  }[];
  isTranscribed: boolean;
  /** Approval chain for a paper attendance register transcribed into the system by the
   *  Secretary: Secretary submits → Programs Director approves → Chairperson gives
   *  final approval. Sheets created via live self-service clock-in (see Dashboard)
   *  don't use this chain and are left undefined/"approved". */
  approvalStatus?: "draft" | "pending_programs_approval" | "pending_chairperson_approval" | "approved" | "rejected";
  submittedBy?: string;
  submittedDate?: string;
  programsApprovedBy?: string;
  programsApprovedDate?: string;
  chairpersonApprovedBy?: string;
  chairpersonApprovedDate?: string;
  rejectionReason?: string;
  /** Server-computed, cryptographically signed verification link for the printable
   *  attendance roster (see /api/verify/attendance_register/:id) */
  verificationUrl?: string;
}

/** A cast/crew payment list the Treasurer enters after a physical payout, tied to the
 *  matching approved expenditure request so the paid-out total is checked against what
 *  was actually authorized — the paper trail behind cash disbursed to a group of people
 *  at once (a play cast, a field crew, etc). */
export interface CastPaymentList {
  id: string;
  title: string;
  eventName: string;
  date: string;
  /** Links to the ExpenditureRequest this payout was authorized under — the sum of
   *  each payment's `grossAmount` must match that request's amount. */
  expenditureRequestId: string;
  payments: {
    id: string;
    name: string;
    role?: string;
    phone?: string;
    /** Links to a real registered member/volunteer/leader profile, when the payee is
     *  one — lets that person see this payment on their own dashboard. Left undefined
     *  for external/non-member cast or crew. */
    userId?: string;
    /** The budgeted stipend amount before any membership-fund deduction. */
    grossAmount: number;
    /** Withheld toward the organization's membership development fund — server-
     *  computed from the list's deduction rate, never trusted from the client. */
    deductionAmount: number;
    /** What the person actually received in hand. */
    netAmount: number;
  }[];
  /** Percentage of each payee's gross amount withheld toward the CBO's membership
   *  development fund, e.g. 5 for 5%. 0 if no deduction applies to this list. */
  deductionRate: number;
  submittedBy: string;
  submittedDate: string;
  /** Reviewed by Chairperson or Vice Chairperson only — never the Treasurer who
   *  submitted it, so the same person can't both pay out and approve. */
  status: "pending_review" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedDate?: string;
  rejectionReason?: string;
  /** Set once approved, only if total deductions > 0 — links to the Income record
   *  auto-created for the withheld membership fees, so that money is actually tracked
   *  in the Financial Ledger rather than just noted here. */
  membershipFundIncomeId?: string;
  verificationUrl?: string;
}

/** One finance reconciliation event: comparing the CBO's own recorded books against a
 *  real bank statement balance for a period, to catch discrepancies early. */
export interface BankReconciliation {
  id: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  bankStatementBalance: number;
  /** The system's own recorded net position as of the statement end date, captured at
   *  the moment of reconciliation (not recalculated later, so history stays accurate
   *  even as new records are added). */
  systemBalance: number;
  difference: number;
  status: "balanced" | "discrepancy";
  notes?: string;
  /** Individual statement lines, auto-matched server-side against real income/
   *  expenditure records by date proximity + amount — not just a manual checklist.
   *  `matched` stays for backward compatibility with older reconciliations. */
  statementLines?: {
    id: string;
    date: string;
    description: string;
    amount: number;
    matched: boolean;
    /** Set by the auto-matcher when a real income/expenditure record was found. */
    matchedRecordId?: string;
    matchedRecordType?: "income" | "expenditure";
    matchedRecordDescription?: string;
  }[];
  /** Real income/expenditure records dated within the statement period that no
   *  statement line matched — money the books say happened but the bank statement
   *  doesn't confirm. The other half of real reconciliation: not just "does the bank
   *  line have a record" but "does the record have a bank line". */
  unmatchedSystemRecords?: {
    id: string;
    type: "income" | "expenditure";
    date: string;
    description: string;
    amount: number;
  }[];
  reconciledBy: string;
  reconciledDate: string;
}

export interface Partner {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  category: "civil_society" | "corporate" | "government" | "other";
  notes: string;
  pipelineStage?: "contacted" | "negotiating" | "confirmed" | "delivered" | "reported";
  /** Real contact history — replaces what used to be hardcoded placeholder "last
   *  contact" / "next follow-up" dates on the Vice Chairperson's dashboard. */
  contactLog?: {
    id: string;
    date: string;
    notes: string;
    method: "call" | "email" | "meeting" | "whatsapp" | "other";
    loggedBy: string;
  }[];
  /** The next time someone should reach back out — set explicitly when logging a
   *  contact, not derived. */
  nextFollowUpDate?: string;
}

/** A scheduled event members/volunteers can see ahead of time and RSVP to — distinct
 *  from AttendanceSheet, which records who actually showed up after the fact. */
export interface CBOEvent {
  id: string;
  title: string;
  type: "rehearsal" | "performance" | "training" | "meeting" | "street_performance" | "field_performance" | "other";
  date: string;
  startTime?: string;
  endTime?: string;
  location: string;
  description?: string;
  createdBy: string;
  createdDate: string;
  rsvps: {
    userId: string;
    userName: string;
    response: "yes" | "no" | "maybe";
    respondedDate: string;
  }[];
}

/** A Board meeting with its agenda tracked ahead of time, and its minutes (a real
 *  Document of type "minutes") linked once the meeting happens. */
export interface BoardMeeting {
  id: string;
  title: string;
  date: string;
  time?: string;
  location: string;
  agenda: string[];
  attendeeIds: string[];
  status: "scheduled" | "completed" | "cancelled";
  minutesDocId?: string;
  createdBy: string;
  createdDate: string;
}

/** Per-new-member onboarding checklist the Secretary tracks — distinct from a Task,
 *  since these are a fixed, predictable set of steps every new member goes through,
 *  not an ad-hoc assignment. */
export interface OnboardingChecklist {
  id: string;
  userId: string;
  userName: string;
  steps: {
    id: string;
    label: string;
    completed: boolean;
    completedDate?: string;
    completedBy?: string;
  }[];
  createdDate: string;
}

export interface Class {
  id: string;
  name: string;
  description: string;
  trainer: string;
  startDate: string;
  endDate: string;
  enrolledUserIds: string[];
  verificationUrl?: string;
}

export interface Grant {
  id: string;
  name: string;
  funder: string;
  deadline: string;
  amount: number;
  status: "identified" | "preparing" | "submitted" | "awarded" | "declined";
  notes: string;
  link?: string;
  probability?: number;
  /** Where this lead came from — lets staff instantly tell a public website
   *  submission (TaaS booking, partner inquiry, sponsorship request) apart from
   *  a grant/lead a staff member entered manually. Set server-side only, never
   *  client-supplied, so it can't be spoofed. */
  source?: "public_website" | "manual";
  contactPhone?: string;
  contactEmail?: string;
}

export interface Income {
  id: string;
  source: "engagement_fee" | "grant" | "donation" | "membership_contribution" | "other";
  amount: number;
  date: string;
  description: string;
  linkedPartnerId?: string;
  linkedBudgetId?: string;
  recordedBy: string;
  /** Marks an income entered while digitizing an old paper cashbook, rather than
   *  recorded live as the money came in. */
  isHistoricalEntry?: boolean;
}

export interface BroadcastReply {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

export interface Broadcast {
  id: string;
  message: string;
  channel: "sms" | "whatsapp" | "email" | "all";
  sentBy: string;
  sentDate: string;
  replies?: BroadcastReply[];
}

export type ProgramArea = "gbv" | "srhr" | "mental_health" | "film_academy" | "taas" | "general";

export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedToId: string;
  assignedToName: string;
  assignedById: string;
  assignedByName: string;
  programArea: ProgramArea;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  createdDate: string;
  completedDate?: string;
}

/** A single logged outreach/rehearsal/training/booking session — the real, countable
 *  unit behind program reach reporting (GBV, SRHR, Mental Health, Film Academy, TaaS). */
export interface ProgramSession {
  id: string;
  programArea: ProgramArea;
  title: string;
  date: string;
  location: string;
  facilitators: string;
  participantsReached: number;
  maleCount: number;
  femaleCount: number;
  childrenCount: number;
  description: string;
  outcomeNotes: string;
  loggedById: string;
  loggedBy: string;
  loggedDate: string;
}

export type RecognitionTier = "bronze" | "silver" | "gold" | "platinum";

export interface VolunteerCertificate {
  id: string;
  userId: string;
  userName: string;
  tier: RecognitionTier;
  hoursAtIssue: number;
  issuedDate: string;
  issuedBy: string;
  /** Server-computed, cryptographically signed verification link */
  verificationUrl?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  respondedBy?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // BT-INV-XXX
  partnerId: string;
  engagementDescription: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: "draft" | "sent" | "paid" | "overdue";
  verificationUrl?: string;
  /** "performance" triggers the automatic 30/70 organizational-cut split when this
   *  invoice is marked paid (see PerformanceSettlement). Left unset/"other" for
   *  invoices that shouldn't auto-split — grants, one-off services, etc. */
  category?: "performance" | "other";
}

/** Created automatically the moment a "performance"-category invoice is marked paid.
 *  Splits the gross fee into the organization's management cut and the pool available
 *  to pay cast/crew — but nothing moves until a Treasurer/Chairperson/Vice Chairperson
 *  actually confirms it, so a wrong invoice amount never silently becomes real income. */
export interface PerformanceSettlement {
  id: string;
  invoiceId: string;
  engagementDescription: string;
  grossAmount: number;
  orgCutPercent: number;
  orgCutAmount: number;
  castPoolPercent: number;
  castPoolAmount: number;
  status: "pending_confirmation" | "confirmed";
  confirmedBy?: string;
  confirmedDate?: string;
  /** Links to the real Income record for the org's cut, created on confirmation. */
  orgIncomeId?: string;
  /** Links to the real (pre-approved) ExpenditureRequest for the cast pool, created on
   *  confirmation — this is what a Cast Payment List then gets built against. */
  castExpenditureId?: string;
  createdDate: string;
}

export interface HandbookSection {
  id: string;            // e.g. "objectives", "code-of-conduct", "relationships-policy"
  title: { en: string; sw: string };
  body: { en: string; sw: string };
  order: number;
}

export interface OrgSettings {
  name: string;
  registrationNumber: string;
  contactDetails: string; // e.g. P.O. Box ...
  physicalAddress: string; // e.g. Community Center...
  emailAndPhone: string; // e.g. Email: ... | Cell: ...
  missionText: string; // slogan e.g. Connecting Youths Through Talents
  renewalFee?: number;
  /** Self-healing, set once on first use — the date this contract-renewal system went
   *  live. Existing members' reminder/lock logic is gated to 3 months after this date
   *  (not just 3 months after their original join date), so nobody already registered
   *  before this feature existed gets locked out on day one of rollout. */
  contractSystemLaunchDate?: string;
  /** Percentage of a performance/engagement fee retained by the organization when a
   *  "performance"-category invoice is marked paid. Default 30. */
  performanceOrgCutPercent?: number;
  /** Recommended default deduction rate for Cast Payment Lists — the per-member
   *  membership-fund contribution taken from their share of a performance fee.
   *  Default 10. Still adjustable per payment list. */
  performanceMembershipDeductionPercent?: number;
  /** Expenditures at or below this amount can be logged through the fast Petty Cash
   *  flow (auto-approved, receipt required) instead of the full Expenditure Request
   *  approval chain. Default 1000. */
  pettyCashThreshold?: number;
  codeOfConduct?: string;
  objectives?: string;
  rules?: string;
  safeguardingContact?: string;
  handbookVersion?: string;         // e.g. "1.0"
  handbookUpdatedAt?: string;       // ISO date, shown to members
  handbookSections?: HandbookSection[];
  visionText?: LocalizedText | string;
  facebookUrl?: string;
  invoiceBankName?: string;
  invoiceBankAccount?: string;
  invoiceBankAccountName?: string;
  invoiceMpesaPaybill?: string;
  invoiceMpesaTill?: string;
  /** Ordered chain of role keys required to approve an expenditure once its amount crosses
   *  the given threshold. Evaluated top-to-bottom; the first matching (highest) threshold
   *  the amount qualifies for wins. Falls back to the legacy 2-tier behavior if unset. */
  expenditureApprovalChain?: ExpenditureApprovalTier[];
}

export interface ExpenditureApprovalTier {
  id: string;
  label: string; // e.g. "Under Ksh 10,000"
  minAmount: number; // inclusive lower bound, 0 for the base tier
  approverRoleKeys: string[]; // ordered list of roleKeys that must each approve, in order
}

// --- PERMISSIONS SYSTEM ---

export type PermissionModuleKey =
  | "dashboard"
  | "documents"
  | "finance"
  | "assets"
  | "grants"
  | "classes"
  | "invoices"
  | "handbook"
  | "settings"
  | "signup_reviews"
  | "cms_editor"
  | "beneficiaries"
  | "roles"
  | "safeguarding"
  | "leadership_appointments"
  | "contract_renewals"
  | "activity_log"
  | "tasks"
  | "program_sessions"
  | "volunteer_recognition"
  | "attendance_registers"
  | "events"
  | "board_meetings"
  | "onboarding_checklists";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve";

export type ModulePermissionSet = Record<PermissionAction, boolean>;

export interface RolePermissions {
  roleId: string; // matches roles collection doc id / roleKey
  roleName: string;
  isSystemRole: boolean;
  orgId: string;
  permissions: Record<PermissionModuleKey, ModulePermissionSet>;
  updatedAt?: string;
  updatedBy?: string;
}

export const PERMISSION_MODULE_KEYS: PermissionModuleKey[] = [
  "dashboard", "documents", "finance", "assets", "grants", "classes", "invoices",
  "handbook", "settings", "signup_reviews", "cms_editor", "beneficiaries", "roles",
  "safeguarding", "leadership_appointments", "contract_renewals", "activity_log",
  "tasks", "program_sessions", "volunteer_recognition", "attendance_registers",
  "events", "board_meetings", "onboarding_checklists"
];

export const PERMISSION_ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete", "approve"];

export function emptyModulePermissionSet(): ModulePermissionSet {
  return { view: false, create: false, edit: false, delete: false, approve: false };
}

// --- ACTIVITY LOG ---

export interface ActivityLogEntry {
  id: string;
  orgId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  module: PermissionModuleKey | string;
  action: string; // e.g. "create" | "update" | "delete" | "approve" | "reject"
  targetId?: string;
  targetLabel?: string;
  timestamp: string;
  before?: any;
  after?: any;
}

export interface LoginHistoryEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  timestamp: string;
  method: "password" | "2fa";
  ipAddress: string;
  userAgent: string;
  /** Lightweight best-effort parse of the User-Agent string — e.g. "Chrome on Windows",
   *  "Safari on iPhone" — not a precise device fingerprint. */
  device: string;
  /** Best-effort city/country from a free IP-geolocation lookup, filled in shortly
   *  after the login event (fire-and-forget, never blocks login). Approximate —
   *  accuracy depends on the ISP/network and can be off, especially on mobile data. */
  location?: string;
}

export interface ContractRenewal {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  submissionDate: string;
  photoUrl: string; // attached passport size photo
  signedConduct: boolean;
  agreedObjectives: boolean;
  signatureUrl?: string;
  paymentStatus: "pending" | "partially_paid" | "paid" | "exempt";
  /** The fee owed for this specific cycle, captured at submission time so a later
   *  change to the org-wide renewal fee never retroactively changes what someone
   *  already partway through paying owes. */
  feeRequired: number;
  /** Every confirmed payment toward this cycle's fee — supports "Lipa Pole Pole"
   *  (pay any amount, any number of times, before the deadline). M-Pesa payments are
   *  appended automatically on a confirmed Daraja callback; manual ones are appended
   *  by a Treasurer/Chairperson/Vice Chairperson after they verify a receipt. */
  payments: {
    id: string;
    amount: number;
    date: string;
    method: "mpesa" | "manual";
    transactionCode?: string;
    recordedBy?: string;
  }[];
  /** Self-reported manual payments awaiting Treasurer/Chairperson/Vice Chairperson
   *  verification against the real till statement — submitted by the member
   *  themselves when M-Pesa STK isn't available, so a payment they've genuinely made
   *  doesn't just disappear into a "pay again" dead end. Confirming one appends it to
   *  `payments` above with method "manual"; nothing counts toward the fee until then. */
  pendingManualClaims?: {
    id: string;
    amount: number;
    transactionCode: string;
    phone?: string;
    claimedDate: string;
    status: "pending" | "confirmed" | "rejected";
    decisionBy?: string;
    decisionDate?: string;
    rejectionReason?: string;
  }[];
  status: "pending_review" | "approved" | "rejected";
  expiryDate?: string; // 12 months from approval
  reviewedBy?: string;
  reviewedDate?: string;
  rejectionReason?: string;
  /** Set only when a Chairperson explicitly waives the fee for this cycle. */
  exemptionReason?: string;
  /** Server-computed, cryptographically signed verification link for the printable
   *  signed contract (see /api/verify/contract_renewal/:id) */
  verificationUrl?: string;
}

export interface SignupApplication {
  id: string;
  type: "member" | "volunteer";
  fullName: string;
  phone: string;
  email?: string;
  dateOfBirth: string; // ISO date
  location: string; // estate/area in Kiambiu
  whyJoin: string;
  skills: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  passportPhotoPath: string; // private Storage path, NOT a public URL
  idDocumentPath: string; // private Storage path, NOT a public URL
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedBy?: string;
  reviewedDate?: string;
  rejectionReason?: string;
  membershipFeeStatus?: "not_applicable" | "pending" | "paid"; // "not_applicable" for volunteers
}

export interface Beneficiary {
  id: string;
  fullName: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  location: string;
  notes: string;
  registeredBy: string; // staff member name, set server-side from req.user
  registeredDate: string;
}

export interface LocalizedText { en: string; sw: string; }

export interface Program {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  photoUrl: string; // public Storage URL, placeholder initially
  supportTillNumber?: string;
  supportInstructions?: LocalizedText;
  sponsorContactNote?: LocalizedText; // shown inside the sponsor modal
  audienceTag?: LocalizedText; // "Who it's for"
  outcomeText?: LocalizedText; // "What happens next"
  actionButtonText?: LocalizedText; // Custom call to action button label
}

export interface Project {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  photoUrl: string;
  category: "general" | "film" | "theatre";
  crew?: LocalizedText; // free text - director/cast/credits, org formats this however they like
  youtubeUrl?: string;
  supportTillNumber?: string;
  supportInstructions?: LocalizedText;
}

export interface RoleTemplate {
  role: UserRole;
  responsibilities: LocalizedText;
}

export interface PartnerLogo {
  id: string;
  name: string;
  logoUrl?: string;
  category?: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  dailyRate: number;
  condition?: "excellent" | "good" | "fair" | "poor" | string;
  photoUrl?: string;
  description?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  title: string;
  bio: string;
  photoUrl?: string;
  order?: number;
}

export interface SiteContent {
  heroTitle: LocalizedText;
  heroSubtitle: LocalizedText;
  aboutText: LocalizedText;
  missionText: LocalizedText;
  visionText?: LocalizedText;
  equipmentEyebrow?: LocalizedText;
  equipmentTitle?: LocalizedText;
  equipmentSubtitle?: LocalizedText;
  galleryEyebrow?: LocalizedText;
  galleryTitle?: LocalizedText;
  gallerySubtitle?: LocalizedText;
  programs: Program[];
  projects: Project[];
  partnersList?: PartnerLogo[];
  equipmentList?: EquipmentItem[];
  teamMembers?: TeamMember[];
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  roleTemplates?: RoleTemplate[];
  heroImageUrl?: string;
  facebookUrl?: string;
  impactStats?: { id: string; value: string; label: LocalizedText; description: LocalizedText }[];
  pillars?: { id: string; title: LocalizedText; description: LocalizedText }[];
}

export interface GalleryImage {
  id: string;
  imageUrl: string; // public Storage URL
  caption: LocalizedText;
  uploadedBy: string;
  uploadedAt: string;
  order: number;
}

export interface LeadershipAppointment {
  id: string;
  profileId: string;
  role: UserRole;
  appointedBy: string; // server-side from req.user!.name, never client-supplied
  appointmentDate: string;
  termStart: string;
  termEnd?: string;
  responsibilities: { en: string; sw: string };
  letterDocumentId?: string; // set once the letter is generated, see section 3
  verificationUrl?: string;
  acknowledged: boolean;
  acknowledgedDate?: string;
}


