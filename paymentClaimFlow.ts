// paymentClaimFlow.ts
// =============================================================================
// ATOMIC, IDEMPOTENT, DUPLICATE-SAFE MANUAL PAYMENT + CLAIM DECISION LOGIC
// =============================================================================
// Core shared financial-integrity rules for Bashosho's contract-renewal manual
// payment path (the "member pays to the till, Treasurer/Chairperson verifies the
// claim" flow). It is shared by:
//   - POST /api/contract_renewals/:id/claim_manual_payment   (member submits a claim)
//   - POST /api/contract_renewals/:id/manual_payment         (admin records directly)
//   - POST /api/contract_renewals/:id/manual_claims/:claimId/decision (verify claim)
//
// Every rule here is enforced inside a Firestore transaction so a confirmation is
// all-or-nothing:
//   A) claim -> confirmed, exactly one payment added, paymentStatus recalculated,
//      exactly one Income record created, transaction code permanently reserved.
//   B) or NOTHING is changed.
//
// Idempotency: retrying the same decision never creates a second payment or income
// record because their IDs are *derived deterministically from the claim id*, and an
// already-recorded decision returns a benign "alreadyProcessed" success instead of
// corrupting the ledger. Duplicate M-Pesa receipt numbers are rejected via a
// dedicated, indexable `transaction_codes` collection keyed by a normalized form of
// the receipt (the deterministic concurrency-safe identity for the receipt).
// =============================================================================

import { db } from "./server-firebase";

// --- Typed API errors (distinct from unknown/internal crashes) -----------------

export type ErrorKind =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SELF_VERIFICATION"
  | "INTERNAL";

export class ClaimFlowError extends Error {
  readonly kind: ErrorKind;
  readonly status: number;
  readonly code: string;
  readonly details?: string;

  constructor(kind: ErrorKind, status: number, code: string, message: string, details?: string) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** A safe, human-editable error shape safe to send to clients. */
export interface SafeClaimFlowError {
  status: number;
  code: string;
  message: string;
  details?: string;
}

export function toSafeError(err: ClaimFlowError): SafeClaimFlowError {
  return {
    status: err.status,
    code: err.code,
    message: err.message,
    details: err.details
  };
}

export function isClaimFlowError(err: any): err is ClaimFlowError {
  return !!err && typeof err.kind === "string" && typeof err.status === "number";
}

// ---------------- Normalization & pure validation ------------------------------

/**
 * Deterministic normalized form of an M-Pesa transaction receipt.
 * "UHRC2L1VL", " uhrc2l1vl ", "UHRC-2L1-VL" all collapse to the same identity so
 * receipt numbers are compared consistently regardless of case / whitespace / dashes.
 */
export function normalizeTransactionCode(code?: string | number | null): string {
  if (code === undefined || code === null) return "";
  return String(code).trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
}

export interface AmountResult {
  ok: boolean;
  value?: number;
  error?: string;
}

/**
 * Validates a payment amount: finite, greater than zero, and safe to store.
 * Rejects zero, negatives, NaN, Infinity/-Infinity and non-numeric garbage.
 */
export function validateManualAmount(amount: any, label = "Amount"): AmountResult {
  if (amount === undefined || amount === null || amount === "") {
    return { ok: false, error: `${label} is required.` };
  }
  if (typeof amount !== "number" && typeof amount !== "string") {
    return { ok: false, error: `${label} must be a number.` };
  }
  const n = Number(amount);
  if (Number.isNaN(n)) return { ok: false, error: `${label} must be a valid number.` };
  if (!Number.isFinite(n)) return { ok: false, error: `${label} must be a finite number.` };
  if (n <= 0) return { ok: false, error: `${label} must be greater than zero.` };
  return { ok: true, value: n };
}

export interface ActionResult {
  ok: boolean;
  value?: "confirm" | "reject";
  error?: string;
}

/** Strictly allows only "confirm" and "reject". Anything else is a validation error —
 *  the server MUST NOT fall through to treat an unknown action as confirmation. */
export function validateClaimAction(action: any): ActionResult {
  if (action === "confirm") return { ok: true, value: "confirm" };
  if (action === "reject") return { ok: true, value: "reject" };
  return {
    ok: false,
    error: `Invalid action "${String(action)}". Only "confirm" or "reject" are supported.`
  };
}

function safeAmount(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ---------------- Roles allowed to verify a manual payment/claim -----------------

export const CLAIM_VERIFIER_ROLE_KEYS = new Set(["treasurer", "chairperson", "vice_chairperson"]);

export function canVerifyPaymentClaims(roleKey: string): boolean {
  return CLAIM_VERIFIER_ROLE_KEYS.has(roleKey);
}

// ---------------- Duplicate M-Pesa receipt protection ---------------------------

/** Deterministic identity doc for a receipt, in the indexable `transaction_codes`
 *  collection, keyed by the *normalized* receipt so it is queryable and claimable
 *  inside a transaction (concurrency cannot double-spend a receipt). */
export function transactionCodeDocId(normalizedCode: string): string {
  return normalizedCode;
}

export async function findExistingTransactionCodeUsage(
  normalizedCode: string,
  dbInstance: any = db,
  ignoreRenewalId?: string
): Promise<{ collection: string; id: string; reason: string } | null> {
  if (!normalizedCode) return null;

  // Fresh deterministic guard doc already reserved? Fast authoritative answer.
  if (!ignoreRenewalId) {
    const guardSnap = await dbInstance.collection("transaction_codes").doc(transactionCodeDocId(normalizedCode)).get();
    if (guardSnap.exists) {
      const g = guardSnap.data() as any;
      return { collection: "transaction_codes", id: normalizedCode, reason: g.reason || "receipt already used" };
    }
  }

  // Legacy scan: payments + pending claims across all contract renewals (skipping the
  // renewal being worked on when `ignoreRenewalId` is set).
  try {
    const renewalsSnap = await dbInstance.collection("contract_renewals").get();
    for (const doc of renewalsSnap.docs) {
      if (ignoreRenewalId && String(doc.id) === String(ignoreRenewalId)) continue;
      const r = doc.data() as any;
      for (const p of r.payments || []) {
        if (p.transactionCode && normalizeTransactionCode(p.transactionCode) === normalizedCode) {
          return { collection: "contract_renewals", id: doc.id, reason: "receipt already recorded against a payment" };
        }
      }
      for (const c of r.pendingManualClaims || []) {
        if (c.transactionCode && normalizeTransactionCode(c.transactionCode) === normalizedCode) {
          return { collection: "contract_renewals", id: doc.id, reason: "receipt already used by another claim" };
        }
      }
    }
  } catch (e) {
    // The authoritative guard doc inside the transaction still prevents double-spend.
  }

  // Legacy scan: M-Pesa STK payment transactions' receipt numbers.
  try {
    const txSnap = await dbInstance.collection("payment_transactions").get();
    for (const doc of txSnap.docs) {
      const t = doc.data() as any;
      if (t.mpesaReceiptNumber && normalizeTransactionCode(t.mpesaReceiptNumber) === normalizedCode) {
        return { collection: "payment_transactions", id: doc.id, reason: "receipt already used by an M-Pesa transaction" };
      }
    }
  } catch (e) {
    // Same as above.
  }

  return null;
}

// ---------------- Shared record types & deterministic ids -----------------------

export interface RenewalClaim {
  id: string;
  amount: number;
  transactionCode?: string;
  phone?: string;
  claimedDate?: string;
  status: string;
  decisionBy?: string;
  decisionDate?: string;
  rejectionReason?: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  method: "manual" | "mpesa";
  transactionCode?: string;
  recordedBy?: string;
  claimId?: string;
}

export interface IncomeRecord {
  id: string;
  source: string;
  amount: number;
  date: string;
  description: string;
  recordedBy: string;
  transactionCode?: string;
  renewalId?: string;
  claimId?: string;
}

/** Deterministic identity for a manual payment keyed by the *claim id*. Re-issuing the
 *  same claim (retries, double clicks, network retries) always targets the same
 *  payment / income document ids → idempotent, never a duplicate. */
export function paymentIdForClaim(claimId: string): string {
  return `pay-manual-${claimId}`;
}
export function incomeIdForClaim(claimId: string): string {
  return `income-manual-${claimId}`;
}

/** Deterministic identity for a directly-recorded manual payment keyed by the receipt
 *  (plus a disambiguator when no receipt was given). */
export function paymentIdForDirect(receipt: string, nonce: string | number): string {
  const base = receipt ? normalizeTransactionCode(receipt) : `noreceipt-${nonce}`;
  return `pay-manual-${base}`;
}
export function incomeIdForDirect(paymentId: string): string {
  return `income-${paymentId}`;
}

function appendUniquePayment(payments: PaymentRecord[], entry: PaymentRecord): PaymentRecord[] {
  if (payments.some(p => p.id === entry.id)) return payments; // idempotent
  return [...payments, entry];
}

export interface ClaimDecisionInput {
  renewalId: string;
  claimId: string;
  action: "confirm" | "reject";
  reason?: string;
  verifierUserId: string;
  verifierName: string;
  verifierRoleKey: string;
  /** Optional override amount used only when confirming (normally the stored claim
   *  amount is used; provided by the caller when the verified amount differs). */
  amount?: number;
}

export interface ClaimDecisionOutcome {
  status: "success" | "alreadyProcessed";
  decision: "confirm" | "reject";
  renewalId: string;
  claimId: string;
  paymentId?: string;
  incomeId?: string;
}

/**
 * The single atomic + idempotent entry point for the payment *claim decision*
 * endpoint (confirm / reject a member-submitted till payment claim).
 *
 * Outcomes:
 *   - success            (fresh decision applied)
 *   - alreadyProcessed   (deterministic retry of an already-recorded decision — the
 *     caller returns a benign success so the frontend refreshes; a confirmed claim's
 *     payment + income are healed so "everything succeeds" on retry)
 *
 * Throws ClaimFlowError for validation / authorization / not-found / conflicts.
 */
export async function processClaimDecision(input: ClaimDecisionInput): Promise<ClaimDecisionOutcome> {
  const actionResult = validateClaimAction(input.action);
  if (!actionResult.ok) {
    throw new ClaimFlowError("VALIDATION", 400, "INVALID_CLAIM_ACTION", actionResult.error);
  }
  const action = actionResult.value;
  const renewalRef = db.collection("contract_renewals").doc(input.renewalId);

  // --------------------------- REJECT path --------------------------------------
  if (action === "reject") {
    return db.runTransaction(async (tx: any) => {
      const snap = await tx.get(renewalRef);
      if (!snap.exists) {
        throw new ClaimFlowError("NOT_FOUND", 404, "RENEWAL_NOT_FOUND", "Contract renewal not found.");
      }
      const existing = snap.data() as any;
      guardSelfVerification(existing, input.verifierUserId);

      const claims: RenewalClaim[] = Array.isArray(existing.pendingManualClaims) ? existing.pendingManualClaims : [];
      const claim = claims.find((c: any) => c.id === input.claimId);
      if (!claim) {
        throw new ClaimFlowError("NOT_FOUND", 404, "CLAIM_NOT_FOUND", "Payment claim not found.");
      }
      if (claim.status === "rejected") {
        return { status: "alreadyProcessed", decision: "reject", renewalId: input.renewalId, claimId: input.claimId };
      }
      if (claim.status === "confirmed") {
        throw new ClaimFlowError("CONFLICT", 409, "CLAIM_ALREADY_CONFIRMED",
          "This claim was already confirmed and a payment recorded; it cannot be rejected now.");
      }
      if (claim.status !== "pending") {
        return { status: "alreadyProcessed", decision: "reject", renewalId: input.renewalId, claimId: input.claimId };
      }

      const updatedClaims = claims.map((c: any) =>
        c.id === claim.id
          ? { ...c, status: "rejected", decisionBy: input.verifierName, decisionDate: today(), rejectionReason: (input.reason || "").trim() }
          : c
      );
      tx.set(renewalRef, { pendingManualClaims: updatedClaims }, { merge: true });
      return { status: "success", decision: "reject", renewalId: input.renewalId, claimId: input.claimId };
    });
  }

  // --------------------------- CONFIRM path -------------------------------------
  // Fast amount validation for a friendly error before entering the transaction.
  let amount: number;
  if (input.amount !== undefined) {
    const amt = validateManualAmount(input.amount, "Payment amount");
    if (!amt.ok) {
      throw new ClaimFlowError("VALIDATION", 400, "INVALID_AMOUNT", amt.error);
    }
    amount = amt.value;
  } else {
    amount = 0; // resolved from the stored claim inside the transaction
  }

  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(renewalRef);
    if (!snap.exists) {
      throw new ClaimFlowError("NOT_FOUND", 404, "RENEWAL_NOT_FOUND", "Contract renewal not found.");
    }
    const existing = snap.data() as any;
    guardSelfVerification(existing, input.verifierUserId);

    const claims: RenewalClaim[] = Array.isArray(existing.pendingManualClaims) ? existing.pendingManualClaims : [];
    const claim = claims.find((c: any) => c.id === input.claimId);
    if (!claim) {
      throw new ClaimFlowError("NOT_FOUND", 404, "CLAIM_NOT_FOUND", "Payment claim not found.");
    }

    if (claim.status === "confirmed") {
      // Idempotent retry: heal payment + income, never duplicate.
      applyConfirmedPaymentToRenewal(tx, renewalRef, input.renewalId, claim, existing, input.verifierName);
      return { status: "alreadyProcessed", decision: "confirm", renewalId: input.renewalId, claimId: input.claimId,
               paymentId: paymentIdForClaim(claim.id), incomeId: incomeIdForClaim(claim.id) };
    }
    if (claim.status === "rejected") {
      throw new ClaimFlowError("CONFLICT", 409, "CLAIM_ALREADY_REJECTED",
        "This claim was already rejected and cannot be confirmed.");
    }
    if (claim.status !== "pending") {
      return { status: "alreadyProcessed", decision: "confirm", renewalId: input.renewalId, claimId: input.claimId };
    }

    // The verifier may optionally correct the amount, otherwise use the stored claim.
    const resolvedAmount = amount > 0 ? amount : safeAmount(claim.amount);
    if (!(Number.isFinite(resolvedAmount)) || resolvedAmount <= 0) {
      throw new ClaimFlowError("VALIDATION", 400, "INVALID_AMOUNT",
        "The claim has an invalid amount and cannot be confirmed. Please reject it and record a correct manual payment.");
    }

    // --- Amount vs. fee / remaining-balance integrity (same protections as STK). ---
    const feeRequired = safeAmount(existing.feeRequired) || 500;
    const existingPayments: PaymentRecord[] = Array.isArray(existing.payments) ? existing.payments : [];
    const priorPaid = existingPayments.reduce((s: number, p: PaymentRecord) => s + safeAmount(p.amount), 0);
    const afterPaid = priorPaid + resolvedAmount;
    const remainingBalance = feeRequired - priorPaid;
    if (remainingBalance >= 0 && resolvedAmount > remainingBalance + 1) {
      throw new ClaimFlowError("VALIDATION", 400, "OVERPAYMENT_EXCEEDS_BALANCE",
        `This payment of KSh ${resolvedAmount.toLocaleString()} exceeds the remaining balance of KSh ${Math.max(0, remainingBalance).toLocaleString()} on this renewal.`);
    }

    // --- Duplicate receipt protection (authoritative + concurrency-safe). ---
    const normalizedCode = normalizeTransactionCode(claim.transactionCode);
    if (normalizedCode) {
      const guardDoc = transactionCodeDocId(normalizedCode);
      const guardSnap = await tx.get(db.collection("transaction_codes").doc(guardDoc));
      if (guardSnap.exists) {
        throw new ClaimFlowError("CONFLICT", 409, "DUPLICATE_TRANSACTION_CODE",
          `The M-Pesa transaction code "${normalizedCode}" has already been used for a confirmed payment and cannot be used again.`);
      }
      tx.set(db.collection("transaction_codes").doc(guardDoc), {
        normalizedCode,
        renewalId: input.renewalId,
        claimId: input.claimId,
        amount: resolvedAmount,
        reason: `reserved by manual payment claim ${input.claimId}`,
        createdAt: new Date().toISOString()
      });
    }

    // --- Write confirmed claim + exactly one payment + recalculated status. ---
    const updatedClaims = claims.map((c: any) =>
      c.id === claim.id
        ? { ...c, status: "confirmed", decisionBy: input.verifierName, decisionDate: today() }
        : c
    );
    const payment: PaymentRecord = {
      id: paymentIdForClaim(claim.id),
      amount: resolvedAmount,
      date: today(),
      method: "manual",
      transactionCode: normalizedCode || claim.transactionCode || undefined,
      recordedBy: input.verifierName,
      claimId: claim.id
    };
    const newPayments = appendUniquePayment(existingPayments, payment);
    tx.set(renewalRef, { pendingManualClaims: updatedClaims, payments: newPayments, paymentStatus: afterPaid >= feeRequired ? "paid" : "partially_paid" }, { merge: true });

    // --- Exactly one Income record, deterministically keyed by claim id. ---
    const incomeId = incomeIdForClaim(claim.id);
    tx.set(db.collection("incomes").doc(incomeId), {
      id: incomeId,
      source: "membership_contribution",
      amount: resolvedAmount,
      date: today(),
      description: `Contract renewal fee (manual) — ${existing.userName || "member"}${normalizedCode ? ` — ${normalizedCode}` : ""}`,
      recordedBy: input.verifierName,
      transactionCode: normalizedCode || undefined,
      renewalId: input.renewalId,
      claimId: claim.id
    });

    return {
      status: "success",
      decision: "confirm",
      renewalId: input.renewalId,
      claimId: input.claimId,
      paymentId: payment.id,
      incomeId
    };
  });
}

/** Enforces segregation of duties: the claimant must never verify their own claim. */
function guardSelfVerification(existing: any, verifierUserId: string): void {
  if (existing.userId && existing.userId === verifierUserId) {
    throw new ClaimFlowError("SELF_VERIFICATION", 403, "SELF_VERIFICATION_BLOCKED",
      "You cannot verify a payment claim you submitted yourself. Another authorized verifier (Treasurer, Chairperson, or Vice Chairperson) must confirm or reject it.");
  }
}

/** Idempotent helper used inside the confirm transaction to ensure a confirmed claim's
 *  payment + income exist (healing legacy partial state from the old non-atomic path). */
function applyConfirmedPaymentToRenewal(
  tx: any,
  renewalRef: any,
  renewalId: string,
  claim: RenewalClaim,
  existing: any,
  recordedBy: string
): void {
  const amount = safeAmount(claim.amount);
  const feeRequired = safeAmount(existing.feeRequired) || 500;
  const existingPayments: PaymentRecord[] = Array.isArray(existing.payments) ? existing.payments : [];
  const normalizedCode = normalizeTransactionCode(claim.transactionCode);
  const payment: PaymentRecord = {
    id: paymentIdForClaim(claim.id),
    amount,
    date: today(),
    method: "manual",
    transactionCode: normalizedCode || undefined,
    recordedBy: claim.decisionBy || recordedBy,
    claimId: claim.id
  };
  const newPayments = appendUniquePayment(existingPayments, payment);
  const afterPaid = newPayments.reduce((s: number, p: PaymentRecord) => s + safeAmount(p.amount), 0);
  tx.set(renewalRef, { payments: newPayments, paymentStatus: afterPaid >= feeRequired ? "paid" : "partially_paid" }, { merge: true });

  const incomeId = incomeIdForClaim(claim.id);
  tx.set(db.collection("incomes").doc(incomeId), {
    id: incomeId,
    source: "membership_contribution",
    amount,
    date: today(),
    description: `Contract renewal fee (manual) — ${existing.userName || "member"}${normalizedCode ? ` — ${normalizedCode}` : ""}`,
    recordedBy: claim.decisionBy || recordedBy,
    transactionCode: normalizedCode || undefined,
    renewalId,
    claimId: claim.id
  });
}

export interface DirectManualPaymentInput {
  renewalId: string;
  amount?: any;
  transactionCode?: string;
  recordedBy: string;
  verifierRoleKey: string;
}

export interface DirectManualPaymentOutcome {
  status: "success" | "alreadyProcessed";
  renewalId: string;
  paymentId: string;
  incomeId: string;
}

/**
 * Records a confirmed manual payment directly (no member claim) — used by the
 * `/manual_payment` endpoint. Atomic + idempotent + duplicate-safe + amount-checked
 * exactly like confirming a claim. When a receipt is provided, its normalized form is
 * used as the deterministic payment/income key, so recording the same receipt twice is
 * a benign idempotent retry rather than an accidental double credit.
 */
export async function confirmDirectManualPayment(input: DirectManualPaymentInput): Promise<DirectManualPaymentOutcome> {
  if (!canVerifyPaymentClaims(input.verifierRoleKey)) {
    throw new ClaimFlowError("UNAUTHORIZED", 403, "NOT_AUTHORIZED_TO_RECORD_PAYMENT",
      "Access denied: only Treasurer, Chairperson, or Vice Chairperson can record a manual payment.");
  }

  const amountResult = validateManualAmount(input.amount, "Payment amount");
  if (!amountResult.ok) {
    throw new ClaimFlowError("VALIDATION", 400, "INVALID_AMOUNT", amountResult.error);
  }
  const amount = amountResult.value;
  const normalizedCode = normalizeTransactionCode(input.transactionCode || "");

  const paymentId = paymentIdForDirect(normalizedCode, input.renewalId);
  const incomeId = incomeIdForDirect(paymentId);
  const renewalRef = db.collection("contract_renewals").doc(input.renewalId);

  // Fast duplicate pre-check. A receipt already reserved for THIS renewal is a benign
  // idempotent retry (browser/network retry, double-click) — never an error. A receipt
  // reserved for a DIFFERENT renewal (or used elsewhere) is a real conflict.
  if (normalizedCode) {
    const guardSnap = await db.collection("transaction_codes").doc(transactionCodeDocId(normalizedCode)).get();
    if (guardSnap.exists) {
      const g = guardSnap.data() as any;
      if (String(g?.renewalId ?? "") === String(input.renewalId)) {
        return { status: "alreadyProcessed", renewalId: input.renewalId, paymentId, incomeId };
      }
      throw new ClaimFlowError("CONFLICT", 409, "DUPLICATE_TRANSACTION_CODE",
        `The M-Pesa transaction code "${normalizedCode}" has already been used on another renewal and cannot be recorded again.`);
    }
    const existingUse = await findExistingTransactionCodeUsage(normalizedCode, db, input.renewalId);
    if (existingUse) {
      throw new ClaimFlowError("CONFLICT", 409, "DUPLICATE_TRANSACTION_CODE",
        `The M-Pesa transaction code "${normalizedCode}" has already been used (${existingUse.reason}) and cannot be recorded again.`);
    }
  }

  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(renewalRef);
    if (!snap.exists) {
      throw new ClaimFlowError("NOT_FOUND", 404, "RENEWAL_NOT_FOUND", "Contract renewal not found.");
    }
    const existing = snap.data() as any;

    const feeRequired = safeAmount(existing.feeRequired) || 500;
    const existingPayments: PaymentRecord[] = Array.isArray(existing.payments) ? existing.payments : [];
    const priorPaid = existingPayments.reduce((s: number, p: PaymentRecord) => s + safeAmount(p.amount), 0);
    const remainingBalance = feeRequired - priorPaid;
    if (remainingBalance >= 0 && amount > remainingBalance + 1) {
      throw new ClaimFlowError("VALIDATION", 400, "OVERPAYMENT_EXCEEDS_BALANCE",
        `This payment of KSh ${amount.toLocaleString()} exceeds the remaining balance of KSh ${Math.max(0, remainingBalance).toLocaleString()} on this renewal.`);
    }

    if (normalizedCode) {
      const guardDoc = transactionCodeDocId(normalizedCode);
      const guardSnap = await tx.get(db.collection("transaction_codes").doc(guardDoc));
      if (guardSnap.exists) {
        const g = guardSnap.data() as any;
        if (String(g?.renewalId ?? "") !== String(input.renewalId)) {
          throw new ClaimFlowError("CONFLICT", 409, "DUPLICATE_TRANSACTION_CODE",
            `The M-Pesa transaction code "${normalizedCode}" has already been used on another renewal and cannot be recorded again.`);
        }
        // Same receipt already reserved for this renewal — benign idempotent retry.
        return { status: "alreadyProcessed", renewalId: input.renewalId, paymentId, incomeId };
      }
      tx.set(db.collection("transaction_codes").doc(guardDoc), {
        normalizedCode,
        renewalId: input.renewalId,
        amount,
        reason: `reserved by manual payment recorded by ${input.recordedBy}`,
        createdAt: new Date().toISOString()
      });
    }

    const payment: PaymentRecord = {
      id: paymentId,
      amount,
      date: today(),
      method: "manual",
      transactionCode: normalizedCode || undefined,
      recordedBy: input.recordedBy
    };
    const newPayments = appendUniquePayment(existingPayments, payment);
    tx.set(renewalRef, { payments: newPayments, paymentStatus: (priorPaid + amount) >= feeRequired ? "paid" : "partially_paid" }, { merge: true });
    tx.set(db.collection("incomes").doc(incomeId), {
      id: incomeId,
      source: "membership_contribution",
      amount,
      date: today(),
      description: `Contract renewal fee (manual) — ${existing.userName || "member"}${normalizedCode ? ` — ${normalizedCode}` : ""}`,
      recordedBy: input.recordedBy,
      transactionCode: normalizedCode || undefined,
      renewalId: input.renewalId
    });
    return { status: "success", renewalId: input.renewalId, paymentId, incomeId };
  });
}

// ----------------- Atomic claim submission (member self-reports a payment) -------

export interface SubmitClaimInput {
  renewalId: string;
  amount?: any;
  transactionCode?: string;
  phone?: string;
  submitterUserId: string;
  submitterName: string;
}

export interface SubmitClaimOutcome {
  id: string;
  status: "pending";
}

/**
 * Member self-reports a till payment as a *claim* (does NOT count toward the fee until
 * an authorized verifier confirms it). Prevents the same member reporting against
 * someone else's renewal, submitting a receipt already used by another payment/claim,
 * submitting a duplicate pending claim, and recording invalid amount values.
 */
export async function submitManualClaim(input: SubmitClaimInput): Promise<SubmitClaimOutcome> {
  const amountResult = validateManualAmount(input.amount, "Payment amount");
  if (!amountResult.ok) {
    throw new ClaimFlowError("VALIDATION", 400, "INVALID_AMOUNT", amountResult.error);
  }
  const code = (input.transactionCode || "").toString().trim();
  if (!code) {
    throw new ClaimFlowError("VALIDATION", 400, "TRANSACTION_CODE_REQUIRED",
      "The M-Pesa transaction code (from your confirmation SMS) is required.");
  }
  const normalizedCode = normalizeTransactionCode(code);

  const renewalRef = db.collection("contract_renewals").doc(input.renewalId);
  const existingSnap = await renewalRef.get();
  if (!existingSnap.exists) {
    throw new ClaimFlowError("NOT_FOUND", 404, "RENEWAL_NOT_FOUND", "Contract renewal not found.");
  }
  const existing = existingSnap.data() as any;
  if (existing.userId !== input.submitterUserId) {
    throw new ClaimFlowError("UNAUTHORIZED", 403, "NOT_OWN_RENEWAL",
      "Access denied: you can only report a payment on your own contract renewal.");
  }

  // A member cannot hold two pending claims for the same receipt on the same renewal.
  const existingClaims: RenewalClaim[] = Array.isArray(existing.pendingManualClaims) ? existing.pendingManualClaims : [];
  for (const c of existingClaims) {
    if (c.status === "pending" && normalizeTransactionCode(c.transactionCode) === normalizedCode) {
      throw new ClaimFlowError("CONFLICT", 409, "DUPLICATE_PENDING_CLAIM",
        "You already have a pending claim with this transaction code. Please wait for it to be verified.");
    }
  }

  const existingUse = await findExistingTransactionCodeUsage(normalizedCode);
  if (existingUse) {
    throw new ClaimFlowError("CONFLICT", 409, "DUPLICATE_TRANSACTION_CODE",
      `The M-Pesa transaction code "${normalizedCode}" has already been used (${existingUse.reason}) and cannot be reported again.`);
  }

  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(renewalRef);
    if (!snap.exists) {
      throw new ClaimFlowError("NOT_FOUND", 404, "RENEWAL_NOT_FOUND", "Contract renewal not found.");
    }
    const current = snap.data() as any;
    if (current.userId !== input.submitterUserId) {
      throw new ClaimFlowError("UNAUTHORIZED", 403, "NOT_OWN_RENEWAL",
        "Access denied: you can only report a payment on your own contract renewal.");
    }
    const claims: RenewalClaim[] = Array.isArray(current.pendingManualClaims) ? current.pendingManualClaims : [];
    for (const c of claims) {
      if (c.status === "pending" && normalizeTransactionCode(c.transactionCode) === normalizedCode) {
        throw new ClaimFlowError("CONFLICT", 409, "DUPLICATE_PENDING_CLAIM",
          "You already have a pending claim with this transaction code. Please wait for it to be verified.");
      }
    }
    const claimId = `claim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const claim: RenewalClaim = {
      id: claimId,
      amount: amountResult.value,
      transactionCode: code,
      phone: input.phone || undefined,
      claimedDate: today(),
      status: "pending"
    };
    tx.set(renewalRef, { pendingManualClaims: [...claims, claim] }, { merge: true });
    return { id: claimId, status: "pending" };
  });
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}