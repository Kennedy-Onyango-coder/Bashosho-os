// equipmentWorkflow.ts
// =============================================================================
// BASHOSHO EQUIPMENT HIRING - server-authoritative workflow logic
// =============================================================================
// The organization owns production equipment. ACTIVE MEMBERS get a significant,
// server-computed discount. This module is the ONLY authority for:
//   - "is this person an active member?"  (derived from the authoritative profile)
//   - the price charged (member vs standard), snapshot onto the hire record
//   - availability (overlapping approved/checked-out hires)
//   - the hire lifecycle (request -> approve/reject -> checkout -> return)
// The browser may request an action; the server decides whether it is valid.
// Pricing/membership are NEVER trusted from the client.
//
// Pure helpers (top section) are unit-tested in scripts/test-equipment-workflow.ts.
// The db-backed service functions are driven by the API endpoints and the same tests.
// Greenfield collection; the existing `assets` hire flow stays untouched.
// =============================================================================

import { db } from "./server-firebase";
import { HireEquipmentItem, EquipmentHire, EquipmentAuditEvent, EquipmentPricingUnit, EquipmentChangeEvent } from "./src/types";

// --------------------------- Membership -------------------------------------

export type ActiveMembershipResult = { active: boolean; label: "active" | "inactive" | "non_member" };

/**
 * Single authoritative rule for "is this person an active member?".
 * Derived from the EXISTING profile model (isActive + status + contract-lock) - we do
 * NOT invent a second membership field. A contract-locked / inactive / non-Active user
 * is not eligible for the member rate; a person with no usable profile is not either.
 */
export function resolveActiveMembership(profile?: {
  isActive?: boolean;
  status?: string;
  contractLocked?: boolean;
}): ActiveMembershipResult {
  if (!profile) return { active: false, label: "non_member" };
  const isActive = profile.isActive === true;
  const statusOk = String(profile.status || "").toLowerCase() === "active";
  const locked = profile.contractLocked === true;
  if (isActive && statusOk && !locked) return { active: true, label: "active" };
  if (isActive || statusOk) return { active: false, label: "inactive" };
  return { active: false, label: "non_member" };
}

// --------------------------- Pricing ----------------------------------------

export interface EquipmentPricingInput {
  normalHireRate?: number;
  memberHireRate?: number;
}

export interface EquipmentPricingResult {
  chargedRate: number;
  normalRate: number;
  memberRate?: number;
  pricingReason: "MEMBER_RATE" | "STANDARD_RATE";
}

/** Default discount applied to "other" equipment with no equipment-specific member rate. */
export const DEFAULT_MEMBER_DISCOUNT_RATIO = 0.5;

/**
 * The authoritative price *this* caller would be charged, computed SERVER-SIDE.
 *  - active member & equipment has a memberHireRate (>0)  -> that equipment-specific rate
 *  - active member & no configured member rate           -> 50% of normal (default rule)
 *  - non-member                                           -> the normal published rate
 * The reason is returned explicitly so the hire record can explain how the amount arose.
 */
export function computeEquipmentPricing(
  item: EquipmentPricingInput,
  isActiveMember: boolean
): EquipmentPricingResult {
  const normalRate = Number(item.normalHireRate) || 0;
  if (!isActiveMember) {
    return { chargedRate: normalRate, normalRate, pricingReason: "STANDARD_RATE" };
  }
  const configured = Number(item.memberHireRate);
  if (Number.isFinite(configured) && configured > 0) {
    return {
      chargedRate: configured,
      normalRate,
      memberRate: configured,
      pricingReason: "MEMBER_RATE"
    };
  }
  // Default member rule: 50% of the normal published rate.
  const discounted = Math.round(normalRate * DEFAULT_MEMBER_DISCOUNT_RATIO);
  return { chargedRate: discounted, normalRate, memberRate: discounted, pricingReason: "MEMBER_RATE" };
}

export interface EquipmentHireInput {
  startDate: string;
  endDate: string;
  pricingUnit: EquipmentPricingUnit;
}

/** Inclusive unit count between two ISO dates (>=1), computed server-side. */
export function computeHireUnits(startDate?: string, endDate?: string, unit: EquipmentPricingUnit = "daily"): number {
  if (!startDate || !endDate) return 0;
  const s = new Date(startDate + "T00:00:00Z").getTime();
  const e = new Date(endDate + "T00:00:00Z").getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  const days = Math.floor((e - s) / 86400000) + 1;
  return days;
}

// --------------------------- Permanent reference ----------------------------

export function formatEquipmentReference(year: number, sequence: number): string {
  return `EQ-${year}-${String(sequence).padStart(5, "0")}`;
}

// --------------------------- Validation -------------------------------------

export interface EquipmentValidationResult {
  ok: boolean;
  error?: string;
  units?: number;
}

export function validateHireRequest(input: EquipmentHireInput): EquipmentValidationResult {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!input.startDate || !input.endDate) {
    return { ok: false, error: "Start and end dates are both required." };
  }
  if (!dateRe.test(input.startDate) || !dateRe.test(input.endDate)) {
    return { ok: false, error: "Dates must be in YYYY-MM-DD format." };
  }
  const units = computeHireUnits(input.startDate, input.endDate, input.pricingUnit);
  if (!(units > 0)) {
    return { ok: false, error: "The end date must be on or after the start date." };
  }
  if (units > 365) {
    return { ok: false, error: "A single hire cannot exceed 365 days." };
  }
  return { ok: true, units };
}
// --------------------------- Availability -----------------------------------

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Statuses that occupy the physical equipment (block availability). */
export const BOOKED_HIRE_STATUSES: ReadonlySet<string> = new Set(["approved", "checked_out", "overdue"]);

// --------------------------- Errors -----------------------------------------

export class EquipmentServiceError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isEquipmentError(err: any): boolean {
  return err instanceof EquipmentServiceError;
}

export function toSafeEquipmentError(err: any): { status: number; code: string; error: string } {
  if (err instanceof EquipmentServiceError) {
    return { status: err.status, code: err.code, error: err.message };
  }
  return { status: 500, code: "EQUIPMENT_INTERNAL_ERROR", error: "Something went wrong processing this request." };
}

export function sendEquipmentError(res: any, err: any): void {
  const safe = toSafeEquipmentError(err);
  res.status(safe.status).json({ error: safe.error, code: safe.code });
}

// --------------------------- Audit helpers ----------------------------------

export function equipmentAudit(type: EquipmentAuditEvent["type"], actor: { id: string; name: string }, note?: string): EquipmentAuditEvent {
  return { id: `eqau-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`, type, at: new Date().toISOString(), byId: actor.id, byName: actor.name, note };
}

export function equipmentChangeEvent(type: EquipmentChangeEvent["type"], field: string, oldValue: any, newValue: any, actor: { id: string; name: string }): EquipmentChangeEvent {
  return { id: `eqch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`, type, field, oldValue, newValue, byId: actor.id, byName: actor.name, at: new Date().toISOString() };
}

// --------------------------- Service functions ------------------------------

export interface EquipmentServiceContext {
  actor: { id: string; name: string };
}

/**
 * Create a NEW equipment hire request. Everything authoritative is computed here:
 *   - equipment must exist and be active
 *   - dates validated
 *   - membership resolved from the (server-loaded) profile, NOT the client
 *   - price computed server-side and SNAPSHOTTED with its reason
 *   - availability checked against committed approved/checked-out hires
 * The reference and id are generated server-side. Status starts "requested".
 */
export async function createEquipmentHire(
  equipmentId: string,
  requester: { id: string; name: string },
  activeMembership: ActiveMembershipResult,
  input: EquipmentHireInput,
  purpose?: string
): Promise<EquipmentHire> {
  const equipmentRef = db.collection("equipment").doc(equipmentId);
  const equipmentSnap = await equipmentRef.get();
  if (!equipmentSnap.exists) {
    throw new EquipmentServiceError(404, "EQUIPMENT_NOT_FOUND", "This equipment item could not be found.");
  }
  const equipment = equipmentSnap.data() as HireEquipmentItem;
  if (equipment.status !== "active" || equipment.active === false) {
    throw new EquipmentServiceError(409, "EQUIPMENT_UNAVAILABLE", "This equipment item is not currently available for hire.");
  }

  const validation = validateHireRequest(input);
  if (!validation.ok) {
    throw new EquipmentServiceError(400, "EQUIPMENT_INVALID_REQUEST", validation.error || "Invalid hire request.");
  }
  const units = validation.units || 1;

  await assertEquipmentAvailable(equipmentId, input.startDate, input.endDate, undefined);

  const pricing = computeEquipmentPricing(equipment, activeMembership.active);
  const reference = await allocateEquipmentReference();
  const hireId = `eqhire-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowISO = new Date().toISOString();
  const hire: EquipmentHire = {
    id: hireId,
    reference,
    equipmentId,
    equipmentNameSnapshot: equipment.name,
    equipmentSerialSnapshot: equipment.serialNumber,
    requesterId: requester.id,
    requesterNameSnapshot: requester.name,
    membershipStatusAtRequest: activeMembership.label,
    normalRate: pricing.normalRate,
    memberRate: pricing.memberRate,
    chargedRate: pricing.chargedRate,
    pricingReason: pricing.pricingReason,
    pricingUnit: equipment.pricingUnit || input.pricingUnit,
    startDate: input.startDate,
    endDate: input.endDate,
    numberOfUnits: units,
    totalAmount: Math.round(pricing.chargedRate * units),
    depositAmount: equipment.depositRequired ? (equipment.depositAmount || 0) : undefined,
    status: "requested",
    purpose: purpose?.trim(),
    createdAt: nowISO,
    updatedAt: nowISO,
    auditTrail: [equipmentAudit("EQUIPMENT_HIRE_REQUESTED", requester)]
  };
  await db.collection("equipment_hires").doc(hireId).set(hire);
  return hire;
}

async function allocateEquipmentReference(): Promise<string> {
  const year = new Date().getFullYear();
  const snap = await db.collection("equipment_hires").get();
  let maxSeq = 0;
  for (const doc of snap.docs) {
    const m = (doc.data() as EquipmentHire).reference?.match(/^EQ-(\d{4})-(\d{5})$/);
    if (m) maxSeq = Math.max(maxSeq, Number(m[2]));
  }
  return formatEquipmentReference(year, maxSeq + 1);
}

/**
 * Overlap check against committed approved/checked-out/overdue hires for the same item.
 * `excludeHireId` lets an approval ignore the hire being decided itself.
 * Runs against the live collection (committed state) and is the authoritative gate.
 */
export async function assertEquipmentAvailable(
  equipmentId: string,
  startDate: string,
  endDate: string,
  excludeHireId?: string
): Promise<void> {
  const snap = await db.collection("equipment_hires").get();
  for (const doc of snap.docs) {
    const h = doc.data() as EquipmentHire;
    if (h.id === excludeHireId) continue;
    if (String(h.equipmentId) !== String(equipmentId)) continue;
    if (!BOOKED_HIRE_STATUSES.has(h.status)) continue;
    if (rangesOverlap(String(h.startDate), String(h.endDate), startDate, endDate)) {
      throw new EquipmentServiceError(
        409,
        "EQUIPMENT_OVERLAP",
        `This equipment is already reserved during ${h.startDate} to ${h.endDate} (${h.reference}).`
      );
    }
  }
}

export interface EquipmentDecisionInput extends EquipmentServiceContext {
  hireId: string;
  decision: "approve" | "reject";
  reason?: string;
  actorCanApprove: boolean;
}

export interface EquipmentDecisionOutcome {
  status: "success" | "alreadyDecided";
  hire: EquipmentHire;
}

/**
 * Authoritative approve/reject. Concurrency-safe: the hire''s current status is read
 * INSIDE a transaction, so only one valid decision can win. A second actor gets
 * `alreadyDecided`. Approval also re-checks availability so two different hires for
 * the same item can''t both be approved for overlapping dates.
 */
export async function decideEquipmentHire(input: EquipmentDecisionInput): Promise<EquipmentDecisionOutcome> {
  if (input.decision !== "approve" && input.decision !== "reject") {
    throw new EquipmentServiceError(400, "EQUIPMENT_INVALID_DECISION", "Decision must be ''approve'' or ''reject''.");
  }
  if (!input.actorCanApprove) {
    throw new EquipmentServiceError(403, "EQUIPMENT_NOT_AUTHORIZED", "You are not authorized to approve or reject equipment hires.");
  }
  if (input.decision === "reject" && !String(input.reason || "").trim()) {
    throw new EquipmentServiceError(400, "EQUIPMENT_REJECTION_REASON_REQUIRED", "A reason is required when rejecting a hire.");
  }

  const hireRef = db.collection("equipment_hires").doc(input.hireId);

  if (input.decision === "approve") {
    const pre = (await hireRef.get()).data() as EquipmentHire | undefined;
    if (pre && pre.equipmentId) {
      await assertEquipmentAvailable(pre.equipmentId, pre.startDate, pre.endDate, pre.id);
    }
  }

  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(hireRef);
    if (!snap.exists) {
      throw new EquipmentServiceError(404, "EQUIPMENT_HIRE_NOT_FOUND", "This hire request could not be found.");
    }
    const hire = snap.data() as EquipmentHire;
    const closed = ["approved", "checked_out", "rejected", "cancelled", "returned"];
    if (closed.includes(hire.status)) {
      return { status: "alreadyDecided", hire };
    }
    const nowISO = new Date().toISOString();
    const audit = [...(hire.auditTrail || [])];
    const updated: EquipmentHire = { ...hire, updatedAt: nowISO, auditTrail: audit };
    if (input.decision === "approve") {
      updated.status = "approved";
      updated.approvedById = input.actor.id;
      updated.approvedByName = input.actor.name;
      updated.approvedAt = nowISO;
      updated.auditTrail = [...audit, equipmentAudit("EQUIPMENT_HIRE_APPROVED", input.actor)];
    } else {
      updated.status = "rejected";
      updated.rejectionReason = input.reason?.trim();
      updated.rejectedById = input.actor.id;
      updated.rejectedAt = nowISO;
      updated.auditTrail = [...audit, equipmentAudit("EQUIPMENT_HIRE_REJECTED", input.actor, input.reason?.trim())];
    }
    tx.set(hireRef, updated, { merge: true });
    return { status: "success", hire: updated };
  });
}

export async function checkoutEquipmentHire(input: EquipmentServiceContext & { hireId: string; actorCanOperate: boolean }): Promise<EquipmentHire> {
  if (!input.actorCanOperate) {
    throw new EquipmentServiceError(403, "EQUIPMENT_NOT_AUTHORIZED", "You are not authorized to check out equipment.");
  }
  const hireRef = db.collection("equipment_hires").doc(input.hireId);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(hireRef);
    if (!snap.exists) throw new EquipmentServiceError(404, "EQUIPMENT_HIRE_NOT_FOUND", "This hire request could not be found.");
    const hire = snap.data() as EquipmentHire;
    if (hire.status !== "approved") {
      throw new EquipmentServiceError(409, "EQUIPMENT_NOT_APPROVED", "Equipment can only be checked out once the hire is approved.");
    }
    if (hire.checkedOutAt) return hire;
    const nowISO = new Date().toISOString();
    const updated: EquipmentHire = {
      ...hire,
      status: "checked_out",
      checkedOutAt: nowISO,
      checkedOutById: input.actor.id,
      updatedAt: nowISO,
      auditTrail: [...(hire.auditTrail || []), equipmentAudit("EQUIPMENT_CHECKED_OUT", input.actor)]
    };
    tx.set(hireRef, updated, { merge: true });
    return updated;
  });
}

export async function returnEquipmentHire(input: EquipmentServiceContext & { hireId: string; actorCanOperate: boolean; condition?: string }): Promise<EquipmentHire> {
  if (!input.actorCanOperate) {
    throw new EquipmentServiceError(403, "EQUIPMENT_NOT_AUTHORIZED", "You are not authorized to record equipment returns.");
  }
  const hireRef = db.collection("equipment_hires").doc(input.hireId);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(hireRef);
    if (!snap.exists) throw new EquipmentServiceError(404, "EQUIPMENT_HIRE_NOT_FOUND", "This hire request could not be found.");
    const hire = snap.data() as EquipmentHire;
    if (hire.status !== "checked_out") {
      throw new EquipmentServiceError(409, "EQUIPMENT_NOT_CHECKED_OUT", "Only equipment that has been checked out can be returned.");
    }
    if (hire.returnedAt) return hire;
    const nowISO = new Date().toISOString();
    const updated: EquipmentHire = {
      ...hire,
      status: "returned",
      returnedAt: nowISO,
      returnedById: input.actor.id,
      returnCondition: input.condition?.trim() || hire.returnCondition,
      updatedAt: nowISO,
      auditTrail: [...(hire.auditTrail || []), equipmentAudit("EQUIPMENT_RETURNED", input.actor, input.condition?.trim())]
    };
    tx.set(hireRef, updated, { merge: true });
    return updated;
  });
}

export async function cancelEquipmentHire(input: EquipmentServiceContext & { hireId: string; actorIsOwnerOrAdmin: boolean }): Promise<EquipmentHire> {
  const hireRef = db.collection("equipment_hires").doc(input.hireId);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(hireRef);
    if (!snap.exists) throw new EquipmentServiceError(404, "EQUIPMENT_HIRE_NOT_FOUND", "This hire request could not be found.");
    const hire = snap.data() as EquipmentHire;
    const isOwner = hire.requesterId === input.actor.id;
    if (!isOwner && !input.actorIsOwnerOrAdmin) {
      throw new EquipmentServiceError(403, "EQUIPMENT_NOT_AUTHORIZED", "You can only cancel your own hire request.");
    }
    if (["rejected", "cancelled", "returned"].includes(hire.status)) {
      throw new EquipmentServiceError(409, "EQUIPMENT_ALREADY_CLOSED", `This hire is already ${hire.status} and cannot be cancelled.`);
    }
    if (hire.status === "checked_out") {
      throw new EquipmentServiceError(409, "EQUIPMENT_CHECKED_OUT", "The equipment is currently checked out - record its return before closing this hire.");
    }
    const nowISO = new Date().toISOString();
    const updated: EquipmentHire = {
      ...hire,
      status: "cancelled",
      cancelledBy: input.actor.name,
      cancelReason: "Cancelled",
      cancelledAt: nowISO,
      updatedAt: nowISO,
      auditTrail: [...(hire.auditTrail || []), equipmentAudit("EQUIPMENT_HIRE_CANCELLED", input.actor)]
    };
    tx.set(hireRef, updated, { merge: true });
    return updated;
  });
}

export async function updateEquipmentRecord(
  equipmentId: string,
  actor: { id: string; name: string },
  patch: Partial<HireEquipmentItem>
): Promise<HireEquipmentItem> {
  const ref = db.collection("equipment").doc(equipmentId);
  const snap = await ref.get();
  if (!snap.exists) throw new EquipmentServiceError(404, "EQUIPMENT_NOT_FOUND", "This equipment item could not be found.");
  const existing = { ...(snap.data() as HireEquipmentItem) };
  const history = [...(existing.changeHistory || [])];
  const candidate = { ...existing, ...patch, id: existing.id, active: true };

  for (const f of ["normalHireRate", "memberHireRate", "depositAmount"] as const) {
    const v = candidate[f];
    if (v !== undefined) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        throw new EquipmentServiceError(400, "EQUIPMENT_INVALID_RATE", `''${f}'' must be a finite non-negative number.`);
      }
    }
  }

  if (Number(candidate.normalHireRate) !== Number(existing.normalHireRate)) {
    history.push(equipmentChangeEvent("EQUIPMENT_RATE_CHANGED", "normalHireRate", existing.normalHireRate, candidate.normalHireRate, actor));
  }
  if (Number(candidate.memberHireRate ?? 0) !== Number(existing.memberHireRate ?? 0)) {
    history.push(equipmentChangeEvent("EQUIPMENT_RATE_CHANGED", "memberHireRate", existing.memberHireRate, candidate.memberHireRate, actor));
  }
  if (candidate.condition !== existing.condition) {
    history.push(equipmentChangeEvent("EQUIPMENT_CONDITION_UPDATED", "condition", existing.condition, candidate.condition, actor));
  }

  const nowISO = new Date().toISOString();
  const saved: HireEquipmentItem = { ...candidate, changeHistory: history, updatedAt: nowISO };
  await ref.set(saved, { merge: true });
  return saved;
}
