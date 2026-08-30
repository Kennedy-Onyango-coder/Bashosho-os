// Pure financial calculation functions for Bashosho Talents CBO's two core
// performance-revenue business rules. Extracted out of server.ts so the exact
// formulas actually running in production can be covered by a standalone
// regression test (scripts/test-financial-calculations.ts) without needing a
// live server, Firestore, or auth session.
//
// These are pure functions: no I/O, no side effects, same input always gives
// the same output. Keep them that way — server.ts imports these rather than
// duplicating the math inline, so a fix here is a fix everywhere it's used.

/**
 * Splits a theatre/film performance's gross income between Bashosho's
 * organizational development fund and the pool available for cast/crew
 * payment, per the org's configured performance revenue policy
 * (org_settings.performanceOrgCutPercent, default 30%).
 */
export function calculatePerformanceSettlement(grossAmount: number, orgCutPercent: number) {
  const clampedPercent = Math.max(0, Math.min(100, orgCutPercent));
  const orgCutAmount = Math.round(grossAmount * (clampedPercent / 100) * 100) / 100;
  const castPoolAmount = Math.round((grossAmount - orgCutAmount) * 100) / 100;
  return {
    orgCutPercent: clampedPercent,
    orgCutAmount,
    castPoolAmount,
    castPoolPercent: Math.round((100 - clampedPercent) * 100) / 100
  };
}

/**
 * Computes what an individual cast/crew payee actually receives from a
 * payment list. The membership development fund deduction (org_settings.
 * performanceMembershipDeductionPercent, default 10%) applies ONLY to
 * registered Bashosho members (payments linked to a real userId) —
 * outsourced/external cast and crew are exempt, per organizational policy.
 */
export function calculateCastPayment(grossAmount: number, deductionRatePercent: number, isRegisteredMember: boolean) {
  const clampedRate = Math.max(0, Math.min(100, deductionRatePercent));
  const deductionAmount = isRegisteredMember
    ? Math.round(grossAmount * (clampedRate / 100) * 100) / 100
    : 0;
  const netAmount = Math.round((grossAmount - deductionAmount) * 100) / 100;
  return { deductionAmount, netAmount };
}
