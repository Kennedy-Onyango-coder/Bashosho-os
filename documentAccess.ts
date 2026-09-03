// Pure document-confidentiality access logic (master doc Phase 7). Determines whether
// a given viewer can see a document at a given confidentiality level. Deliberately
// built on top of permissions the system already grants (documents:edit, finance:view,
// a fixed leadership roleKey set) rather than inventing a whole new permission
// dimension no role has ever been configured for — every existing role already has a
// sensible answer here without needing new configuration.

export type DocumentConfidentiality = "public" | "internal" | "confidential" | "finance_only" | "leadership_only" | "restricted";

export interface DocumentAccessContext {
  hasDocumentsView: boolean;
  hasDocumentsEdit: boolean;
  hasFinanceView: boolean;
  roleKey: string;
}

// Leadership roleKeys — kept as a plain list here (not imported from rolePermissions.ts)
// so this module has zero dependencies and can be safely used by any endpoint,
// including the document-audit endpoint which historically had no permission
// awareness at all.
const LEADERSHIP_ROLE_KEYS = new Set([
  "chairperson", "vice_chairperson", "programs_director", "secretary", "treasurer",
  "executive_director", "safeguarding_officer" // legacy, kept for backward compatibility
]);

const RESTRICTED_ROLE_KEYS = new Set(["chairperson", "vice_chairperson"]);

/**
 * `confidentiality` undefined is treated as "internal" — every document that existed
 * before this field was introduced keeps exactly the access it always had (anyone with
 * documents:view), rather than suddenly becoming inaccessible or suddenly becoming
 * more exposed.
 */
export function canViewDocumentConfidentiality(
  confidentiality: DocumentConfidentiality | undefined,
  ctx: DocumentAccessContext
): boolean {
  const level = confidentiality || "internal";

  switch (level) {
    case "public":
    case "internal":
      return ctx.hasDocumentsView;
    case "confidential":
      return ctx.hasDocumentsEdit;
    case "finance_only":
      return ctx.hasFinanceView;
    case "leadership_only":
      return LEADERSHIP_ROLE_KEYS.has(ctx.roleKey);
    case "restricted":
      return RESTRICTED_ROLE_KEYS.has(ctx.roleKey);
    default:
      // An unrecognized confidentiality value is treated as the strictest tier, never
      // the most permissive — a typo or a future value this code doesn't know about
      // yet should never accidentally expose something.
      return RESTRICTED_ROLE_KEYS.has(ctx.roleKey);
  }
}
