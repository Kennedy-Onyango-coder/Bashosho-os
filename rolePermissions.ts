// Pure role-permission-matrix logic — extracted out of server.ts. This determines
// exactly what every role in the organization can see and do, so a silent regression
// here (a role accidentally losing access it needs, or gaining access it shouldn't
// have) is a real, high-consequence bug — the kind that's easy to introduce
// accidentally while editing a nearby case block and easy to miss without a test
// actively checking it.

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve";

export const PERMISSION_MODULE_KEYS = [
  "dashboard", "documents", "finance", "assets", "grants", "classes", "invoices",
  "handbook", "settings", "signup_reviews", "cms_editor", "beneficiaries", "roles",
  "safeguarding", "leadership_appointments", "contract_renewals", "activity_log",
  "tasks", "program_sessions", "volunteer_recognition", "attendance_registers",
  "events", "board_meetings", "onboarding_checklists"
] as const;

export const PERMISSION_ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete", "approve"];

export type PermSet = Record<PermissionAction, boolean>;
export type PermissionMatrix = Record<string, PermSet>;

export function emptyPermSet(): PermSet {
  return { view: false, create: false, edit: false, delete: false, approve: false };
}

export function fullPermSet(): PermSet {
  return { view: true, create: true, edit: true, delete: true, approve: true };
}

export function permSet(opts: Partial<PermSet>): PermSet {
  return { ...emptyPermSet(), ...opts };
}

// Default permission matrices that reproduce EXACTLY the access each of the 8 system
// roles had under the old hardcoded requireRole([...]) / nav-array checks, at the time
// this system was introduced. Audited against every requireRole call in this file and
// every UserRole array in src/App.tsx nav rendering.
export function buildDefaultPermissionsForRole(roleKey: string): PermissionMatrix {
  const p: any = {};
  for (const m of PERMISSION_MODULE_KEYS) p[m] = emptyPermSet();

  const view = (m: string) => { p[m].view = true; };
  const full = (m: string) => { p[m] = fullPermSet(); };

  // Every role can see their own dashboard and the handbook/classes/security areas —
  // these were unrestricted in the old nav code.
  full("dashboard");
  view("handbook");
  view("classes");

  // Tasks: everyone can see and update their own assigned/created tasks (baseline
  // "view" — the tasks endpoint itself further restricts non-leadership users to only
  // their own tasks, see GET /api/tasks). Only leadership roles (granted below) can
  // assign a task to someone else.
  view("tasks");
  // Program outcomes: transparency by default — every role, including volunteers who
  // ran a session, can log and see program reach numbers (GBV/SRHR/Mental Health/Film
  // Academy/TaaS). Editing someone else's logged session is leadership-only, below.
  view("program_sessions"); p.program_sessions.create = true;
  // Volunteer recognition: self-service — anyone can view their own progress and
  // generate their own certificate once real logged hours clear a tier threshold
  // (server recomputes hours from attendance records, never trusts a client figure).
  view("volunteer_recognition"); p.volunteer_recognition.create = true;
  // Attendance registers (transcribed paper sign-in sheets): everyone can view the
  // approved roster archive; only Secretary/Programs Director/Chairperson can submit
  // or move one through the approval chain (granted per-role below).
  view("attendance_registers");
  // Events: everyone can see what's scheduled and RSVP; only certain roles can create
  // one (granted per-role below).
  view("events");

  switch (roleKey) {
    case "chairperson":
      // Chairperson: full access everywhere, matches old `[..].includes` superset + all
      // requireRole(["chairperson"]) exclusive endpoints (roles CRUD, org_settings, admin
      // export/purge, leadership_appointments create).
      for (const m of PERMISSION_MODULE_KEYS) full(m);
      break;

    case "vice_chairperson":
      full("documents"); p.documents.delete = false; // document delete was chairperson-only under the old generic-delete fallback
      view("finance");
      // Assets: create+edit granted so the CMS Equipment tab (full("cms_editor") above)
      // is actually usable — that tab now saves directly to the assets collection.
      // Delete intentionally withheld; only Chairperson/Treasurer/Programs Director can
      // remove inventory records.
      view("assets"); p.assets.create = true; p.assets.edit = true;
      view("grants");
      full("invoices");
      full("settings"); p.settings.delete = false;
      full("signup_reviews");
      full("cms_editor");
      view("beneficiaries");
      view("roles");
      view("safeguarding");
      view("leadership_appointments");
      view("contract_renewals"); p.contract_renewals.edit = true; // can approve/reject alongside Chairperson
      view("activity_log");
      full("classes"); p.classes.delete = false; // class delete was chairperson+programs_director only
      p.tasks.create = true; p.tasks.edit = true;
      p.program_sessions.edit = true;
      p.volunteer_recognition.edit = true;
      p.events.create = true; p.events.edit = true;
      full("board_meetings");
      break;

    case "programs_director":
      full("documents"); p.documents.delete = false;
      full("assets"); p.assets.delete = false;
      view("beneficiaries"); p.beneficiaries.create = true; p.beneficiaries.edit = true;
      // Bashosho has decided to retire the dedicated Safeguarding & MEL Officer role
      // (see "safeguarding_officer" case below, kept only for any account still on it).
      // Programs Director — whose role always included MEL — is the org's chosen
      // successor for the confidential safeguarding workflow, so gets the same level
      // the officer had (everything except delete) rather than read-only.
      full("safeguarding"); p.safeguarding.delete = false;
      view("grants");
      view("finance"); // budgets creation allowed per old requireRole(["chairperson","treasurer","programs_director","vice_chairperson"])
      p.finance.create = true;
      p.classes.create = true; p.classes.edit = true; p.classes.delete = true; // matches old attendance-create + generic-delete route access
      p.tasks.create = true; p.tasks.edit = true;
      p.program_sessions.edit = true; p.program_sessions.delete = true;
      p.volunteer_recognition.edit = true;
      p.attendance_registers.edit = true; // approves the Programs stage
      p.events.create = true; p.events.edit = true; p.events.delete = true;
      break;

    case "secretary":
      full("documents"); p.documents.delete = false;
      view("beneficiaries"); p.beneficiaries.create = true; p.beneficiaries.edit = true;
      full("settings"); p.settings.delete = false; p.settings.edit = false; // secretary sees settings tab but org_settings save is chairperson-only historically
      view("safeguarding");
      p.tasks.create = true; p.tasks.edit = true;
      p.attendance_registers.create = true; p.attendance_registers.edit = true;
      p.events.create = true; p.events.edit = true;
      view("board_meetings"); p.board_meetings.create = true; p.board_meetings.edit = true;
      full("onboarding_checklists");
      break;

    case "treasurer":
      full("finance"); // old generic-delete route allowed treasurer to delete incomes/expenditures
      full("assets"); p.assets.delete = false; // assets delete was chairperson-only under the old default fallback
      full("grants"); // old generic-delete route allowed treasurer to delete grants
      full("invoices"); // old generic-delete route allowed treasurer to delete invoices
      p.finance.create = true;
      p.tasks.create = true; p.tasks.edit = true;
      break;

    // LEGACY ROLE — Bashosho Talents has decided to retire the dedicated Safeguarding
    // & MEL Officer as an organizational position (its duties now sit with Programs
    // Director, above). This case is kept, not deleted, purely so that if any existing
    // account in production still carries this roleKey, their permissions don't
    // silently break. It is no longer offered when assigning/reassigning a role in
    // Role Management (see RoleManagementPanel.tsx) — new appointments cannot be made
    // to it. Reassign any current holder to Programs Director (or another fitting
    // role) via Role Management when convenient; this case can then be deleted.
    case "safeguarding_officer":
      full("documents"); p.documents.delete = false;
      full("safeguarding"); p.safeguarding.delete = false;
      view("beneficiaries"); p.beneficiaries.create = true; p.beneficiaries.edit = true;
      p.tasks.create = true; p.tasks.edit = true;
      break;

    case "program_member":
    case "volunteer":
    case "intern":
      // Old code granted these roles nothing beyond the always-open dashboard/handbook/
      // classes/security tabs. Intern gets the same minimal baseline as Member/
      // Volunteer by default — a real org role now exists to assign people to, but it
      // doesn't come with any elevated access just by being added.
      break;

    default:
      // Unknown/custom roles created before this system existed: safest default is the
      // same minimal access as program_member, so nothing is silently over-granted.
      break;
  }

  return p;
}
