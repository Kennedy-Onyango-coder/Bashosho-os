// identitySync.ts
// =============================================================================
// IDENTITY / ID DOCUMENT SYNCHRONIZATION
// =============================================================================
// The authoritative member/profile record is the ONLY editable source for identity
// fields (name, role, status, membership). Derived ID representations — the current
// `identity_records` row and any newly generated contract/ID document — consume that
// source. When an authoritative field changes:
//
//   1. the affected identity fields are compared (old vs new),
//   2. the profile is marked `idRegenerationRequired: true`,
//   3. a NEW immutable snapshot row is appended to `identity_records` (history is
//      never overwritten or deleted),
//   4. an ID_DATA_CHANGED / ID_REGENERATED audit is recorded.
//
// Historical signed documents are NEVER rewritten — new documents consume the current
// profile; executed documents keep their original snapshot. Nothing here runs at
// deploy time; it only runs when an endpoint calls it.
// =============================================================================

import { db } from "./server-firebase";
import { IdentityRecord } from "./src/types";

/** Authoritative profile fields whose change should invalidate a current ID. */
export const ID_SENSITIVE_FIELDS: ReadonlyArray<string> = [
  "name", "role", "roleKey", "status", "isActive", "memberNumber", "department", "position"
];

export interface IdentityChange {
  field: string;
  oldValue?: any;
  newValue?: any;
}

/**
 * Compare two profile representations and return the list of ID-sensitive fields that
 * changed. Pure + testable.
 */
export function detectIdentityChanges(before: any, after: any): IdentityChange[] {
  const changes: IdentityChange[] = [];
  for (const field of ID_SENSITIVE_FIELDS) {
    const oldV = before?.[field];
    const newV = after?.[field];
    if (String(oldV ?? "") !== String(newV ?? "")) {
      changes.push({ field, oldValue: oldV, newValue: newV });
    }
  }
  return changes;
}

export interface IdentityRecordInput {
  profileId: string;
  snapshot: {
    name: string;
    role: string;
    roleKey: string;
    status: string;
    isActive: boolean;
    memberNumber?: string;
    department?: string;
    position?: string;
  };
  issuedBy?: string;
  notes?: string;
}
/**
 * Append a NEW immutable identity record and make it current. The previous current row
 * is demoted (isCurrent=false) but NEVER deleted, so issued-ID history stays intact.
 * Returns the created IdentityRecord and the new version number.
 */
export async function appendIdentityRecord(input: IdentityRecordInput): Promise<{ record: IdentityRecord; version: number }> {
  const prose = db.collection("identity_records");
  const allSnap = await prose.get();
  let maxVersion = 0;
  for (const doc of allSnap.docs) {
    const r = doc.data() as IdentityRecord;
    if (r.profileId !== input.profileId) continue;
    maxVersion = Math.max(maxVersion, Number(r.version) || 0);
  }
  const version = maxVersion + 1;
  const nowISO = new Date().toISOString();
  const id = `idrec-${input.profileId}-${version}`;

  // Demote any previously-current rows for this profile (history preserved).
  for (const doc of allSnap.docs) {
    const r = doc.data() as IdentityRecord;
    if (r.profileId === input.profileId && r.isCurrent) {
      await prose.doc(doc.id).update({ isCurrent: false });
    }
  }

  const record: IdentityRecord = {
    id,
    profileId: input.profileId,
    version,
    isCurrent: true,
    snapshot: input.snapshot,
    issuedBy: input.issuedBy,
    issuedAt: nowISO,
    notes: input.notes
  };
  await prose.doc(id).set(record);
  return { record, version };
}

/**
 * Drive the full identity sync for a profile change. Detects which ID-sensitive fields
 * changed, marks the profile for regeneration, appends a current identity record, and
 * records an ID_DATA_CHANGED audit (best-effort; never fails the caller).
 */
export async function applyIdentitySyncForProfileChange(
  actor: { id: string; name: string },
  before: any,
  after: any,
  context: { profileId: string }
): Promise<{ changes: IdentityChange[]; version?: number; regenerated: boolean }> {
  const changes = detectIdentityChanges(before, after);
  if (changes.length === 0) {
    return { changes, regenerated: false };
  }

  const profileRef = db.collection("profiles").doc(context.profileId);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) {
    return { changes, regenerated: false };
  }
  const profile = profileSnap.data() as any;
  const regenerated = profile.idRegenerationRequired === true;
  await profileRef.update({
    idRegenerationRequired: true,
    identityVersion: Number(profile.identityVersion || 0) + 1,
    identityDataVersion: Number(profile.identityDataVersion || 0) + 1,
    updatedAt: new Date().toISOString()
  });

  const { version } = await appendIdentityRecord({
    profileId: context.profileId,
    snapshot: {
      name: String(after.name ?? profile.name ?? ""),
      role: String(after.role ?? profile.role ?? ""),
      roleKey: String(after.roleKey ?? profile.roleKey ?? ""),
      status: String(after.status ?? profile.status ?? ""),
      isActive: after.isActive !== undefined ? !!after.isActive : !!profile.isActive,
      memberNumber: after.memberNumber ?? profile.memberNumber,
      department: after.department ?? profile.department,
      position: after.position ?? profile.position
    },
    issuedBy: actor.name,
    notes: `ID_DATA_CHANGED: ${changes.map(c => c.field).join(", ")}`
  });

  try {
    const auditRef = db.collection("activity_log").doc(`idlog-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
    await auditRef.set({
      module: "identity",
      action: "ID_DATA_CHANGED",
      targetId: context.profileId,
      targetLabel: changes.map(c => c.field).join(", "),
      actorId: actor.id,
      actorName: actor.name,
      timestamp: new Date().toISOString(),
      details: { changes, regenerated }
    });
  } catch { }

  return { changes, version, regenerated };
}

/**
 * Regenerate the current ID representation on demand (authorized approver). Clears the
 * regeneration-required flag and records ID_REGENERATED. Historical rows preserved.
 */
export async function regenerateIdentity(
  actor: { id: string; name: string },
  profileId: string
): Promise<{ record: IdentityRecord; version: number }> {
  const profileSnap = await db.collection("profiles").doc(profileId).get();
  if (!profileSnap.exists) {
    throw new Error("Profile not found");
  }
  const profile = profileSnap.data() as any;
  const { record, version } = await appendIdentityRecord({
    profileId,
    snapshot: {
      name: String(profile.name ?? ""),
      role: String(profile.role ?? ""),
      roleKey: String(profile.roleKey ?? ""),
      status: String(profile.status ?? ""),
      isActive: !!profile.isActive,
      memberNumber: profile.memberNumber,
      department: profile.department,
      position: profile.position
    },
    issuedBy: actor.name,
    notes: "ID_REGENERATED"
  });
  await db.collection("profiles").doc(profileId).update({
    idRegenerationRequired: false,
    identityCurrentVersion: version,
    updatedAt: new Date().toISOString()
  });
  try {
    const auditRef = db.collection("activity_log").doc(`idlog-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
    await auditRef.set({
      module: "identity",
      action: "ID_REGENERATED",
      targetId: profileId,
      targetLabel: profile.name || profileId,
      actorId: actor.id,
      actorName: actor.name,
      timestamp: new Date().toISOString(),
      version
    });
  } catch { }
  return { record, version };
}
