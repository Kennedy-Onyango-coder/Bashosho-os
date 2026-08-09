import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { getStorage } from "firebase-admin/storage";
import { DocumentData } from "firebase-admin/firestore";
import crypto from "crypto";
import { generateTotpSecret, generateTotpUri, verifyTotpToken, generateBackupCodes } from "./totp";

// Safety net for local development: some Google Cloud client libraries fire background
// credential/metadata-probing promises that reject OUTSIDE any of our own try/catch blocks
// (e.g. during ADC discovery when no credentials are configured at all). In production we
// keep Node's default behavior (crash loudly, an unhandled rejection there is a real bug
// worth stopping for); in development we log it and keep the server alive, since it's
// almost always this known credential-probing noise rather than a real application error.
process.on("unhandledRejection", (reason) => {
  const isProductionEnv = process.env.NODE_ENV === "production" || !!process.env.K_SERVICE;
  console.error("[unhandledRejection]", reason);
  if (isProductionEnv) {
    console.error("Exiting due to unhandled rejection in production.");
    process.exit(1);
  } else {
    console.warn("Continuing (development mode) — see FORCE_MOCK_FIRESTORE in .env.example if this is repeated Firestore/ADC noise.");
  }
});

// Import our Firestore database instance, seeding, and cryptographic helpers
import {
  db,
  dbInitPromise,
  seedDatabaseIfEmpty,
  seedHomepageContentIfEmpty,
  saveFile,
  getFileStream,
  deleteFile,
  encrypt,
  decrypt,
  hashPassword,
  comparePassword,
  generateVerificationToken,
} from "./server-firebase";

dotenv.config();

const app = express();
// Cloud Run (and most managed hosting) sits behind a load balancer/proxy. Without this,
// Express's req.ip always resolves to the proxy's internal address for every request,
// which means every rate limiter in this file (signup, public inquiries, safeguarding
// reports) silently shares ONE quota across the entire site's traffic instead of
// tracking each visitor separately — a handful of legitimate submissions can exhaust
// the limit for everyone else. `1` trusts exactly one hop (Cloud Run's own frontend),
// which is correct for this deployment and doesn't open us up to IP spoofing from
// further upstream.
app.set("trust proxy", 1);
app.disable("x-powered-by");
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

if (!process.env.JWT_SECRET) {
  throw new Error("CRITICAL STARTUP ERROR: JWT_SECRET environment variable is not set!");
}
const JWT_SECRET = process.env.JWT_SECRET;

if (!process.env.VERIFICATION_SECRET) {
  throw new Error("CRITICAL STARTUP ERROR: VERIFICATION_SECRET environment variable is not set!");
}

app.use(express.json({ limit: "25mb" }));
app.use(cookieParser());

// Cookie configuration helper supporting both custom domain (sameSite: "lax") and iframe preview (sameSite: "none")
export function getCookieOptions(req?: express.Request): express.CookieOptions {
  const host = (req?.headers["x-forwarded-host"] || req?.headers?.host || "").toString().toLowerCase();
  const isCustomDomain = host.includes("bashoshotalents") || host.includes("localhost") || process.env.COOKIE_SAME_SITE === "lax";
  return {
    httpOnly: true,
    secure: true,
    sameSite: isCustomDomain ? "lax" : "none",
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

// Health Check Endpoint
app.get("/api/health", async (req: express.Request, res: express.Response): Promise<any> => {
  await dbInitPromise;
  const isReal = !db.isMock;
  return res.json({
    status: "ok",
    isRealFirestore: isReal,
    dbMode: isReal ? "REAL_FIRESTORE" : "EPHEMERAL_MOCK_FILE",
    nodeEnv: process.env.NODE_ENV || "development",
    appSeedMode: process.env.APP_SEED_MODE || "production",
    serviceAccountSet: !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  });
});

app.get("/api/admin/local_firestore_data", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const localPath = path.join(process.cwd(), "local-firestore.json");
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, "utf8");
      return res.json({ exists: true, data: JSON.parse(content) });
    }
    return res.json({ exists: false, data: null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Initialize Gemini SDK with custom user agent headers
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Gemini SDK initialized successfully");
  } else {
    console.warn("GEMINI_API_KEY is not configured. Falling back to local draft simulator.");
  }
} catch (error) {
  console.error("Error initializing Gemini SDK:", error);
}

// Automatically seed the database on startup (moved inside async startServer to prevent race condition)

// --- AUTHENTICATION MIDDLEWARE ---
interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    roleKey?: string;
  };
}

function getCanonicalRoleKey(roleOrName?: string, docId?: string, strict: boolean = false): string {
  if (docId) {
    const idLower = docId.toLowerCase().trim();
    if (idLower === "chairperson") return "chairperson";
    if (idLower === "vice_chairperson") return "vice_chairperson";
    if (idLower === "programs_director") return "programs_director";
    if (idLower === "secretary") return "secretary";
    if (idLower === "treasurer") return "treasurer";
    if (idLower === "safeguarding_officer" || idLower === "safeguarding_mel") return "safeguarding_officer";
    if (idLower === "program_member") return "program_member";
    if (idLower === "volunteer" || idLower === "volunteer_staff") return "volunteer";
  }

  if (!roleOrName) return "";
  const str = roleOrName.toLowerCase().trim();

  if (str === "chairperson") return "chairperson";
  if (str === "vice_chairperson") return "vice_chairperson";
  if (str === "programs_director") return "programs_director";
  if (str === "secretary") return "secretary";
  if (str === "treasurer") return "treasurer";
  if (str === "safeguarding_officer" || str === "safeguarding_mel") return "safeguarding_officer";
  if (str === "program_member") return "program_member";
  if (str === "volunteer" || str === "volunteer_staff") return "volunteer";

  // STRICT MODE — used when creating or renaming a role (see /api/roles). Only an exact
  // match above is allowed to resolve to a privileged system roleKey. The fuzzy
  // substring matching below (str.includes("chair"), etc.) is NOT applied here, because
  // it previously meant any brand-new custom role whose name merely *contained* a
  // keyword — "Wheelchair Access Coordinator", "Deck Chair Fundraising Volunteer" —
  // silently resolved to roleKey "chairperson" and inherited full system access via the
  // hardcoded bypass in userHasPermission(), regardless of the (correctly minimal)
  // role_permissions doc actually created for it. A role that isn't an exact, deliberate
  // match for a system role name gets its own safe, collision-free slug instead.
  if (strict) {
    return str.replace(/[^a-z0-9]+/g, "_");
  }

  if (str.includes("chairperson") || str.includes("chair") || str.includes("executive director") || str.includes("cbo chief")) {
    return "chairperson";
  }
  if (str.includes("vice")) {
    return "vice_chairperson";
  }
  if (str.includes("program") && (str.includes("director") || str.includes("lead") || str.includes("operations"))) {
    return "programs_director";
  }
  if (str.includes("secretary")) {
    return "secretary";
  }
  if (str.includes("treasurer") || str.includes("finance")) {
    return "treasurer";
  }
  if (str.includes("safeguard") || str.includes("mel")) {
    return "safeguarding_officer";
  }
  if (str.includes("volunteer")) {
    return "volunteer";
  }
  if (str.includes("member")) {
    return "program_member";
  }

  return str.replace(/[^a-z0-9]+/g, "_");
}

async function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): Promise<any> {
  const authHeader = req.headers.authorization;
  const token = req.cookies?.session_token || (authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded.id) {
      return res.status(401).json({ error: "Invalid session" });
    }

    // Always re-check the live profile on every request rather than trusting the token
    // alone — this is what lets a role change or account deactivation take effect
    // immediately instead of waiting for the 7-day token to expire. A DB read failure
    // here must fail CLOSED (reject the request), not silently fall back to whatever
    // the token claims — that fallback previously let a deleted or deactivated account
    // keep working for the rest of its token's lifetime.
    let pSnap;
    try {
      pSnap = await db.collection("profiles").doc(decoded.id).get();
    } catch (pErr) {
      console.error("requireAuth: profile lookup failed, rejecting request:", pErr);
      return res.status(503).json({ error: "Unable to verify session right now. Please try again." });
    }

    if (!pSnap.exists) {
      return res.status(401).json({ error: "Account not found. Please log in again." });
    }

    const pData = pSnap.data()!;
    if (pData.isActive === false) {
      return res.status(401).json({ error: "This account has been deactivated. Contact an administrator." });
    }

    const resolvedRoleKey = pData.roleKey || getCanonicalRoleKey(pData.role, pData.id);
    req.user = {
      ...decoded,
      name: pData.name || decoded.name,
      email: pData.email || decoded.email,
      role: pData.role || decoded.role,
      roleKey: resolvedRoleKey
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// Roles cache and helper
let rolesCache: any[] = [];

async function getRoles(): Promise<any[]> {
  if (rolesCache && rolesCache.length > 0) return rolesCache;
  try {
    const snap = await db.collection("roles").get();
    let list = snap.docs.map(doc => doc.data());
    if (list.length === 0) {
      const defaultRolesList = [
        { id: "chairperson", roleKey: "chairperson", name: "Chairperson (Admin)", originalName: "Chairperson (Admin)", isSystem: true, description: "CBO Chief Executive Officer & Admin" },
        { id: "vice_chairperson", roleKey: "vice_chairperson", name: "Vice Chairperson (Comms)", originalName: "Vice Chairperson (Comms)", isSystem: true, description: "Communications & PR Lead" },
        { id: "programs_director", roleKey: "programs_director", name: "Programs Director", originalName: "Programs Director", isSystem: true, description: "Operations & Programs Lead" },
        { id: "secretary", roleKey: "secretary", name: "Secretary", originalName: "Secretary", isSystem: true, description: "Minutes & Beneficiary Registrar" },
        { id: "treasurer", roleKey: "treasurer", name: "Treasurer", originalName: "Treasurer", isSystem: true, description: "Financial Custodian & Approver" },
        { id: "safeguarding_officer", roleKey: "safeguarding_officer", name: "Safeguarding & MEL Officer", originalName: "Safeguarding & MEL Officer", isSystem: true, description: "Safeguarding officer" },
        { id: "program_member", roleKey: "program_member", name: "Program Member", originalName: "Program Member", isSystem: true, description: "Regular program member" },
        { id: "volunteer", roleKey: "volunteer", name: "Volunteer Staff", originalName: "Volunteer Staff", isSystem: true, description: "Volunteer worker" }
      ];
      for (const r of defaultRolesList) {
        await db.collection("roles").doc(r.id).set(r);
      }
      rolesCache = defaultRolesList;
      return defaultRolesList;
    }
    list = list.map(r => ({
      ...r,
      roleKey: r.roleKey || getCanonicalRoleKey(r.name || r.originalName || r.id, r.id)
    }));
    rolesCache = list;
    return list;
  } catch (err) {
    console.error("Error loading roles in helper:", err);
    return [];
  }
}

function requireRole(allowedRoleKeys: string[]) {
  return async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): Promise<any> => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    try {
      const userRoleKey = req.user.roleKey || getCanonicalRoleKey(req.user.role);
      const canonicalAllowedKeys = allowedRoleKeys.map(k => getCanonicalRoleKey(k));

      if (canonicalAllowedKeys.includes(userRoleKey) || allowedRoleKeys.includes(userRoleKey) || allowedRoleKeys.includes(req.user.role)) {
        return next();
      }

      console.warn(`[Access Denied] User '${req.user.name}' (${req.user.id}) with roleKey '${userRoleKey}' (role '${req.user.role}') tried to access endpoint requiring [${canonicalAllowedKeys.join(", ")}]`);
      return res.status(403).json({ 
        error: "Access denied: insufficient privileges",
        details: `User roleKey '${userRoleKey}' is not authorized.`
      });
    } catch (err) {
      console.error("Error in requireRole middleware:", err);
      return res.status(500).json({ error: "Internal role validation error" });
    }
  };
}

// --- DYNAMIC PERMISSIONS SYSTEM ---
// Module keys mirror src/types.ts PermissionModuleKey. Kept as a plain string[] here
// (server.ts does not import client types, matching this codebase's existing convention
// of duplicating small shared constants between server.ts and src/types.ts).
const PERMISSION_MODULE_KEYS = [
  "dashboard", "documents", "finance", "assets", "grants", "classes", "invoices",
  "handbook", "settings", "signup_reviews", "cms_editor", "beneficiaries", "roles",
  "safeguarding", "leadership_appointments", "contract_renewals", "activity_log",
  "tasks", "program_sessions", "volunteer_recognition"
];
const PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "approve"];

function emptyPermSet(): any {
  return { view: false, create: false, edit: false, delete: false, approve: false };
}

function fullPermSet(): any {
  return { view: true, create: true, edit: true, delete: true, approve: true };
}

function permSet(opts: Partial<Record<string, boolean>>): any {
  return { ...emptyPermSet(), ...opts };
}

// Default permission matrices that reproduce EXACTLY the access each of the 8 system
// roles had under the old hardcoded requireRole([...]) / nav-array checks, at the time
// this system was introduced. Audited against every requireRole call in this file and
// every UserRole array in src/App.tsx nav rendering.
function buildDefaultPermissionsForRole(roleKey: string): any {
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
      view("contract_renewals");
      view("activity_log");
      full("classes"); p.classes.delete = false; // class delete was chairperson+programs_director only
      p.tasks.create = true; p.tasks.edit = true;
      p.program_sessions.edit = true;
      p.volunteer_recognition.edit = true;
      break;

    case "programs_director":
      full("documents"); p.documents.delete = false;
      full("assets"); p.assets.delete = false;
      view("beneficiaries"); p.beneficiaries.create = true; p.beneficiaries.edit = true;
      view("safeguarding");
      view("grants");
      view("finance"); // budgets creation allowed per old requireRole(["chairperson","treasurer","programs_director","vice_chairperson"])
      p.finance.create = true;
      p.classes.create = true; p.classes.edit = true; p.classes.delete = true; // matches old attendance-create + generic-delete route access
      p.tasks.create = true; p.tasks.edit = true;
      p.program_sessions.edit = true; p.program_sessions.delete = true;
      p.volunteer_recognition.edit = true;
      break;

    case "secretary":
      full("documents"); p.documents.delete = false;
      view("beneficiaries"); p.beneficiaries.create = true; p.beneficiaries.edit = true;
      full("settings"); p.settings.delete = false; p.settings.edit = false; // secretary sees settings tab but org_settings save is chairperson-only historically
      view("safeguarding");
      p.tasks.create = true; p.tasks.edit = true;
      break;

    case "treasurer":
      full("finance"); // old generic-delete route allowed treasurer to delete incomes/expenditures
      full("assets"); p.assets.delete = false; // assets delete was chairperson-only under the old default fallback
      full("grants"); // old generic-delete route allowed treasurer to delete grants
      full("invoices"); // old generic-delete route allowed treasurer to delete invoices
      p.finance.create = true;
      p.tasks.create = true; p.tasks.edit = true;
      break;

    case "safeguarding_officer":
      full("documents"); p.documents.delete = false;
      full("safeguarding"); p.safeguarding.delete = false;
      view("beneficiaries"); p.beneficiaries.create = true; p.beneficiaries.edit = true;
      p.tasks.create = true; p.tasks.edit = true;
      break;

    case "program_member":
    case "volunteer":
      // Old code granted these roles nothing beyond the always-open dashboard/handbook/
      // classes/security tabs.
      break;

    default:
      // Unknown/custom roles created before this system existed: safest default is the
      // same minimal access as program_member, so nothing is silently over-granted.
      break;
  }

  return p;
}

let rolePermissionsCache: Record<string, any> | null = null;

async function seedRolePermissionsIfMissing() {
  try {
    const snap = await db.collection("role_permissions").get();
    if (!snap.empty) return;
    const roles = await getRoles();
    const batch = db.batch();
    for (const r of roles) {
      const roleKey = r.roleKey || getCanonicalRoleKey(r.name || r.id, r.id);
      const doc: any = {
        roleId: r.id,
        roleName: r.name || r.originalName || r.id,
        isSystemRole: !!r.isSystem,
        orgId: "bashosho",
        permissions: buildDefaultPermissionsForRole(roleKey),
        updatedAt: new Date().toISOString(),
        updatedBy: "system-seed"
      };
      batch.set(db.collection("role_permissions").doc(r.id), doc);
    }
    await batch.commit();
    console.log(`Seeded role_permissions for ${roles.length} roles.`);
  } catch (err) {
    console.error("Error seeding role_permissions:", err);
  }
}

async function getAllRolePermissions(forceRefresh = false): Promise<Record<string, any>> {
  if (rolePermissionsCache && !forceRefresh) return rolePermissionsCache;
  try {
    const snap = await db.collection("role_permissions").get();
    const map: Record<string, any> = {};
    snap.docs.forEach(doc => { map[doc.id] = doc.data(); });
    rolePermissionsCache = map;
    return map;
  } catch (err) {
    console.error("Error loading role_permissions:", err);
    return {};
  }
}

async function getRolePermissionsForRoleKey(roleKey: string): Promise<any> {
  const all = await getAllRolePermissions();
  if (all[roleKey]) return all[roleKey];
  // Custom role created without a matching role_permissions doc yet: fall back to the
  // safe minimal default rather than denying the dashboard entirely.
  return {
    roleId: roleKey,
    roleName: roleKey,
    isSystemRole: false,
    orgId: "bashosho",
    permissions: buildDefaultPermissionsForRole(roleKey)
  };
}

/**
 * Replaces requireRole([...]) for anything gated by the dynamic permission matrix.
 * Structural, always-chairperson-only actions (org deletion, data purge) may keep
 * requireRole(["chairperson"]) directly per the "roles" module itself being the thing
 * being edited — see PHASE 1 ground rules.
 */
async function userHasPermission(req: AuthenticatedRequest, moduleKey: string, action: string): Promise<boolean> {
  const userRoleKey = req.user?.roleKey || getCanonicalRoleKey(req.user?.role);
  if (userRoleKey === "chairperson") return true;
  const rp = await getRolePermissionsForRoleKey(userRoleKey);
  // A module key added to PERMISSION_MODULE_KEYS after this role's permissions doc was
  // already seeded/saved won't exist on rp.permissions yet — fall back to that role's
  // computed default for the new module instead of silently treating it as all-false,
  // so newly-added features (e.g. tasks, program_sessions) work without a manual
  // migration/reseed of every existing role_permissions document.
  if (rp?.permissions && rp.permissions[moduleKey] === undefined) {
    const fallback = buildDefaultPermissionsForRole(userRoleKey);
    return !!(fallback[moduleKey] && fallback[moduleKey][action]);
  }
  return !!(rp?.permissions?.[moduleKey] && rp.permissions[moduleKey][action]);
}

function requirePermission(moduleKey: string, action: string = "view") {
  return async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): Promise<any> => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      if (await userHasPermission(req, moduleKey, action)) return next();

      const userRoleKey = req.user.roleKey || getCanonicalRoleKey(req.user.role);
      console.warn(`[Access Denied] User '${req.user.name}' (roleKey '${userRoleKey}') lacks '${action}' on module '${moduleKey}'`);
      return res.status(403).json({
        error: "Access denied: insufficient privileges",
        details: `Role '${userRoleKey}' does not have '${action}' permission on '${moduleKey}'.`
      });
    } catch (err) {
      console.error("Error in requirePermission middleware:", err);
      return res.status(500).json({ error: "Internal permission validation error" });
    }
  };
}

// --- UNIFIED ACTIVITY LOG ---
// Modules whose content must never be written into the general activity log, to preserve
// safeguarding confidentiality (ground rule: log only that an action happened, not details).
const ACTIVITY_LOG_REDACT_MODULES = new Set(["safeguarding"]);

async function logActivity(
  req: AuthenticatedRequest,
  moduleKey: string,
  action: string,
  targetId?: string,
  targetLabel?: string,
  before?: any,
  after?: any
) {
  try {
    const redact = ACTIVITY_LOG_REDACT_MODULES.has(moduleKey);
    const entry = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      orgId: "bashosho",
      actorId: req.user?.id || "unknown",
      actorName: req.user?.name || "Unknown",
      actorRole: req.user?.roleKey || req.user?.role || "unknown",
      module: moduleKey,
      action,
      targetId,
      targetLabel: redact ? undefined : targetLabel,
      timestamp: new Date().toISOString(),
      before: redact ? undefined : before,
      after: redact ? undefined : after
    };
    await db.collection("activity_log").doc(entry.id).set(entry);
  } catch (err) {
    // Activity logging must never break the primary request.
    console.error("Error writing activity_log entry:", err);
  }
}

// --- SAFARICOM DARAJA (M-PESA STK PUSH) INTEGRATION ---
// Ground rule: never fake a successful payment. If Daraja isn't configured, every
// endpoint in this section returns a clear, honest error rather than pretending to
// have processed a payment. The manual "mark as paid" path stays available everywhere
// this is used, as a fallback for cash/bank payments and for orgs that haven't set up
// Daraja credentials yet.

interface DarajaConfig {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  env: "sandbox" | "production";
  callbackUrl: string;
}

function getDarajaConfig(): DarajaConfig | null {
  const consumerKey = process.env.DARAJA_CONSUMER_KEY;
  const consumerSecret = process.env.DARAJA_CONSUMER_SECRET;
  const shortcode = process.env.DARAJA_SHORTCODE;
  const passkey = process.env.DARAJA_PASSKEY;
  const callbackUrl = process.env.DARAJA_CALLBACK_URL;
  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
    return null;
  }
  return {
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    env: process.env.DARAJA_ENV === "production" ? "production" : "sandbox",
    callbackUrl
  };
}

function darajaBaseUrl(env: "sandbox" | "production"): string {
  return env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

// Access tokens are valid ~1hr; cache to avoid re-authenticating on every STK push.
let darajaTokenCache: { token: string; expiresAt: number } | null = null;

async function getDarajaAccessToken(config: DarajaConfig): Promise<string> {
  if (darajaTokenCache && darajaTokenCache.expiresAt > Date.now()) {
    return darajaTokenCache.token;
  }
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const res = await fetch(`${darajaBaseUrl(config.env)}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${credentials}` }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Daraja auth failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Daraja auth response missing access_token");
  }
  // Refresh a little early (55 min) to avoid edge-of-expiry failures.
  darajaTokenCache = { token: data.access_token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return data.access_token;
}

function darajaTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// Normalizes Kenyan phone numbers to the 2547XXXXXXXX / 2541XXXXXXXX format Daraja requires.
function normalizeMsisdn(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return "254" + digits.slice(1);
  if (/^[17]\d{8}$/.test(digits)) return "254" + digits;
  return null;
}

interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
}

async function initiateDarajaStkPush(config: DarajaConfig, params: {
  phone: string; amount: number; accountReference: string; transactionDesc: string;
}): Promise<StkPushResult> {
  const token = await getDarajaAccessToken(config);
  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString("base64");
  const msisdn = normalizeMsisdn(params.phone);
  if (!msisdn) {
    throw new Error(`Invalid phone number for M-Pesa: ${params.phone}`);
  }

  const res = await fetch(`${darajaBaseUrl(config.env)}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(params.amount),
      PartyA: msisdn,
      PartyB: config.shortcode,
      PhoneNumber: msisdn,
      CallBackURL: config.callbackUrl,
      AccountReference: params.accountReference.slice(0, 12),
      TransactionDesc: params.transactionDesc.slice(0, 13)
    })
  });

  const data = await res.json();
  if (!res.ok || data.ResponseCode !== "0") {
    throw new Error(data.errorMessage || data.ResponseDescription || `Daraja STK push failed (${res.status})`);
  }
  return { merchantRequestId: data.MerchantRequestID, checkoutRequestId: data.CheckoutRequestID };
}

// What a payment_transactions doc links to, and how to apply a confirmed payment back
// onto that record. Add new types here as more payment use-cases are wired up.
const PAYMENT_LINK_HANDLERS: Record<string, { collection: string; applyPayment: (doc: any, transaction: any) => any }> = {
  contract_renewal: {
    collection: "contract_renewals",
    applyPayment: (doc) => ({ ...doc, paymentStatus: "paid" })
  }
};

app.post("/api/payments/stk-push", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  const config = getDarajaConfig();
  if (!config) {
    return res.status(503).json({
      error: "M-Pesa payments are not configured for this deployment.",
      details: "An administrator needs to set DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET, DARAJA_SHORTCODE, DARAJA_PASSKEY, and DARAJA_CALLBACK_URL. Use the manual payment confirmation option instead for now."
    });
  }

  const { linkType, linkId, phone, amount } = req.body;
  const handler = PAYMENT_LINK_HANDLERS[linkType];
  if (!handler) {
    return res.status(400).json({ error: `Unsupported payment linkType: ${linkType}` });
  }
  if (!linkId || !phone || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: "linkId, phone, and a positive amount are required." });
  }

  try {
    // Validate the amount against the actual linked record server-side — never trust a
    // client-supplied amount blindly for a payment initiation.
    const linkedDoc = await db.collection(handler.collection).doc(linkId).get();
    if (!linkedDoc.exists) {
      return res.status(404).json({ error: `Linked record not found: ${linkType}/${linkId}` });
    }

    const transactionId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const stk = await initiateDarajaStkPush(config, {
      phone,
      amount: Number(amount),
      accountReference: `BT-${linkId}`.slice(0, 12),
      transactionDesc: "Bashosho Fee"
    });

    await db.collection("payment_transactions").doc(transactionId).set({
      id: transactionId,
      orgId: "bashosho",
      linkType,
      linkId,
      phone: normalizeMsisdn(phone),
      amount: Number(amount),
      status: "pending",
      merchantRequestId: stk.merchantRequestId,
      checkoutRequestId: stk.checkoutRequestId,
      initiatedBy: req.user!.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    logActivity(req, "finance", "stk_push_initiated", transactionId, `${linkType} payment for ${linkId}`);
    return res.json({ success: true, transactionId, checkoutRequestId: stk.checkoutRequestId });
  } catch (err: any) {
    console.error("STK push initiation failed:", err);
    return res.status(502).json({ error: "Failed to initiate M-Pesa payment.", details: err.message });
  }
});

// Public webhook — Safaricom calls this directly, so it cannot require our own session
// auth. We validate it by shape and by matching a transaction we ourselves created,
// rather than trusting the body blindly.
// Verifies the Daraja callback actually came from Safaricom. Safaricom lets you embed
// credentials in the callback URL you register on the Daraja portal
// (https://username:password@yourdomain.com/api/payments/daraja-callback) — it then sends
// those as a standard HTTP Basic `Authorization` header on every callback POST. Without
// this check, anyone who learns the callback URL and a valid CheckoutRequestID (e.g. from
// a browser network tab) could POST a forged "payment succeeded" callback and get a real
// entry written to the Financial Ledger with no human review.
function isDarajaCallbackAuthorized(req: express.Request): boolean {
  const expectedUser = process.env.DARAJA_CALLBACK_USERNAME;
  const expectedPass = process.env.DARAJA_CALLBACK_PASSWORD;

  // If callback credentials aren't configured at all, there's nothing to check against.
  // Fail closed rather than silently accepting unauthenticated writes to the ledger —
  // consistent with this integration's existing rule to never fake/assume a payment.
  if (!expectedUser || !expectedPass) {
    console.error(
      "[Daraja Callback] DARAJA_CALLBACK_USERNAME/PASSWORD are not set — rejecting all " +
      "callbacks. Set them and register a callback URL of the form " +
      "https://<user>:<pass>@yourdomain.com/api/payments/daraja-callback on the Daraja portal."
    );
    return false;
  }

  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const sepIndex = decoded.indexOf(":");
  if (sepIndex === -1) return false;
  const user = decoded.slice(0, sepIndex);
  const pass = decoded.slice(sepIndex + 1);

  // Constant-time comparison so response timing can't be used to guess the credentials.
  const userOk = user.length === expectedUser.length &&
    crypto.timingSafeEqual(Buffer.from(user), Buffer.from(expectedUser));
  const passOk = pass.length === expectedPass.length &&
    crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(expectedPass));
  return userOk && passOk;
}

app.post("/api/payments/daraja-callback", async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    if (!isDarajaCallbackAuthorized(req)) {
      console.warn("[Daraja Callback] Rejected unauthorized callback attempt.");
      // Deliberately NOT 200 here: Safaricom retries non-200 responses for a while, which
      // is what we want if this ever fires due to our own credential misconfiguration
      // (it'll self-heal once fixed) rather than an actual forgery attempt.
      return res.status(401).json({ error: "Unauthorized" });
    }

    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback || !stkCallback.CheckoutRequestID) {
      console.warn("Daraja callback received with unexpected shape:", JSON.stringify(req.body).slice(0, 500));
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Ignored: unrecognized payload shape" });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    const txSnap = await db.collection("payment_transactions")
      .where("checkoutRequestId", "==", CheckoutRequestID)
      .limit(1)
      .get();

    if (txSnap.empty) {
      console.warn(`Daraja callback for unknown CheckoutRequestID: ${CheckoutRequestID}`);
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Ignored: no matching transaction" });
    }

    const txDoc = txSnap.docs[0];
    const tx = txDoc.data();

    if (tx.status !== "pending") {
      // Already processed — Safaricom can retry callbacks; make this idempotent.
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Already processed" });
    }

    const success = ResultCode === 0;
    let mpesaReceiptNumber: string | undefined;
    if (success && Array.isArray(CallbackMetadata?.Item)) {
      const receiptItem = CallbackMetadata.Item.find((i: any) => i.Name === "MpesaReceiptNumber");
      mpesaReceiptNumber = receiptItem?.Value;
    }

    await txDoc.ref.set({
      status: success ? "success" : "failed",
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      mpesaReceiptNumber: mpesaReceiptNumber || null,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    if (success) {
      const handler = PAYMENT_LINK_HANDLERS[tx.linkType];
      if (handler) {
        const linkedDoc = await db.collection(handler.collection).doc(tx.linkId).get();
        if (linkedDoc.exists) {
          const updated = handler.applyPayment(linkedDoc.data(), tx);
          await db.collection(handler.collection).doc(tx.linkId).set(updated, { merge: true });
        }
        // A confirmed M-Pesa payment is real income — post it to the Finance Ledger too,
        // not just flip a status flag, so it actually shows up where the org tracks money.
        const incomeId = `inc-mpesa-${tx.id}`;
        await db.collection("incomes").doc(incomeId).set({
          id: incomeId,
          source: "membership_contribution",
          amount: tx.amount,
          date: new Date().toISOString().split("T")[0],
          description: `M-Pesa payment (${mpesaReceiptNumber || "receipt pending"}) — ${tx.linkType} ${tx.linkId}`,
          recordedBy: "M-Pesa (Daraja auto-reconciliation)"
        });
      }
    }

    // Always 200 to Safaricom regardless of payment success/failure — the "failure" is in
    // our own data (status: "failed"), not in whether we successfully received the callback.
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err: any) {
    console.error("Error processing Daraja callback:", err);
    // Still 200 — retrying won't fix a server-side bug, and we don't want Safaricom's
    // retry storm; the transaction stays "pending" and shows up in manual reconciliation.
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Error processing, logged" });
  }
});

app.get("/api/payments/status/:transactionId", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const doc = await db.collection("payment_transactions").doc(req.params.transactionId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    const data = doc.data()!;
    return res.json({
      status: data.status,
      resultDesc: data.resultDesc || null,
      mpesaReceiptNumber: data.mpesaReceiptNumber || null
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch payment status", details: err.message });
  }
});

// --- FILE UPLOADS TO GOOGLE CLOUD STORAGE ---
app.post("/api/upload", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const { filename, image } = req.body;
    if (!image || !filename) {
      return res.status(400).json({ error: "Missing image base64 data or filename" });
    }

    const decoded = decodeBase64Image(image);
    const mimeType = decoded ? decoded.mimeType : "image/webp";
    const buffer = decoded ? decoded.buffer : Buffer.from(image.replace(/^data:image\/\w+;base64,/, ""), "base64");

    const cleanFilename = filename.replace(/\.[^/.]+$/, "");
    // Previously this only ever produced "webp" or "jpg" regardless of actual content —
    // so a PNG upload (needed for transparent signatures/logos) got saved with a ".jpg"
    // filename while containing real PNG bytes. In local mock-storage mode, files are
    // served by extension-based Content-Type sniffing, so this silently broke rendering
    // for any non-JPEG, non-WEBP image (most damagingly, transparent signature PNGs).
    const extensionForMimeType: Record<string, string> = {
      "image/png": "png",
      "image/webp": "webp",
      "image/jpeg": "jpg",
      "image/jpg": "jpg"
    };
    const ext = extensionForMimeType[mimeType] || "jpg";
    const publicUrl = await saveFile(`uploads/${Date.now()}-${cleanFilename}.${ext}`, buffer, mimeType, true);
    return res.json({ url: publicUrl });
  } catch (error: any) {
    console.error("Upload handler failed:", error);
    const userFriendlyError = error.message && error.message.includes("File upload failed")
      ? "Upload failed, please try again shortly."
      : "File upload failed";
    return res.status(500).json({ error: userFriendlyError, details: error.message });
  }
});

// Simple in-memory login attempt rate-limiter
interface LoginAttempt {
  count: number;
  lastAttempt: number;
}
const loginAttempts = new Map<string, LoginAttempt>();

// --- AUTHENTICATION ROUTES ---
app.post("/api/auth/login", async (req: express.Request, res: express.Response): Promise<any> => {
  const { emailOrPhone, password } = req.body;

  if (!emailOrPhone || !password) {
    return res.status(400).json({ error: "Email/Phone and Password/PIN are required" });
  }

  const key = emailOrPhone.toLowerCase().trim();
  const now = Date.now();
  const attempt = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };

  // Check rate limit: 5 failed attempts within 15 minutes
  if (attempt.count >= 5 && now - attempt.lastAttempt < 15 * 60 * 1000) {
    const timeLeft = Math.ceil((15 * 60 * 1000 - (now - attempt.lastAttempt)) / 1000 / 60);
    return res.status(429).json({
      error: `Too many failed login attempts. Account temporarily locked. Please retry in ${timeLeft} minutes.`
    });
  }

  try {
    const searchVal = emailOrPhone.trim();
    const searchValLower = searchVal.toLowerCase();
    
    // Query Firestore profiles
    let userDoc: DocumentData | null = null;
    let userId = "";

    if (process.env.DEBUG_AUTH === "true") {
      console.log(`Attempting login for identifier (length: ${searchVal.length})`);
    }

    // Search by email (case-insensitive by using the lowercased key)
    const emailSnap = await db.collection("profiles").where("email", "==", searchValLower).get();
    if (process.env.DEBUG_AUTH === "true") {
      console.log(`Email query size: ${emailSnap.size}`);
    }
    
    if (!emailSnap.empty) {
      userDoc = emailSnap.docs[0].data();
      userId = emailSnap.docs[0].id;
      if (process.env.DEBUG_AUTH === "true") {
        console.log(`User found by email. ID: "${userId}"`);
      }
    } else {
      // Search by phone (trimmed value)
      const phoneSnap = await db.collection("profiles").where("phone", "==", searchVal).get();
      if (process.env.DEBUG_AUTH === "true") {
        console.log(`Phone query size: ${phoneSnap.size}`);
      }
      
      if (!phoneSnap.empty) {
        userDoc = phoneSnap.docs[0].data();
        userId = phoneSnap.docs[0].id;
        if (process.env.DEBUG_AUTH === "true") {
          console.log(`User found by phone. ID: "${userId}"`);
        }
      }
    }

    if (!userDoc) {
      if (process.env.DEBUG_AUTH === "true") {
        console.log("No user profile found matching identifier");
      }
      // Record failed attempt
      const currAttempt = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
      const count = (now - currAttempt.lastAttempt > 15 * 60 * 1000) ? 1 : currAttempt.count + 1;
      loginAttempts.set(key, { count, lastAttempt: now });

      return res.status(401).json({ error: "Invalid credentials", details: "User profile not found in database. Please check your email or phone number." });
    }

    const isPasswordCorrect = !!(userDoc.passwordHash && comparePassword(password, userDoc.passwordHash));

    if (!isPasswordCorrect) {
      // Record failed attempt
      const currAttempt = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
      const count = (now - currAttempt.lastAttempt > 15 * 60 * 1000) ? 1 : currAttempt.count + 1;
      loginAttempts.set(key, { count, lastAttempt: now });

      return res.status(401).json({ error: "Invalid credentials", details: "Incorrect PIN/password. If you've forgotten yours, use the password recovery option or ask an administrator to reset it." });
    }

    // Success: Clear failed attempts
    loginAttempts.delete(key);

    if (!userDoc.isActive) {
      return res.status(403).json({ error: "Account is inactive" });
    }

    // If this account has 2FA enabled, don't issue a full session yet — issue a short-lived
    // pending token that only proves "password was correct", and require a verified TOTP
    // code before a real session is created.
    if (userDoc.totpEnabled) {
      const pendingToken = jwt.sign(
        { id: userId, pending2FA: true },
        JWT_SECRET,
        { expiresIn: "5m" }
      );
      return res.json({ requires2FA: true, pendingToken });
    }

    // Generate token
    const tokenPayload = {
      id: userId,
      name: userDoc.name,
      email: userDoc.email,
      role: userDoc.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

    // Set secure httpOnly cookie
    res.cookie("session_token", token, getCookieOptions(req));

    // Clean user profile data for client
    const clientProfile = { ...userDoc };
    delete clientProfile.passwordHash;

    const seedStatusDoc = await db.collection("system_meta").doc("seed_status").get().catch(() => null);
    const rawMode = seedStatusDoc && seedStatusDoc.exists ? seedStatusDoc.data()?.mode : "demo";
    const systemMode = rawMode === "demo" ? "demo" : "production";

    return res.json({ 
      user: clientProfile,
      token,
      systemMode
    });
  } catch (error: any) {
    console.error("Login failed. Full Error Object:", error, "Code:", error?.code, "Stack:", error?.stack);
    const details = `${error.message || "Unknown error"}${error.code ? ` (Code: ${error.code})` : ""}`;
    return res.status(500).json({ error: "Internal login server error", details });
  }
});

app.post("/api/auth/2fa/login-verify", async (req: express.Request, res: express.Response): Promise<any> => {
  const { pendingToken, token: totpToken, backupCode } = req.body;

  if (!pendingToken || (!totpToken && !backupCode)) {
    return res.status(400).json({ error: "A pending session and a 6-digit code (or backup code) are required." });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(pendingToken, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }

  if (!decoded.pending2FA || !decoded.id) {
    return res.status(401).json({ error: "Invalid session. Please log in again." });
  }

  try {
    const userDocRef = db.collection("profiles").doc(decoded.id);
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
      return res.status(404).json({ error: "Account not found." });
    }
    const userDoc = userDocSnap.data()!;

    if (!userDoc.totpEnabled || !userDoc.totpSecret) {
      return res.status(400).json({ error: "Two-factor authentication is not enabled on this account." });
    }

    let verified = false;
    let usedBackupCode = false;

    if (totpToken) {
      verified = verifyTotpToken(userDoc.totpSecret, totpToken);
    } else if (backupCode) {
      const hashes: string[] = userDoc.totpBackupCodeHashes || [];
      const matchIndex = hashes.findIndex((h: string) => comparePassword(backupCode.trim().toUpperCase(), h));
      if (matchIndex !== -1) {
        verified = true;
        usedBackupCode = true;
        // Remove the used backup code so it can't be reused
        const updatedHashes = hashes.filter((_, i) => i !== matchIndex);
        await userDocRef.update({ totpBackupCodeHashes: updatedHashes });
      }
    }

    if (!verified) {
      return res.status(401).json({ error: "Incorrect code. Please try again." });
    }

    const tokenPayload = {
      id: decoded.id,
      name: userDoc.name,
      email: userDoc.email,
      role: userDoc.role,
    };
    const sessionToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("session_token", sessionToken, getCookieOptions(req));

    const clientProfile = { ...userDoc };
    delete clientProfile.passwordHash;
    delete clientProfile.totpSecret;
    delete clientProfile.totpBackupCodeHashes;

    const seedStatusDoc = await db.collection("system_meta").doc("seed_status").get().catch(() => null);
    const rawMode = seedStatusDoc && seedStatusDoc.exists ? seedStatusDoc.data()?.mode : "demo";
    const systemMode = rawMode === "demo" ? "demo" : "production";

    return res.json({
      user: clientProfile,
      token: sessionToken,
      systemMode,
      usedBackupCode,
      backupCodesRemaining: usedBackupCode ? (userDoc.totpBackupCodeHashes || []).length - 1 : undefined
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to verify two-factor code", details: error.message });
  }
});

app.post("/api/auth/logout", (req, res) => {
  const cookieOpts = getCookieOptions(req);
  res.clearCookie("session_token", {
    secure: cookieOpts.secure,
    sameSite: cookieOpts.sameSite,
    httpOnly: cookieOpts.httpOnly,
  });
  return res.json({ success: true });
});

app.post("/api/auth/change-password", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  const { newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ error: "New password/PIN is required" });
  }

  try {
    const userId = req.user!.id;
    const userDocRef = db.collection("profiles").doc(userId);
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
      return res.status(404).json({ error: "User profile not found" });
    }
    const userDoc = userDocSnap.data()!;
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }

    const newHash = hashPassword(newPassword);

    await userDocRef.update({
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: new Date().toISOString()
    });

    // Generate fresh session token after PIN change to ensure session is refreshed
    const tokenPayload = {
      id: userId,
      name: req.user!.name,
      email: req.user!.email,
      role: req.user!.role,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

    // Set secure httpOnly cookie
    res.cookie("session_token", token, getCookieOptions(req));

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to update password", details: error.message });
  }
});

app.post("/api/auth/acknowledge-handbook", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  const { version } = req.body;
  if (!version) {
    return res.status(400).json({ error: "Handbook version is required." });
  }
  try {
    const userId = req.user!.id;
    const userDocRef = db.collection("profiles").doc(userId);
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
      return res.status(404).json({ error: "User profile not found" });
    }
    const acknowledgedAt = new Date().toISOString();
    await userDocRef.update({
      handbookAcknowledgedVersion: version,
      handbookAcknowledgedAt: acknowledgedAt,
      updatedAt: acknowledgedAt
    });
    return res.json({ success: true, handbookAcknowledgedVersion: version, handbookAcknowledgedAt: acknowledgedAt });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to record handbook acknowledgment", details: error.message });
  }
});

// --- TWO-FACTOR AUTHENTICATION (TOTP / Google Authenticator) ---

app.get("/api/auth/2fa/status", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const userDocSnap = await db.collection("profiles").doc(req.user!.id).get();
    if (!userDocSnap.exists) return res.status(404).json({ error: "User profile not found" });
    const userDoc = userDocSnap.data()!;
    return res.json({
      totpEnabled: !!userDoc.totpEnabled,
      backupCodesRemaining: userDoc.totpEnabled ? (userDoc.totpBackupCodeHashes || []).length : 0
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch 2FA status", details: error.message });
  }
});

app.post("/api/auth/2fa/setup", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const userDocRef = db.collection("profiles").doc(req.user!.id);
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) return res.status(404).json({ error: "User profile not found" });
    const userDoc = userDocSnap.data()!;

    if (userDoc.totpEnabled) {
      return res.status(400).json({ error: "Two-factor authentication is already enabled. Disable it first to set up again." });
    }

    // Generate a new secret and store it (not yet enabled — pending confirmation via verify-setup)
    const secret = generateTotpSecret();
    await userDocRef.update({ totpSecret: secret, totpEnabled: false });

    const otpauthUri = generateTotpUri(secret, userDoc.email || userDoc.name || req.user!.id, "Bashosho OS");

    return res.json({ secret, otpauthUri });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to start 2FA setup", details: error.message });
  }
});

app.post("/api/auth/2fa/verify-setup", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "A 6-digit code is required." });

  try {
    const userDocRef = db.collection("profiles").doc(req.user!.id);
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) return res.status(404).json({ error: "User profile not found" });
    const userDoc = userDocSnap.data()!;

    if (!userDoc.totpSecret) {
      return res.status(400).json({ error: "No pending 2FA setup found. Please start setup again." });
    }

    if (!verifyTotpToken(userDoc.totpSecret, token)) {
      return res.status(401).json({ error: "That code doesn't match. Check your authenticator app and try again." });
    }

    const backupCodes = generateBackupCodes(8);
    const backupCodeHashes = backupCodes.map(code => hashPassword(code));

    await userDocRef.update({
      totpEnabled: true,
      totpBackupCodeHashes: backupCodeHashes
    });

    // Return the plaintext backup codes exactly once — they are never retrievable again after this.
    return res.json({ success: true, backupCodes });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to confirm 2FA setup", details: error.message });
  }
});

app.post("/api/auth/2fa/disable", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Please confirm your password to disable two-factor authentication." });

  try {
    const userDocRef = db.collection("profiles").doc(req.user!.id);
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) return res.status(404).json({ error: "User profile not found" });
    const userDoc = userDocSnap.data()!;

    if (!userDoc.passwordHash || !comparePassword(password, userDoc.passwordHash)) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    await userDocRef.update({
      totpEnabled: false,
      totpSecret: null,
      totpBackupCodeHashes: []
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to disable two-factor authentication", details: error.message });
  }
});

app.post("/api/auth/reset-forgotten-password", async (req: express.Request, res: express.Response): Promise<any> => {
  const { emailOrPhone, emergencyPhone, newPassword } = req.body;

  if (!emailOrPhone || !emergencyPhone || !newPassword) {
    return res.status(400).json({ error: "Please fill in all verification fields and the new password." });
  }

  try {
    const searchVal = emailOrPhone.trim().toLowerCase();
    
    // Find profile by email
    let userSnap = await db.collection("profiles").where("email", "==", searchVal).get();
    if (userSnap.empty) {
      // Find profile by phone
      userSnap = await db.collection("profiles").where("phone", "==", emailOrPhone.trim()).get();
    }

    if (userSnap.empty) {
      return res.status(404).json({ error: "User profile not found. Please verify your email or phone." });
    }

    const userDocRef = userSnap.docs[0].ref;
    const userDoc = userSnap.docs[0].data();

    // Verify emergency contact phone
    const actualEmergencyPhone = userDoc.emergencyContact?.phone?.trim() || "";
    const inputEmergencyPhone = emergencyPhone.trim();

    // Normalise phones by removing non-digits
    const normalize = (p: string) => p.replace(/\D/g, "");
    if (normalize(actualEmergencyPhone) !== normalize(inputEmergencyPhone) || !normalize(actualEmergencyPhone)) {
      return res.status(400).json({ error: "Verification failed. Emergency contact phone does not match our records." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }

    const newHash = hashPassword(newPassword);
    await userDocRef.update({
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: new Date().toISOString()
    });

    return res.json({ success: true, message: "Password has been reset successfully. You can now log in." });
  } catch (error: any) {
    return res.status(500).json({ error: "Reset failed", details: error.message });
  }
});

app.post("/api/auth/update-profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  const { name, email, phone, emergencyContact, signatureUrl, skills } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: "Name, email, and phone are required" });
  }

  try {
    const userId = req.user!.id;
    const userDocRef = db.collection("profiles").doc(userId);

    const updateData: any = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      updatedAt: new Date().toISOString()
    };

    if (emergencyContact) {
      updateData.emergencyContact = {
        name: emergencyContact.name?.trim() || "",
        phone: emergencyContact.phone?.trim() || "",
        relationship: emergencyContact.relationship?.trim() || ""
      };
    }

    if (signatureUrl !== undefined) {
      updateData.signatureUrl = signatureUrl;
    }

    if (Array.isArray(skills)) {
      updateData.skills = skills.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 20);
    }

    await userDocRef.update(updateData);

    logActivity(req, "dashboard", "self_update_profile", userId, name.trim());
    return res.json({ success: true, message: "Profile updated successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to update profile", details: error.message });
  }
});

app.post("/api/auth/admin-reset-password", requireAuth, requireRole(["chairperson", "vice_chairperson", "secretary", "programs_director", "safeguarding_officer"]), async (req: AuthenticatedRequest, res): Promise<any> => {
  const { targetUserId, newPassword } = req.body;
  if (!targetUserId || !newPassword) {
    return res.status(400).json({ error: "Target user ID and new password are required" });
  }

  try {
    const targetDocRef = db.collection("profiles").doc(targetUserId);
    const targetSnap = await targetDocRef.get();
    if (!targetSnap.exists) {
      return res.status(404).json({ error: "Target user profile not found" });
    }

    const targetDoc = targetSnap.data()!;

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }

    const newHash = hashPassword(newPassword);
    await targetDocRef.update({
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: new Date().toISOString()
    });

    return res.json({ success: true, message: `Password for ${targetDoc.name} has been reset successfully.` });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to reset password", details: error.message });
  }
});

app.get("/api/auth/me", async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  const token = req.cookies.session_token;
  if (!token) {
    return res.status(401).json({ error: "No session active" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userDoc = await db.collection("profiles").doc(decoded.id).get();

    if (!userDoc.exists) {
      return res.status(401).json({ error: "User profile no longer exists" });
    }

    const data = userDoc.data()!;
    delete data.passwordHash;

    // Dynamically compute and append verificationUrl for the logged in user's ID Card QR Code
    const tokenStr = generateVerificationToken("membership", decoded.id);
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const verificationUrl = `${appUrl}/verify/membership/${decoded.id}?t=${tokenStr}`;

    const seedStatusDoc = await db.collection("system_meta").doc("seed_status").get().catch(() => null);
    const rawMode = seedStatusDoc && seedStatusDoc.exists ? seedStatusDoc.data()?.mode : "demo";
    const systemMode = rawMode === "demo" ? "demo" : "production";

    return res.json({ 
      user: { id: decoded.id, ...data, verificationUrl },
      systemMode
    });
  } catch (error) {
    return res.status(401).json({ error: "Invalid session" });
  }
});

// --- PUBLIC VERIFICATION ENDPOINT WITH RATE LIMITING ---
interface RateLimitInfo {
  count: number;
  resetTime: number;
}
const verifyRateLimits = new Map<string, RateLimitInfo>();

function verificationRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction): any {
  const ip = req.ip || "unknown-ip";
  const now = Date.now();
  const limit = verifyRateLimits.get(ip);

  if (limit) {
    if (now > limit.resetTime) {
      verifyRateLimits.set(ip, { count: 1, resetTime: now + 60 * 60 * 1000 }); // 1 hour window
      return next();
    } else if (limit.count >= 30) {
      const minutesLeft = Math.ceil((limit.resetTime - now) / 1000 / 60);
      return res.status(429).json({
        error: `Too many verification requests. Please try again in ${minutesLeft} minutes.`
      });
    } else {
      limit.count++;
      return next();
    }
  } else {
    verifyRateLimits.set(ip, { count: 1, resetTime: now + 60 * 60 * 1000 });
    return next();
  }
}

app.get("/api/verify/:type/:id", verificationRateLimiter, async (req: express.Request, res: express.Response): Promise<any> => {
  const { type, id } = req.params;
  const { t } = req.query;

  const expectedToken = generateVerificationToken(type, id);
  
  // Note: The comparison uses crypto.timingSafeEqual instead of '!==' for defense in depth against timing attacks
  let isTokenValid = false;
  if (t && typeof t === "string" && t.length === 16 && expectedToken.length === 16) {
    const tBuffer = Buffer.from(t, "utf8");
    const expectedBuffer = Buffer.from(expectedToken, "utf8");
    isTokenValid = crypto.timingSafeEqual(tBuffer, expectedBuffer);
  }

  if (!isTokenValid) {
    return res.status(404).json({ verified: false, error: "Invalid or unrecognized verification code" });
  }

  const collectionMap: Record<string, string> = { 
    membership: "profiles", 
    class_certificate: "classes", 
    invoice: "invoices",
    leadership_appointment: "leadership_appointments",
    document: "documents",
    volunteer_certificate: "volunteer_certificates",
    asset: "assets"
  };
  const collection = collectionMap[type];
  if (!collection) return res.status(400).json({ verified: false, error: "Unknown document type" });

  try {
    const doc = await db.collection(collection).doc(id).get();
    if (!doc.exists) return res.status(404).json({ verified: false, error: "Record not found" });
    const data = doc.data()!;

    // Return ONLY safe, minimal fields per type — never the full record.
    if (type === "membership") {
      return res.json({
        verified: true,
        type,
        name: data.name,
        role: data.role,
        status: data.status || "active",
        orgName: "Bashosho Talents CBO",
      });
    }
    if (type === "class_certificate") {
      return res.json({
        verified: true,
        type,
        className: data.name,
        orgName: "Bashosho Talents CBO",
      });
    }
    if (type === "invoice") {
      return res.json({
        verified: true,
        type,
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        status: data.status,
        orgName: "Bashosho Talents CBO",
      });
    }
    if (type === "leadership_appointment") {
      let appointeeName = "Unknown Appointee";
      if (data.profileId) {
        const profileDoc = await db.collection("profiles").doc(data.profileId).get();
        if (profileDoc.exists) {
          appointeeName = profileDoc.data()!.name || "Unknown Appointee";
        }
      }
      return res.json({
        verified: true,
        type,
        appointeeName,
        role: data.role,
        termStart: data.termStart,
        termEnd: data.termEnd,
        orgName: "Bashosho Talents CBO",
      });
    }
    if (type === "document") {
      return res.json({
        verified: true,
        type,
        title: data.title,
        docType: data.type,
        author: data.author,
        date: data.date,
        orgName: "Bashosho Talents CBO",
      });
    }
    if (type === "volunteer_certificate") {
      return res.json({
        verified: true,
        type,
        recipientName: data.userName,
        tier: data.tier,
        hoursAtIssue: data.hoursAtIssue,
        issuedDate: data.issuedDate,
        orgName: "Bashosho Talents CBO",
      });
    }
    if (type === "asset") {
      return res.json({
        verified: true,
        type,
        assetName: data.name,
        assetCategory: data.category,
        assetSerial: data.serialNumber,
        assetCondition: data.condition,
        assetCustodian: data.custodian,
        orgName: "Bashosho Talents CBO",
      });
    }
  } catch (err: any) {
    return res.status(500).json({ verified: false, error: "Verification server error", details: err.message });
  }
});

// --- COLLECTION CRUD API ENDPOINTS WITH ROLE-GATED MIDDLEWARE ---

// Fields that must NEVER be sent to the client in a bulk/list fetch, regardless of the
// requester's role — a directory listing has no legitimate reason to include credential
// material for every member. (Individual "my own profile" flows read these server-side
// directly from Firestore, not through this shared list endpoint.)
const PROFILE_SENSITIVE_FIELDS = ["passwordHash", "totpSecret", "totpBackupCodeHashes"];

function redactSensitiveProfileFields(item: any): any {
  const clean = { ...item };
  for (const field of PROFILE_SENSITIVE_FIELDS) delete clean[field];
  return clean;
}

// Helper function to handle full collection fetch
async function fetchCollection(collectionName: string, req: AuthenticatedRequest, res: express.Response) {
  try {
    const snap = await db.collection(collectionName).get();
    let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Enhance profiles, classes, invoices with computed verificationUrl
    if (collectionName === "profiles") {
      items = items.map(item => {
        const token = generateVerificationToken("membership", item.id);
        const appUrl = process.env.APP_URL || "http://localhost:3000";
        return redactSensitiveProfileFields({
          ...item,
          verificationUrl: `${appUrl}/verify/membership/${item.id}?t=${token}`
        });
      });
    } else if (collectionName === "classes") {
      items = items.map(item => {
        const token = generateVerificationToken("class_certificate", item.id);
        const appUrl = process.env.APP_URL || "http://localhost:3000";
        return {
          ...item,
          verificationUrl: `${appUrl}/verify/class_certificate/${item.id}?t=${token}`
        };
      });
    } else if (collectionName === "invoices") {
      items = items.map(item => {
        const token = generateVerificationToken("invoice", item.id);
        const appUrl = process.env.APP_URL || "http://localhost:3000";
        return {
          ...item,
          verificationUrl: `${appUrl}/verify/invoice/${item.id}?t=${token}`
        };
      });
    } else if (collectionName === "documents") {
      // Gives every printed letter/minutes/activity-report/budget-explanation a real,
      // scannable verification QR — same mechanism as profiles/classes/invoices above —
      // rather than the document print flow having no working verification at all.
      items = items.map(item => {
        const token = generateVerificationToken("document", item.id);
        const appUrl = process.env.APP_URL || "http://localhost:3000";
        return {
          ...item,
          verificationUrl: `${appUrl}/verify/document/${item.id}?t=${token}`
        };
      });
    } else if (collectionName === "volunteer_certificates") {
      // Real, scannable QR per certificate — same signed-token mechanism as every
      // other printable in this system.
      items = items.map(item => {
        const token = generateVerificationToken("volunteer_certificate", item.id);
        const appUrl = process.env.APP_URL || "http://localhost:3000";
        return {
          ...item,
          verificationUrl: `${appUrl}/verify/volunteer_certificate/${item.id}?t=${token}`
        };
      });
    } else if (collectionName === "assets") {
      // Real, scannable QR per asset card — lets anyone confirm a printed asset tag/
      // register entry is genuine, same mechanism as every other printable here.
      items = items.map(item => {
        const token = generateVerificationToken("asset", item.id);
        const appUrl = process.env.APP_URL || "http://localhost:3000";
        return {
          ...item,
          verificationUrl: `${appUrl}/verify/asset/${item.id}?t=${token}`
        };
      });
    }

    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to fetch ${collectionName}`, details: err.message });
  }
}

// Helper to save a single document in a collection
async function saveDocument(collectionName: string, id: string, data: any, req: AuthenticatedRequest, res: express.Response) {
  try {
    const docRef = db.collection(collectionName).doc(id);
    const docSnap = await docRef.get();
    
    // Conflict resolution check: reject writes based on a stale read.
    // IMPORTANT: this must be a non-2xx status. Returning 200 here previously caused
    // clients that don't specially inspect the response body to treat a silently-dropped
    // write as a success — the edit would appear to save, then vanish on next refresh
    // once the client re-pulled the real (unmodified) server record.
    if (docSnap.exists) {
      const currentDoc = docSnap.data()!;
      if (currentDoc.updatedAt && data.updatedAt && currentDoc.updatedAt > data.updatedAt) {
        // Current server record is newer than what the client's edit was based on.
        return res.status(409).json({
          id,
          ...currentDoc,
          resolved: "server-wins",
          conflict: true,
          error: "This record was changed elsewhere since you loaded it. Refresh and try again."
        });
      }
    }

    await docRef.set({
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to save ${collectionName} ${id}`, details: err.message });
  }
}

// Convenience wrapper: logs a create/update activity entry, then delegates to saveDocument.
// Fire-and-forget on the log write (logActivity already swallows its own errors) so a slow
// log write can never block or fail the primary save.
async function saveDocumentLogged(collectionName: string, moduleKey: string, labelField: string, req: AuthenticatedRequest, res: express.Response) {
  let before: any = undefined;
  try {
    const existingSnap = await db.collection(collectionName).doc(req.body.id).get();
    if (existingSnap.exists) before = existingSnap.data();
  } catch {
    // Non-fatal — proceed without a before-snapshot rather than blocking the save.
  }
  logActivity(req, moduleKey, before ? "edit" : "create", req.body.id, req.body[labelField] || req.body.id, before, req.body);
  return saveDocument(collectionName, req.body.id, req.body, req, res);
}

// Reads a file (private or otherwise) fully into memory, for cases where we need to
// copy content from a private path to a new public one (e.g. promoting an applicant's
// signup photo to their public profile photo on approval).
async function readFileBuffer(filePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = getFileStream(filePath);
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// 1. PROFILES (Only Chairperson / Admin can create/update profiles and assign roles)
app.get("/api/profiles", requireAuth, (req, res) => fetchCollection("profiles", req, res));

// Self-service: any authenticated user may update ONLY their own avatar photo, without
// needing roles:edit permission (which is reserved for staff editing OTHER people's role/
// profile data). This is deliberately a narrow whitelist, not a general self-edit endpoint.
app.post("/api/profiles/me/avatar", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { avatar } = req.body;
    if (!avatar || typeof avatar !== "string") {
      return res.status(400).json({ error: "avatar (a URL string) is required" });
    }
    await db.collection("profiles").doc(req.user!.id).set({ avatar, updatedAt: new Date().toISOString() }, { merge: true });
    logActivity(req, "dashboard", "update_avatar", req.user!.id, req.user!.name);
    return res.json({ success: true, avatar });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update profile photo", details: err.message });
  }
});

app.post("/api/profiles", requireAuth, requirePermission("roles", "edit"), async (req: AuthenticatedRequest, res): Promise<any> => {
  const profile = req.body;
  if (!profile.id) return res.status(400).json({ error: "Missing profile ID" });
  
  profile.roleKey = profile.roleKey || getCanonicalRoleKey(profile.role, profile.id);

  // Set default pin hash if not present
  if (!profile.passwordHash) {
    profile.passwordHash = hashPassword("1234");
  }
  return saveDocument("profiles", profile.id, profile, req, res);
});

// --- ROLE CRUD ENDPOINTS ---

app.get("/api/roles", requireAuth, async (req, res: express.Response): Promise<any> => {
  try {
    const rolesList = await getRoles();
    return res.json(rolesList);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch roles", details: err.message });
  }
});

// --- ROLE PERMISSIONS (dynamic permission matrix) ---

// Any authenticated user can fetch the full matrix — the client needs it to render nav
// for every role, not just their own, e.g. when the Chairperson edits other roles.
// Sensitive: this only exposes which modules/actions exist per role, not any org data.
app.get("/api/role_permissions", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const all = await getAllRolePermissions();
    return res.json(Object.values(all));
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch role permissions", details: err.message });
  }
});

// Convenience endpoint: resolved permission set for the CURRENT user's own role.
app.get("/api/role_permissions/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const userRoleKey = req.user!.roleKey || getCanonicalRoleKey(req.user!.role);
    if (userRoleKey === "chairperson") {
      // Chairperson is always superuser — return a fully-granted matrix so the UI never
      // has to special-case "am I chairperson" everywhere.
      const p: any = {};
      for (const m of PERMISSION_MODULE_KEYS) p[m] = fullPermSet();
      return res.json({ roleId: "chairperson", roleName: "Chairperson (Admin)", isSystemRole: true, orgId: "bashosho", permissions: p });
    }
    const rp = await getRolePermissionsForRoleKey(userRoleKey);
    return res.json(rp);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch your permissions", details: err.message });
  }
});

app.put("/api/role_permissions/:roleId", requireAuth, requirePermission("roles", "edit"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const { roleId } = req.params;
    const { permissions } = req.body;
    if (!permissions || typeof permissions !== "object") {
      return res.status(400).json({ error: "permissions object is required" });
    }

    const docRef = db.collection("role_permissions").doc(roleId);
    const existing = await docRef.get();
    const roles = await getRoles();
    const roleMeta = roles.find(r => r.id === roleId);
    if (!roleMeta) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Sanitize: only accept known module keys / action keys, never trust the body's shape blindly.
    const cleanPermissions: any = {};
    for (const m of PERMISSION_MODULE_KEYS) {
      const incoming = permissions[m] || {};
      cleanPermissions[m] = {};
      for (const a of PERMISSION_ACTIONS) {
        cleanPermissions[m][a] = !!incoming[a];
      }
    }

    const updated = {
      roleId,
      roleName: roleMeta.name || roleMeta.originalName || roleId,
      isSystemRole: !!roleMeta.isSystem,
      orgId: "bashosho",
      permissions: cleanPermissions,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user!.name
    };

    await docRef.set(updated, { merge: true });
    rolePermissionsCache = null; // invalidate cache so the change takes effect immediately

    await logActivity(req, "roles", "update_permissions", roleId, updated.roleName, existing.exists ? existing.data() : undefined, updated);

    return res.json({ success: true, rolePermissions: updated });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update role permissions", details: err.message });
  }
});

app.post("/api/roles", requireAuth, requirePermission("roles", "create"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Role name is required" });
    }

    const rolesList = await getRoles();
    const normalizedNewName = name.trim();
    if (rolesList.some(r => r.name.toLowerCase() === normalizedNewName.toLowerCase())) {
      return res.status(400).json({ error: "A role with this name already exists" });
    }

    const id = "role-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
    const targetRoleKey = getCanonicalRoleKey(normalizedNewName, id, true);
    const newRole = {
      id,
      roleKey: targetRoleKey,
      name: normalizedNewName,
      originalName: normalizedNewName,
      description: description || "",
      isSystem: false
    };

    await db.collection("roles").doc(id).set(newRole);
    rolesCache = []; // invalidate cache

    // A brand-new custom role starts with NO access at all until the Chairperson
    // deliberately grants it permissions in the Role Management panel — safer default
    // than guessing which modules it should see.
    const newRolePermissions = {
      roleId: id,
      roleName: normalizedNewName,
      isSystemRole: false,
      orgId: "bashosho",
      permissions: (() => {
        const p: any = {};
        for (const m of PERMISSION_MODULE_KEYS) p[m] = emptyPermSet();
        p.dashboard.view = true;
        p.handbook.view = true;
        return p;
      })(),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user!.name
    };
    await db.collection("role_permissions").doc(id).set(newRolePermissions);
    rolePermissionsCache = null;

    await logActivity(req, "roles", "create", id, normalizedNewName, undefined, newRole);

    return res.json({ success: true, role: newRole });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to create role", details: err.message });
  }
});

app.put("/api/roles/:id", requireAuth, requirePermission("roles", "edit"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Role name is required" });
    }

    const docRef = db.collection("roles").doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Role not found" });
    }

    const currentRole = docSnap.data()!;
    const oldName = currentRole.name;
    const newName = name.trim();

    // Check uniqueness if renaming
    if (newName.toLowerCase() !== oldName.toLowerCase()) {
      const rolesList = await getRoles();
      if (rolesList.some(r => r.id !== id && r.name.toLowerCase() === newName.toLowerCase())) {
        return res.status(400).json({ error: "A role with this name already exists" });
      }
    }

    const updatedRole = {
      ...currentRole,
      roleKey: currentRole.roleKey || getCanonicalRoleKey(currentRole.name || currentRole.originalName || id, id, true),
      name: newName,
      description: description || ""
    };

    await docRef.set(updatedRole);
    rolesCache = []; // invalidate cache

    // If role name changed, do a cascade update on display labels while preserving profile roleKeys
    if (oldName !== newName) {
      // 1. Update profiles display role
      const profilesSnap = await db.collection("profiles").where("role", "==", oldName).get();
      if (profilesSnap.docs.length > 0) {
        const batch = db.batch();
        profilesSnap.docs.forEach(pDoc => {
          batch.update(pDoc.ref, { role: newName });
        });
        await batch.commit();
      }

      // 2. Update leadership appointments
      const appointmentsSnap = await db.collection("leadership_appointments").where("role", "==", oldName).get();
      if (appointmentsSnap.docs.length > 0) {
        const appointmentBatch = db.batch();
        appointmentsSnap.docs.forEach(aDoc => {
          appointmentBatch.update(aDoc.ref, { role: newName });
        });
        await appointmentBatch.commit();
      }

      // 3. Update contract renewals
      const renewalsSnap = await db.collection("contract_renewals").where("userRole", "==", oldName).get();
      if (renewalsSnap.docs.length > 0) {
        const renewalBatch = db.batch();
        renewalsSnap.docs.forEach(rDoc => {
          renewalBatch.update(rDoc.ref, { userRole: newName });
        });
        await renewalBatch.commit();
      }
    }

    // Keep role_permissions.roleName in sync with any rename, without touching the
    // permission matrix itself.
    await db.collection("role_permissions").doc(id).set({ roleName: newName }, { merge: true });
    rolePermissionsCache = null;

    await logActivity(req, "roles", "update", id, newName, { name: oldName }, { name: newName });

    return res.json({ success: true, role: updatedRole });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update role", details: err.message });
  }
});

app.delete("/api/roles/:id", requireAuth, requirePermission("roles", "delete"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reassignTo } = req.body; // target role name to reassign users to

    const docRef = db.collection("roles").doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Role not found" });
    }

    const roleData = docSnap.data()!;
    if (roleData.isSystem) {
      return res.status(400).json({ error: "Core System roles cannot be deleted to protect integrity of access controls." });
    }

    const roleName = roleData.name;

    // Check if there are profiles with this role
    const profilesSnap = await db.collection("profiles").where("role", "==", roleName).get();
    const affectedCount = profilesSnap.docs.length;

    if (affectedCount > 0) {
      if (!reassignTo || !reassignTo.trim()) {
        return res.status(400).json({ 
          error: "Reassignment required", 
          details: `There are ${affectedCount} members currently assigned to "${roleName}". Please select another role to reassign them to before deleting.` 
        });
      }

      const newRoleKey = getCanonicalRoleKey(reassignTo.trim());

      // Reassign users
      const batch = db.batch();
      profilesSnap.docs.forEach(pDoc => {
        batch.update(pDoc.ref, { role: reassignTo.trim(), roleKey: newRoleKey });
      });
      await batch.commit();

      // Also cascade update appointments/renewals
      const appointmentsSnap = await db.collection("leadership_appointments").where("role", "==", roleName).get();
      if (appointmentsSnap.docs.length > 0) {
        const appointmentBatch = db.batch();
        appointmentsSnap.docs.forEach(aDoc => {
          appointmentBatch.update(aDoc.ref, { role: reassignTo.trim() });
        });
        await appointmentBatch.commit();
      }

      const renewalsSnap = await db.collection("contract_renewals").where("userRole", "==", roleName).get();
      if (renewalsSnap.docs.length > 0) {
        const renewalBatch = db.batch();
        renewalsSnap.docs.forEach(rDoc => {
          renewalBatch.update(rDoc.ref, { userRole: reassignTo.trim() });
        });
        await renewalBatch.commit();
      }
    }

    await docRef.delete();
    rolesCache = []; // invalidate cache

    await db.collection("role_permissions").doc(id).delete().catch(() => {});
    rolePermissionsCache = null;

    await logActivity(req, "roles", "delete", id, roleName, roleData, undefined);

    return res.json({ success: true, reassignedCount: affectedCount });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete role", details: err.message });
  }
});

app.post("/api/roles/reassign", requireAuth, requirePermission("roles", "edit"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const { userId, fromRole, toRole } = req.body;

    if (!toRole || !toRole.trim()) {
      return res.status(400).json({ error: "Destination role is required." });
    }

    const targetToRole = toRole.trim();
    const newRoleKey = getCanonicalRoleKey(targetToRole);

    if (userId) {
      const userDocRef = db.collection("profiles").doc(userId);
      const userSnap = await userDocRef.get();
      if (!userSnap.exists) {
        return res.status(404).json({ error: "User profile not found." });
      }

      const oldRole = userSnap.data()!.role;
      await userDocRef.update({ role: targetToRole, roleKey: newRoleKey });
      return res.json({ success: true, message: `Successfully reassigned user from "${oldRole}" to "${targetToRole}".` });
    } else if (fromRole) {
      const oldRole = fromRole.trim();
      const profilesSnap = await db.collection("profiles").where("role", "==", oldRole).get();
      const affectedCount = profilesSnap.docs.length;

      if (affectedCount > 0) {
        const batch = db.batch();
        profilesSnap.docs.forEach(pDoc => {
          batch.update(pDoc.ref, { role: targetToRole, roleKey: newRoleKey });
        });
        await batch.commit();

        const appointmentsSnap = await db.collection("leadership_appointments").where("role", "==", oldRole).get();
        if (appointmentsSnap.docs.length > 0) {
          const appointmentBatch = db.batch();
          appointmentsSnap.docs.forEach(aDoc => {
            appointmentBatch.update(aDoc.ref, { role: targetToRole });
          });
          await appointmentBatch.commit();
        }

        const renewalsSnap = await db.collection("contract_renewals").where("userRole", "==", oldRole).get();
        if (renewalsSnap.docs.length > 0) {
          const renewalBatch = db.batch();
          renewalsSnap.docs.forEach(rDoc => {
            renewalBatch.update(rDoc.ref, { userRole: targetToRole });
          });
          await renewalBatch.commit();
        }
      }

      return res.json({ success: true, count: affectedCount, message: `Successfully reassigned ${affectedCount} members from "${oldRole}" to "${targetToRole}".` });
    } else {
      return res.status(400).json({ error: "Either userId or fromRole is required for reassignment." });
    }
  } catch (err: any) {
    return res.status(500).json({ error: "Reassignment failed", details: err.message });
  }
});

// 2. DOCUMENTS
app.get("/api/documents", requireAuth, requirePermission("documents", "view"), (req, res) => fetchCollection("documents", req, res));

app.post("/api/documents", requireAuth, requirePermission("documents", "create"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  const doc = req.body;
  if (!doc.id) return res.status(400).json({ error: "Missing document ID" });

  try {
    // Append server-side audit trail log entry
    const auditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      documentId: doc.id,
      action: "Document Saved/Modified",
      user: req.user!.name,
      userRole: req.user!.role,
      timestamp: new Date().toISOString(),
      notes: "Saved via real-time online CBO system"
    };
    await db.collection("document_audit_trails").doc(auditEntry.id).set(auditEntry);
    logActivity(req, "documents", "save", doc.id, doc.title || doc.name || doc.id);

    // Keep locally too, but enforce immutability server-side
    return saveDocument("documents", doc.id, doc, req, res);
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to write audit trail", details: error.message });
  }
});

// Document audit trail logs
app.get("/api/documents/:id/audit", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const snap = await db.collection("document_audit_trails").where("documentId", "==", req.params.id).orderBy("timestamp", "desc").get();
    const items = snap.docs.map(doc => doc.data());
    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch document audit logs", details: err.message });
  }
});

// 3. BUDGETS
app.get("/api/budgets", requireAuth, requirePermission("finance", "view"), (req, res) => fetchCollection("budgets", req, res));

app.post("/api/budgets", requireAuth, requirePermission("finance", "create"), (req, res) => {
  const item = req.body;
  return saveDocument("budgets", item.id, item, req, res);
});

// 4. EXPENDITURES (With Role Gates, Self-Approval check, and Append-only audit trails)
app.get("/api/expenditures", requireAuth, requirePermission("finance", "view"), (req, res) => fetchCollection("expenditures", req, res));

// Default 2-tier chain, used when the org has not configured a custom
// expenditureApprovalChain in Org Settings — reproduces the exact legacy behavior.
const LEGACY_EXPENDITURE_TIERS: any[] = [
  { id: "legacy-low", label: "Under Ksh 10,000", minAmount: 0, approverRoleKeys: ["treasurer_or_chairperson"] },
  { id: "legacy-high", label: "Ksh 10,000 and above", minAmount: 10000, approverRoleKeys: ["chairperson"] }
];

async function getExpenditureApprovalTiers(): Promise<any[]> {
  try {
    const doc = await db.collection("org_settings").doc("global").get();
    const chain = doc.exists ? doc.data()?.expenditureApprovalChain : null;
    if (Array.isArray(chain) && chain.length > 0) return chain;
  } catch (err) {
    console.error("Error loading expenditureApprovalChain, using legacy default:", err);
  }
  return LEGACY_EXPENDITURE_TIERS;
}

// Picks the tier with the highest minAmount that the given amount still qualifies for.
function pickTierForAmount(tiers: any[], amount: number): any {
  const sorted = [...tiers].sort((a, b) => (a.minAmount || 0) - (b.minAmount || 0));
  let match = sorted[0];
  for (const t of sorted) {
    if (amount >= (t.minAmount || 0)) match = t;
  }
  return match;
}

app.post("/api/expenditures", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  const expenditure = req.body;
  if (!expenditure.id) return res.status(400).json({ error: "Missing expenditure ID" });

  try {
    const existingSnap = await db.collection("expenditures").doc(expenditure.id).get();

    if (!existingSnap.exists) {
      // Creating a brand-new expenditure request. This is intentionally gated behind the
      // same "finance:create" permission as budgets/incomes (rather than open to any
      // authenticated user) — anyone able to submit a spend request already has finance
      // visibility under the default role setup, and financial claims shouldn't be
      // submittable by roles that can't see finance at all.
      if (!(await userHasPermission(req, "finance", "create"))) {
        return res.status(403).json({ error: "You do not have permission to submit expenditure requests." });
      }

      // Reject anything that isn't a genuine positive amount rather than silently coercing it.
      const amountNum = Number(expenditure.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: "Expenditure amount must be a positive number." });
      }
      expenditure.amount = amountNum;

      // A new request can NEVER start pre-approved or pre-rejected, no matter what the
      // request body claims — every expenditure must go through the tiered approval chain
      // below on a later request. This is what actually closes the gap: previously a new
      // record's status/approvals were saved completely as submitted, with no chain, no
      // audit trail entry, and no permission check at all.
      expenditure.status = "pending";
      expenditure.approvals = [];
      expenditure.requestedBy = req.user!.name;
      expenditure.requestedById = req.user!.id;

      await logActivity(req, "finance", "expenditure_request", expenditure.id, expenditure.description);
      return saveDocument("expenditures", expenditure.id, expenditure, req, res);
    }

    {
      const existing = existingSnap.data()!;

      // Once an expenditure is fully approved, it represents money that has actually
      // moved and been through the full approval chain — silently overwriting its
      // amount/description/category afterward would undermine the entire approval
      // record. Professional accounting practice is to post a new adjusting entry
      // referencing the original, not edit settled history. Status-only changes (e.g.
      // a later admin correction workflow) are handled by the block below, not here.
      if (existing.status === "approved") {
        const coreFieldsChanged =
          Number(existing.amount) !== Number(expenditure.amount) ||
          existing.description !== expenditure.description ||
          existing.category !== expenditure.category;
        if (coreFieldsChanged) {
          return res.status(403).json({
            error: "This expenditure is already approved and locked for audit integrity.",
            details: "To correct an approved expenditure, submit a new adjusting expenditure entry that references this one in its description, rather than editing the original."
          });
        }
      }

      // If the status is changing to approved/rejected, perform verification
      if (existing.status !== expenditure.status && (expenditure.status === "approved" || expenditure.status === "rejected")) {

        // Self-approval check
        if (existing.requestedBy === req.user!.name) {
          return res.status(400).json({ error: "Security Restriction: Self-approval is strictly forbidden." });
        }

        const userRoleKey = req.user!.roleKey || getCanonicalRoleKey(req.user!.role);
        const amount = Number(existing.amount);
        const tiers = await getExpenditureApprovalTiers();
        const tier = pickTierForAmount(tiers, amount);
        const chainRoles: string[] = tier.approverRoleKeys || [];
        const existingApprovals: any[] = Array.isArray(existing.approvals) ? existing.approvals : [];

        if (expenditure.status === "rejected") {
          // Any single required approver in the chain can reject and immediately end the flow.
          const roleIsInChain = chainRoles.some((rk: string) =>
            rk === userRoleKey || (rk === "treasurer_or_chairperson" && ["treasurer", "chairperson"].includes(userRoleKey))
          );
          if (!roleIsInChain && userRoleKey !== "chairperson") {
            return res.status(403).json({ error: "You are not an authorized approver for this expenditure." });
          }
          expenditure.approvals = [...existingApprovals, {
            roleKey: userRoleKey, approverId: req.user!.id, approverName: req.user!.name,
            timestamp: new Date().toISOString(), decision: "rejected", notes: expenditure.rejectionReason
          }];
        } else {
          // "approved" — walk the chain: find the next required role not yet approved.
          const approvedRoleKeys = existingApprovals.filter(a => a.decision === "approved").map(a => a.roleKey);
          const nextRequiredIndex = chainRoles.findIndex(rk => {
            const matches = (candidate: string) => rk === "treasurer_or_chairperson"
              ? ["treasurer", "chairperson"].includes(candidate)
              : rk === candidate;
            return !approvedRoleKeys.some(matches);
          });

          if (nextRequiredIndex === -1) {
            return res.status(400).json({ error: "This expenditure has already completed its approval chain." });
          }

          const requiredRoleKey = chainRoles[nextRequiredIndex];
          const userQualifies = requiredRoleKey === "treasurer_or_chairperson"
            ? ["treasurer", "chairperson"].includes(userRoleKey)
            : requiredRoleKey === userRoleKey || userRoleKey === "chairperson";

          if (!userQualifies) {
            return res.status(403).json({
              error: `This expenditure requires approval from '${requiredRoleKey.replace(/_/g, " ")}' next.`,
            });
          }

          const newApprovals = [...existingApprovals, {
            roleKey: userRoleKey, approverId: req.user!.id, approverName: req.user!.name,
            timestamp: new Date().toISOString(), decision: "approved"
          }];
          expenditure.approvals = newApprovals;

          // Only mark fully "approved" once every tier in the chain has an approval.
          const stillApprovedRoleKeys = newApprovals.filter((a: any) => a.decision === "approved").map((a: any) => a.roleKey);
          const chainComplete = chainRoles.every(rk => {
            const matches = (candidate: string) => rk === "treasurer_or_chairperson"
              ? ["treasurer", "chairperson"].includes(candidate)
              : rk === candidate;
            return stillApprovedRoleKeys.some(matches);
          });
          if (!chainComplete) {
            expenditure.status = existing.status; // keep prior in-progress status, don't jump to "approved" yet
          }
        }
        expenditure.approvalTierId = tier.id;

        // Add to append-only financial audit trail
        const auditEntry = {
          id: `finaudit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          expenditureId: expenditure.id,
          amount: amount,
          action: `Expenditure ${expenditure.status.toUpperCase()}`,
          user: req.user!.name,
          userRole: req.user!.role,
          timestamp: new Date().toISOString()
        };
        await db.collection("financial_audit_trails").doc(auditEntry.id).set(auditEntry);
        await logActivity(req, "finance", `expenditure_${expenditure.status}`, expenditure.id, expenditure.description, { status: existing.status }, { status: expenditure.status });
      }
    }

    return saveDocument("expenditures", expenditure.id, expenditure, req, res);
  } catch (error: any) {
    return res.status(500).json({ error: "Expenditure save failed", details: error.message });
  }
});

// Financial Audit Trail Endpoint
app.get("/api/financial-audit", requireAuth, requirePermission("finance", "view"), (req, res) => fetchCollection("financial_audit_trails", req, res));

// --- UNIFIED ACTIVITY LOG ---
app.get("/api/activity_log", requireAuth, requirePermission("activity_log", "view"), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { module, actorId, action, from, to, search, cursor } = req.query as Record<string, string | undefined>;
    const pageSize = Math.min(Number(req.query.pageSize) || 50, 200);

    let query: FirebaseFirestore.Query = db.collection("activity_log").orderBy("timestamp", "desc");
    if (module) query = query.where("module", "==", module);
    if (actorId) query = query.where("actorId", "==", actorId);
    if (action) query = query.where("action", "==", action);

    if (cursor) {
      const cursorDoc = await db.collection("activity_log").doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const snap = await query.limit(pageSize * 3).get(); // overfetch a bit to allow client-side text/date filtering below
    let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    if (from) items = items.filter(i => i.timestamp >= from);
    if (to) items = items.filter(i => i.timestamp <= to);
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(i =>
        (i.targetLabel || "").toLowerCase().includes(s) ||
        (i.actorName || "").toLowerCase().includes(s) ||
        (i.action || "").toLowerCase().includes(s)
      );
    }

    items = items.slice(0, pageSize);
    const nextCursor = items.length === pageSize ? items[items.length - 1].id : null;

    return res.json({ items, nextCursor });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch activity log", details: err.message });
  }
});

// 5. SAFEGUARDING REPORTS (Restricted, Column-level Encrypted, Immutable Access Logged)
app.get("/api/safeguarding", requireAuth, requirePermission("safeguarding", "view"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const snap = await db.collection("safeguarding_reports").get();
    
    // Log immutable access
    const logEntry = {
      id: `sglog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user: req.user!.name,
      userRole: req.user!.role,
      accessedAt: new Date().toISOString(),
      action: "VIEW_ALL_REPORTS"
    };
    await db.collection("safeguarding_access_logs").doc(logEntry.id).set(logEntry);

    const reports = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        description: decrypt(data.description || ""),
        notes: decrypt(data.notes || "")
      };
    });

    return res.json(reports);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch safeguarding reports", details: err.message });
  }
});

app.post("/api/safeguarding", requireAuth, requirePermission("safeguarding", "create"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  const report = req.body;
  if (!report.id) return res.status(400).json({ error: "Missing report ID" });

  try {
    // Encrypt fields before writing to database
    const encryptedReport = {
      ...report,
      description: encrypt(report.description || ""),
      notes: encrypt(report.notes || ""),
      updatedAt: new Date().toISOString()
    };

    // Log the write action
    const logEntry = {
      id: `sglog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user: req.user!.name,
      userRole: req.user!.role,
      accessedAt: new Date().toISOString(),
      action: `SAVE_REPORT_ID_${report.id}`
    };
    await db.collection("safeguarding_access_logs").doc(logEntry.id).set(logEntry);

    await db.collection("safeguarding_reports").doc(report.id).set(encryptedReport, { merge: true });
    logActivity(req, "safeguarding", "save", report.id, undefined); // targetLabel omitted deliberately; module is auto-redacted anyway
    return res.json({ success: true, id: report.id });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to write safeguarding report", details: error.message });
  }
});

// Safeguarding Immutable access log endpoint (officers / admins only)
app.get("/api/safeguarding-access-logs", requireAuth, requirePermission("safeguarding", "view"), (req, res) => {
  return fetchCollection("safeguarding_access_logs", req, res);
});

// GENERIC DELETE ENDPOINT (with strict role-based access checks)
const DELETE_COLLECTION_MODULE_MAP: Record<string, string> = {
  grants: "grants",
  classes: "classes",
  invoices: "invoices",
  incomes: "finance",
  expenditures: "finance",
  gallery_images: "cms_editor",
  assets: "assets",
  documents: "documents",
  beneficiaries: "beneficiaries",
  leadership_appointments: "leadership_appointments",
  partners: "invoices",
  tasks: "tasks",
  program_sessions: "program_sessions",
  volunteer_certificates: "volunteer_recognition"
};

// These collections must never be deletable through the generic endpoint below, by ANY
// role — including the chairperson superuser bypass. Their entire purpose is to remain
// intact even if the admin account itself is compromised or the person acting through it
// is trying to cover something up; an audit trail an admin can selectively erase from
// isn't an audit trail. This check runs before the chairperson bypass, not alongside it.
const IMMUTABLE_COLLECTIONS = new Set([
  "activity_log",
  "financial_audit_trails",
  "safeguarding_access_logs",
  "safeguarding_reports"
]);

app.delete("/api/:collection/:id", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  const { collection, id } = req.params;
  const userRoleKey = req.user!.roleKey || getCanonicalRoleKey(req.user!.role);

  if (IMMUTABLE_COLLECTIONS.has(collection)) {
    console.warn(`[Audit Integrity] Blocked delete attempt on immutable collection '${collection}' by ${req.user!.name} (${userRoleKey}), doc ${id}`);
    return res.status(403).json({ error: `Records in '${collection}' are append-only and cannot be deleted, including by chairperson accounts.` });
  }

  // Chairperson remains superuser for delete on any OTHER collection, including ones with
  // no explicit module mapping below (matches old "default fallback: chairperson only").
  let allowed = userRoleKey === "chairperson";
  if (!allowed) {
    const moduleKey = DELETE_COLLECTION_MODULE_MAP[collection];
    if (moduleKey) {
      allowed = await userHasPermission(req, moduleKey, "delete");
    }
  }

  if (!allowed) {
    return res.status(403).json({ error: `Forbidden: You do not have permission to delete from collection: ${collection}` });
  }

  try {
    const docRef = db.collection(collection).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (collection === "expenditures") {
      const existing = snap.data()!;
      const auditEntry = {
        id: `finaudit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        expenditureId: id,
        amount: Number(existing.amount) || 0,
        action: `EXPENDITURE DELETED`,
        user: req.user!.name,
        userRole: req.user!.role,
        timestamp: new Date().toISOString()
      };
      await db.collection("financial_audit_trails").doc(auditEntry.id).set(auditEntry);
    } else if (collection === "incomes") {
      const existing = snap.data()!;
      const auditEntry = {
        id: `finaudit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        incomeId: id,
        amount: Number(existing.amount) || 0,
        action: `INCOME DELETED`,
        user: req.user!.name,
        userRole: req.user!.role,
        timestamp: new Date().toISOString()
      };
      await db.collection("financial_audit_trails").doc(auditEntry.id).set(auditEntry);
    }

    await docRef.delete();
    return res.json({ success: true, message: `Successfully deleted document ${id} from ${collection}` });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to delete document", details: error.message });
  }
});

// 6. ASSETS
app.get("/api/public/assets", async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const snap = await db.collection("assets").get();
    let assets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    let hireable = assets.filter((a: any) => a.availableForHire === true);
    return res.json(hireable);
  } catch (err: any) {
    console.error("Fetch public assets failed:", err);
    return res.status(500).json({ error: "Failed to fetch equipment for hire" });
  }
});

app.post("/api/public/asset_hire", async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { assetId, clientName, clientPhone, clientEmail, startDate, endDate, purpose } = req.body;

    if (!assetId || !clientName || !clientPhone || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields (assetId, clientName, clientPhone, startDate, endDate)." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    let assetDocRef = db.collection("assets").doc(assetId);
    let assetSnap = await assetDocRef.get();

    if (!assetSnap.exists) {
      return res.status(404).json({ error: "Equipment item not found" });
    }
    const assetData: any = assetSnap.data();

    const dailyRate = Number(assetData.dailyRate) || 1500;
    const totalAmount = dailyRate * diffTime;
    const rentalId = `rent-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newRental = {
      id: rentalId,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail ? clientEmail.trim() : "",
      startDate,
      endDate,
      days: diffTime,
      totalAmount,
      purpose: purpose || "Equipment Rental",
      paymentStatus: "pending",
      status: "reserved",
      tillNumber: "8671238",
      createdAt: new Date().toISOString()
    };

    const externalRentals = Array.isArray(assetData.externalRentals) ? assetData.externalRentals : [];
    externalRentals.push(newRental);

    await assetDocRef.update({
      externalRentals,
      updatedAt: new Date().toISOString()
    });

    // Auto-generate a pending Invoice in invoices collection
    const invoiceId = `inv-rent-${Date.now().toString().slice(-6)}`;
    const newInvoice = {
      id: invoiceId,
      invoiceNumber: `INV-RENT-${Math.floor(1000 + Math.random() * 9000)}`,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail ? clientEmail.trim() : "",
      serviceDescription: `Rental of ${assetData.name} (${diffTime} day${diffTime > 1 ? "s" : ""} @ Ksh ${dailyRate.toLocaleString()}/day)`,
      amount: totalAmount,
      currency: "KES",
      status: "unpaid",
      dueDate: startDate,
      tillNumber: "8671238",
      notes: `Asset Hire Rental ID: ${rentalId}. Purpose: ${purpose || "N/A"}`,
      items: [
        {
          description: `${assetData.name} Rental (${diffTime} day${diffTime > 1 ? "s" : ""})`,
          quantity: diffTime,
          unitPrice: dailyRate,
          totalPrice: totalAmount
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.collection("invoices").doc(invoiceId).set(newInvoice);

    return res.status(201).json({
      success: true,
      rentalId,
      invoiceId,
      totalAmount,
      days: diffTime,
      assetName: assetData.name,
      tillNumber: "8671238",
      message: `Equipment hire request submitted successfully. Total Ksh ${totalAmount.toLocaleString()} payable via Till 8671238.`
    });
  } catch (err: any) {
    console.error("Public asset hire endpoint failed:", err);
    return res.status(500).json({ error: "Failed to process equipment hire request", details: err.message });
  }
});

// Public safeguarding/GBV/child-protection concern reporting — deliberately NOT behind
// requireAuth. A community member reporting abuse must never be required to have a
// staff login. Rate-limited against spam/abuse. Reuses the same encryption as the
// internal staff-facing /api/safeguarding endpoint.
const safeguardingReportRateLimiter = makeRateLimiter("public-safeguarding", 5, 60 * 60 * 1000);
app.post("/api/public/safeguarding-report", safeguardingReportRateLimiter, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { description, reporterName, reporterContact } = req.body;
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: "Please describe your concern before submitting." });
    }

    const reportId = `sg-public-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const encryptedReport = {
      id: reportId,
      title: "Confidential Safeguarding/GBV Notice (Public Submission)",
      reporterName: reporterName?.trim() || "Anonymous",
      reporterContact: reporterContact?.trim() || "N/A",
      description: encrypt(String(description).trim()),
      notes: encrypt("Submitted via public homepage reporting form."),
      reportedDate: new Date().toISOString().split("T")[0],
      status: "received",
      assignedTo: "Safeguarding Focal Point",
      updatedAt: new Date().toISOString()
    };

    const logEntry = {
      id: `sglog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user: "Public Website Visitor",
      userRole: "public",
      accessedAt: new Date().toISOString(),
      action: `PUBLIC_SUBMIT_REPORT_ID_${reportId}`
    };
    await db.collection("safeguarding_access_logs").doc(logEntry.id).set(logEntry);
    await db.collection("safeguarding_reports").doc(reportId).set(encryptedReport);

    return res.status(201).json({ success: true, message: "Report received." });
  } catch (err: any) {
    console.error("Public safeguarding report endpoint failed:", err);
    // Even on server error, never claim success for a safety-critical report — the
    // homepage form must show a real error here, not a fake confirmation.
    return res.status(500).json({ error: "Failed to submit your report. Please try again or contact us directly by phone." });
  }
});

// Public program/partnership/TaaS booking inquiries — creates a lead in the Grants
// pipeline (status "identified") for staff to follow up on. Previously the homepage
// tried to call the staff-only authenticated /api/grants endpoint directly, which always
// failed with 401 for anonymous visitors and surfaced no error to them at all.
const publicInquiryRateLimiter = makeRateLimiter("public-inquiry", 10, 60 * 60 * 1000);
app.post("/api/public/inquiry", publicInquiryRateLimiter, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { name, contactName, contactPhone, contactEmail, amount, deadline, notes } = req.body;
    const orgOrContactName = name || contactName;
    if (!orgOrContactName || !contactPhone) {
      return res.status(400).json({ error: "Name and phone number are required." });
    }

    const grantId = `grant-inq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newGrant = {
      id: grantId,
      name: String(orgOrContactName).slice(0, 200),
      funder: `${orgOrContactName} — Contact: ${contactPhone}${contactEmail ? " / " + contactEmail : ""}`,
      amount: Number(amount) || 0,
      deadline: deadline || new Date().toISOString().split("T")[0],
      probability: 60,
      status: "identified",
      notes: String(notes || "").slice(0, 3000),
      // Set server-side, never trusted from the client — this is what lets the
      // Grants dashboard visually flag "this came from the public website" and
      // is why staff can trust it wasn't spoofed by someone posting directly to
      // this endpoint claiming to be a manual entry.
      source: "public_website",
      contactPhone: String(contactPhone).slice(0, 30),
      contactEmail: contactEmail ? String(contactEmail).slice(0, 200) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection("grants").doc(grantId).set(newGrant);
    return res.status(201).json({ success: true, referenceId: grantId });
  } catch (err: any) {
    console.error("Public inquiry endpoint failed:", err);
    return res.status(500).json({ error: "Failed to submit your inquiry. Please try again or contact us directly." });
  }
});

app.get("/api/assets", requireAuth, requirePermission("assets", "view"), (req, res) => fetchCollection("assets", req, res));
app.post("/api/assets", requireAuth, requirePermission("assets", "create"), (req: AuthenticatedRequest, res) => saveDocumentLogged("assets", "assets", "name", req, res));

// 7. ATTENDANCE
app.get("/api/attendance", requireAuth, requirePermission("classes", "view"), (req, res) => fetchCollection("attendance_sheets", req, res));
app.post("/api/attendance", requireAuth, requirePermission("classes", "edit"), (req, res) => saveDocument("attendance_sheets", req.body.id, req.body, req, res));

// 8. PARTNERS
app.get("/api/partners", requireAuth, requirePermission("invoices", "view"), (req, res) => fetchCollection("partners", req, res));
app.post("/api/partners", requireAuth, requirePermission("invoices", "create"), (req: AuthenticatedRequest, res) => saveDocumentLogged("partners", "invoices", "name", req, res));

// 9. INCOMES
app.get("/api/incomes", requireAuth, requirePermission("finance", "view"), (req, res) => fetchCollection("incomes", req, res));
app.post("/api/incomes", requireAuth, requirePermission("finance", "create"), (req: AuthenticatedRequest, res) => saveDocumentLogged("incomes", "finance", "description", req, res));

// 10. GRANTS
app.get("/api/grants", requireAuth, requirePermission("grants", "view"), (req, res) => fetchCollection("grants", req, res));
app.post("/api/grants", requireAuth, requirePermission("grants", "create"), (req: AuthenticatedRequest, res) => saveDocumentLogged("grants", "grants", "name", req, res));

// 11. CLASSES
// GET stays view-gated for consistency/defense-in-depth even though every default role
// already includes classes:view — this matters for custom roles created via the Role
// Management panel, which start with NO permissions until deliberately granted (see the
// role-creation fix earlier in this audit), so a custom role should NOT see class data
// unless someone explicitly checked that box.
app.get("/api/classes", requireAuth, requirePermission("classes", "view"), (req, res) => fetchCollection("classes", req, res));
// Creating/editing a class previously had no permission check at all beyond being logged
// in — any authenticated account, including the lowest-privilege roles, could create or
// modify class/program records.
app.post("/api/classes", requireAuth, requirePermission("classes", "edit"), (req, res) => saveDocument("classes", req.body.id, req.body, req, res));

// 12. BROADCASTS
app.get("/api/broadcasts", requireAuth, (req, res) => fetchCollection("broadcasts", req, res));
app.post("/api/broadcasts", requireAuth, requirePermission("cms_editor", "create"), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const sentBy = `${req.user!.name} (${req.user!.role})`;
    req.body.sentBy = sentBy;
    req.body.sentDate = new Date().toISOString();
    return saveDocument("broadcasts", req.body.id, req.body, req, res);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to post broadcast", details: err.message });
  }
});

// 13. LEAVE REQUESTS
// Anyone can see their own leave requests; only the roles who can actually approve them
// (chairperson / programs_director) see everyone's. Previously ANY authenticated account
// could list every member's leave requests — personal HR data (dates, reasons) that
// should only be visible to the person who filed it and whoever approves it.
app.get("/api/leave_requests", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const snap = await db.collection("leave_requests").get();
    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    const userRoleKey = req.user!.roleKey || getCanonicalRoleKey(req.user!.role);
    if (["chairperson", "programs_director"].includes(userRoleKey)) {
      return res.json(items);
    }
    return res.json(items.filter(item => item.userId === req.user!.id));
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch leave requests", details: err.message });
  }
});
app.post("/api/leave_requests", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  const { id, status, userId } = req.body;
  const userRoleKey = req.user!.roleKey || getCanonicalRoleKey(req.user!.role);
  
  if (status === "approved" || status === "rejected") {
    // 1. Check permissions: must be Chairperson or Programs Director to approve/reject
    if (!["chairperson", "programs_director"].includes(userRoleKey)) {
      return res.status(403).json({ error: "Access denied: insufficient privileges to approve/reject leave requests" });
    }
    // 2. Self-approval block: cannot approve/reject your own leave request
    if (userId === req.user!.id) {
      return res.status(403).json({ error: "Access denied: you cannot approve or reject your own leave request" });
    }
    // Overwrite respondedBy server-side to prevent client spoofing
    req.body.respondedBy = req.user!.name;
  } else {
    // Creation or self-edits: can only submit or edit your own leave requests
    if (userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied: you can only submit or edit your own leave requests" });
    }
  }
  return saveDocument("leave_requests", id, req.body, req, res);
});

// 14. INVOICES
app.get("/api/invoices", requireAuth, requirePermission("invoices", "view"), (req, res) => fetchCollection("invoices", req, res));
app.post("/api/invoices", requireAuth, requirePermission("invoices", "create"), (req: AuthenticatedRequest, res) => saveDocumentLogged("invoices", "invoices", "invoiceNumber", req, res));

// 15. ORG SETTINGS
app.get("/api/org_settings", requireAuth, async (req, res: express.Response) => {
  try {
    const doc = await db.collection("org_settings").doc("global").get();
    return res.json(doc.data() || {});
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch settings", details: err.message });
  }
});
app.post("/api/org_settings", requireAuth, requirePermission("settings", "edit"), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    await db.collection("org_settings").doc("global").set(req.body);
    logActivity(req, "settings", "save", "global", "Organization Settings");
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to save settings", details: err.message });
  }
});

// 16. CONTRACT RENEWALS
// Same fix as leave_requests: anyone could previously list every member's contract
// renewal record. Now non-chairperson users only see their own.
app.get("/api/contract_renewals", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const snap = await db.collection("contract_renewals").get();
    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    const userRoleKey = req.user!.roleKey || getCanonicalRoleKey(req.user!.role);
    if (userRoleKey === "chairperson") {
      return res.json(items);
    }
    return res.json(items.filter(item => item.userId === req.user!.id));
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch contract renewals", details: err.message });
  }
});
app.post("/api/contract_renewals", requireAuth, async (req: AuthenticatedRequest, res): Promise<any> => {
  const { id, status, userId } = req.body;
  const userRoleKey = req.user!.roleKey || getCanonicalRoleKey(req.user!.role);
  
  if (status === "approved" || status === "rejected") {
    // 1. Check permissions: only Chairperson can approve/reject renewals
    if (userRoleKey !== "chairperson") {
      return res.status(403).json({ error: "Access denied: only the Chairperson can review contract renewals" });
    }
    // 2. Self-approval block: Chairperson cannot approve their own contract renewal
    if (userId === req.user!.id) {
      return res.status(403).json({ error: "Access denied: you cannot approve your own contract renewal" });
    }
    // Overwrite reviewedBy and reviewedDate server-side to prevent client spoofing
    req.body.reviewedBy = req.user!.name;
    req.body.reviewedDate = new Date().toISOString().split("T")[0];
  } else {
    // Creation or self-edits: can only submit or edit your own contract renewal request
    if (userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied: you can only submit or edit your own contract renewal request" });
    }
  }
  return saveDocument("contract_renewals", id, req.body, req, res);
});

// 17. LEADERSHIP APPOINTMENTS
app.get("/api/leadership_appointments", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const snap = await db.collection("leadership_appointments").get();
    let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Generate verification URL for each appointment
    items = items.map(item => {
      const token = generateVerificationToken("leadership_appointment", item.id);
      const appUrl = process.env.APP_URL || "http://localhost:3000";
      return {
        ...item,
        verificationUrl: `${appUrl}/verify/leadership_appointment/${item.id}?t=${token}`
      };
    });

    const userRoleKey = req.user!.roleKey || getCanonicalRoleKey(req.user!.role);
    if (userRoleKey === "chairperson") {
      return res.json(items);
    } else {
      const filtered = items.filter(item => item.profileId === req.user!.id);
      return res.json(filtered);
    }
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch leadership appointments", details: err.message });
  }
});

app.post("/api/leadership_appointments", requireAuth, requirePermission("leadership_appointments", "create"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const data = req.body;
    if (!data.id) return res.status(400).json({ error: "Missing appointment ID" });
    if (!data.profileId) return res.status(400).json({ error: "Missing profile ID" });

    data.appointedBy = req.user!.name;
    data.appointmentDate = new Date().toISOString().split("T")[0];

    const docRef = db.collection("leadership_appointments").doc(data.id);
    await docRef.set({
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    logActivity(req, "leadership_appointments", "save", data.id, data.role || data.id);
    return res.json({ success: true, id: data.id });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to save leadership appointment", details: err.message });
  }
});

app.post("/api/leadership_appointments/:id/acknowledge", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const { id } = req.params;
    const docRef = db.collection("leadership_appointments").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Leadership appointment not found" });
    }
    const data = snap.data()!;
    if (data.profileId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied: can only acknowledge your own appointment" });
    }

    const updated = {
      ...data,
      acknowledged: true,
      acknowledgedDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await docRef.set(updated, { merge: true });
    return res.json({ success: true, id, acknowledged: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to acknowledge appointment", details: err.message });
  }
});


// 18. TASKS / ACTION ITEMS
// Any of the 6 leadership roleKeys (everyone except program_member/volunteer) may
// assign a task to any member or volunteer. The assignee can always update their own
// task's status even without general "tasks.edit" permission — that's what lets a
// volunteer with no other write access still mark their own task done.
const LEADERSHIP_ROLE_KEYS = new Set([
  "chairperson", "vice_chairperson", "programs_director", "secretary", "treasurer", "safeguarding_officer"
]);

app.get("/api/tasks", requireAuth, requirePermission("tasks", "view"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const snap = await db.collection("tasks").get();
    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    const userRoleKey = req.user!.roleKey || getCanonicalRoleKey(req.user!.role);
    if (LEADERSHIP_ROLE_KEYS.has(userRoleKey)) {
      return res.json(items);
    }
    // Non-leadership: only see tasks assigned to them or that they created.
    return res.json(items.filter(t => t.assignedToId === req.user!.id || t.assignedById === req.user!.id));
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch tasks", details: err.message });
  }
});

app.post("/api/tasks", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const userRoleKey = req.user!.roleKey || getCanonicalRoleKey(req.user!.role);
    const existing = req.body.id ? (await db.collection("tasks").doc(req.body.id).get()) : null;

    if (existing && existing.exists) {
      // Update: either the assignee updating their own status, or a leader with
      // tasks.edit permission editing/reassigning the task.
      const data = existing.data()!;
      const isOwnStatusUpdate = req.user!.id === data.assignedToId;
      const canFullEdit = await userHasPermission(req, "tasks", "edit");
      if (!isOwnStatusUpdate && !canFullEdit) {
        return res.status(403).json({ error: "Access denied: you can only update tasks assigned to you, or manage tasks you have edit rights to." });
      }
      const updated: any = isOwnStatusUpdate && !canFullEdit
        ? { ...data, status: req.body.status || data.status, completedDate: req.body.status === "completed" ? new Date().toISOString() : data.completedDate }
        : {
            ...data,
            title: req.body.title ?? data.title,
            description: req.body.description ?? data.description,
            programArea: req.body.programArea ?? data.programArea,
            priority: req.body.priority ?? data.priority,
            dueDate: req.body.dueDate ?? data.dueDate,
            status: req.body.status ?? data.status,
            completedDate: req.body.status === "completed" ? (data.completedDate || new Date().toISOString()) : (req.body.status ? undefined : data.completedDate),
            assignedToId: req.body.assignedToId ?? data.assignedToId,
            assignedToName: req.body.assignedToId && req.body.assignedToId !== data.assignedToId
              ? (await db.collection("profiles").doc(req.body.assignedToId).get()).data()?.name || data.assignedToName
              : data.assignedToName,
            // Who originally assigned the task is never editable via this endpoint — it's
            // an audit fact, not a mutable field a reassigning leader should overwrite.
            assignedById: data.assignedById,
            assignedByName: data.assignedByName,
            id: existing.id
          };
      logActivity(req, "tasks", "edit", existing.id, updated.title, data, updated);
      return saveDocument("tasks", existing.id, updated, req, res);
    }

    // Create: only leadership roles may assign a NEW task to someone else.
    if (!LEADERSHIP_ROLE_KEYS.has(userRoleKey)) {
      return res.status(403).json({ error: "Access denied: only leadership roles can assign new tasks." });
    }
    if (!req.body.title || !req.body.assignedToId) {
      return res.status(400).json({ error: "title and assignedToId are required" });
    }
    const assigneeSnap = await db.collection("profiles").doc(req.body.assignedToId).get();
    if (!assigneeSnap.exists) {
      return res.status(400).json({ error: "assignedToId does not match a real member profile" });
    }
    const assignee = assigneeSnap.data()!;
    const id = req.body.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const task = {
      id,
      title: req.body.title,
      description: req.body.description || "",
      assignedToId: req.body.assignedToId,
      assignedToName: assignee.name,
      // Set server-side from the authenticated session — never trust a client-supplied
      // assigner identity, same convention used throughout this file.
      assignedById: req.user!.id,
      assignedByName: req.user!.name,
      programArea: req.body.programArea || "general",
      priority: req.body.priority || "medium",
      dueDate: req.body.dueDate || "",
      status: "pending",
      createdDate: new Date().toISOString().split("T")[0]
    };
    logActivity(req, "tasks", "create", id, task.title);
    return saveDocument("tasks", id, task, req, res);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to save task", details: err.message });
  }
});

// 19. PROGRAM OUTCOMES / M&E SESSIONS
// Logs a real outreach/rehearsal/training/booking session against one of the org's
// actual program areas (GBV, SRHR, Mental Health, Film Academy, TaaS) with participant
// reach numbers — the data donor reports actually need, which nothing in this system
// captured before. Anyone can log a session they ran; only leadership can edit/delete
// someone else's entry.
app.get("/api/program_sessions", requireAuth, requirePermission("program_sessions", "view"), (req, res) => fetchCollection("program_sessions", req, res));

app.post("/api/program_sessions", requireAuth, requirePermission("program_sessions", "create"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const existingId = req.body.id;
    if (existingId) {
      const snap = await db.collection("program_sessions").doc(existingId).get();
      if (snap.exists) {
        const data = snap.data()!;
        const isOwner = data.loggedById === req.user!.id;
        const canEdit = await userHasPermission(req, "program_sessions", "edit");
        if (!isOwner && !canEdit) {
          return res.status(403).json({ error: "Access denied: you can only edit sessions you logged yourself." });
        }
      }
    }
    if (!req.body.title || !req.body.programArea) {
      return res.status(400).json({ error: "title and programArea are required" });
    }
    const id = existingId || `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const session = {
      id,
      programArea: req.body.programArea,
      title: req.body.title,
      date: req.body.date || new Date().toISOString().split("T")[0],
      location: req.body.location || "",
      facilitators: req.body.facilitators || req.user!.name,
      participantsReached: Number(req.body.participantsReached) || 0,
      maleCount: Number(req.body.maleCount) || 0,
      femaleCount: Number(req.body.femaleCount) || 0,
      childrenCount: Number(req.body.childrenCount) || 0,
      description: req.body.description || "",
      outcomeNotes: req.body.outcomeNotes || "",
      loggedById: req.user!.id,
      loggedBy: req.user!.name,
      loggedDate: existingId ? req.body.loggedDate : new Date().toISOString().split("T")[0]
    };
    logActivity(req, "program_sessions", existingId ? "edit" : "create", id, session.title);
    return saveDocument("program_sessions", id, session, req, res);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to save program session", details: err.message });
  }
});

// 20. VOLUNTEER RECOGNITION / SERVICE CERTIFICATES
// Self-service certificate issuance: hours are ALWAYS recomputed server-side from real
// attendance records, never taken from client input, so this can be safely left
// self-service without a leadership approval step — a member cannot certify more
// hours than they actually logged.
const RECOGNITION_TIERS: { tier: string; minHours: number }[] = [
  { tier: "platinum", minHours: 200 },
  { tier: "gold", minHours: 100 },
  { tier: "silver", minHours: 50 },
  { tier: "bronze", minHours: 10 }
];

async function computeVolunteerHours(userId: string): Promise<number> {
  const snap = await db.collection("attendance").get();
  let hours = 0;
  snap.docs.forEach(doc => {
    const sheet = doc.data() as any;
    (sheet.records || []).forEach((rec: any) => {
      if (rec.userId === userId) hours += Number(rec.volunteerHours) || 0;
    });
  });
  return hours;
}

app.get("/api/volunteer_certificates", requireAuth, requirePermission("volunteer_recognition", "view"), (req, res) => fetchCollection("volunteer_certificates", req, res));

app.post("/api/volunteer_certificates", requireAuth, requirePermission("volunteer_recognition", "create"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    // Chairperson/leadership may issue on behalf of someone else (edit permission);
    // everyone else may only issue their own, earned certificate.
    const targetUserId = req.body.userId || req.user!.id;
    if (targetUserId !== req.user!.id) {
      const canEdit = await userHasPermission(req, "volunteer_recognition", "edit");
      if (!canEdit) {
        return res.status(403).json({ error: "Access denied: you can only generate your own certificate." });
      }
    }
    const targetSnap = await db.collection("profiles").doc(targetUserId).get();
    if (!targetSnap.exists) return res.status(400).json({ error: "userId does not match a real member profile" });
    const target = targetSnap.data()!;

    const hours = await computeVolunteerHours(targetUserId);
    const matched = RECOGNITION_TIERS.find(t => hours >= t.minHours);
    if (!matched) {
      return res.status(400).json({ error: `Not enough logged volunteer hours yet (${hours} hrs). The first tier (Bronze) requires 10 hrs.` });
    }
    const requestedTier = req.body.tier;
    if (requestedTier && RECOGNITION_TIERS.some(t => t.tier === requestedTier)) {
      const requested = RECOGNITION_TIERS.find(t => t.tier === requestedTier)!;
      if (hours < requested.minHours) {
        return res.status(400).json({ error: `You have ${hours} logged hours — not enough for the ${requestedTier} tier (needs ${requested.minHours}+).` });
      }
    }
    const tier = (requestedTier && RECOGNITION_TIERS.some(t => t.tier === requestedTier)) ? requestedTier : matched.tier;

    const id = `volcert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const cert = {
      id,
      userId: targetUserId,
      userName: target.name,
      tier,
      hoursAtIssue: hours,
      issuedDate: new Date().toISOString().split("T")[0],
      issuedBy: req.user!.name
    };
    logActivity(req, "volunteer_recognition", "create", id, `${target.name} — ${tier}`);
    return saveDocument("volunteer_certificates", id, cert, req, res);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to generate certificate", details: err.message });
  }
});

// 21. BROADCAST REPLIES (two-way communication on top of existing one-way broadcasts)
// Any authenticated user may reply to a broadcast they received — replies are appended
// to that broadcast's own document rather than a separate collection, since they only
// ever need to be read alongside their parent message.
app.post("/api/broadcasts/:id/reply", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "message is required" });
    }
    const docRef = db.collection("broadcasts").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Broadcast not found" });

    const data = snap.data()!;
    const reply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: req.user!.id,
      userName: req.user!.name,
      message: String(message).trim().slice(0, 1000),
      timestamp: new Date().toISOString()
    };
    const replies = Array.isArray(data.replies) ? [...data.replies, reply] : [reply];
    await docRef.set({ replies, updatedAt: new Date().toISOString() }, { merge: true });
    logActivity(req, "cms_editor", "reply", id, `Reply on: ${data.message?.slice(0, 40) || id}`);
    return res.json({ success: true, reply });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to post reply", details: err.message });
  }
});


// --- BACKEND BULK SYNC ENDPOINT WITH CONFLICT RESOLUTION ---
app.post("/api/sync", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  const { queue } = req.body;
  if (!queue || !Array.isArray(queue)) {
    return res.status(400).json({ error: "Invalid sync request format" });
  }

  const userRoleKey = req.user!.roleKey || getCanonicalRoleKey(req.user!.role);

  const results = [];
  for (const item of queue) {
    const { action, payload, id, timestamp } = item;
    
    // Authorization maps for bulk synchronization
    let allowed = true;
    if (action === "profiles" || action === "org_settings") {
      allowed = userRoleKey === "chairperson";
    } else if (action === "safeguarding_reports") {
      allowed = ["safeguarding_officer", "chairperson"].includes(userRoleKey);
    }

    if (!allowed) {
      results.push({ id, status: "error", error: "Unauthorized operation in sync" });
      continue;
    }

    try {
      const docRef = db.collection(action).doc(payload.id);

      // Handle deletion actions from offline queue
      if (item.type === "delete") {
        let deleteAllowed = false;
        if (action === "grants") {
          deleteAllowed = ["chairperson", "treasurer"].includes(userRoleKey);
        } else if (action === "classes") {
          deleteAllowed = ["chairperson", "programs_director"].includes(userRoleKey);
        } else if (action === "invoices") {
          deleteAllowed = ["chairperson", "treasurer", "vice_chairperson"].includes(userRoleKey);
        } else {
          deleteAllowed = userRoleKey === "chairperson";
        }

        if (!deleteAllowed) {
          results.push({ id, status: "error", error: "Unauthorized delete operation in sync" });
          continue;
        }

        await docRef.delete();
        results.push({ id, status: "synced" });
        continue;
      }

      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const currentDoc = docSnap.data()!;
        // Last-Write-Wins based on updatedAt or timestamp comparison
        if (currentDoc.updatedAt && timestamp && currentDoc.updatedAt > timestamp) {
          results.push({ id, status: "resolved", resolved: "server-wins", payload: currentDoc });
          continue;
        }
      }

      // If it is safeguarding, encrypt it before saving!
      const dataToSave = { ...payload };
      if (action === "safeguarding_reports") {
        dataToSave.description = encrypt(payload.description || "");
        dataToSave.notes = encrypt(payload.notes || "");
      }

      dataToSave.updatedAt = new Date().toISOString();
      await docRef.set(dataToSave, { merge: true });
      results.push({ id, status: "synced" });
    } catch (err: any) {
      results.push({ id, status: "error", error: err.message });
    }
  }

  return res.json({ success: true, results });
});


// --- ADMIN EXPORT BACKUP ENDPOINT ---
app.get("/api/admin/export", requireAuth, requireRole(["chairperson"]), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const collections = [
      "profiles", "documents", "budgets", "expenditures", "safeguarding_reports",
      "assets", "attendance_sheets", "partners", "incomes", "grants", "classes",
      "broadcasts", "leave_requests", "invoices", "org_settings", "contract_renewals",
      "safeguarding_access_logs", "financial_audit_trails", "tasks", "program_sessions",
      "volunteer_certificates"
    ];

    const backupData: any = {
      backupTimestamp: new Date().toISOString(),
      backupBy: req.user!.name,
      data: {}
    };

    for (const name of collections) {
      const snap = await db.collection(name).get();
      backupData.data[name] = snap.docs.map(doc => {
        const d = doc.data();
        // Decrypt safeguarding reports in backup if accessed by Chairperson
        if (name === "safeguarding_reports") {
          return {
            id: doc.id,
            ...d,
            description: decrypt(d.description || ""),
            notes: decrypt(d.notes || "")
          };
        }
        return { id: doc.id, ...d };
      });
    }

    res.setHeader("Content-disposition", `attachment; filename=bashosho-backup-${Date.now()}.json`);
    res.setHeader("Content-type", "application/json");
    logActivity(req, "settings", "admin_export", undefined, "Full Data Backup Export");
    return res.send(JSON.stringify(backupData, null, 2));
  } catch (error: any) {
    return res.status(500).json({ error: "Backup export failed", details: error.message });
  }
});


// --- ADMIN DATA PURGE ENDPOINT ---
app.post("/api/admin/purge-data", requireAuth, requireRole(["chairperson"]), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const collectionsToPurge = [
      "documents", "budgets", "expenditures", "safeguarding_reports",
      "assets", "attendance_sheets", "partners", "incomes", "grants", "classes",
      "broadcasts", "leave_requests", "invoices", "contract_renewals",
      "safeguarding_access_logs", "financial_audit_trails", "tasks", "program_sessions",
      "volunteer_certificates"
    ];

    console.log(`[Purge] Initiating database purge by ${req.user!.name}...`);

    for (const colName of collectionsToPurge) {
      const snap = await db.collection(colName).get();
      if (!snap.empty) {
        const chunks = [];
        let batch = db.batch();
        let count = 0;
        for (const doc of snap.docs) {
          batch.delete(doc.ref);
          count++;
          if (count === 400) {
            chunks.push(batch);
            batch = db.batch();
            count = 0;
          }
        }
        if (count > 0) {
          chunks.push(batch);
        }
        for (const b of chunks) {
          await b.commit();
        }
        console.log(`[Purge] Deleted ${snap.size} documents from collection: ${colName}`);
      }
    }

    // Keep only the current logged-in Chairperson's profile to prevent lockouts, and delete other seeded profiles
    const profilesSnap = await db.collection("profiles").get();
    for (const doc of profilesSnap.docs) {
      if (doc.id !== req.user!.id) {
        await doc.ref.delete();
        console.log(`[Purge] Deleted profile: ${doc.id}`);
      }
    }

    // Update the system_meta seed_status to "production" so that the server does not seed the DB with demo data on boot again!
    await db.collection("system_meta").doc("seed_status").set({
      seeded: true,
      mode: "production",
      seededAt: new Date().toISOString(),
      purgedBy: req.user!.name
    });

    console.log("[Purge] Database successfully cleared to production clean-slate.");
    return res.json({ success: true, message: "Database successfully cleared. All demo/fake data has been purged." });
  } catch (error: any) {
    console.error("[Purge] Error during data purge:", error);
    return res.status(500).json({ error: "Failed to purge database", details: error.message });
  }
});


// --- ADMINISTRATIVE DOCUMENT GENERATOR ROUTES ---

// System Document Draft Generation Route
app.post("/api/document_templates/generate_draft", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  const { notes, docType, title, appointeeName, role, termStart, termEnd, responsibilities, chairpersonName } = req.body;

  if (!notes && docType !== "appointment_letter") {
    return res.status(400).json({ error: "No notes provided" });
  }

  let promptDetails = "";
  if (docType === "minutes") {
    promptDetails = `Format as professional community organization Meeting Minutes. Include:
- Heading with BASHOSHO TALENTS CBO MEETING MINUTES, Date, and Venue
- Section for Attendance, Agenda, Key Resolutions, Action Items, and Signatures
- Tone: Extremely professional, administrative, objective.`;
  } else if (docType === "activity") {
    promptDetails = `Format as a formal CBO Activity Report. Include:
- Heading with CBO ACTIVITY OUTREACH REPORT, Date, Lead Facilitator, and Partner
- Sections for Executive Summary, Target Audience Reached, Key Outcomes/Metrics, Challenges Faced, Recommendations
- Tone: Impact-oriented, descriptive, and funder-ready. Highlight mental health or GBV advocacy.`;
  } else if (docType === "budget") {
    promptDetails = `Format as a Per-Engagement Budget and Settlement Explanation. Include:
- Sections detailing budget allocations (stipends, transport, props, refreshments)
- Analysis of estimated vs actual costs, explanations for variances, and value for money statement
- Tone: Financially diligent, auditable, and transparent.`;
  } else if (docType === "appointment_letter") {
    const orgSettingsSnap = await db.collection("org_settings").doc("global").get();
    const orgSettings = orgSettingsSnap.exists ? orgSettingsSnap.data() : { name: "Bashosho Talents CBO", missionText: "Connecting Youths Through Talents" };

    promptDetails = `Format as a formal, executive Letter of Appointment.
- Appointee Name: ${appointeeName || "Selected Leader"}
- Selected Role: ${role || "Leadership Officer"}
- Term Start: ${termStart || "Date of Appointment"}
- Term End: ${termEnd || "Indefinite / Open-ended"}
- Core Responsibilities: ${responsibilities || "Standard CBO leadership and program duties"}
- Organization Name: ${orgSettings.name || "Bashosho Talents CBO"}
- Organization Mission: ${orgSettings.missionText || "Connecting Youths Through Talents"}
- Appointed By: ${chairpersonName || "The Chairperson"}

Prompt:
Draft a highly formal, inspiring, and professional Letter of Appointment.
The letter should be structured as follows:
1. Formal Salutation to ${appointeeName || "the appointee"}.
2. Confirmation of appointment to the position of ${role || "Leadership Officer"}, commencing on ${termStart || "the start date"} and running ${termEnd ? `until ${termEnd}` : "indefinitely on an open-ended basis"}.
3. A paragraph outlining their core duties and responsibilities: "${responsibilities || "Standard duties"}".
4. A statement of expectation on organizational standards, ethics, and alignment with our mission ("${orgSettings.missionText || "Connecting Youths Through Talents"}").
5. A warm closing and congratulations.
6. A signature line for the Chairperson, ${chairpersonName || "the Chairperson"}.`;
  } else if (docType === "invoice_explanation" || docType === "invoicing") {
    promptDetails = `Format as a professional Narrative Statement of Engagement supporting a CBO invoice. Include:
- A detailed explanation of services provided (theater performances, film crew production, community roadshow facilitation, or equipment hire)
- Value delivered to the partner (civic outreach metrics, participant feedback, creative asset outputs, community impact)
- Payment breakdown, Till Number 8671238 payment instructions, and closing professional call to action.
- Tone: Corporate, consultative, and highly professional.`;
  } else if (docType === "grant_pitch" || docType === "grants") {
    promptDetails = `Format as a comprehensive community grant funding pitch or proposal outline. Include:
- Executive Summary of the proposed project
- Clear Problem Statement detailing the challenges in Kiambiu (e.g., SGBV, youth unemployment, mental health stigma)
- Proposed Methodology using creative arts/forum theater or cinema academy
- Expected key metrics, community indicators, and a technical budget framework
- Tone: Highly persuasive, urgent, structured, and aligned with international donor agency guidelines (UN, USAID, etc.).`;
  } else if (docType === "contract_renewal") {
    promptDetails = `Format as a formal CBO Contract Performance Review & Renewal Proposal. Include:
- Heading with BASHOSHO TALENTS CBO CONTRACT RENEWAL EVALUATION
- Section 1: Key Project Milestones & Deliverables Completed
- Section 2: Performance Evaluation & Community Impact Assessment
- Section 3: Proposed Term Extension, Duty Re-alignments & Stipend Adjustments
- Section 4: Recommendation for Board Approval & Sign-off Block
- Tone: Administrative, evaluative, clear, and objective.`;
  } else if (docType === "membership_bio" || docType === "id_card") {
    promptDetails = `Format as an Official Member Profile & Verification Statement for ID Card Issuance. Include:
- Heading with BASHOSHO TALENTS CBO MEMBER VERIFICATION BRIEF
- Section 1: Member Registration Details & Assigned ID Number
- Section 2: Verified Artistic/Technical Specialization & Talent Portfolio
- Section 3: Community Projects & Forum Theatre Involvement History
- Section 4: Safeguarding, Ethics & Code of Conduct Acknowledgment
- Section 5: Formal Secretariat Endorsement for Official ID Card Issuance
- Tone: Authoritative, verified, and community-affirming.`;
  } else if (docType === "class_syllabus" || docType === "classes") {
    promptDetails = `Format as a CBO Talent Academy Course Syllabus & Workshop Curriculum Guide. Include:
- Heading with BASHOSHO TALENTS ACADEMY - COURSE SYLLABUS
- Course Title, Duration, Target Cohort Size, and Lead Instructor
- Section 1: Course Overview & Target Skill Competencies
- Section 2: Weekly Module Breakdown (Practical Exercises, Forum Theatre/Cinema Techniques)
- Section 3: Equipment, Studio Safety & Safeguarding Guidelines
- Section 4: Graduation Assessment Criteria & Certification Path
- Tone: Educational, structured, practical, and empowering.`;
  } else if (docType === "beneficiary_intake" || docType === "beneficiary") {
    promptDetails = `Format as a Formal Community Intake & Vulnerability Narrative Report. Include:
- Heading with CONFIDENTIAL COMMUNITY INTAKE & SUPPORT BRIEF
- Section 1: Background & Social Circumstances Context
- Section 2: Core Need Assessment (e.g., SGBV Counseling, Youth Mentorship, Creative Skills Training, Emergency Relief)
- Section 3: Tailored Empowerment Plan & Community Referral Pathway
- Section 4: Safeguarding & Data Confidentiality Commitment Statement
- Tone: Empathetic, respectful, confidential, and action-oriented.`;
  } else if (docType === "financial_audit" || docType === "ledger") {
    promptDetails = `Format as a Formal Financial Audit Summary & Ledger Reconciliation Report. Include:
- Heading with BASHOSHO TALENTS CBO FINANCIAL AUDIT & LEDGER SUMMARY
- Section 1: Executive Financial Overview & Total Income/Expenditure Reconciliation
- Section 2: Category Breakdown & Variance Analysis (Stipends, Equipment, Operations, Outreach)
- Section 3: Compliance & Value-for-Money (VfM) Audit Observations
- Section 4: Internal Controls Assessment & Treasurer Sign-off
- Tone: Audit-grade, precise, transparent, and financially sound.`;
  } else {
    promptDetails = `Format as a general formal organization document with clear section headings, bullet points, and an action-oriented structure.`;
  }

  const systemInstruction = `You are the lead secretary and communications advisor for Bashosho Talents CBO, a prominent community-based organization operating in Kiambiu, Nairobi. 
The organization uses forum theatre, creative film, and participatory arts to address community issues including mental health, gender-based violence (GBV), and sexual and reproductive health rights (SRHR).
Your task is to take the rough, conversational, or bullet-pointed notes provided and draft a highly professional, comprehensive, print-ready, and formal document.
Do not invent facts, but flesh out the provided bullet points into elegant, fluent prose.
Make sure the tone is authoritative and inspiring, suitable for sharing with international funders and Kenyan government officials.`;

  const fullPrompt = `Document Title: ${title || "Untitled Document"}
Document Type: ${docType}

${promptDetails}

Rough Bullet Points/Notes to expand:
${notes || ""}`;

  try {
    if (ai) {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: fullPrompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2,
        },
      });

      const text = response.text;
      if (text) {
        return res.json({ draft: text });
      } else {
        throw new Error("Empty response text from Gemini API");
      }
    } else {
      // Fallback draft generator (Simulator) in case Gemini API key is missing
      if (docType === "appointment_letter") {
        const orgSettingsSnap = await db.collection("org_settings").doc("global").get();
        const orgSettings = orgSettingsSnap.exists ? orgSettingsSnap.data() : { name: "Bashosho Talents CBO", missionText: "Connecting Youths Through Talents" };
        const fallbackDraft = `## LETTER OF APPOINTMENT

**Date:** ${new Date().toLocaleDateString("en-KE")}  
**To:** ${appointeeName || "Selected Leader"}  
**Position:** ${role || "Leadership Officer"}  

Dear ${appointeeName || "Selected Leader"},

### RE: APPOINTMENT TO THE POSITION OF ${role ? role.toUpperCase() : "LEADERSHIP OFFICER"}

On behalf of the Board and Secretariat of **${orgSettings.name || "Bashosho Talents CBO"}**, I am pleased to offer you the formal appointment as our **${role || "Leadership Officer"}** commencing on **${termStart || "the start date"}** ${termEnd ? `and ending on **${termEnd}**` : "to serve on an indefinite/open-ended basis"}.

In this capacity, you will report directly to the Chairperson and the Executive Committee. Your primary focus will be supporting the organization's core mission: *"${orgSettings.missionText || "Connecting Youths Through Talents"}"*.

#### KEY RESPONSIBILITIES:
Based on your official appointment, your duties will include, but are not limited to, the following:
${responsibilities ? responsibilities.split("\n").map((line: string) => `- ${line.trim()}`).join("\n") : "- Performing general administrative and creative coordination duties aligned with your executive capacity."}

#### STANDARDS & CONDUCT:
You are expected to conduct yourself with the highest level of integrity, transparency, and accountability, maintaining the excellent reputation of our community-based organization. 

We look forward to your valuable contribution as we work together to empower the youth of Kiambiu through talent and advocacy.

Please review this letter. You will be required to formally acknowledge and accept this appointment upon your initial system login.

Yours sincerely,

**${chairpersonName || "Kennedy Onyango"}**  
Chairperson, ${orgSettings.name || "Bashosho Talents CBO"}`;
        return res.json({ draft: fallbackDraft, simulated: true });
      }

      const fallbackDraft = `## BASHOSHO TALENTS CBO NYARAKA / FORMAL DRAFT
**[DEVELOPMENT MODE - GEMINI SIMULATOR FALLBACK]**
**Title:** ${title || "Untitled Document"}
**Type:** ${docType.toUpperCase()}
**Date:** ${new Date().toLocaleDateString("en-KE")}
**Location:** Kiambiu, Nairobi, Kenya

---

### 1. OFFICIAL SUMMARY
This document has been compiled by the Secretariat of Bashosho Talents CBO to summarize activities and resolutions regarding: *"${notes ? notes.slice(0, 80) : ""}..."*

### 2. CORE DETAILS & DISCUSSION
Based on the rough records submitted, the following key items were noted and discussed:
${notes ? notes.split("\n").map((line: string) => (line.trim() ? `- **${line.trim()}**: Detailed action and community implementation planning based on Kiambiu outreach standards.` : "")).join("\n") : ""}

### 3. ACTION PLAN & RECOMMENDATIONS
- **Implementation:** The Programs Director and Safeguarding & MEL Officer to immediate verify compliance metrics.
- **Financial Review:** The Treasurer has pre-approved appropriate stipend schedules under the Ksh 10,000 threshold. Larger payments forwarded to Chairperson.
- **Reporting:** Formal reports to be exported via the Print Letterhead system for donor presentation.

*Prepared in Kiambiu, Nairobi, Kenya.*`;
      return res.json({ draft: fallbackDraft, simulated: true });
    }
  } catch (err: any) {
    console.error("Gemini API call failed:", err);
    return res.status(500).json({ error: "Gemini execution failed", details: err?.message });
  }
});

// System Financial Commentary Route
app.post("/api/reports/financial_summary", requireAuth, async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  const { totalIncome, totalApprovedExpense, cashReserves, incomesSummary, expendituresSummary } = req.body;

  const systemInstruction = `You are the expert Financial Auditor and Strategic Advisory Consultant for Bashosho Talents CBO, a community-based organization in Kiambiu, Nairobi, Kenya.
The organization uses participatory arts, film, and theatre for development.
Your task is to write a highly professional, concise financial commentary paragraph (maximum 150 words) suitable for a formal donor/funder annual report.
It should analyze the period's real figures, reserve trend, overall financial health, and mention value-for-money. Do not use generic filler text or placeholder brackets. Refer explicitly to Kenyan Shillings (Ksh).`;

  const fullPrompt = `Please analyze the following actual CBO financial metrics and generate a single, professional, flowing commentary paragraph:
- Total Received Income: Ksh ${totalIncome?.toLocaleString() || 0}
- Disbursed Approved Expenditures: Ksh ${totalApprovedExpense?.toLocaleString() || 0}
- Net Retained Reserves: Ksh ${cashReserves?.toLocaleString() || 0}

Summary of Income Sources:
${incomesSummary || "No detailed income logged yet."}

Summary of Approved Expenditures:
${expendituresSummary || "No approved expenditures logged yet."}

Write a direct, inspiring, yet highly auditable statement noting the reserve sustainability, notable variances or spend categories (such as stipends, rent, utilities, etc.), and confirming that all disbursements align with community-safeguarding and programs outreach objectives.`;

  try {
    if (ai) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: fullPrompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3,
        },
      });

      const text = response.text;
      if (text) {
        return res.json({ commentary: text.trim() });
      } else {
        throw new Error("Empty response text from report assistant API");
      }
    } else {
      // Fallback draft generator (Simulator) in case API key is missing
      const percentage = totalIncome ? ((cashReserves / totalIncome) * 100).toFixed(1) : "0.0";
      const fallbackCommentary = `Bashosho Talents CBO exhibits a robust and highly transparent financial position for the fiscal period, recording total received revenues of Ksh ${totalIncome?.toLocaleString() || 0} against approved operational disbursements of Ksh ${totalApprovedExpense?.toLocaleString() || 0}, leaving a healthy net retained reserve of Ksh ${cashReserves?.toLocaleString() || 0}. The largest share of expenditures went toward essential community-facing resources, including performer stipends and logistical costs, which have been rigorously audited under the CBO's direct transaction guidelines. Retaining a reserve represents a positive sustainability index of ${percentage}%, ensuring sufficient liquidity for forthcoming forum theatre engagements and outreach programs in Kiambiu. Variance between budgeted figures and actual disbursements has been maintained well within the approved 5% operational tolerance threshold, demonstrating high financial discipline.`;
      return res.json({ commentary: fallbackCommentary, simulated: true });
    }
  } catch (err: any) {
    console.error("Financial report assistant API call failed:", err);
    return res.status(500).json({ error: "Reporting assistant execution failed", details: err?.message });
  }
});


// =========================================================================
// BASHOSHO OS — PUBLIC HOMEPAGE & SIGNUP BACKEND ENDPOINTS
// =========================================================================

const signupRateLimits = new Map<string, RateLimitInfo>();

// Generic rate limiter factory — same sliding-window-per-IP pattern as signupRateLimiter,
// parameterized so other public (unauthenticated) endpoints can reuse it without a
// shared bucket, which would let unrelated abuse on one endpoint lock out another.
function makeRateLimiter(storeName: string, maxRequests: number, windowMs: number) {
  const store = new Map<string, RateLimitInfo>();
  return function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction): any {
    const ip = req.ip || "unknown-ip";
    const now = Date.now();
    const limit = store.get(ip);

    if (limit) {
      if (now > limit.resetTime) {
        store.set(ip, { count: 1, resetTime: now + windowMs });
        return next();
      } else if (limit.count >= maxRequests) {
        const minutesLeft = Math.ceil((limit.resetTime - now) / 1000 / 60);
        return res.status(429).json({ error: `Too many requests. Please try again in ${minutesLeft} minutes.` });
      } else {
        limit.count++;
        return next();
      }
    } else {
      store.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }
  };
}

function signupRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction): any {
  const ip = req.ip || "unknown-ip";
  const now = Date.now();
  const limit = signupRateLimits.get(ip);

  if (limit) {
    if (now > limit.resetTime) {
      signupRateLimits.set(ip, { count: 1, resetTime: now + 60 * 60 * 1000 }); // 1 hour window
      return next();
    } else if (limit.count >= 5) {
      const minutesLeft = Math.ceil((limit.resetTime - now) / 1000 / 60);
      return res.status(429).json({
        error: `Too many signup attempts. Please try again in ${minutesLeft} minutes.`
      });
    } else {
      limit.count++;
      return next();
    }
  } else {
    signupRateLimits.set(ip, { count: 1, resetTime: now + 60 * 60 * 1000 });
    return next();
  }
}

function decodeBase64Image(base64Str: string): { buffer: Buffer; mimeType: string } | null {
  if (!base64Str) return null;
  const match = base64Str.match(/^data:(image\/\w+);base64,/);
  const mimeType = match ? match[1] : "image/jpeg";
  const cleanBase64 = base64Str.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");
  return { buffer, mimeType };
}

// 1. Local Mock Storage public files server helper
app.get("/api/mock-public-files/*", (req, res) => {
  const filePath = req.params[0];
  const fullPath = path.join(process.cwd(), "mock-storage", filePath);
  if (fs.existsSync(fullPath)) {
    res.sendFile(fullPath);
  } else {
    res.status(404).send("File not found");
  }
});

// 2. Public Self-Service Signup
app.post("/api/public/signup", signupRateLimiter, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const {
      type,
      fullName,
      phone,
      email,
      dateOfBirth,
      location,
      whyJoin,
      skills,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      passportPhoto,
      idDocument,
      recaptchaToken
    } = req.body;

    // Basic validation
    if (
      !type ||
      !fullName ||
      !phone ||
      !dateOfBirth ||
      !location ||
      !whyJoin ||
      !skills ||
      !emergencyContactName ||
      !emergencyContactPhone ||
      !emergencyContactRelationship ||
      !passportPhoto ||
      !idDocument
    ) {
      return res.status(400).json({ error: "Missing required signup fields." });
    }

    if (type !== "member" && type !== "volunteer") {
      return res.status(400).json({ error: "Invalid registration type. Must be 'member' or 'volunteer'." });
    }

    // Age check (18+)
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (age < 18) {
      return res.status(400).json({
        error: "Signups are for ages 18 and up. If you'd like to register someone younger, please contact us directly."
      });
    }

    // reCAPTCHA v3 verification
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    if (recaptchaSecret && recaptchaSecret !== "MY_RECAPTCHA_SECRET_KEY") {
      const skipRecaptcha = process.env.SKIP_RECAPTCHA_FOR_LOCAL_DEV === "true";
      if (!recaptchaToken) {
        if (skipRecaptcha) {
          console.log("[reCAPTCHA] Missing token in local dev environment. Bypassing check.");
        } else {
          return res.status(400).json({ error: "Security validation token is missing. Please try again." });
        }
      } else {
        try {
          const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `secret=${encodeURIComponent(recaptchaSecret)}&response=${encodeURIComponent(recaptchaToken)}`,
          });
          const result = await response.json() as any;
          if (!result.success || result.score < 0.5) {
            if (skipRecaptcha) {
              console.log("[reCAPTCHA] Validation failed in local dev environment. Bypassing error.", result);
            } else {
              return res.status(400).json({ error: "Security validation failed (reCAPTCHA). Please try again." });
            }
          }
        } catch (err) {
          console.error("reCAPTCHA check failed:", err);
          if (skipRecaptcha) {
            console.log("[reCAPTCHA] Error in local dev environment. Bypassing check.");
          } else {
            return res.status(400).json({ error: "Security validation service error. Please try again." });
          }
        }
      }
    }

    // Duplicate checks (Phone & Email)
    const normalizedPhone = phone.trim();
    const normalizedEmail = email ? email.trim().toLowerCase() : "";

    // Search profiles
    const profilesCol = db.collection("profiles");
    const phoneProfileCheck = await profilesCol.where("phone", "==", normalizedPhone).get();
    if (!phoneProfileCheck.empty) {
      return res.status(400).json({ error: "An application or account with these details already exists." });
    }

    if (normalizedEmail) {
      const emailProfileCheck = await profilesCol.where("email", "==", normalizedEmail).get();
      if (!emailProfileCheck.empty) {
        return res.status(400).json({ error: "An application or account with these details already exists." });
      }
    }

    // Search pending applications
    const signupApplicationsCol = db.collection("signup_applications");
    const phoneAppCheck = await signupApplicationsCol
      .where("phone", "==", normalizedPhone)
      .where("status", "==", "pending")
      .get();
    if (!phoneAppCheck.empty) {
      return res.status(400).json({ error: "An application or account with these details already exists." });
    }

    if (normalizedEmail) {
      const emailAppCheck = await signupApplicationsCol
        .where("email", "==", normalizedEmail)
        .where("status", "==", "pending")
        .get();
      if (!emailAppCheck.empty) {
        return res.status(400).json({ error: "An application or account with these details already exists." });
      }
    }

    // Decode & validate files
    const passportDecoded = decodeBase64Image(passportPhoto);
    const idDecoded = decodeBase64Image(idDocument);

    if (!passportDecoded || !idDecoded) {
      return res.status(400).json({ error: "Invalid image upload format." });
    }

    if (passportDecoded.buffer.length > 5 * 1024 * 1024 || idDecoded.buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "File size limit exceeded. Uploads must be 5MB or smaller each." });
    }

    if (!passportDecoded.mimeType.startsWith("image/") || !idDecoded.mimeType.startsWith("image/")) {
      return res.status(400).json({ error: "Invalid file type. Only images are allowed." });
    }

    // Generate Application ID and save files safely
    const applicationId = crypto.randomBytes(16).toString("hex");
    const passportExt = passportDecoded.mimeType.includes("webp") ? "webp" : "jpg";
    const idExt = idDecoded.mimeType.includes("webp") ? "webp" : "jpg";
    const passportPath = `signup-uploads/${applicationId}/passport.${passportExt}`;
    const idPath = `signup-uploads/${applicationId}/id-document.${idExt}`;

    await saveFile(passportPath, passportDecoded.buffer, passportDecoded.mimeType, false);
    await saveFile(idPath, idDecoded.buffer, idDecoded.mimeType, false);

    // Write application document to Firestore
    const applicationData = {
      id: applicationId,
      type,
      fullName,
      phone: normalizedPhone,
      email: normalizedEmail || undefined,
      dateOfBirth,
      location,
      whyJoin,
      skills,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      passportPhotoPath: passportPath,
      idDocumentPath: idPath,
      status: "pending",
      submittedAt: new Date().toISOString(),
      membershipFeeStatus: type === "member" ? "pending" : "not_applicable"
    };

    await signupApplicationsCol.doc(applicationId).set(applicationData);

    // Log a system broadcast
    const broadcastId = crypto.randomBytes(16).toString("hex");
    const systemBroadcast = {
      id: broadcastId,
      message: `New applicant signup submitted: ${fullName} (${type === "member" ? "Member" : "Volunteer"}) from ${location}.`,
      channel: "all",
      sentBy: "System — New Applications",
      sentDate: new Date().toISOString()
    };
    await db.collection("broadcasts").doc(broadcastId).set(systemBroadcast);

    return res.status(201).json({ success: true, applicationId });
  } catch (err: any) {
    console.error("Signup handler failed:", err);
    const userFriendlyError = err.message && err.message.includes("File upload failed")
      ? "Upload failed, please try again shortly."
      : "Signup application failed to submit.";
    return res.status(500).json({ error: userFriendlyError, details: err.message });
  }
});

// 3. Authenticated Stream of Private Document
app.get("/api/signup_applications/:id/document/:docType", requireAuth, requirePermission("signup_reviews", "view"), async (req, res): Promise<any> => {
  try {
    const { id, docType } = req.params;
    if (docType !== "passport" && docType !== "id") {
      return res.status(400).json({ error: "Invalid document type requested." });
    }

    const docSnap = await db.collection("signup_applications").doc(id).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Signup application not found." });
    }

    const appData = docSnap.data();
    const filePath = docType === "passport" ? appData.passportPhotoPath : appData.idDocumentPath;
    if (!filePath) {
      return res.status(404).json({ error: "Document file path is not available." });
    }

    const contentType = filePath.endsWith(".webp") ? "image/webp" : "image/jpeg";
    res.setHeader("Content-Type", contentType);
    const stream = getFileStream(filePath);
    stream.on("error", (err: any) => {
      console.error("Streaming error:", err);
      if (!res.headersSent) {
        res.status(404).json({ error: "File not found or storage inaccessible." });
      }
    });
    stream.pipe(res);
  } catch (err: any) {
    console.error("Document stream failed:", err);
    return res.status(500).json({ error: "Failed to load document.", details: err.message });
  }
});

// 4. Fetch Signup Applications List (Admin/Comms Only)
app.get("/api/signup_applications", requireAuth, requirePermission("signup_reviews", "view"), async (req, res): Promise<any> => {
  try {
    const snapshot = await db.collection("signup_applications").get();
    const list: any[] = [];
    snapshot.forEach((doc: any) => {
      list.push(doc.data());
    });
    list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    return res.json(list);
  } catch (err: any) {
    console.error("Fetch signup applications failed:", err);
    return res.status(500).json({ error: "Failed to fetch signup applications.", details: err.message });
  }
});

// 5. Approve Application (Atomic Profile Creation & PIN Generation)
app.post("/api/signup_applications/:id/approve", requireAuth, requirePermission("signup_reviews", "approve"), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id } = req.params;
    const reviewerName = req.user!.name;

    const appRef = db.collection("signup_applications").doc(id);
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      return res.status(404).json({ error: "Signup application not found." });
    }

    const application = appSnap.data();
    if (application.status !== "pending") {
      return res.status(400).json({ error: `Application is already ${application.status}.` });
    }

    // Prepare profile creation
    const isMember = application.type === "member";
    const userRole = isMember ? "Program Member" : "Volunteer Staff";
    const userRoleKey = isMember ? "program_member" : "volunteer";
    
    // Generate sequential/unique member number
    const profilesCol = db.collection("profiles");
    const profilesSnap = await profilesCol.get();
    const count = profilesSnap.size + 101;
    const memberNumber = `BT-CBO-${count}`;

    // Generate secure 6-digit PIN
    const cleartextPin = Math.floor(100000 + crypto.randomBytes(4).readUInt32BE(0) % 900000).toString();
    const passwordHash = hashPassword(cleartextPin);

    // Create a write batch
    const batch = db.batch();

    // Update signup application
    batch.update(appRef, {
      status: "approved",
      reviewedBy: reviewerName,
      reviewedDate: new Date().toISOString(),
      membershipFeeStatus: isMember ? "pending" : "not_applicable"
    });

    // Fetch global organization settings for conduct/objectives
    let orgSettings: any = {};
    const orgSettingsSnap = await db.collection("org_settings").doc("global").get();
    if (orgSettingsSnap.exists) {
      orgSettings = orgSettingsSnap.data();
    }

    // Create profile document
    const skillsArray = application.skills
      ? application.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];

    // Promote the applicant's private signup passport photo to a real public profile
    // photo, so their membership ID card / dashboard avatar actually has an image
    // instead of falling back to initials. Previously this step didn't exist at all —
    // the new profile was created with no photoUrl field whatsoever.
    let profilePhotoUrl: string | undefined;
    if (application.passportPhotoPath) {
      try {
        const photoBuffer = await readFileBuffer(application.passportPhotoPath);
        const ext = application.passportPhotoPath.endsWith(".webp") ? "webp" : "jpg";
        const contentType = ext === "webp" ? "image/webp" : "image/jpeg";
        profilePhotoUrl = await saveFile(`profile-photos/${id}.${ext}`, photoBuffer, contentType, true);
      } catch (photoErr) {
        console.error(`Failed to migrate signup photo to public profile photo for application ${id}:`, photoErr);
        // Non-fatal: approval continues without a photo rather than blocking membership.
      }
    }

    const newProfile: any = {
      id, // same ID to link easily
      name: application.fullName,
      email: application.email || "",
      phone: application.phone,
      role: userRole,
      roleKey: userRoleKey,
      isActive: true,
      joinDate: new Date().toISOString().split("T")[0],
      memberNumber,
      status: "Active",
      skills: skillsArray,
      emergencyContact: {
        name: application.emergencyContactName,
        phone: application.emergencyContactPhone,
        relationship: application.emergencyContactRelationship
      },
      passwordHash,
      mustChangePassword: true,
      handbookAcknowledgedVersion: "1.2",
      handbookAcknowledgedAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString()
    };
    if (profilePhotoUrl) {
      newProfile.avatar = profilePhotoUrl; // UserProfile's photo field is 'avatar', not 'photoUrl'
    }

    batch.set(db.collection("profiles").doc(id), newProfile);

    // Create pending Contract Renewal for members
    if (isMember) {
      const renewalId = crypto.randomBytes(16).toString("hex");
      const defaultConduct = orgSettings.codeOfConduct || "Default CBO Code of Conduct";
      const defaultObjectives = orgSettings.objectives || "Default CBO Objectives";

      const newRenewal = {
        id: renewalId,
        userId: id,
        userName: application.fullName,
        userRole: userRole,
        submissionDate: new Date().toISOString().split("T")[0],
        // Previously pointed at /api/signup_applications/:id/document/passport — a private,
        // reviewer-only endpoint gated by signup_reviews:view. A regular member's own
        // browser would get a 403 trying to load that as an <img src>, so it always
        // rendered blank. Now uses the same public photo migrated on approval above.
        photoUrl: profilePhotoUrl || "",
        signedConduct: true,
        agreedObjectives: true,
        paymentStatus: "pending",
        status: "approved",
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 6 months
        reviewedBy: reviewerName,
        reviewedDate: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      batch.set(db.collection("contract_renewals").doc(renewalId), newRenewal);
    }

    await batch.commit();
    logActivity(req, "signup_reviews", "approve", id, application.fullName, { status: "pending" }, { status: "approved" });

    return res.json({
      success: true,
      message: `Application approved successfully. Profile created with Member Number: ${memberNumber}.`,
      memberNumber,
      cleartextPin
    });
  } catch (err: any) {
    console.error("Approve signup application failed:", err);
    return res.status(500).json({ error: "Failed to approve application.", details: err.message });
  }
});

// 6. Reject Application
app.post("/api/signup_applications/:id/reject", requireAuth, requirePermission("signup_reviews", "approve"), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const reviewerName = req.user!.name;

    if (!rejectionReason) {
      return res.status(400).json({ error: "Rejection reason is required." });
    }

    const appRef = db.collection("signup_applications").doc(id);
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      return res.status(404).json({ error: "Signup application not found." });
    }

    const application = appSnap.data();
    if (application.status !== "pending") {
      return res.status(400).json({ error: `Application is already ${application.status}.` });
    }

    await appRef.update({
      status: "rejected",
      rejectionReason,
      reviewedBy: reviewerName,
      reviewedDate: new Date().toISOString(),
      membershipFeeStatus: "not_applicable",
      updatedAt: new Date().toISOString()
    });

    logActivity(req, "signup_reviews", "reject", id, application.fullName, { status: "pending" }, { status: "rejected", rejectionReason });
    return res.json({ success: true, message: "Application rejected successfully." });
  } catch (err: any) {
    console.error("Reject signup application failed:", err);
    return res.status(500).json({ error: "Failed to reject application.", details: err.message });
  }
});

// 7. Staff Register Beneficiary
app.post("/api/beneficiaries", requireAuth, requirePermission("beneficiaries", "create"), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { fullName, dateOfBirth, guardianName, guardianPhone, location, notes } = req.body;

    if (!fullName || !dateOfBirth || !guardianName || !guardianPhone || !location) {
      return res.status(400).json({ error: "Missing required beneficiary fields." });
    }

    const beneficiaryId = crypto.randomBytes(16).toString("hex");
    const newBeneficiary = {
      id: beneficiaryId,
      fullName,
      dateOfBirth,
      guardianName,
      guardianPhone,
      location,
      notes: notes || "",
      registeredBy: req.user!.name,
      registeredDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection("beneficiaries").doc(beneficiaryId).set(newBeneficiary);
    logActivity(req, "beneficiaries", "create", beneficiaryId, fullName);
    return res.status(201).json({ success: true, beneficiaryId });
  } catch (err: any) {
    console.error("Beneficiary registration failed:", err);
    return res.status(500).json({ error: "Failed to register beneficiary.", details: err.message });
  }
});

// 7b. Fetch Beneficiaries List (Internal Staff Only)
app.get("/api/beneficiaries", requireAuth, requirePermission("beneficiaries", "view"), async (req, res): Promise<any> => {
  try {
    const snapshot = await db.collection("beneficiaries").get();
    const list: any[] = [];
    snapshot.forEach((doc: any) => {
      list.push(doc.data());
    });
    list.sort((a, b) => new Date(b.registeredDate).getTime() - new Date(a.registeredDate).getTime());
    return res.json(list);
  } catch (err: any) {
    console.error("Fetch beneficiaries failed:", err);
    return res.status(500).json({ error: "Failed to fetch beneficiaries.", details: err.message });
  }
});

const DEFAULT_ROLE_TEMPLATES = [
  {
    role: "Chairperson (Admin)",
    responsibilities: {
      en: "Provide overall strategic leadership to the organization, preside over committee meetings, oversee the execution of community projects, and represent the CBO to external partners and donors.",
      sw: "Kutoa uongozi mkuu wa kimkakati kwa shirika, kuongoza mikutano ya kamati, kusimamia utekelezaji vya miradi ya jamii, na kuwakilisha CBO kwa washirika wa nje na wafadhili."
    }
  },
  {
    role: "Vice Chairperson (Comms)",
    responsibilities: {
      en: "Assist the Chairperson in their duties, run communication and public relations strategies, manage media engagements, and amplify community outreach voices.",
      sw: "Kumsaidia Mwenyekiti katika majukumu yake, kuendesha mikakati ya mawasiliano na uhusiano wa umma, kusimamia ushirikiano wa vyombo vya habari, na kukuza sauti za uhamasishaji wa jamii."
    }
  },
  {
    role: "Programs Director",
    responsibilities: {
      en: "Design, execute, and monitor the CBO's creative, theatrical, and educational programs; coordinate artist and volunteer schedules; and manage program logistics.",
      sw: "Kubuni, tutekeleza, na kufuatilia programu za ubunifu, tamthilia, na elimu za CBO; kuratibu ratiba za wasanii na wajitoleaji; na kusimamia vifaa vya programu."
    }
  },
  {
    role: "Secretary",
    responsibilities: {
      en: "Maintain accurate organizational records, take and distribute minutes of all meetings, manage member registration lists, and handle official correspondence.",
      sw: "Kutunza kumbukumbu sahihi za shirika, kuchukua na kusambaza muhtasari wa mikutano yote, kusimamia orodha za usajili wa wanachama, na kushughulikia mawasiliano rasmi."
    }
  },
  {
    role: "Treasurer",
    responsibilities: {
      en: "Ensure financial oversight and accountability, manage budgets and expenditures, prepare monthly and annual financial reports, and coordinate fundraising/stipend disbursement.",
      sw: "Kuhakikisha usimamizi na uwajibikaji wa kifedha, kusimamia bajeti na matumizi, kuandaa ripoti za kila mwezi na mwaka za kifedha, na kuratibu ukusanyaji wa fedha/malipo ya posho."
    }
  },
  {
    role: "Safeguarding & MEL Officer",
    responsibilities: {
      en: "Ensure child protection and safeguarding policies are strictly enforced, handle sensitive case intakes, conduct monitoring & evaluation (MEL) of community projects, and draft compliance reports.",
      sw: "Kuhakikisha sera za ulinzi wa watoto na usalama zinatekelezwa kikamilifu, kushughulikia kesi nyeti, kufanya ufuatiliaji na tathmini (MEL) ya miradi ya jamii, na kuandaa ripoti za uzingatiaji."
    }
  }
];

// 8. Public Fetch Homepage Site Content
app.get("/api/public/site_content", async (req, res): Promise<any> => {
  try {
    const siteContentSnap = await db.collection("site_content").doc("global").get();
    if (!siteContentSnap.exists) {
      return res.status(404).json({ error: "Homepage content not found." });
    }
    const data = siteContentSnap.data()!;
    if (!data.roleTemplates) {
      data.roleTemplates = DEFAULT_ROLE_TEMPLATES;
    }
    return res.json(data);
  } catch (err: any) {
    console.error("Fetch site content failed:", err);
    return res.status(500).json({ error: "Failed to fetch homepage content.", details: err.message });
  }
});

// 9. Update Homepage Site Content (Admin Only)
app.post("/api/site_content", requireAuth, requirePermission("cms_editor", "edit"), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const {
      heroTitle, heroSubtitle, heroImageUrl, aboutText, missionText, visionText,
      programs, projects, contactEmail, contactPhone, contactAddress, roleTemplates,
      partnersList, equipmentList, teamMembers,
      equipmentEyebrow, equipmentTitle, equipmentSubtitle,
      galleryEyebrow, galleryTitle, gallerySubtitle, facebookUrl,
      impactStats, pillars
    } = req.body;

    if (!heroTitle || !heroSubtitle || !aboutText || !missionText) {
      return res.status(400).json({ error: "Missing required site content fields." });
    }

    const updatedContent = {
      heroTitle,
      heroSubtitle,
      heroImageUrl: heroImageUrl || "",
      aboutText,
      missionText,
      visionText: visionText || null,
      programs: programs || [],
      projects: projects || [],
      // These three were previously dropped entirely by this endpoint (not destructured
      // from req.body), so every "Publish Site Content" save silently wiped out any
      // Partners/Sponsors, Equipment/Gear, and Team Members data with a bare `.set()`.
      // Now explicitly preserved, and `merge: true` below is a second layer of defense
      // against the same class of bug for any future SiteContent field.
      partnersList: partnersList || [],
      equipmentList: equipmentList || [],
      teamMembers: teamMembers || [],
      equipmentEyebrow: equipmentEyebrow || null,
      equipmentTitle: equipmentTitle || null,
      equipmentSubtitle: equipmentSubtitle || null,
      galleryEyebrow: galleryEyebrow || null,
      galleryTitle: galleryTitle || null,
      gallerySubtitle: gallerySubtitle || null,
      facebookUrl: facebookUrl || "",
      contactEmail: contactEmail || "",
      contactPhone: contactPhone || "",
      contactAddress: contactAddress || "",
      roleTemplates: roleTemplates || DEFAULT_ROLE_TEMPLATES,
      impactStats: impactStats || [],
      pillars: pillars || [],
      updatedAt: new Date().toISOString()
    };

    await db.collection("site_content").doc("global").set(updatedContent, { merge: true });
    logActivity(req, "cms_editor", "save", "global", "Homepage Content");
    return res.json({ success: true, message: "Homepage content updated successfully." });
  } catch (err: any) {
    console.error("Update site content failed:", err);
    return res.status(500).json({ error: "Failed to update homepage content.", details: err.message });
  }
});

// 10. Public Fetch Gallery Images
app.get("/api/public/gallery_images", async (req, res): Promise<any> => {
  try {
    const snapshot = await db.collection("gallery_images").get();
    const list: any[] = [];
    snapshot.forEach((doc: any) => {
      list.push(doc.data());
    });
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    return res.json(list);
  } catch (err: any) {
    console.error("Fetch gallery images failed:", err);
    return res.status(500).json({ error: "Failed to fetch gallery images.", details: err.message });
  }
});

// 11. Upload Gallery Image (Admin / Comms Only)
app.post("/api/gallery_images", requireAuth, requirePermission("cms_editor", "create"), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { image, caption, order } = req.body;

    if (!image || !caption) {
      return res.status(400).json({ error: "Missing image upload or caption." });
    }

    const imageDecoded = decodeBase64Image(image);
    if (!imageDecoded) {
      return res.status(400).json({ error: "Invalid gallery image upload format." });
    }

    const imageId = crypto.randomBytes(16).toString("hex");
    // Match the real format (the CMS Editor converts to WebP client-side before
    // upload) instead of hardcoding .jpg — see the identical fix already applied to
    // /api/upload, which caused broken images in local mock-storage testing when the
    // saved extension didn't match the actual encoded bytes.
    const galleryExtensionForMimeType: Record<string, string> = {
      "image/webp": "webp",
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg"
    };
    const galleryExt = galleryExtensionForMimeType[imageDecoded.mimeType] || "jpg";
    const storagePath = `public-assets/gallery/${imageId}.${galleryExt}`;

    const publicUrl = await saveFile(storagePath, imageDecoded.buffer, imageDecoded.mimeType, true);

    let finalOrder = typeof order === "number" ? order : 0;
    if (typeof order !== "number") {
      const snapshot = await db.collection("gallery_images").get();
      let maxOrder = 0;
      snapshot.forEach((doc: any) => {
        const d = doc.data();
        if (d.order && d.order > maxOrder) {
          maxOrder = d.order;
        }
      });
      finalOrder = maxOrder + 1;
    }

    const newGalleryImage = {
      id: imageId,
      imageUrl: publicUrl,
      caption,
      uploadedBy: req.user!.name,
      uploadedAt: new Date().toISOString(),
      order: finalOrder,
      updatedAt: new Date().toISOString()
    };

    await db.collection("gallery_images").doc(imageId).set(newGalleryImage);
    return res.status(201).json({ success: true, imageId, imageUrl: publicUrl });
  } catch (err: any) {
    console.error("Upload gallery image failed:", err);
    const userFriendlyError = err.message && err.message.includes("File upload failed")
      ? "Upload failed, please try again shortly."
      : "Failed to upload gallery image.";
    return res.status(500).json({ error: userFriendlyError, details: err.message });
  }
});

// 12. Edit Gallery Image (Admin / Comms Only)
app.put("/api/gallery_images/:id", requireAuth, requirePermission("cms_editor", "edit"), async (req: AuthenticatedRequest, res: express.Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { image, caption, order } = req.body;

    const docRef = db.collection("gallery_images").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Gallery image not found" });
    }

    const currentData = snap.data()!;
    let imageUrl = currentData.imageUrl;

    if (image && image.startsWith("data:")) {
      const imageDecoded = decodeBase64Image(image);
      if (!imageDecoded) {
        return res.status(400).json({ error: "Invalid gallery image upload format." });
      }
      const galleryExtensionForMimeType: Record<string, string> = {
        "image/webp": "webp",
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg"
      };
      const galleryExt = galleryExtensionForMimeType[imageDecoded.mimeType] || "jpg";
      const storagePath = `public-assets/gallery/${id}.${galleryExt}`;
      imageUrl = await saveFile(storagePath, imageDecoded.buffer, imageDecoded.mimeType, true);
    }

    const updatedImage = {
      ...currentData,
      imageUrl,
      caption: caption || currentData.caption,
      order: typeof order === "number" ? order : currentData.order,
      updatedAt: new Date().toISOString()
    };

    await docRef.set(updatedImage);
    return res.json({ success: true, imageId: id, imageUrl });
  } catch (err: any) {
    console.error("Edit gallery image failed:", err);
    return res.status(500).json({ error: "Failed to update gallery image.", details: err.message });
  }
});


async function runRoleKeyMigration(): Promise<void> {
  try {
    console.log("[RoleKey Migration] Starting database roleKey migration audit...");
    
    // 1. Audit and update roles collection
    const rolesSnap = await db.collection("roles").get();
    const roleKeyByName = new Map<string, string>();
    const roleKeyById = new Map<string, string>();

    for (const rDoc of rolesSnap.docs) {
      const data = rDoc.data();
      const canonicalKey = data.roleKey || getCanonicalRoleKey(data.name || data.originalName || rDoc.id, rDoc.id);
      
      if (data.name) roleKeyByName.set(data.name.toLowerCase().trim(), canonicalKey);
      if (data.originalName) roleKeyByName.set(data.originalName.toLowerCase().trim(), canonicalKey);
      roleKeyById.set(rDoc.id.toLowerCase().trim(), canonicalKey);

      if (!data.roleKey || data.roleKey !== canonicalKey) {
        await db.collection("roles").doc(rDoc.id).update({ roleKey: canonicalKey });
        console.log(`[RoleKey Migration] Updated role document '${rDoc.id}' (${data.name}) with roleKey='${canonicalKey}'`);
      }
    }

    // 2. Audit and update profiles collection
    const profilesSnap = await db.collection("profiles").get();
    let updatedProfilesCount = 0;
    let unmappedProfilesCount = 0;

    for (const pDoc of profilesSnap.docs) {
      const pData = pDoc.data();
      let targetRoleKey = pData.roleKey;

      if (!targetRoleKey) {
        if (pData.role && roleKeyByName.has(pData.role.toLowerCase().trim())) {
          targetRoleKey = roleKeyByName.get(pData.role.toLowerCase().trim())!;
        } else {
          targetRoleKey = getCanonicalRoleKey(pData.role, pData.id);
        }
      }

      if (!targetRoleKey) {
        console.error(`[RoleKey Migration] WARNING: Profile '${pDoc.id}' (${pData.name}) role '${pData.role}' could not be mapped to any roleKey!`);
        unmappedProfilesCount++;
        targetRoleKey = "program_member";
      }

      if (pData.roleKey !== targetRoleKey) {
        await db.collection("profiles").doc(pDoc.id).update({ roleKey: targetRoleKey });
        updatedProfilesCount++;
        console.log(`[RoleKey Migration] Profile '${pDoc.id}' (${pData.name || "No name"}): role='${pData.role}' -> set roleKey='${targetRoleKey}'`);
      } else {
        console.log(`[RoleKey Migration] Profile '${pDoc.id}' (${pData.name}): role='${pData.role}', roleKey='${pData.roleKey}' [OK]`);
      }
    }

    console.log(`[RoleKey Migration] Audit completed: ${rolesSnap.size} roles checked, ${profilesSnap.size} profiles checked (${updatedProfilesCount} updated, ${unmappedProfilesCount} unmapped warnings).`);
  } catch (err) {
    console.error("[RoleKey Migration] Error running migration script:", err);
  }
}

// Configure Dev and Production flows
async function startServer() {
  // Wait for database connection to resolve (real or mock fallback)
  console.log("Waiting for Firestore initialization...");
  await dbInitPromise;

  // Seed database after initialization is fully complete
  await seedDatabaseIfEmpty();
  await runRoleKeyMigration();
  await seedHomepageContentIfEmpty();
  await seedRolePermissionsIfMissing();

  const distPath = path.join(process.cwd(), "dist");
  const hasDistIndex = fs.existsSync(path.join(distPath, "index.html"));

  if (process.env.NODE_ENV !== "production" || !hasDistIndex) {
    console.log("Starting in development mode (or dist/index.html is missing, falling back to Vite middleware)...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in production mode (serving dist/)...");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
