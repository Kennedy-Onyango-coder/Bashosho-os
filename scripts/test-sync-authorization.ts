// Regression tests for the /api/sync authorization allowlist.
// The old /api/sync trusted any `action` as a Firestore collection and defaulted to
// "allowed" for almost everything — a volunteer could bulk-create an Income record, a
// member could write to role_permissions / financial_audit_trails / activity logs, and
// anyone could write to an arbitrary collection. These tests lock that closed by
// exercising the exact pure function server.ts uses (syncAuthorization.evaluateSyncItem)
// against the real role permission matrix (rolePermissions).
//
// Run with: npx tsx scripts/test-sync-authorization.ts

import { evaluateSyncItem, SYNCABLE_COLLECTIONS, SYNC_NON_WRITABLE_COLLECTIONS, isSyncableCollection } from "../syncAuthorization";
import { buildDefaultPermissionsForRole } from "../rolePermissions";

let passed = 0;
let failed = 0;
function check(cond: boolean, label: string, extra?: string): void {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
}

// `can` driven by the real default permission matrix for a role.
function canFor(roleKey: string) {
  const perms = buildDefaultPermissionsForRole(roleKey);
  return (moduleKey: string, action: string): boolean => !!(perms[moduleKey] && perms[moduleKey][action]);
}

const volunteer = canFor("volunteer");
const member = canFor("program_member");
const treasurer = canFor("treasurer");
const memberRep = canFor("member_representative");
const programsDirector = canFor("programs_director");

const item = (action: string, type?: string, opts: any = {}) => ({
  action,
  type,
  docExists: opts.docExists ?? false,
  docOwnerId: opts.docOwnerId,
  payloadOwnerId: opts.payloadOwnerId,
  requesterId: opts.requesterId ?? "u-attacker",
  can: opts.can ?? member
});

console.log("=== [Blocked] volunteer trying to create income ===");
{
  const d = await evaluateSyncItem(item("incomes", undefined, { can: volunteer }));
  check(!d.allowed && d.reason === "SYNC_PERMISSION_DENIED", "volunteer → incomes create DENIED");
}
console.log("\n=== [Blocked] member trying to modify expenditure ===");
{
  const d = await evaluateSyncItem(item("expenditures", undefined, { docExists: true, can: member }));
  check(!d.allowed && d.reason === "SYNC_PERMISSION_DENIED", "member → expenditures edit DENIED");
}
console.log("\n=== [Blocked] member trying to alter another profile ===");
{
  const d = await evaluateSyncItem(item("profiles", undefined, { can: member }));
  check(!d.allowed && d.reason === "SYNC_COLLECTION_NON_WRITABLE", "profiles is NON-WRITABLE via sync");
}
console.log("\n=== [Blocked] user trying to write role permissions ===");
{
  const d = await evaluateSyncItem(item("role_permissions", undefined, { can: member }));
  check(!d.allowed && d.reason === "SYNC_COLLECTION_NON_WRITABLE", "role_permissions is NON-WRITABLE via sync");
}
console.log("\n=== [Blocked] user trying to write activity logs ===");
{
  const d = await evaluateSyncItem(item("activity_log", undefined, { can: member }));
  check(!d.allowed && d.reason === "SYNC_COLLECTION_NON_WRITABLE", "activity_log is NON-WRITABLE via sync");
}
console.log("\n=== [Blocked] user trying to write financial audit trails ===");
{
  const d = await evaluateSyncItem(item("financial_audit_trails", undefined, { can: member }));
  check(!d.allowed && d.reason === "SYNC_COLLECTION_NON_WRITABLE", "financial_audit_trails is NON-WRITABLE via sync");
}
console.log("\n=== [Blocked] member touching another person's contract renewal ===");
{
  const d = await evaluateSyncItem(item("contract_renewals", undefined, { docExists: true, docOwnerId: "u-other", payloadOwnerId: "u-other", requesterId: "u-attacker", can: member }));
  check(!d.allowed && d.reason === "SYNC_PERMISSION_DENIED", "member editing someone else's renewal DENIED");
}
console.log("\n=== [Allowed] member editing their OWN contract renewal (self-service) ===");
{
  const d = await evaluateSyncItem(item("contract_renewals", undefined, { docExists: true, docOwnerId: "u-attacker", requesterId: "u-attacker", can: member }));
  check(d.allowed, "member editing their own renewal ALLOWED (ownership self-service)");
}
console.log("\n=== [Blocked] arbitrary / unknown collection names ===");
{
  for (const action of ["hacked_collection", "__proto__", "constructor", "0", "system/things", "*"]) {
    const d = await evaluateSyncItem(item(action, undefined, { can: treasurer }));
    check(!d.allowed && d.reason === "SYNC_COLLECTION_NOT_ALLOWED", `unknown action '${action}' DENIED`);
  }
}
console.log("\n=== [Blocked] volunteer deleting anything sensitive ===");
{
  const d = await evaluateSyncItem(item("incomes", "delete", { can: volunteer }));
  check(!d.allowed, "volunteer deleting income DENIED");
  const d2 = await evaluateSyncItem(item("documents", "delete", { can: volunteer }));
  check(!d2.allowed, "volunteer deleting document DENIED");
}
console.log("\n=== [Allowed] treasurer creating income (has finance create) ===");
{
  const d = await evaluateSyncItem(item("incomes", undefined, { can: treasurer }));
  check(d.allowed, "treasurer → incomes create ALLOWED (finance:create)");
}

console.log("\n=== Safeguarding reports require safeguarding permission ===");
{
  const memberD = await evaluateSyncItem(item("safeguarding_reports", undefined, { can: member }));
  check(!memberD.allowed, "program_member → safeguarding_reports DENIED");
  const programsD = await evaluateSyncItem(item("safeguarding_reports", undefined, { can: programsDirector }));
  check(programsD.allowed, "programs_director → safeguarding_reports ALLOWED (successor role)");
  const memberRepD = await evaluateSyncItem(item("safeguarding_reports", undefined, { can: memberRep }));
  check(!memberRepD.allowed, "member_representative → safeguarding_reports DENIED (not a trusted verify role)");
}
console.log("\n=== Allowlist consistency ===");
{
  check(isSyncableCollection("incomes"), "incomes is a recognized syncable collection");
  check(!isSyncableCollection("role_permissions"), "role_permissions never syncable");
  check(typeof SYNCABLE_COLLECTIONS === "object" && SYNCABLE_COLLECTIONS.profiles === undefined, "profiles is not an allow-listed sync target");
  for (const name of SYNC_NON_WRITABLE_COLLECTIONS) {
    check(SYNCABLE_COLLECTIONS[name] === undefined, `non-writable '${name}' is not also allow-listed`);
  }
}

console.log(`\n=== Sync authorization tests: ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);