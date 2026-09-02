// Regression test for the role-permission matrix. Imports the exact function
// server.ts uses — not a re-implementation.
//
// This deliberately does NOT re-assert every single grant in every role (that would
// just mirror the implementation and catch nothing real). It protects specific,
// security-relevant invariants — several of which were established or changed
// earlier in this engagement and would be easy to silently regress while editing a
// nearby case block.
//
// Run with: npx tsx scripts/test-role-permissions.ts
// No server, database, or credentials required.

import { buildDefaultPermissionsForRole, PERMISSION_MODULE_KEYS } from "../rolePermissions";

let passed = 0;
let failed = 0;

function check(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

console.log("=== Chairperson: full access everywhere ===");
{
  const p = buildDefaultPermissionsForRole("chairperson");
  check(
    PERMISSION_MODULE_KEYS.every(m => p[m].view && p[m].create && p[m].edit && p[m].delete && p[m].approve),
    "Chairperson has full (view/create/edit/delete/approve) access to every single module"
  );
}

console.log("\n=== Programs Director inherits the retired Safeguarding Officer's confidential-module access ===");
{
  const p = buildDefaultPermissionsForRole("programs_director");
  check(p.safeguarding.view && p.safeguarding.create && p.safeguarding.edit, "Programs Director has full (non-delete) safeguarding access");
  check(!p.safeguarding.delete, "...but not delete — matches the retired officer's own level exactly");
}

console.log("\n=== Legacy safeguarding_officer role still resolves permissions (backward compatibility) ===");
{
  const p = buildDefaultPermissionsForRole("safeguarding_officer");
  check(p.safeguarding.view && p.safeguarding.edit, "An existing account still on this retired roleKey is not locked out of safeguarding");
  check(p.documents.view && p.documents.edit, "...or documents");
}

console.log("\n=== Intern gets the real Member/Volunteer baseline, not elevated access ===");
{
  const intern = buildDefaultPermissionsForRole("intern");
  const volunteer = buildDefaultPermissionsForRole("volunteer");
  const member = buildDefaultPermissionsForRole("program_member");
  check(JSON.stringify(intern) === JSON.stringify(volunteer), "Intern's permission matrix is identical to Volunteer's");
  check(JSON.stringify(intern) === JSON.stringify(member), "Intern's permission matrix is identical to Program Member's");
  check(!intern.finance.view && !intern.safeguarding.view && !intern.roles.view, "Intern has no access to finance, safeguarding, or roles — no accidental elevation just from being a named role");
}

console.log("\n=== An unrecognized/custom roleKey never silently gets elevated access ===");
{
  const p = buildDefaultPermissionsForRole("some_future_role_nobody_wrote_a_case_for");
  const baseline = buildDefaultPermissionsForRole("program_member");
  check(JSON.stringify(p) === JSON.stringify(baseline), "An unknown roleKey falls back to the same minimal baseline as Program Member, never anything broader");
}

console.log("\n=== Universal baseline every role gets, regardless of case ===");
for (const role of ["chairperson", "treasurer", "secretary", "volunteer", "intern", "totally_made_up_role"]) {
  const p = buildDefaultPermissionsForRole(role);
  check(p.dashboard.view, `${role}: can see their own dashboard`);
  check(p.handbook.view, `${role}: can see the handbook`);
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
