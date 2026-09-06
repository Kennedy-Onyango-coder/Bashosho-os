// Regression tests for Bashosho leave management workflow.
// Run with: npx tsx scripts/test-leave-workflow.ts

process.env.FORCE_MOCK_FIRESTORE = "true";
process.env.NODE_ENV = "test";
process.env.SAFEGUARDING_SECRET = "test-safeguarding-secret";
process.env.VERIFICATION_SECRET = "test-verification-secret";
process.env.JWT_SECRET = "test-jwt-secret";

import fs from "fs";
import path from "path";
import type { LeaveWorkflowRecord } from "../leaveWorkflow";

const dbFile = path.join(process.cwd(), "local-firestore.json");
const hadDbFile = fs.existsSync(dbFile);
const backup = hadDbFile ? fs.readFileSync(dbFile, "utf8") : null;
if (hadDbFile) fs.rmSync(dbFile, { force: true });

let passed = 0;
let failed = 0;
function check(cond: boolean, label: string, extra?: string): void {
  if (cond) { passed++; console.log(`  PASS ${label}`); }
  else { failed++; console.error(`  FAIL ${label}${extra ? ` - ${extra}` : ""}`); }
}
function expectError(err: any, code: string, label: string): void {
  check(err && err.code === code, label, err ? `${err.code}: ${err.message}` : "no error thrown");
}

const { db, MockFirestore } = await import("../server-firebase");
const {
  submitLeaveRequest, decideLeaveRequest, cancelLeaveRequest,
  confirmLeaveReturn, runLeaveAutomationTick, reconcileLeaveRegister,
  backfillLegacyLeaveRequests, computeLeaveBalance, toSafeLeaveError,
  isActionable, isOpenLeave, normalizeLegacyStatus, buildTimeline, statusDisplay,
  computeLeaveDays, DEFAULT_LEAVE_AUTOMATION,
  validateLeaveInput, formatLeaveReference, resolveApprover,
  LeaveServiceError
} = await import("../leaveWorkflow");

function resetDb(): void {
  if (fs.existsSync(dbFile)) fs.rmSync(dbFile, { force: true });
  db.setActiveDb(new MockFirestore(), true);
}

const profiles = [
  { id: "user-1", name: "Michael", roleKey: "member" },
  { id: "chair-1", name: "Chairperson", roleKey: "chairperson" },
  { id: "vice-1", name: "Vice Chairperson", roleKey: "vice_chairperson" },
  { id: "prog-1", name: "Programs Director", roleKey: "programs_director" }
];

async function seedProfiles(): Promise<void> {
  for (const p of profiles) await db.collection("profiles").doc(p.id).set(p);
}

async function seedLeaveRequest(overrides: Partial<LeaveWorkflowRecord> = {}): Promise<string> {
  const id = overrides.id || `leave-${Date.now()}`;
  const record: LeaveWorkflowRecord = {
    id, userId: "user-1", userName: "Michael",
    startDate: "2026-09-20", endDate: "2026-09-27",
    reason: "Annual leave", leaveType: "annual",
    status: "submitted", submittedAt: new Date().toISOString(),
    approverId: "chair-1", approverName: "Chairperson",
    reference: "LV-2026-00001", days: 8, auditTrail: [],
    ...overrides
  };
  await db.collection("leave_requests").doc(id).set(record);
  return id;
}

async function testReferenceGeneration(): Promise<void> {
  console.log("\n--- Permanent Reference Generation ---");
  check(formatLeaveReference(2026, 1) === "LV-2026-00001", "formats reference correctly");
  check(formatLeaveReference(2026, 100) === "LV-2026-00100", "pads sequence to 5 digits");
  check(formatLeaveReference(2027, 99999) === "LV-2027-99999", "handles max sequence");
}

async function testValidation(): Promise<void> {
  console.log("\n--- Input Validation ---");
  const valid = validateLeaveInput({ startDate: "2026-09-20", endDate: "2026-09-27", reason: "Annual leave" });
  check(valid.ok === true, "valid input passes");
  check(valid.days === 8, "computes correct day count");
  const missingDates = validateLeaveInput({ startDate: "", endDate: "", reason: "test" });
  check(missingDates.ok === false, "missing dates rejected");
  const inverted = validateLeaveInput({ startDate: "2026-09-27", endDate: "2026-09-20", reason: "test" });
  check(inverted.ok === false, "inverted dates rejected");
  const noReason = validateLeaveInput({ startDate: "2026-09-20", endDate: "2026-09-27", reason: "" });
  check(noReason.ok === false, "missing reason rejected");
  const tooLong = validateLeaveInput({ startDate: "2026-09-20", endDate: "2026-09-27", reason: "x".repeat(2001) });
  check(tooLong.ok === false, "reason too long rejected");
}

async function testApproverRouting(): Promise<void> {
  console.log("\n--- Approver Routing ---");
  const memberRoute = resolveApprover({ id: "user-1", roleKey: "member" }, profiles);
  check(memberRoute?.approverId === "prog-1", "member routed to Programs Director");
  const chairRoute = resolveApprover({ id: "chair-1", roleKey: "chairperson" }, profiles);
  check(chairRoute?.approverId === "vice-1", "chairperson routed to Vice Chairperson");
  const overrideRoute = resolveApprover({ id: "user-1", roleKey: "member", leaveApproverId: "vice-1" }, profiles);
  check(overrideRoute?.approverId === "vice-1", "profile override takes precedence");
}

async function testRequestSubmission(): Promise<void> {
  console.log("\n--- Request Submission ---");
  resetDb();
  await seedProfiles();
  const result = await submitLeaveRequest({
    userId: "user-1", userName: "Michael",
    startDate: "2026-09-20", endDate: "2026-09-27",
    reason: "Annual leave", leaveType: "annual", profiles
  });
  check(!!result.reference, "reference generated on submission");
  check(result.reference?.startsWith("LV-"), "reference has LV- prefix");
  check(result.status === "submitted", "status is submitted");
  check(result.approverId === "prog-1", "approver resolved");
  // Full record (with days/submittedAt/auditTrail) lives in the database, not the summary outcome
  const snap = await db.collection("leave_requests").doc(result.id).get();
  const data = snap.data() as LeaveWorkflowRecord;
  if ((data.auditTrail?.length || 0) !== 1) {
    console.log("  DEBUG auditTrail:", JSON.stringify(data.auditTrail));
  }
  check(data.days === 8, "days computed correctly");
  check(!!data.submittedAt, "submission timestamp recorded");
  check((data.auditTrail?.length || 0) >= 1, "audit trail has submission event");
  check(snap.exists, "request persisted to Firestore");
}

async function testApprovalPersistence(): Promise<void> {
  console.log("\n--- Approval Persistence ---");
  resetDb();
  await seedProfiles();
  const id = await seedLeaveRequest();
  const outcome = await decideLeaveRequest({
    requestId: id, decision: "approve",
    actor: { id: "chair-1", name: "Chairperson" },
    actorIsChairperson: true, actorRoleKey: "chairperson"
  });
  check(outcome.status === "success", "decision succeeded");
  check(outcome.request.status === "approved", "status changed to approved");
  check(outcome.request.decisionDate !== undefined, "decision timestamp recorded");
  check(outcome.request.respondedBy === "Chairperson", "decision actor recorded");
  check(outcome.request.auditTrail?.some(e => e.type === "APPROVED"), "approval in audit trail");
  const snap = await db.collection("leave_requests").doc(id).get();
  const data = snap.data() as LeaveWorkflowRecord;
  check(data.status === "approved", "approval persisted to Firestore");
}

async function testSelfApprovalBlocked(): Promise<void> {
  console.log("\n--- Self-Approval Prevention ---");
  resetDb();
  await seedProfiles();
  const ownId = await seedLeaveRequest({ id: "leave-self", userId: "chair-1", userName: "Chairperson", approverId: "vice-1", approverName: "Vice Chairperson" });
  let err: any;
  try {
    await decideLeaveRequest({
      requestId: ownId, decision: "approve",
      actor: { id: "chair-1", name: "Chairperson" },
      actorIsChairperson: true, actorRoleKey: "chairperson"
    });
  } catch (e) { err = e; }
  expectError(err, "LEAVE_SELF_APPROVAL_BLOCKED", "self-approval blocked server-side");
  const snap = await db.collection("leave_requests").doc(ownId).get();
  check((snap.data() as LeaveWorkflowRecord).status === "submitted", "status unchanged after blocked self-approval");
}

async function testRejectionRequiresReason(): Promise<void> {
  console.log("\n--- Rejection Requires Reason ---");
  resetDb();
  await seedProfiles();
  const id = await seedLeaveRequest();
  let err: any;
  try {
    await decideLeaveRequest({
      requestId: id, decision: "reject", reason: "",
      actor: { id: "chair-1", name: "Chairperson" },
      actorIsChairperson: true, actorRoleKey: "chairperson"
    });
  } catch (e) { err = e; }
  expectError(err, "LEAVE_REJECTION_REASON_REQUIRED", "rejection without reason blocked");
}

async function testConcurrentDecision(): Promise<void> {
  console.log("\n--- Concurrent Decision Handling ---");
  resetDb();
  await seedProfiles();
  // Seed with approver = Programs Director; chairperson can also override
  const id = await seedLeaveRequest({ approverId: "prog-1", approverName: "Programs Director" });
  const r1 = await decideLeaveRequest({
    requestId: id, decision: "approve",
    actor: { id: "prog-1", name: "Programs Director" },
    actorIsChairperson: false, actorRoleKey: "programs_director"
  });
  check(r1.status === "success", "first decision (approve) succeeds");
  // Second actor (chairperson override) attempts to reject — should see alreadyDecided
  const r2 = await decideLeaveRequest({
    requestId: id, decision: "reject", reason: "Too late",
    actor: { id: "chair-1", name: "Chairperson" },
    actorIsChairperson: true, actorRoleKey: "chairperson"
  });
  check(r2.status === "alreadyDecided", "second decision returns alreadyDecided");
  check(r2.request.status === "approved", "first decision preserved");
}

async function testCancellation(): Promise<void> {
  console.log("\n--- Cancellation ---");
  resetDb();
  await seedProfiles();
  const id = await seedLeaveRequest();
  const result = await cancelLeaveRequest(id, { id: "user-1", name: "Michael" }, "Change of plans", false);
  check(result.status === "cancelled", "status changed to cancelled");
  check(result.cancelledById === "user-1", "cancelled by recorded");
  const snap = await db.collection("leave_requests").doc(id).get();
  check(snap.exists, "cancelled request still exists (not deleted)");
}


async function testReturnConfirmation(): Promise<void> {
  console.log("\n--- Return Confirmation ---");
  resetDb();
  await seedProfiles();
  const id = await seedLeaveRequest({ status: "on_leave" });
  const result = await confirmLeaveReturn(id, { id: "user-1", name: "Michael" }, false);
  check(!!result.returnConfirmedAt, "return confirmed timestamp recorded");
  const snap = await db.collection("leave_requests").doc(id).get();
  check(!!(snap.data() as LeaveWorkflowRecord).returnConfirmedAt, "return confirmation persisted");
}

async function testAutomationTick(): Promise<void> {
  console.log("\n--- Automation Tick ---");
  resetDb();
  await seedProfiles();
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  await seedLeaveRequest({ status: "approved", startDate: today, endDate: tomorrow });
  const result = await runLeaveAutomationTick();
  check(result.requestsScanned >= 1, "scanned at least one request");
  check(result.transitions >= 1, "transitioned at least one request to on_leave");
  const result2 = await runLeaveAutomationTick();
  check(result2.transitions === 0, "second run is idempotent (no duplicate transitions)");
}

async function testReconciliation(): Promise<void> {
  console.log("\n--- Reconciliation ---");
  resetDb();
  await seedProfiles();
  await db.collection("leave_requests").doc("leave-legacy").set({
    id: "leave-legacy", userId: "user-1", userName: "Michael",
    startDate: "2026-09-20", endDate: "2026-09-27", reason: "Legacy", status: "pending"
  });
  const result = await reconcileLeaveRegister();
  check(result.scanned >= 1, "scanned records");
  check(result.problems.length >= 1, "detected problems in legacy record");
}

async function testBackfill(): Promise<void> {
  console.log("\n--- Backfill Legacy Records ---");
  resetDb();
  await seedProfiles();
  await db.collection("leave_requests").doc("leave-1234567890").set({
    id: "leave-1234567890", userId: "user-1", userName: "Michael",
    startDate: "2026-09-20", endDate: "2026-09-27", reason: "Legacy", status: "pending"
  });
  const result = await backfillLegacyLeaveRequests();
  check(result.referencesAssigned === 1, "reference assigned to legacy record");
  check(result.submissionDatesSet === 1, "submission date backfilled from id");
  check(result.approversAssigned === 1, "approver resolved for legacy record");
  const snap = await db.collection("leave_requests").doc("leave-1234567890").get();
  const data = snap.data() as LeaveWorkflowRecord;
  check(!!data.reference, "reference now present");
  check(!!data.approverId, "approverId now present");
}

async function testLeaveBalance(): Promise<void> {
  console.log("\n--- Leave Balance ---");
  resetDb();
  await seedProfiles();
  await seedLeaveRequest({ status: "approved", days: 5 });
  await seedLeaveRequest({ id: "leave-pending", status: "submitted", days: 3 });
  const balance = await computeLeaveBalance("user-1", 20);
  check(balance.configured === true, "balance configured with entitlement");
  check(balance.usedDays === 5, "used days counted from approved leave");
  check(balance.pendingDays === 3, "pending days counted from submitted leave");
  check(balance.remainingDays === 12, "remaining days correct (20-5-3)");
}

async function testSearchByReference(): Promise<void> {
  console.log("\n--- Search by Reference ---");
  resetDb();
  await seedProfiles();
  await seedLeaveRequest({ reference: "LV-2026-00042" });
  const snap = await db.collection("leave_requests").get();
  const found = snap.docs.find(d => (d.data() as LeaveWorkflowRecord).reference === "LV-2026-00042");
  check(!!found, "request found by reference");
}

async function testTimeline(): Promise<void> {
  console.log("\n--- Timeline ---");
  resetDb();
  await seedProfiles();
  const id = await seedLeaveRequest();
  const outcome = await decideLeaveRequest({
    requestId: id, decision: "approve",
    actor: { id: "chair-1", name: "Chairperson" },
    actorIsChairperson: true, actorRoleKey: "chairperson"
  });
  const timeline = buildTimeline(outcome.request);
  check(timeline.length >= 2, "timeline has multiple stages");
  check(timeline.some(s => s.key === "submitted"), "timeline includes submitted stage");
  check(timeline.some(s => s.key === "decision"), "timeline includes decision stage");
}

async function testStatusDisplay(): Promise<void> {
  console.log("\n--- Status Display ---");
  check(statusDisplay("submitted").label === "Pending", "submitted displays as Pending");
  check(statusDisplay("approved").label === "Approved — upcoming", "approved displays as Approved");
  check(statusDisplay("rejected").label === "Rejected", "rejected displays as Rejected");
  check(statusDisplay("on_leave").label === "On leave", "on_leave displays as On leave");
  check(statusDisplay("completed").label === "Completed", "completed displays as Completed");
}

async function testDecidedRequestNotActionable(): Promise<void> {
  console.log("\n--- Decided Request Not Actionable ---");
  resetDb();
  await seedProfiles();
  const id = await seedLeaveRequest();
  await decideLeaveRequest({
    requestId: id, decision: "approve",
    actor: { id: "chair-1", name: "Chairperson" },
    actorIsChairperson: true, actorRoleKey: "chairperson"
  });
  const snap = await db.collection("leave_requests").doc(id).get();
  const data = snap.data() as LeaveWorkflowRecord;
  check(!isActionable(data.status), "approved request is not actionable");
  check(isOpenLeave(data.status), "approved request is open leave");
}

async function main(): Promise<void> {
  console.log("=== BASHOSHO LEAVE WORKFLOW REGRESSION TESTS ===\n");
  await testReferenceGeneration();
  await testValidation();
  await testApproverRouting();
  await testRequestSubmission();
  await testApprovalPersistence();
  await testSelfApprovalBlocked();
  await testRejectionRequiresReason();
  await testConcurrentDecision();
  await testCancellation();
  await testReturnConfirmation();
  await testAutomationTick();
  await testReconciliation();
  await testBackfill();
  await testLeaveBalance();
  await testSearchByReference();
  await testTimeline();
  await testStatusDisplay();
  await testDecidedRequestNotActionable();

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (backup) fs.writeFileSync(dbFile, backup);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error("Test suite crashed:", err);
  if (backup) fs.writeFileSync(dbFile, backup);
  process.exit(1);
});