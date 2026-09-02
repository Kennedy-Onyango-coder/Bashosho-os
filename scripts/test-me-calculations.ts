// Regression test for M&E aggregation logic — imports the exact functions
// MEDashboardBoard.tsx uses, not a re-implementation.
//
// Run with: npx tsx scripts/test-me-calculations.ts
// No server, database, or credentials required.

import { filterSessionsByPeriod, computeMESummary, computeByProgramArea, MESessionLike } from "../meCalculations";

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

function session(overrides: Partial<MESessionLike>): MESessionLike {
  return {
    date: "2026-06-15",
    participantsReached: 0,
    maleCount: 0,
    femaleCount: 0,
    childrenCount: 0,
    location: "",
    facilitators: "",
    programArea: "general",
    ...overrides
  };
}

console.log("=== Period filtering ===");
{
  const referenceDate = new Date("2026-06-20");
  const sessions = [
    session({ date: "2026-06-01" }),  // this month, this year
    session({ date: "2026-01-15" }),  // this year, not this month
    session({ date: "2025-06-01" }),  // last year
    session({ date: "not-a-date" })   // unparseable
  ];
  assertEqual(filterSessionsByPeriod(sessions, "all", referenceDate).length, 4, '"all" includes everything, even an unparseable date');
  assertEqual(filterSessionsByPeriod(sessions, "this_year", referenceDate).length, 2, '"this_year" excludes last year and the unparseable date');
  assertEqual(filterSessionsByPeriod(sessions, "this_month", referenceDate).length, 1, '"this_month" only includes the June session');
}

console.log("\n=== Headline totals (defensive against bad data) ===");
{
  const sessions = [
    session({ participantsReached: 20, maleCount: 8, femaleCount: 12, childrenCount: 3, location: "Kiambiu", facilitators: "Amina, John" }),
    session({ participantsReached: 15, maleCount: 6, femaleCount: 9, childrenCount: 2, location: "kiambiu", facilitators: "Amina" }) // same location, different case
  ];
  const summary = computeMESummary(sessions);
  assertEqual(summary.totalParticipants, 35, "Total participants sums correctly across sessions");
  assertEqual(summary.totalMale, 14, "Total male sums correctly");
  assertEqual(summary.totalFemale, 21, "Total female sums correctly");
  assertEqual(summary.uniqueLocationCount, 1, 'Location matching is case-insensitive — "Kiambiu" and "kiambiu" count as one location');
  assertEqual(summary.uniqueFacilitatorCount, 2, "Facilitators are split on commas and de-duplicated (Amina appears in both sessions but counts once)");
}
{
  // A malformed record (fields that are NaN, missing, or the wrong type) must
  // contribute zero, never poison the whole sum into NaN.
  const sessions = [
    session({ participantsReached: 10 }),
    { ...session({}), participantsReached: undefined as any },
    { ...session({}), participantsReached: "not a number" as any }
  ];
  const summary = computeMESummary(sessions);
  assertEqual(Number.isNaN(summary.totalParticipants), false, "A malformed participantsReached field never turns the total into NaN");
  assertEqual(summary.totalParticipants, 10, "A malformed record contributes zero, not an error, to the total");
}

console.log("\n=== By program area ===");
{
  const sessions = [
    session({ programArea: "gbv", participantsReached: 10 }),
    session({ programArea: "gbv", participantsReached: 5 }),
    session({ programArea: "srhr", participantsReached: 50 }),
  ];
  const byArea = computeByProgramArea(sessions, ["gbv", "srhr", "mental_health"]);
  assertEqual(byArea.length, 2, "An area with zero sessions (mental_health) is omitted, not shown as a misleading zero bar");
  assertEqual(byArea[0].area, "srhr", "Areas are sorted by participants reached, descending");
  assertEqual(byArea[0].participants, 50, "srhr's total is correct");
  assertEqual(byArea[1].area, "gbv", "gbv is the second area shown, since 15 < 50");
  assertEqual(byArea[1].participants, 15, "gbv's two sessions (10+5) sum correctly");
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
