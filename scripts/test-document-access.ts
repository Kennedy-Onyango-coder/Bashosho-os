// Regression test for document confidentiality enforcement — imports the exact
// function server.ts uses for both the document list endpoint and the (previously
// completely unprotected) document audit-trail endpoint.

import { canViewDocumentConfidentiality, DocumentAccessContext } from "../documentAccess";

let passed = 0;
let failed = 0;

function ctx(overrides: Partial<DocumentAccessContext>): DocumentAccessContext {
  return { hasDocumentsView: false, hasDocumentsEdit: false, hasFinanceView: false, roleKey: "program_member", ...overrides };
}

function assertAllowed(confidentiality: any, c: DocumentAccessContext, label: string) {
  if (canViewDocumentConfidentiality(confidentiality, c)) {
    passed++; console.log(`  ✓ ${label}`);
  } else {
    failed++; console.error(`  ✗ ${label} — expected allowed, was denied`);
  }
}

function assertDenied(confidentiality: any, c: DocumentAccessContext, label: string) {
  if (!canViewDocumentConfidentiality(confidentiality, c)) {
    passed++; console.log(`  ✓ ${label}`);
  } else {
    failed++; console.error(`  ✗ ${label} — expected denied, was allowed`);
  }
}

console.log("=== Backward compatibility: documents predating this field ===");
assertAllowed(undefined, ctx({ hasDocumentsView: true }), "A document with no confidentiality set is treated as 'internal' — visible to anyone with documents:view");
assertDenied(undefined, ctx({ hasDocumentsView: false }), "...and still denied to someone without even baseline documents:view");

console.log("\n=== public / internal ===");
assertAllowed("public", ctx({ hasDocumentsView: true }), "public is visible with baseline documents:view");
assertAllowed("internal", ctx({ hasDocumentsView: true }), "internal is visible with baseline documents:view");
assertDenied("internal", ctx({ hasDocumentsView: false, hasDocumentsEdit: true }), "internal is NOT visible on documents:edit alone without view — view is a superset in practice, but this checks the function's own logic in isolation");

console.log("\n=== confidential requires edit rights, not just view ===");
assertDenied("confidential", ctx({ hasDocumentsView: true, hasDocumentsEdit: false }), "confidential is denied to view-only access");
assertAllowed("confidential", ctx({ hasDocumentsEdit: true }), "confidential is allowed with documents:edit");

console.log("\n=== finance_only ignores general document permissions entirely ===");
assertDenied("finance_only", ctx({ hasDocumentsView: true, hasDocumentsEdit: true, hasFinanceView: false }), "Full document access does NOT grant finance_only access");
assertAllowed("finance_only", ctx({ hasDocumentsView: false, hasFinanceView: true }), "finance:view alone is sufficient for finance_only, even with zero document permissions");

console.log("\n=== leadership_only and restricted are role-based, not permission-based ===");
assertDenied("leadership_only", ctx({ hasDocumentsEdit: true, roleKey: "program_member" }), "documents:edit does not imply leadership_only access if the role isn't actually leadership");
assertAllowed("leadership_only", ctx({ roleKey: "secretary" }), "Secretary (a real leadership roleKey) has leadership_only access");
assertDenied("restricted", ctx({ roleKey: "treasurer" }), "Treasurer — leadership, but not Chairperson/VC — is denied 'restricted'");
assertAllowed("restricted", ctx({ roleKey: "chairperson" }), "Chairperson has 'restricted' access");
assertAllowed("restricted", ctx({ roleKey: "vice_chairperson" }), "Vice Chairperson has 'restricted' access");

console.log("\n=== An unrecognized confidentiality value never defaults to permissive ===");
assertDenied("some_future_value_this_code_does_not_know" as any, ctx({ hasDocumentsView: true, hasDocumentsEdit: true, roleKey: "treasurer" }), "An unknown confidentiality value is treated as the strictest tier, not the most permissive");
assertAllowed("some_future_value_this_code_does_not_know" as any, ctx({ roleKey: "chairperson" }), "...but Chairperson still gets through, since the strictest tier is still just 'restricted', not 'nobody'");

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
