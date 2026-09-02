// Regression test for grant eligibility verdict computation — the mechanism behind
// master doc Phase 13's core rule: "NEVER claim eligibility where evidence is
// missing." Imports the exact function GrantsBoard.tsx uses.
//
// Run with: npx tsx scripts/test-grant-eligibility.ts

import { computeEligibilityVerdict } from "../grantEligibility";

let passed = 0;
let failed = 0;

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}\n      expected: ${expected}\n      actual:   ${actual}`);
  }
}

console.log("=== The rule this test exists to protect ===");
assertEqual(computeEligibilityVerdict(undefined), "no_requirements_listed", "No checklist at all is NEVER silently treated as eligible");
assertEqual(computeEligibilityVerdict([]), "no_requirements_listed", "An empty checklist is NEVER silently treated as eligible");

console.log("\n=== A single failing requirement disqualifies, no matter how many others pass ===");
assertEqual(
  computeEligibilityVerdict([
    { status: "met" }, { status: "met" }, { status: "met" }, { status: "met" }, { status: "not_met" }
  ]),
  "not_eligible",
  "9 met + 1 not_met is still not_eligible — one hard failure disqualifies"
);

console.log("\n=== Unconfirmed is not the same as failed ===");
assertEqual(
  computeEligibilityVerdict([{ status: "met" }, { status: "needs_verification" }]),
  "needs_verification",
  "A mix of met + needs_verification (no failures) is needs_verification, not eligible"
);
assertEqual(
  computeEligibilityVerdict([{ status: "not_met" }, { status: "needs_verification" }]),
  "not_eligible",
  "A known failure always wins over an unconfirmed item — not_eligible, not needs_verification"
);

console.log("\n=== Only fully confirmed requirements produce 'eligible' ===");
assertEqual(
  computeEligibilityVerdict([{ status: "met" }, { status: "met" }, { status: "met" }]),
  "eligible",
  "All requirements genuinely met is eligible"
);
assertEqual(
  computeEligibilityVerdict([{ status: "met" }]),
  "eligible",
  "A single met requirement, with nothing else in question, is eligible"
);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
