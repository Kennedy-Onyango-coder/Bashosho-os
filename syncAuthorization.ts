// syncAuthorization.ts
// =============================================================================
// Pure authorization logic for the offline bulk-sync endpoint (/api/sync).
//
// The endpoint must NEVER let a client pick an arbitrary Firestore collection or
// bypass the normal API permission system. This module owns the STRICT ALLOWLIST:
// which collections are writable through sync, under which permission module/action,
// and under which ownership restrictions. It is deliberately pure & side-effect-free
// so it can be unit-tested (see scripts/test-sync-authorization.ts) and imported by
// server.ts. Fail closed: anything not explicitly allowed is denied.
// =============================================================================

export interface SyncRule {
  module: string;
  createAction: string;
  editAction: string;
  deleteAction: string;
  /** Field on the doc that stores the owning profile id (for self-service checks). */
  ownField?: string;
  /** A user may create/edit own-field docs without the module's edit permission. */
  allowsSelf?: boolean;
}

export const SYNCABLE_COLLECTIONS: Record<string, SyncRule> = {
  documents:    { module: "documents", createAction: "create", editAction: "edit", deleteAction: "delete" },
  budgets:      { module: "finance", createAction: "create", editAction: "edit", deleteAction: "delete" },
  expenditures: { module: "finance", createAction: "create", editAction: "edit", deleteAction: "delete" },
  incomes:      { module: "finance", createAction: "create", editAction: "edit", deleteAction: "delete" },
  invoices:     { module: "invoices", createAction: "create", editAction: "edit", deleteAction: "delete" },
  assets:       { module: "assets", createAction: "create", editAction: "edit", deleteAction: "delete" },
  grants:       { module: "grants", createAction: "create", editAction: "edit", deleteAction: "delete" },
  classes:      { module: "classes", createAction: "create", editAction: "edit", deleteAction: "delete" },
  broadcasts:   { module: "cms_editor", createAction: "create", editAction: "edit", deleteAction: "delete" },
  partners:     { module: "cms_editor", createAction: "create", editAction: "edit", deleteAction: "delete" },
  org_settings: { module: "roles", createAction: "edit", editAction: "edit", deleteAction: "delete" },
  contract_renewals: { module: "contract_renewals", createAction: "create", editAction: "edit", deleteAction: "delete", ownField: "userId", allowsSelf: true },
  leadership_appointments: { module: "leadership_appointments", createAction: "create", editAction: "edit", deleteAction: "delete" },
  safeguarding_reports: { module: "safeguarding", createAction: "create", editAction: "edit", deleteAction: "delete" },
  leave_requests: { module: "program_sessions", createAction: "create", editAction: "edit", deleteAction: "delete", ownField: "userId", allowsSelf: true },
  attendance_sheets: { module: "attendance_registers", createAction: "create", editAction: "edit", deleteAction: "delete" },
  program_sessions: { module: "program_sessions", createAction: "create", editAction: "edit", deleteAction: "delete" }
};

/**
 * Collections that must NEVER be writable through offline sync, even if a client tries
 * to guess their names. These are authoritative audit / permission / financial-internal
 * records that only travel through purpose-built endpoints.
 */
export const SYNC_NON_WRITABLE_COLLECTIONS: ReadonlySet<string> = new Set([
  "profiles",
  "role_permissions",
  "activity_log",
  "financial_audit_trails",
  "transaction_codes",
  "payment_transactions",
  "safeguarding_access_logs",
  "system_meta"
]);

export interface SyncDecisionInput {
  /** Collection/action name from the client (what would become a Firestore collection). */
  action: string;
  /** "delete" when the client wants to delete, otherwise a create-or-update. */
  type?: string;
  /** true when the target document already exists on the server. */
  docExists: boolean;
  /** Owner id already on the stored document (if any). */
  docOwnerId?: any;
  /** Owner id the client is claiming in the payload for a new doc (if any). */
  payloadOwnerId?: any;
  /** The authenticated requester's profile id. */
  requesterId: string;
  /** Reflects the real permission system (module, action) -> boolean. May be async. */
  can: (module: string, action: string) => boolean | Promise<boolean>;
}

export interface SyncDecision {
  allowed: boolean;
  reason?: string;
  requiredModule?: string;
  requiredAction?: string;
}

/**
 * Decides whether one sync item may be applied. Pure & deterministic:
 *  - an action not in the allowlist (or explicitly non-writable) is DENIED;
 *  - the required permission module/action is derived from the operation and checked
 *    against the real permission system via `can`;
 *  - a self-service collection allows a user to touch only their own documents
 *    without the module's edit permission (still failing closed otherwise).
 */
export async function evaluateSyncItem(input: SyncDecisionInput): Promise<SyncDecision> {
  const action = String(input.action || "").trim();
  if (SYNC_NON_WRITABLE_COLLECTIONS.has(action)) {
    return { allowed: false, reason: "SYNC_COLLECTION_NON_WRITABLE" };
  }
  // Use an own-property check so prototype-pollution style keys (`__proto__`,
  // `constructor`, `toString`, `hasOwnProperty`, ...) can never resolve to a rule.
  if (!Object.prototype.hasOwnProperty.call(SYNCABLE_COLLECTIONS, action)) {
    return { allowed: false, reason: "SYNC_COLLECTION_NOT_ALLOWED" };
  }
  const rule = SYNCABLE_COLLECTIONS[action];

  const isDelete = input.type === "delete";
  let requiredAction = isDelete ? rule.deleteAction : rule.createAction;
  if (!isDelete && input.docExists) requiredAction = rule.editAction;

  // Ownership-based self-service: a user may write only their own docs for
  // allow-self collections, regardless of the module edit permission.
  let isOwn = false;
  if (rule.ownField && rule.allowsSelf) {
    if (input.docExists && String(input.docOwnerId ?? "") === String(input.requesterId)) isOwn = true;
    if (!isDelete && !input.docExists && String(input.payloadOwnerId ?? "") === String(input.requesterId)) isOwn = true;
    if (isDelete && String(input.payloadOwnerId ?? "") === String(input.requesterId)) isOwn = true;
  }

  let authorized = isOwn;
  if (!authorized) {
    authorized = await input.can(rule.module, requiredAction);
  }
  if (!authorized) {
    return {
      allowed: false,
      reason: "SYNC_PERMISSION_DENIED",
      requiredModule: rule.module,
      requiredAction
    };
  }
  return {
    allowed: true,
    requiredModule: rule.module,
    requiredAction
  };
}

/** Convenience predicate: is a collection allow-listed at all (for tooling)? */
export function isSyncableCollection(action: string): boolean {
  return Object.prototype.hasOwnProperty.call(SYNCABLE_COLLECTIONS, action);
}