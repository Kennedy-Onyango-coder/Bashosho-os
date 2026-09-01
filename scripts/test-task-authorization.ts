// Regression test for task-status-transition authorization — the mechanism behind
// "a person should not be able to falsely mark a task completed where organizational
// review is required" (master doc, Phase 8).
//
// Imports the exact function server.ts uses — not a re-implementation.
//
// Run with: npx tsx scripts/test-task-authorization.ts
// No server, database, or credentials required.

import { checkTaskStatusTransition } from "../taskAuthorization";

let passed = 0;
let failed = 0;

function assertAllowed(isOwnTask: boolean, canFullEdit: boolean, status: any, label: string) {
  const result = checkTaskStatusTransition(isOwnTask, canFullEdit, status);
  if (result.allowed) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}\n      expected: allowed\n      actual:   denied (${result.reason})`);
  }
}

function assertDenied(isOwnTask: boolean, canFullEdit: boolean, status: any, label: string) {
  const result = checkTaskStatusTransition(isOwnTask, canFullEdit, status);
  if (!result.allowed) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}\n      expected: denied\n      actual:   allowed`);
  }
}

console.log("=== The core rule this test exists to protect ===");
assertDenied(true, false, "completed", "An assignee (no edit rights) can NEVER self-approve their own task to 'completed'");
assertDenied(true, false, "cancelled", "An assignee (no edit rights) can NEVER self-cancel their own task");

console.log("\n=== What an ordinary assignee CAN do to their own task ===");
assertAllowed(true, false, "in_progress", "Assignee can start their own task");
assertAllowed(true, false, "blocked", "Assignee can report their own task blocked");
assertAllowed(true, false, "submitted", "Assignee can submit their own task for review");
assertAllowed(true, false, undefined, "Assignee can edit their own task without changing status at all");

console.log("\n=== A real reviewer (tasks:edit) has full authority ===");
assertAllowed(true, true, "completed", "A reviewer who is ALSO the assignee can still approve to completed");
assertAllowed(false, true, "completed", "A reviewer (not the assignee) can approve a submitted task to completed");
assertAllowed(false, true, "in_progress", "A reviewer can return a submitted task to in_progress");
assertAllowed(false, true, "cancelled", "A reviewer can cancel a task");
assertAllowed(false, true, undefined, "A reviewer can edit a task's other fields without touching status");

console.log("\n=== Nobody else has any access at all ===");
assertDenied(false, false, "in_progress", "A random user (not assignee, not reviewer) cannot touch someone else's task");
assertDenied(false, false, undefined, "...not even to edit non-status fields");

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
