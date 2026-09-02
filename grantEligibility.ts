// Pure grant-eligibility verdict logic (master doc Phase 13). The rule this exists to
// protect: "NEVER claim eligibility where evidence is missing." This function never
// independently asserts anything about whether Bashosho is eligible for a grant — it
// only summarizes a checklist that a human has actually gone through and marked. If
// the checklist is empty or incomplete, the verdict says so plainly rather than
// defaulting to something reassuring.

export type EligibilityItemStatus = "met" | "not_met" | "needs_verification";

export interface EligibilityItem {
  status: EligibilityItemStatus;
}

export type EligibilityVerdict = "eligible" | "not_eligible" | "needs_verification" | "no_requirements_listed";

/**
 * A single "not_met" requirement is disqualifying regardless of how many other
 * requirements are met — a grant with 9 of 10 requirements satisfied is still not
 * eligible if the 10th is a hard requirement that fails. "needs_verification" only
 * wins when nothing is actively failing, since an unconfirmed requirement is not the
 * same as a known-failed one.
 */
export function computeEligibilityVerdict(checklist: EligibilityItem[] | undefined): EligibilityVerdict {
  if (!checklist || checklist.length === 0) {
    return "no_requirements_listed";
  }
  if (checklist.some(item => item.status === "not_met")) {
    return "not_eligible";
  }
  if (checklist.some(item => item.status === "needs_verification")) {
    return "needs_verification";
  }
  return "eligible";
}
