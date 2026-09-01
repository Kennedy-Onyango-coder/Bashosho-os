// Pure task-status-transition authorization logic. Extracted out of server.ts's task
// update handler for the same reason financialCalculations.ts exists: one real
// implementation, covered by a standalone regression test, rather than logic that
// only ever gets exercised by a live server request.
//
// Core rule (master doc: "a person should not be able to falsely mark a task
// completed where organizational review is required"): an assignee updating their
// OWN task can move it through the working states, but can never self-approve it
// into "completed" or self-"cancelled" it — only someone with real task-review
// authority (tasks:edit permission) can do that.

export type TaskStatus = "pending" | "in_progress" | "submitted" | "blocked" | "cancelled" | "completed";

const SELF_ALLOWED_STATUSES = new Set<TaskStatus>(["in_progress", "submitted", "blocked"]);

export interface TaskStatusCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * @param isOwnTask   true if the requester is the task's assignee (not the assigner,
 *                    not a leader — specifically whoever the task is assigned TO)
 * @param canFullEdit true if the requester holds real tasks:edit permission
 *                    (leadership/reviewer authority), independent of whose task it is
 * @param requestedStatus the status the requester is trying to set — undefined if
 *                    this update doesn't touch status at all (e.g. editing only the
 *                    description)
 */
export function checkTaskStatusTransition(
  isOwnTask: boolean,
  canFullEdit: boolean,
  requestedStatus: TaskStatus | undefined
): TaskStatusCheckResult {
  // No access at all unless it's your own task or you have real edit authority.
  if (!isOwnTask && !canFullEdit) {
    return { allowed: false, reason: "You can only update tasks assigned to you, or manage tasks you have edit rights to." };
  }

  // A reviewer (tasks:edit) can set any status, on any task they have access to —
  // this is the actual authority the review workflow relies on.
  if (canFullEdit) {
    return { allowed: true };
  }

  // From here: isOwnTask is true and canFullEdit is false — the ordinary assignee
  // case. No status change at all is always fine (e.g. editing other fields).
  if (requestedStatus === undefined) {
    return { allowed: true };
  }

  if (SELF_ALLOWED_STATUSES.has(requestedStatus)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'You can move this task to "in progress", "blocked", or "submitted for review" yourself — only a reviewer can mark it completed or cancel it.'
  };
}
