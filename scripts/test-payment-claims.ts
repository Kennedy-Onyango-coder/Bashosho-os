// Regression tests for Bashosho's payment-claim financial-integrity flow.
// Covers the previously buggy (non-atomic, non-idempotent, unguarded) path that
// produced "Failed to process payment claim":
//   1. claim submission (+ amount validation)
//   2. confirmation is atomic (claim + payment + income + receipt reservation)
//   3. confirmation is idempotent (double-click / retry never duplicates)
//   4. concurrent confirmation never double-counts
//   5. duplicate M-Pesa receipt protection (cross-renewal + guard doc)
//   6. overpayment / invalid-amount rejection
//   7. self-verification (segregation of duties) blocked
//   8. unknown action is never treated as confirm
//   9. partial-failure atomicity (a failing transaction leaves NO partial writes)
//  10. reject path writes no payment/income
//  11. direct manual payment endpoint (idempotent + duplicate-safe)
//
// These import the exact functions server.ts uses (paymentClaimFlow.ts) against a
// fresh in-memory mock Firestore. Run with: npx tsx scripts/test-payment-claims.ts
// No production data is touched, no credentials required.

// Ensure we never attempt a real Firestore connection during tests.
process.env.FORCE_MOCK_FIRESTORE = "true";
process.env.NODE_ENV = "test";
// server-firebase.ts requires these at module load; test-only dummy values.
process.env.SAFEGUARDING_SECRET = "test-safeguarding-secret";
process.env.VERIFICATION_SECRET = "test-verification-secret";
process.env.JWT_SECRET = "test-jwt-secret";

import fs from "fs";
import path from "path";

const dbFile = path.join(process.cwd(), "local-firestore.json");
const hadDbFile = fs.existsSync(dbFile);
const backup = hadDbFile ? fs.readFileSync(dbFile, "utf8") : null;
if (hadDbFile) fs.rmSync(dbFile, { force: true });

let passed = 0;
let failed = 0;
function check(cond: boolean, label: string, extra?: string): void {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
}
function expectError(err: any, code: string, label: string): void {
  check(err && err.code === code, label, err ? `${err.code}: ${err.message}` : "no error thrown");
}

const { db, MockFirestore } = await import("../server-firebase");
const {
  processClaimDecision,
  submitManualClaim,
  confirmDirectManualPayment,
  normalizeTransactionCode,
  isClaimFlowError
} = await import("../paymentClaimFlow");

// Fresh empty mock for isolation. The mock persists to local-firestore.json, so delete
// it first to guarantee each scenario starts from a truly empty store.
function resetDb(): void {
  if (fs.existsSync(dbFile)) fs.rmSync(dbFile, { force: true });
  db.setActiveDb(new MockFirestore(), true);
}

async function seedRenewal(opts: { id: string; userId: string; userName?: string; feeRequired?: number; payments?: any[]; claims?: any[] }): Promise<void> {
  await db.collection("contract_renewals").doc(opts.id).set({
    id: opts.id,
    userId: opts.userId,
    userName: opts.userName || "Member",
    role: "Program Member",
    feeRequired: opts.feeRequired || 500,
    payments: opts.payments || [],
    pendingManualClaims: opts.claims || [],
    status: "pending_review"
  }, { merge: true });
}

async function getRenewal(id: string): Promise<any> {
  const snap = await db.collection("contract_renewals").doc(id).get();
  return snap.exists ? snap.data() : null;
}
async function getIncome(id: string): Promise<any> {
  const snap = await db.collection("incomes").doc(id).get();
  return snap.exists ? snap.data() : null;
}
async function countIncomes(): Promise<number> {
  return (await db.collection("incomes").get()).size;
}

console.log("=== Normalization ===");
check(normalizeTransactionCode("UHRC2L1VL") === "UHRC2L1VL", "uppercase kept");
check(normalizeTransactionCode(" uhrc2l1vl ") === "UHRC2L1VL", "case + whitespace normalized");
check(normalizeTransactionCode("UHRC-2L1-VL") === "UHRC2L1VL", "dashes removed");

console.log("\n=== 1. Claim submission & amount validation ===");
{
  resetDb();
  await seedRenewal({ id: "r1", userId: "u-member", userName: "Amina" });
  const c = await submitManualClaim({ renewalId: "r1", amount: 500, transactionCode: "UHRC2L1VL", submitterUserId: "u-member", submitterName: "Amina" });
  check(c.status === "pending", "own renewal claim accepted");
  check(!isClaimFlowError(c), "submission returns an outcome, not an error");

  for (const bad of [0, -5, "abc", Number.NaN, Number.POSITIVE_INFINITY]) {
    try {
      await submitManualClaim({ renewalId: "r1", amount: bad, transactionCode: "X1", submitterUserId: "u-member", submitterName: "Amina" });
      check(false, `rejects invalid amount ${String(bad)}`);
    } catch (e) {
      check(isClaimFlowError(e) && e.code === "INVALID_AMOUNT", `rejects invalid amount ${String(bad)}`);
    }
  }
  try {
    await submitManualClaim({ renewalId: "r1", amount: 100, transactionCode: "X2", submitterUserId: "u-other", submitterName: "Bob" });
    check(false, "blocks claiming on another member's renewal");
  } catch (e) {
    expectError(e, "NOT_OWN_RENEWAL", "blocks claiming on another member's renewal");
  }
}

console.log("\n=== 2. Confirm is atomic: claim + exactly one payment + income + receipt reserved ===");
{
  resetDb();
  await seedRenewal({ id: "r1", userId: "u-member", userName: "Amina" });
  await submitManualClaim({ renewalId: "r1", amount: 500, transactionCode: "UHRC2L1VL", submitterUserId: "u-member", submitterName: "Amina" });
  const renewal = await getRenewal("r1");
  const claim = renewal.pendingManualClaims[0];

  const out = await processClaimDecision({ renewalId: "r1", claimId: claim.id, action: "confirm", verifierUserId: "u-treasurer", verifierName: "Treasurer", verifierRoleKey: "treasurer" });
  check(out.status === "success" && out.decision === "confirm", "confirmation reports success");
  check(out.incomeId === `income-manual-${claim.id}`, "income id is deterministic from the claim id");

  const after = await getRenewal("r1");
  check(after.pendingManualClaims[0].status === "confirmed", "claim status = confirmed");
  check(after.payments.length === 1, "exactly one payment added");
  check(after.payments[0].transactionCode === "UHRC2L1VL", "payment carries the normalized receipt");
  check(after.paymentStatus === "paid", "paymentStatus recalculated to paid");
  check((await getIncome(`income-manual-${claim.id}`)) !== null, "exactly one income record created");
  const guard = await db.collection("transaction_codes").doc("UHRC2L1VL").get();
  check(guard.exists, "receipt permanently reserved in transaction_codes");
}

console.log("\n=== 3. Retry (double-click) is idempotent — no duplicate payment/income ===");
{
  resetDb();
  await seedRenewal({ id: "r1", userId: "u-member", userName: "Amina" });
  await submitManualClaim({ renewalId: "r1", amount: 500, transactionCode: "UHRC2L1VL", submitterUserId: "u-member", submitterName: "Amina" });
  const renewal = await getRenewal("r1");
  const claim = renewal.pendingManualClaims[0];

  const first = await processClaimDecision({ renewalId: "r1", claimId: claim.id, action: "confirm", verifierUserId: "u-treasurer", verifierName: "Mary", verifierRoleKey: "treasurer" });
  check(first.status === "success", "first confirm success");

  const retry = await processClaimDecision({ renewalId: "r1", claimId: claim.id, action: "confirm", verifierUserId: "u-treasurer", verifierName: "Mary", verifierRoleKey: "treasurer" });
  check(retry.status === "alreadyProcessed", "retry returns benign alreadyProcessed");

  const after = await getRenewal("r1");
  check(after.payments.length === 1, "still exactly one payment after retry");
  check((await getIncome(`income-manual-${claim.id}`)) !== null, "income still exactly one (same id)");
  check(after.payments.reduce((s: number, p: any) => s + p.amount, 0) === 500, "no double-count after retry");
}

console.log("\n=== 4. Concurrent confirmation never double-counts ===");
{
  resetDb();
  await seedRenewal({ id: "r1", userId: "u-member", userName: "Amina" });
  await submitManualClaim({ renewalId: "r1", amount: 500, transactionCode: "UHRC2L1VL", submitterUserId: "u-member", submitterName: "Amina" });
  const renewal = await getRenewal("r1");
  const claim = renewal.pendingManualClaims[0];

  const results = await Promise.all([
    processClaimDecision({ renewalId: "r1", claimId: claim.id, action: "confirm", verifierUserId: "u-treasurer", verifierName: "Mary", verifierRoleKey: "treasurer" }),
    processClaimDecision({ renewalId: "r1", claimId: claim.id, action: "confirm", verifierUserId: "u-treasurer", verifierName: "Mary", verifierRoleKey: "treasurer" }),
    processClaimDecision({ renewalId: "r1", claimId: claim.id, action: "confirm", verifierUserId: "u-treasurer", verifierName: "Mary", verifierRoleKey: "treasurer" })
  ]);
  // All requests resolve (some "success", later ones "alreadyProcessed" on a real serialized
  // store) and — crucially — concurrent confirms never double-count the receivable.
  check(results.every(r => r.status === "success" || r.status === "alreadyProcessed"), "all concurrent confirms resolved without error");
  const after = await getRenewal("r1");
  check(after.payments.length === 1, "one payment after concurrent confirms");
  check((await countIncomes()) === 1, "one income after concurrent confirms");
  check(after.payments.reduce((s: number, p: any) => s + p.amount, 0) === 500, "total still 500");
}

console.log("\n=== 5. Duplicate M-Pesa receipt protection (cross-renewal) ===");
{
  resetDb();
  await seedRenewal({ id: "r1", userId: "u-member", userName: "Amina" });
  await seedRenewal({ id: "r2", userId: "u-member2", userName: "Brian" });
  await submitManualClaim({ renewalId: "r1", amount: 500, transactionCode: "UHRC2L1VL", submitterUserId: "u-member", submitterName: "Amina" });
  const renewal1 = await getRenewal("r1");
  await processClaimDecision({ renewalId: "r1", claimId: renewal1.pendingManualClaims[0].id, action: "confirm", verifierUserId: "u-treasurer", verifierName: "Mary", verifierRoleKey: "treasurer" });

  // The same (normalized) receipt is now reserved: another member cannot submit it,
  // and nothing is written to their renewal.
  try {
    await submitManualClaim({ renewalId: "r2", amount: 500, transactionCode: " uhrc-2l1-vl ", submitterUserId: "u-member2", submitterName: "Brian" });
    check(false, "reject a second claim reusing a reserved receipt");
  } catch (e) {
    expectError(e, "DUPLICATE_TRANSACTION_CODE", "reject a second claim reusing a reserved receipt");
  }
  const r2after = await getRenewal("r2");
  check((r2after.pendingManualClaims || []).length === 0, "no duplicate claim stored");
  check(r2after.payments.length === 0, "no payment written for the duplicate receipt");
}

console.log("\n=== 5b. A member cannot file two pending claims with the same receipt ===");
{
  resetDb();
  await seedRenewal({ id: "r1", userId: "u-member", userName: "Amina" });
  await submitManualClaim({ renewalId: "r1", amount: 200, transactionCode: "DUPSAME", submitterUserId: "u-member", submitterName: "Amina" });
  try {
    await submitManualClaim({ renewalId: "r1", amount: 300, transactionCode: "dupsame", submitterUserId: "u-member", submitterName: "Amina" });
    check(false, "second pending claim with the same receipt rejected");
  } catch (e) {
    expectError(e, "DUPLICATE_PENDING_CLAIM", "second pending claim with the same receipt rejected");
  }
}

console.log("\n=== 6. Overpayment / balance validation ===");
{
  resetDb();
  await seedRenewal({ id: "r1", userId: "u-member", userName: "Amina", feeRequired: 500 });
  await submitManualClaim({ renewalId: "r1", amount: 600, transactionCode: "OVR1", submitterUserId: "u-member", submitterName: "Amina" });
  const renewal = await getRenewal("r1");
  const claim = renewal.pendingManualClaims[0];
  try {
    await processClaimDecision({ renewalId: "r1", claimId: claim.id, action: "confirm", verifierUserId: "u-treasurer", verifierName: "Mary", verifierRoleKey: "treasurer" });
    check(false, "reject overpayment beyond remaining balance");
  } catch (e) {
    expectError(e, "OVERPAYMENT_EXCEEDS_BALANCE", "reject overpayment beyond remaining balance");
  }
  const after = await getRenewal("r1");
  check(after.pendingManualClaims[0].status === "pending" && after.payments.length === 0, "overpayment attempt left no partial writes");
}

console.log("\n=== 7. Self-verification is blocked (segregation of duties) ===");
{
  resetDb();
  await seedRenewal({ id: "r1", userId: "u-member", userName: "Amina" });
  await submitManualClaim({ renewalId: "r1", amount: 500, transactionCode: "UHRC2L1VL", submitterUserId: "u-member", submitterName: "Amina" });
  const renewal = await getRenewal("r1");
  const claim = renewal.pendingManualClaims[0];
  try {
    await processClaimDecision({ renewalId: "r1", claimId: claim.id, action: "confirm", verifierUserId: "u-member", verifierName: "Amina", verifierRoleKey: "treasurer" });
    check(false, "claimant cannot confirm their own claim");
  } catch (e) {
    expectError(e, "SELF_VERIFICATION_BLOCKED", "claimant cannot confirm their own claim");
  }
}

console.log("\n=== 8. Unknown action is never treated as confirm ===");
{
  resetDb();
  await seedRenewal({ id: "r1", userId: "u-member", userName: "Amina" });
  await submitManualClaim({ renewalId: "r1", amount: 500, transactionCode: "UHRC2L1VL", submitterUserId: "u-member", submitterName: "Amina" });
  const renewal = await getRenewal("r1");
  const claim = renewal.pendingManualClaims[0];
  for (const bad of ["confirmed", "approve", "banana", ""]) {
    try {
      await processClaimDecision({ renewalId: "r1", claimId: claim.id, action: bad as any, verifierUserId: "u-treasurer", verifierName: "Mary", verifierRoleKey: "treasurer" });
      check(false, `unknown action '${bad}' rejected`);
    } catch (e) {
      expectError(e, "INVALID_CLAIM_ACTION", `unknown action '${bad}' rejected`);
    }
  }
  const after = await getRenewal("r1");
  check(after.pendingManualClaims[0].status === "pending", "no accidental confirmation from unknown action");
  check(after.payments.length === 0, "no accidental payment from unknown action");
}

console.log("\n=== 9. Reject writes no payment/income ===");
{
  resetDb();
  await seedRenewal({ id: "r1", userId: "u-member", userName: "Amina" });
  await submitManualClaim({ renewalId: "r1", amount: 500, transactionCode: "UHRC2L1VL", submitterUserId: "u-member", submitterName: "Amina" });
  const renewal = await getRenewal("r1");
  const claim = renewal.pendingManualClaims[0];
  await processClaimDecision({ renewalId: "r1", claimId: claim.id, action: "reject", reason: "receipt mismatch", verifierUserId: "u-treasurer", verifierName: "Mary", verifierRoleKey: "treasurer" });
  const after = await getRenewal("r1");
  check(after.pendingManualClaims[0].status === "rejected", "claim marked rejected");
  check(after.pendingManualClaims[0].rejectionReason === "receipt mismatch", "rejection reason recorded");
  check(after.payments.length === 0, "no payment recorded on rejection");
  check((await countIncomes()) === 0, "no income recorded on rejection");
}

console.log("\n=== 10. Direct manual payment is idempotent + duplicate-safe + role-gated ===");
{
  resetDb();
  await seedRenewal({ id: "r1", userId: "u-member", userName: "Amina" });
  const first = await confirmDirectManualPayment({ renewalId: "r1", amount: 200, transactionCode: "DIRECT1", recordedBy: "Mary", verifierRoleKey: "treasurer" });
  check(first.status === "success", "direct payment succeeds");
  const second = await confirmDirectManualPayment({ renewalId: "r1", amount: 200, transactionCode: "direct-1", recordedBy: "Mary", verifierRoleKey: "treasurer" });
  check(second.status === "alreadyProcessed", "same receipt idempotent (alreadyProcessed)");
  const after = await getRenewal("r1");
  check(after.payments.length === 1, "one payment for the receipt");
  check(after.payments.reduce((s: number, p: any) => s + p.amount, 0) === 200, "no double-count for the receipt");

  try {
    await confirmDirectManualPayment({ renewalId: "r1", amount: 100, transactionCode: "X", recordedBy: "Volunteer", verifierRoleKey: "volunteer" });
    check(false, "volunteer cannot record a manual payment");
  } catch (e) {
    expectError(e, "NOT_AUTHORIZED_TO_RECORD_PAYMENT", "volunteer cannot record a manual payment");
  }
}

console.log("\n=== 11. Partial-failure atomicity (confirm-time duplicate guard rolls back) ===");
{
  resetDb();
  await seedRenewal({ id: "r1", userId: "u-member", userName: "Amina" });
  // r1 reserves the receipt via a direct payment FIRST.
  await confirmDirectManualPayment({ renewalId: "r1", amount: 100, transactionCode: "REC-ALPHA", recordedBy: "Mary", verifierRoleKey: "treasurer" });
  // Then a legacy-style pending claim on r2 reuses the same receipt (seeded directly, as
  // legacy data could be — submission-time checks can't see history this way).
  await seedRenewal({ id: "r2", userId: "u-member2", userName: "Brian", claims: [{ id: "claim-dup", amount: 100, transactionCode: "rec-alpha", status: "pending" }] });

  // Confirming r2's claim (same normalized receipt) fails inside the transaction; the
  // failure must throw AFTER some writes were staged but BEFORE commit — proving that
  // NOTHING is committed on failure (all-or-nothing).
  try {
    await processClaimDecision({ renewalId: "r2", claimId: "claim-dup", action: "confirm", verifierUserId: "u-treasurer", verifierName: "Mary", verifierRoleKey: "treasurer" });
    check(false, "duplicate claim confirm fails (as expected)");
  } catch (e) {
    expectError(e, "DUPLICATE_TRANSACTION_CODE", "duplicate claim confirm fails (as expected)");
  }
  const r2after = await getRenewal("r2");
  check(r2after.pendingManualClaims[0].status === "pending", "claim remained pending (no partial commit)");
  check(r2after.payments.length === 0, "no payment written");
  check(r2after.paymentStatus !== "paid", "paymentStatus unchanged");
  check((await countIncomes()) === 1, "only r1's income exists (r2's was rolled back)");
}

console.log(`\n=== Payment claim tests: ${passed} passed, ${failed} failed ===`);
if (hadDbFile) fs.writeFileSync(dbFile, backup, "utf8");
process.exit(failed === 0 ? 0 : 1);