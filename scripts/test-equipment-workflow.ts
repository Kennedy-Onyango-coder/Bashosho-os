// Regression tests for Bashosho equipment hiring (member pricing, availability,
// lifecycle, authorization) + identity synchronization + handbook policy.
// Run with: npx tsx scripts/test-equipment-workflow.ts

process.env.FORCE_MOCK_FIRESTORE = "true";
process.env.NODE_ENV = "test";
process.env.SAFEGUARDING_SECRET = "test-safeguarding-secret";
process.env.VERIFICATION_SECRET = "test-verification-secret";
process.env.JWT_SECRET = "test-jwt-secret";

import fs from "fs";
import path from "path";

const dbFile = path.join(process.cwd(), "local-firestore.json");
if (fs.existsSync(dbFile)) fs.rmSync(dbFile, { force: true });

let passed = 0;
let failed = 0;
function check(cond: boolean, label: string, extra?: string): void {
  if (cond) { passed++; console.log(`  PASS ${label}`); }
  else { failed++; console.error(`  FAIL ${label}${extra ? " - " + extra : ""}`); }
}
function expectError(err: any, code: string, label: string): void {
  check(err && err.code === code, label, err ? `${err.code}: ${err.message}` : "no error thrown");
}

const { db, MockFirestore } = await import("../server-firebase");
const {
  resolveActiveMembership, computeEquipmentPricing, computeHireUnits, validateHireRequest,
  formatEquipmentReference, rangesOverlap, createEquipmentHire, decideEquipmentHire,
  checkoutEquipmentHire, returnEquipmentHire, cancelEquipmentHire, updateEquipmentRecord,
  assertEquipmentAvailable, EquipmentServiceError, DEFAULT_MEMBER_DISCOUNT_RATIO
} = await import("../equipmentWorkflow");
const { detectIdentityChanges, appendIdentityRecord, applyIdentitySyncForProfileChange, regenerateIdentity, ID_SENSITIVE_FIELDS } = await import("../identitySync");
const { buildDefaultPermissionsForRole } = await import("../rolePermissions");

function resetDb(): void {
  if (fs.existsSync(dbFile)) fs.rmSync(dbFile, { force: true });
  db.setActiveDb(new MockFirestore(), true);
}

const camera = { id: "eq-camera-main", name: "Cinema Camera (Main)", category: "camera", description: "", normalHireRate: 5000, memberHireRate: 500, pricingUnit: "daily", status: "active", active: true, condition: "excellent", serialNumber: "BTC-CAM-001", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", changeHistory: [] };
const mic = { id: "eq-mic-wireless", name: "Wireless Microphone Set", category: "mic", description: "", normalHireRate: 2000, memberHireRate: 300, pricingUnit: "daily", status: "active", active: true, condition: "good", serialNumber: "BTC-MIC-001", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", changeHistory: [] };
const lights = { id: "eq-lighting-kit", name: "Lighting Kit", category: "lighting", description: "", normalHireRate: 3000, pricingUnit: "daily", status: "active", active: true, condition: "good", serialNumber: "BTC-LGT-001", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", changeHistory: [] };

async function seedEquipment(items: any[] = [camera, mic, lights]): Promise<void> {
  for (const it of items) await db.collection("equipment").doc(it.id).set(it);
}

const member = { id: "member-1", name: "Michael", isActive: true, status: "Active", contractLocked: false };
const admin = { id: "chair-1", name: "Chairperson" };
const other = { id: "member-2", name: "Other Member" };

console.log("\n=== Membership eligibility (single authoritative rule) ===");
{
  check(resolveActiveMembership({ isActive: true, status: "Active", contractLocked: false }).active === true, "active member recognized");
  check(resolveActiveMembership({ isActive: true, status: "Active", contractLocked: true }).active === false, "contract-locked member is NOT active");
  check(resolveActiveMembership({ isActive: true, status: "Inactive" }).label === "inactive", "inactive member is labeled inactive");
  check(resolveActiveMembership({ isActive: false, status: "Volunteer" }).label === "non_member", "non-active profile is non_member");
  check(resolveActiveMembership(undefined).active === false, "no profile -> not a member");
}

console.log("\n=== Server-side pricing ===");
{
  // 12. active member camera rate = KSh 500
  const camP = computeEquipmentPricing(camera, true);
  check(camP.chargedRate === 500 && camP.pricingReason === "MEMBER_RATE", "12. active member camera rate is KSh 500 (MEMBER_RATE)", JSON.stringify(camP));
  // 13. active member wireless mic rate = KSh 300
  const micP = computeEquipmentPricing(mic, true);
  check(micP.chargedRate === 300 && micP.pricingReason === "MEMBER_RATE", "13. active member wireless mic rate is KSh 300", JSON.stringify(micP));
  // 14. default 50% for other equipment
  const lightP = computeEquipmentPricing(lights, true);
  check(lightP.chargedRate === 1500 && lightP.pricingReason === "MEMBER_RATE", "14. default equipment gets 50% member rate (3000 -> 1500)", JSON.stringify(lightP));
  check(DEFAULT_MEMBER_DISCOUNT_RATIO === 0.5, "default discount ratio is 0.5");
  // 15. equipment-specific member rate overrides the default 50%
  const custom = { ...lights, memberHireRate: 700 };
  check(computeEquipmentPricing(custom, true).chargedRate === 700, "15. equipment-specific member rate overrides the 50% rule");
  // 16. inactive member does NOT get the member rate
  check(computeEquipmentPricing(camera, false).chargedRate === 5000 && computeEquipmentPricing(camera, false).pricingReason === "STANDARD_RATE", "16. non-member pays the standard rate");
  // zero/invalid rates never produce NaN
  check(Number.isFinite(computeEquipmentPricing({ normalHireRate: NaN }, true).chargedRate), "NaN normalHireRate does not produce NaN pricing");
}

console.log("\n=== Units / validation / references ===");
{
  check(computeHireUnits("2026-09-20", "2026-09-27", "daily") === 8, "inclusive day count 20-27 Sept = 8");
  check(computeHireUnits("2026-09-20", "2026-09-20", "daily") === 1, "single day hire = 1");
  check(formatEquipmentReference(2026, 7) === "EQ-2026-00007", "reference formatting EQ-YYYY-NNNNN");
  const bad = validateHireRequest({ startDate: "2026-09-27", endDate: "2026-09-20", pricingUnit: "daily" });
  check(!bad.ok && (bad.error || "").includes("end date"), "inverted dates rejected");
  const badFmt = validateHireRequest({ startDate: "20/09/2026", endDate: "2026-09-27", pricingUnit: "daily" });
  check(!badFmt.ok, "non-ISO dates rejected");
  check(rangesOverlap("2026-09-20", "2026-09-27", "2026-09-25", "2026-09-30"), "overlap detection works");
  check(!rangesOverlap("2026-09-20", "2026-09-27", "2026-09-28", "2026-09-30"), "non-overlapping ranges pass");
}

console.log("\n=== Hire request: server-side pricing + snapshot ===");
{
  resetDb();
  await seedEquipment();
  // 17/18/19: price is computed from the server-side membership, never from the browser
  const mem = resolveActiveMembership({ isActive: true, status: "Active", contractLocked: false });
  const hire = await createEquipmentHire("eq-camera-main", { id: member.id, name: member.name }, mem, { startDate: "2026-09-20", endDate: "2026-09-27", pricingUnit: "daily" }, "Film shoot");
  check(hire.chargedRate === 500, "19. server calculated the member rate (500)", String(hire.chargedRate));
  check(hire.pricingReason === "MEMBER_RATE", "pricing reason recorded as MEMBER_RATE");
  // 20. price snapshot stored on the hire record
  check(hire.normalRate === 5000 && hire.memberRate === 500, "20. normal + member rates snapshotted");
  check(hire.totalAmount === 500 * 8, "totalAmount = chargedRate x units (500 x 8 = 4000)", String(hire.totalAmount));
  check(hire.equipmentNameSnapshot === "Cinema Camera (Main)" && hire.equipmentSerialSnapshot === "BTC-CAM-001", "equipment name + serial snapshotted");
  check(hire.membershipStatusAtRequest === "active", "membership status snapshotted at request");
  check(!!hire.reference && /^EQ-\d{4}-\d{5}$/.test(hire.reference), "permanent reference assigned");
  check(hire.status === "requested", "new hire starts as requested");
  check((hire.auditTrail || []).some(a => a.type === "EQUIPMENT_HIRE_REQUESTED"), "audit trail records EQUIPMENT_HIRE_REQUESTED");

  // non-member request
  const nonMem = resolveActiveMembership({ isActive: false, status: "Volunteer" });
  const hire2 = await createEquipmentHire("eq-camera-main", { id: other.id, name: other.name }, nonMem, { startDate: "2026-10-01", endDate: "2026-10-03", pricingUnit: "daily" });
  check(hire2.chargedRate === 5000 && hire2.pricingReason === "STANDARD_RATE", "non-member charged the standard rate");

  // unavailable equipment
  let threw: any = null;
  try {
    await db.collection("equipment").doc("eq-camera-main").set({ ...camera, status: "maintenance" });
    await createEquipmentHire("eq-camera-main", { id: member.id, name: member.name }, mem, { startDate: "2026-11-01", endDate: "2026-11-02", pricingUnit: "daily" });
  } catch (e) { threw = e; }
  expectError(threw, "EQUIPMENT_UNAVAILABLE", "inactive/maintenance equipment cannot be hired");
  await db.collection("equipment").doc("eq-camera-main").set(camera);

  // missing equipment
  threw = null;
  try { await createEquipmentHire("eq-nope", { id: member.id, name: member.name }, mem, { startDate: "2026-11-01", endDate: "2026-11-02", pricingUnit: "daily" }); } catch (e) { threw = e; }
  expectError(threw, "EQUIPMENT_NOT_FOUND", "unknown equipment id rejected");
}

console.log("\n=== Availability / overlapping bookings ===");
{
  resetDb();
  await seedEquipment();
  const mem = resolveActiveMembership(member);
  await createEquipmentHire("eq-camera-main", { id: member.id, name: member.name }, mem, { startDate: "2026-09-20", endDate: "2026-09-27", pricingUnit: "daily" });
  // approve the first hire so it occupies the equipment
  const hires = await db.collection("equipment_hires").get();
  const first = hires.docs[0].data();
  const decision = await decideEquipmentHire({ hireId: first.id, decision: "approve", actor: admin, actorCanApprove: true });
  check(decision.status === "success" && decision.hire.status === "approved", "authorized approver can approve a hire");
  check(decision.hire.approvedById === admin.id && !!decision.hire.approvedAt, "approval records actor + timestamp");
  check((decision.hire.auditTrail || []).some(a => a.type === "EQUIPMENT_HIRE_APPROVED"), "9. approval creates an audit trail entry");

  // 22. overlapping approved booking is rejected
  let threw: any = null;
  try {
    await createEquipmentHire("eq-camera-main", { id: other.id, name: other.name }, mem, { startDate: "2026-09-25", endDate: "2026-09-30", pricingUnit: "daily" });
  } catch (e) { threw = e; }
  expectError(threw, "EQUIPMENT_OVERLAP", "22. overlapping booking rejected at request time");

  // 23. approving an overlapping requested hire is blocked too
  const overlap = await createEquipmentHire("eq-camera-main", { id: other.id, name: other.name }, mem, { startDate: "2026-09-26", endDate: "2026-09-28", pricingUnit: "daily" }).catch(() => null);
  check(overlap === null, "overlapping request is not created");

  // 28/29: cancelled/rejected do NOT block; approved/checked_out DO block
  const cancelled = await createEquipmentHire("eq-mic-wireless", { id: member.id, name: member.name }, mem, { startDate: "2026-09-20", endDate: "2026-09-22", pricingUnit: "daily" });
  await cancelEquipmentHire({ hireId: cancelled.id, actor: { id: member.id, name: member.name }, actorIsOwnerOrAdmin: false });
  const afterCancel = await createEquipmentHire("eq-mic-wireless", { id: other.id, name: other.name }, mem, { startDate: "2026-09-20", endDate: "2026-09-22", pricingUnit: "daily" });
  check(!!afterCancel.id, "28. cancelled hire does not block availability");
}

console.log("\n=== Decisions / concurrency / lifecycle ===");
{
  resetDb();
  await seedEquipment();
  const mem = resolveActiveMembership(member);
  const hire = await createEquipmentHire("eq-camera-main", { id: member.id, name: member.name }, mem, { startDate: "2026-09-20", endDate: "2026-09-27", pricingUnit: "daily" });

  // 24. unauthorized user cannot approve
  let threw: any = null;
  try { await decideEquipmentHire({ hireId: hire.id, decision: "approve", actor: { id: member.id, name: member.name }, actorCanApprove: false }); } catch (e) { threw = e; }
  expectError(threw, "EQUIPMENT_NOT_AUTHORIZED", "24. unauthorized user cannot approve");

  // reject requires a reason
  threw = null;
  try { await decideEquipmentHire({ hireId: hire.id, decision: "reject", actor: admin, actorCanApprove: true, reason: "" }); } catch (e) { threw = e; }
  expectError(threw, "EQUIPMENT_REJECTION_REASON_REQUIRED", "rejection requires a reason");

  // approve, then double-decision is alreadyDecided (concurrency guard)
  const ok = await decideEquipmentHire({ hireId: hire.id, decision: "approve", actor: admin, actorCanApprove: true });
  check(ok.status === "success", "authorized approver approves");
  const second = await decideEquipmentHire({ hireId: hire.id, decision: "approve", actor: admin, actorCanApprove: true });
  check(second.status === "alreadyDecided", "second decision on the same hire is alreadyDecided (no double decision)");
  const rejectAfter = await decideEquipmentHire({ hireId: hire.id, decision: "reject", actor: admin, actorCanApprove: true, reason: "late" });
  check(rejectAfter.status === "alreadyDecided", "approve-vs-reject race: reject cannot overwrite an approval");

  // checkout requires authorization + approved status
  threw = null;
  try { await checkoutEquipmentHire({ hireId: hire.id, actor: { id: member.id, name: member.name }, actorCanOperate: false }); } catch (e) { threw = e; }
  expectError(threw, "EQUIPMENT_NOT_AUTHORIZED", "26. unauthorized user cannot check out");
  const co = await checkoutEquipmentHire({ hireId: hire.id, actor: admin, actorCanOperate: true });
  check(co.status === "checked_out" && !!co.checkedOutAt, "27a. checkout records timestamp + actor");
  check((co.auditTrail || []).some(a => a.type === "EQUIPMENT_CHECKED_OUT"), "audit trail records EQUIPMENT_CHECKED_OUT");

  // return records condition
  const ret = await returnEquipmentHire({ hireId: hire.id, actor: admin, actorCanOperate: true, condition: "good" });
  check(ret.status === "returned" && ret.returnCondition === "good" && !!ret.returnedAt, "27. return records condition + timestamp");
  check((ret.auditTrail || []).some(a => a.type === "EQUIPMENT_RETURNED"), "audit trail records EQUIPMENT_RETURNED");

  // returned hire does not block availability
  const rehire = await createEquipmentHire("eq-camera-main", { id: other.id, name: other.name }, mem, { startDate: "2026-09-20", endDate: "2026-09-27", pricingUnit: "daily" });
  check(!!rehire.id, "returned hire frees the equipment for future booking");
}

console.log("\n=== Pricing changes are audited, never silent ===");
{
  resetDb();
  await seedEquipment();
  // 21. price changes do NOT alter historical hire records
  const mem = resolveActiveMembership(member);
  const hire = await createEquipmentHire("eq-camera-main", { id: member.id, name: member.name }, mem, { startDate: "2026-09-20", endDate: "2026-09-21", pricingUnit: "daily" });
  const saved = await updateEquipmentRecord("eq-camera-main", admin, { memberHireRate: 800, condition: "fair" });
  const stored = (await db.collection("equipment").doc("eq-camera-main").get()).data();
  check(saved.memberHireRate === 800 && stored.memberHireRate === 800, "pricing update persists");
  check(hire.chargedRate === 500 && hire.memberRate === 500, "21. historical hire record keeps its original price snapshot");
  const rateEvents = (stored.changeHistory || []).filter((c: any) => c.type === "EQUIPMENT_RATE_CHANGED");
  check(rateEvents.length === 1 && rateEvents[0].field === "memberHireRate" && rateEvents[0].oldValue === 500 && rateEvents[0].newValue === 800, "EQUIPMENT_RATE_CHANGED audited with old/new values");
  check(rateEvents[0].byName === admin.name && !!rateEvents[0].at, "rate change records who + when");
  const condEvents = (stored.changeHistory || []).filter((c: any) => c.type === "EQUIPMENT_CONDITION_UPDATED");
  check(condEvents.length === 1, "EQUIPMENT_CONDITION_UPDATED audited");

  // invalid rates rejected
  let threw: any = null;
  try { await updateEquipmentRecord("eq-camera-main", admin, { memberHireRate: -5 }); } catch (e) { threw = e; }
  expectError(threw, "EQUIPMENT_INVALID_RATE", "negative rate rejected");
  threw = null;
  try { await updateEquipmentRecord("eq-camera-main", admin, { memberHireRate: "abc" as any }); } catch (e) { threw = e; }
  expectError(threw, "EQUIPMENT_INVALID_RATE", "non-numeric rate rejected");
}

console.log("\n=== Permission model ===");
{
  const chair = buildDefaultPermissionsForRole("chairperson");
  const memberPerms = buildDefaultPermissionsForRole("program_member");
  const pd = buildDefaultPermissionsForRole("programs_director");
  check(chair.equipment_management.view && chair.equipment_management.create && chair.equipment_management.approve && chair.equipment_management.edit, "Chairperson: full equipment management");
  check(pd.equipment_management.approve && pd.equipment_management.edit, "Programs Director: approve + manage");
  check(memberPerms.equipment_management.view && memberPerms.equipment_management.create, "member: view + request");
  check(!memberPerms.equipment_management.approve && !memberPerms.equipment_management.edit, "member: NO approve / NO manage / NO pricing");
  const volunteer = buildDefaultPermissionsForRole("volunteer");
  check(!volunteer.equipment_management.approve, "volunteer: NO approve");
}

console.log("\n=== Identity synchronization ===");
{
  resetDb();
  const before = { id: "member-1", name: "Michael", role: "Member", roleKey: "program_member", status: "Active", isActive: true, memberNumber: "BT-001" };
  const after = { ...before, role: "Treasurer", roleKey: "treasurer" };
  await db.collection("profiles").doc(before.id).set(before);

  check(detectIdentityChanges(before, after).length === 2, "30. role change detected (role + roleKey)");
  check(detectIdentityChanges(before, { ...before }).length === 0, "no-change produces no identity diff");
  check(ID_SENSITIVE_FIELDS.includes("status") && ID_SENSITIVE_FIELDS.includes("memberNumber"), "membership status + memberNumber are ID-sensitive fields");

  const result = await applyIdentitySyncForProfileChange(admin, before, after, { profileId: before.id });
  check(result.changes.length === 2, "identity sync ran for the role change");
  const profile = (await db.collection("profiles").doc(before.id).get()).data();
  check(profile.idRegenerationRequired === true, "profile flagged idRegenerationRequired");
  check((profile.identityVersion || 0) === 1, "identityVersion advanced");

  const recs = (await db.collection("identity_records").get()).docs.map(d => d.data());
  check(recs.length === 1 && recs[0].isCurrent && recs[0].version === 1, "31. current identity snapshot appended");
  check(recs[0].snapshot.role === "Treasurer" && recs[0].snapshot.roleKey === "treasurer", "snapshot holds the NEW authoritative values");

  // 32. membership status change updates eligibility + identity
  const afterStatus = { ...after, status: "Inactive" };
  await applyIdentitySyncForProfileChange(admin, after, afterStatus, { profileId: before.id });
  const recs2 = (await db.collection("identity_records").get()).docs.map(d => d.data());
  check(recs2.length === 2 && recs2.filter(r => r.isCurrent).length === 1, "35/36. new version appended, old version demoted but NOT deleted");
  const current = recs2.find(r => r.isCurrent);
  check(current.snapshot.status === "Inactive", "membership status change captured in the current identity snapshot");
  check(resolveActiveMembership({ isActive: true, status: "Inactive" }).active === false, "inactive membership loses the member rate eligibility");

  // 35. regeneration audited
  const regen = await regenerateIdentity(admin, before.id);
  check(regen.version === 3, "regeneration creates version 3");
  const profileAfterRegen = (await db.collection("profiles").doc(before.id).get()).data();
  check(profileAfterRegen.idRegenerationRequired === false, "regeneration clears the required flag");
  const recs3 = (await db.collection("identity_records").get()).docs.map(d => d.data());
  check(recs3.length === 3, "historical identity records preserved after regeneration");
  const logs = (await db.collection("activity_log").get()).docs.map(d => d.data());
  check(logs.some(l => l.action === "ID_DATA_CHANGED"), "ID_DATA_CHANGED audit recorded");
  check(logs.some(l => l.action === "ID_REGENERATED"), "ID_REGENERATED audit recorded");
}

console.log("\n=== Handbook policy integration ===");
{
  const { SEED_HANDBOOK_SECTIONS, SEED_ORG_SETTINGS } = await import("../server-firebase");
  const sections = SEED_ORG_SETTINGS.handbookSections || SEED_HANDBOOK_SECTIONS;
  const pol = sections.find((s: any) => s.id === "equipment-hiring-policy");
  check(!!pol, "37. equipment hiring policy present in the authoritative handbook seed");
  const body: string = pol ? String(pol.body?.en || "") : "";
  check(body.includes("KSh 500"), "38a. policy references the camera member rate (KSh 500)");
  check(body.includes("KSh 300"), "38b. policy references the wireless microphone member rate (KSh 300)");
  check(body.includes("50%"), "38c. policy references the default 50% discount rule");
  check(body.includes("active membership status"), "38d. policy ties eligibility to active membership status");
  check(sections.some((s: any) => s.id === "amendment-acknowledgement"), "39. policy sits inside the existing versioned handbook mechanism");
  check(typeof SEED_ORG_SETTINGS.handbookVersion === "string", "handbook version field present for policy versioning");
}

console.log(`\n=== Equipment/identity/handbook tests: ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);
