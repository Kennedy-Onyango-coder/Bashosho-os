// Regression test for Bashosho's two core financial business rules:
//   1. Performance settlement: org-cut % / cast-pool % split of gross income.
//   2. Cast payment: membership-fund deduction %, members only.
//
// These tests import the exact functions server.ts uses in production
// (financialCalculations.ts) — not a re-implementation of the formulas — so a
// bug introduced in that file fails here before it ever reaches a live
// performance settlement or payment list.
//
// Run with: npx tsx scripts/test-financial-calculations.ts
// No server, database, or credentials required.

import { calculatePerformanceSettlement, calculateCastPayment } from "../financialCalculations";

let passed = 0;
let failed = 0;

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
  }
}

console.log("=== Performance Settlement (org-cut / cast-pool split) ===");

// Standard 30% policy on a round number.
assertEqual(
  calculatePerformanceSettlement(100000, 30),
  { orgCutPercent: 30, orgCutAmount: 30000, castPoolAmount: 70000, castPoolPercent: 70 },
  "Ksh 100,000 gross at standard 30% org cut"
);

// A different configured policy rate (org changed the setting) still splits correctly.
assertEqual(
  calculatePerformanceSettlement(50000, 25),
  { orgCutPercent: 25, orgCutAmount: 12500, castPoolAmount: 37500, castPoolPercent: 75 },
  "Ksh 50,000 gross at a reconfigured 25% org cut"
);

// A gross amount that doesn't divide evenly must still round to the cent and the two
// halves must sum back to the original gross — money can never appear or vanish.
{
  const result = calculatePerformanceSettlement(12345.67, 30);
  assertEqual(
    Math.round((result.orgCutAmount + result.castPoolAmount) * 100) / 100,
    12345.67,
    "Org cut + cast pool always reconstitutes the original gross amount (odd cents)"
  );
}

// 0% org cut (edge case — e.g. a fully member-funded community show).
assertEqual(
  calculatePerformanceSettlement(20000, 0),
  { orgCutPercent: 0, orgCutAmount: 0, castPoolAmount: 20000, castPoolPercent: 100 },
  "0% org cut sends the full gross to the cast pool"
);

// 100% org cut (edge case — e.g. donated performance, no cast payout).
assertEqual(
  calculatePerformanceSettlement(20000, 100),
  { orgCutPercent: 100, orgCutAmount: 20000, castPoolAmount: 0, castPoolPercent: 0 },
  "100% org cut leaves nothing in the cast pool"
);

// Out-of-range input must be clamped, never produce a negative amount or overshoot.
assertEqual(
  calculatePerformanceSettlement(10000, 150).orgCutPercent,
  100,
  "Org cut percent above 100 is clamped to 100"
);
assertEqual(
  calculatePerformanceSettlement(10000, -10).orgCutPercent,
  0,
  "Org cut percent below 0 is clamped to 0"
);

console.log("\n=== Cast Payment (membership-fund deduction) ===");

// Standard 10% deduction for a registered member.
assertEqual(
  calculateCastPayment(5000, 10, true),
  { deductionAmount: 500, netAmount: 4500 },
  "Registered member: Ksh 5,000 gross at standard 10% deduction"
);

// The exact rule this test exists to protect: an outsourced/external cast member is
// NEVER deducted, no matter what deductionRate the list was created with.
assertEqual(
  calculateCastPayment(5000, 10, false),
  { deductionAmount: 0, netAmount: 5000 },
  "Non-member (outsourced cast) pays zero deduction even at a 10% list rate"
);
assertEqual(
  calculateCastPayment(5000, 100, false),
  { deductionAmount: 0, netAmount: 5000 },
  "Non-member pays zero deduction even at an extreme 100% list rate"
);

// A policy exception rate (e.g. Chairperson approved 15% for a special engagement).
assertEqual(
  calculateCastPayment(8000, 15, true),
  { deductionAmount: 1200, netAmount: 6800 },
  "Registered member at an overridden 15% policy-exception rate"
);

// 0% deduction (e.g. org waived the fund contribution for this event).
assertEqual(
  calculateCastPayment(3000, 0, true),
  { deductionAmount: 0, netAmount: 3000 },
  "0% deduction rate leaves a member's full gross intact"
);

// Rounding: deduction + net must always reconstitute the gross, to the cent.
{
  const result = calculateCastPayment(999.99, 10, true);
  assertEqual(
    Math.round((result.deductionAmount + result.netAmount) * 100) / 100,
    999.99,
    "Deduction + net always reconstitutes the original gross amount (odd cents)"
  );
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
