import { initializeApp as initAdminApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables as early as possible
dotenv.config();

// Configuration targets
export let projectId = "gen-lang-client-0903061428";
export let firestoreDbId = "ai-studio-bashoshoos-4530ec7d-21bc-43f5-904c-665179a3f4d3";
export let resolvedDbId = firestoreDbId;
export let storageBucket = "gen-lang-client-0903061428.firebasestorage.app";

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config) {
      if (config.projectId) projectId = config.projectId;
      if (config.firestoreDatabaseId) {
        firestoreDbId = config.firestoreDatabaseId;
      } else if (projectId !== "gen-lang-client-0903061428") {
        firestoreDbId = "(default)";
      }
      if (config.storageBucket) {
        storageBucket = config.storageBucket;
      } else if (projectId !== "gen-lang-client-0903061428") {
        storageBucket = `${projectId}.firebasestorage.app`;
      }
    }
  }
} catch (e) {
  console.warn("Could not read firebase-applet-config.json in server-firebase:", e);
}

// Ensure database ID is resolved
resolvedDbId = firestoreDbId;

console.log("========================================================================");
console.log("  BASHOSHO OS SERVER STARTUP CONFIGURATION CHECK");
console.log(`  NODE_ENV: ${process.env.NODE_ENV || "development"}`);
console.log(`  APP_SEED_MODE: ${process.env.APP_SEED_MODE || "production"}`);
console.log(`  FIREBASE_SERVICE_ACCOUNT: ${process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? "SET (FOUND IN ENV)" : "NOT SET (USING ADC / MOCK)"}`);
console.log(`  TARGET PROJECT: ${projectId}`);
console.log(`  TARGET DATABASE ID: ${firestoreDbId}`);
console.log(`  PRODUCTION DETECTION: NODE_ENV=${process.env.NODE_ENV === "production" ? "production (matched)" : "no match"}, REQUIRE_REAL_FIRESTORE=${process.env.REQUIRE_REAL_FIRESTORE === "true" ? "true (matched)" : "no match"}, K_SERVICE=${process.env.K_SERVICE ? `"${process.env.K_SERVICE}" (matched - Cloud Run detected)` : "not set"}`);
console.log("========================================================================");

// =========================================================================
// MOCK FIRESTORE LOCAL DATABASE EMULATOR (SURVIVES RESTARTS & NO AUTH REQUIRED)
// =========================================================================

export interface MockDocumentSnapshot {
  id: string;
  exists: boolean;
  data(): any;
}

export interface MockQuerySnapshot {
  docs: MockDocumentSnapshot[];
  empty: boolean;
  size: number;
  forEach(callback: (doc: MockDocumentSnapshot) => void): void;
}

export class MockDocumentReference {
  constructor(public id: string, public colName: string, private db: any) {}

  async get(): Promise<MockDocumentSnapshot> {
    const data = this.db.getDoc(this.colName, this.id);
    return {
      id: this.id,
      exists: data !== undefined,
      data: () => (data ? { ...data } : undefined)
    };
  }

  async set(data: any, options?: { merge?: boolean }): Promise<void> {
    this.db.setDoc(this.colName, this.id, data, options);
  }

  async update(data: any): Promise<void> {
    this.db.updateDoc(this.colName, this.id, data);
  }

  async delete(): Promise<void> {
    this.db.deleteDoc(this.colName, this.id);
  }
}

export class MockQuery {
  constructor(
    protected colName: string,
    protected db: any,
    protected filters: Array<{ field: string; op: string; value: any }> = [],
    protected sortField: string | null = null,
    protected sortDir: "asc" | "desc" = "asc",
    protected limitNum: number | null = null
  ) {}

  where(field: string, op: string, value: any): MockQuery {
    return new MockQuery(
      this.colName,
      this.db,
      [...this.filters, { field, op, value }],
      this.sortField,
      this.sortDir,
      this.limitNum
    );
  }

  orderBy(field: string, direction: "asc" | "desc" = "asc"): MockQuery {
    return new MockQuery(
      this.colName,
      this.db,
      this.filters,
      field,
      direction,
      this.limitNum
    );
  }

  limit(n: number): MockQuery {
    return new MockQuery(
      this.colName,
      this.db,
      this.filters,
      this.sortField,
      this.sortDir,
      n
    );
  }

  async get(): Promise<MockQuerySnapshot> {
    let docs = this.db.getCollectionDocs(this.colName);

    // Apply filters
    for (const filter of this.filters) {
      docs = docs.filter((doc: any) => {
        // Resolve nested path (e.g. "emergencyContact.relationship")
        const parts = filter.field.split(".");
        let val = doc;
        for (const part of parts) {
          if (val && typeof val === "object") {
            val = val[part];
          } else {
            val = undefined;
            break;
          }
        }

        const op = filter.op;
        const filterVal = filter.value;

        if (op === "==") return val === filterVal;
        if (op === "!=") return val !== filterVal;
        if (op === "<") return val < filterVal;
        if (op === "<=") return val <= filterVal;
        if (op === ">") return val > filterVal;
        if (op === ">=") return val >= filterVal;
        if (op === "array-contains") return Array.isArray(val) && val.includes(filterVal);
        if (op === "in") return Array.isArray(filterVal) && filterVal.includes(val);
        return false;
      });
    }

    // Apply sorting
    if (this.sortField) {
      const field = this.sortField;
      const dir = this.sortDir === "asc" ? 1 : -1;
      docs.sort((a: any, b: any) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === undefined || valB === undefined) return 0;
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
      });
    }

    // Apply limit
    if (this.limitNum !== null) {
      docs = docs.slice(0, this.limitNum);
    }

    const docSnapshots: MockDocumentSnapshot[] = docs.map((data: any) => ({
      id: data.id,
      exists: true,
      data: () => ({ ...data }),
      // Real Firestore's QueryDocumentSnapshot includes a .ref for update-after-query
      // patterns (e.g. "find the pending transaction, then update it"). The mock
      // previously omitted this, which crashed any code relying on it — .doc()/.get()
      // and .doc()/.set() elsewhere worked fine, only this query-result path was missing it.
      ref: this.db.collection(this.colName).doc(data.id)
    }));

    return {
      docs: docSnapshots,
      empty: docSnapshots.length === 0,
      size: docSnapshots.length,
      forEach: (callback) => docSnapshots.forEach(callback)
    };
  }
}

export class MockCollectionReference extends MockQuery {
  constructor(colName: string, db: any) {
    super(colName, db);
  }

  doc(id?: string): MockDocumentReference {
    const docId = id || crypto.randomBytes(16).toString("hex");
    return new MockDocumentReference(docId, this.colName, this.db);
  }

  async add(data: any): Promise<MockDocumentReference> {
    const docId = crypto.randomBytes(16).toString("hex");
    const docRef = this.doc(docId);
    await docRef.set(data);
    return docRef;
  }
}

export class MockWriteBatch {
  private ops: Array<() => void> = [];
  constructor(private db: any) {}

  set(docRef: MockDocumentReference, data: any, options?: { merge?: boolean }): MockWriteBatch {
    this.ops.push(() => docRef.set(data, options));
    return this;
  }

  update(docRef: MockDocumentReference, data: any): MockWriteBatch {
    this.ops.push(() => docRef.update(data));
    return this;
  }

  delete(docRef: MockDocumentReference): MockWriteBatch {
    this.ops.push(() => docRef.delete());
    return this;
  }

  async commit(): Promise<void> {
    for (const op of this.ops) {
      op();
    }
    this.db.save();
  }
}

export class MockFirestore {
  private state: { [col: string]: { [id: string]: any } } = {};
  private filePath = path.join(process.cwd(), "local-firestore.json");

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.state = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      } else {
        this.state = {};
      }
    } catch (e) {
      console.warn("Error loading local firestore JSON:", e);
      this.state = {};
    }
  }

  public save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), "utf8");
    } catch (e) {
      console.error("Error saving local firestore JSON:", e);
    }
  }

  collection(name: string): MockCollectionReference {
    return new MockCollectionReference(name, this);
  }

  batch(): MockWriteBatch {
    return new MockWriteBatch(this);
  }

  /**
   * Mock equivalent of Firestore's `runTransaction`. The whole update function runs
   * against a private working copy of the state; nothing is visible to other readers and
   * NOTHING is committed unless the update function completes without throwing. That
   * gives the local mock genuine all-or-nothing semantics (plus reads seeing their own
   * staged writes), so regression tests for our financial confirmation flow can verify
   * atomicity — a failure halfway through leaves zero partial writes behind.
   */
  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    const workingState: { [col: string]: { [id: string]: any } } = JSON.parse(JSON.stringify(this.state));
    const transaction = {
      get: (ref: MockDocumentReference) => {
        const data = workingState[ref.colName]?.[ref.id];
        return Promise.resolve({
          exists: data !== undefined,
          id: ref.id,
          data: () => (data ? { ...data } : undefined)
        });
      },
      set: (ref: MockDocumentReference, data: any, options?: { merge?: boolean }) => {
        if (!workingState[ref.colName]) workingState[ref.colName] = {};
        const existing = workingState[ref.colName][ref.id] || {};
        workingState[ref.colName][ref.id] = (options?.merge ? { ...existing, ...data } : { ...data });
      },
      update: (ref: MockDocumentReference, data: any) => {
        if (!workingState[ref.colName]) workingState[ref.colName] = {};
        const existing = workingState[ref.colName][ref.id] || {};
        workingState[ref.colName][ref.id] = { ...existing, ...data };
      },
      delete: (ref: MockDocumentReference) => {
        if (workingState[ref.colName]) delete workingState[ref.colName][ref.id];
      }
    };
    const updateResult = await updateFunction(transaction);
    // Only reached if updateFunction completed without throwing → commit atomically.
    this.state = workingState;
    this.save();
    return updateResult;
  }

  getDoc(col: string, id: string): any {
    return this.state[col]?.[id];
  }

  setDoc(col: string, id: string, data: any, options?: { merge?: boolean }) {
    if (!this.state[col]) {
      this.state[col] = {};
    }
    const existing = this.state[col][id] || {};
    if (options?.merge) {
      this.state[col][id] = { ...existing, ...data, id };
    } else {
      this.state[col][id] = { ...data, id };
    }
    this.save();
  }

  updateDoc(col: string, id: string, data: any) {
    if (!this.state[col]) {
      this.state[col] = {};
    }
    const existing = this.state[col][id] || {};
    this.state[col][id] = { ...existing, ...data, id };
    this.save();
  }

  deleteDoc(col: string, id: string) {
    if (this.state[col]?.[id]) {
      delete this.state[col][id];
      this.save();
    }
  }

  getCollectionDocs(col: string): any[] {
    return Object.values(this.state[col] || {});
  }
}

// =========================================================================
// FIREBASE ADMIN PROVIDER WITH MOCK DB AUTOFALLBACK
// =========================================================================

class DynamicDb {
  private activeDb: any;
  private isUsingMockDb = true;

  constructor() {
    this.activeDb = new MockFirestore();
  }

  setActiveDb(dbInstance: any, isMock = false) {
    this.activeDb = dbInstance;
    this.isUsingMockDb = isMock;
  }

  get isMock() {
    return this.isUsingMockDb;
  }

  collection(name: string) {
    return this.activeDb.collection(name);
  }

  batch() {
    return this.activeDb.batch();
  }

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    return this.activeDb.runTransaction(updateFunction);
  }
}

export const db = new DynamicDb();

// Self-healing database initializer
export const dbInitPromise = (async () => {
  // Explicit local-dev escape hatch: skip ANY contact with firebase-admin/Google Auth
  // entirely when set. This exists because attempting a real Firestore connection with
  // no credentials can throw via an unhandled promise rejection from deep inside
  // google-auth-library's background ADC/metadata-server probing — a rejection that
  // occurs OUTSIDE this function's own try/catch below and crashes the whole process,
  // rather than being caught here and falling back gracefully. Setting
  // FORCE_MOCK_FIRESTORE=true avoids ever reaching that code path.
  if (process.env.FORCE_MOCK_FIRESTORE === "true") {
    console.log("=========================================================");
    console.log("  FORCE_MOCK_FIRESTORE=true — skipping real Firestore     ");
    console.log("  connection entirely. Using local file-persisted mock.   ");
    console.log("=========================================================");
    db.setActiveDb(new MockFirestore(), true);
    return;
  }

  try {
    console.log(`[Firebase Admin] Attempting initialization for project: ${projectId}, database: ${resolvedDbId}`);
    
    // Check for a private key string or path first, otherwise use applicationDefault
    let app;
    const isProductionEnv = process.env.NODE_ENV === "production" || process.env.REQUIRE_REAL_FIRESTORE === "true" || !!process.env.K_SERVICE;
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (isProductionEnv && !serviceAccountVar) {
      console.error("=========================================================");
      console.error("  CRITICAL ERROR: FIREBASE_SERVICE_ACCOUNT IS MISSING!   ");
      console.error("  FIREBASE_SERVICE_ACCOUNT environment variable is       ");
      console.error("  required in production environments.                   ");
      console.error("  Aborting server startup to prevent booting into an    ");
      console.error("  ephemeral mock store that resets on restart.          ");
      console.error("=========================================================");
      process.exit(1);
    }
    
    if (serviceAccountVar) {
      try {
        const trimmed = serviceAccountVar.trim();
        const cred = cert(JSON.parse(trimmed));
        app = getApps().length === 0 ? initAdminApp({ credential: cred, projectId, storageBucket }) : getApp();
        console.log("[Firebase Admin] Initialized using service account credentials from environment.");
      } catch (err: any) {
        if (isProductionEnv) {
          console.error("[Firebase Admin] CRITICAL ERROR parsing FIREBASE_SERVICE_ACCOUNT in production:", err.message);
          process.exit(1);
        }
        console.warn("[Firebase Admin] Failed parsing FIREBASE_SERVICE_ACCOUNT env var, trying applicationDefault:", err.message);
        app = getApps().length === 0 ? initAdminApp({ projectId, storageBucket }) : getApp();
      }
    } else {
      app = getApps().length === 0 ? initAdminApp({ projectId, storageBucket }) : getApp();
    }

    const adminFirestore = resolvedDbId && resolvedDbId !== "(default)"
      ? getAdminFirestore(app, resolvedDbId)
      : getAdminFirestore(app);
    
    // Test actual connectivity to verify if sandbox service account has permission
    console.log("[Firebase Admin] Verifying permissions on real Firestore...");
    await adminFirestore.collection("profiles").limit(1).get();
    
    // Success! Switch dynamic db to genuine Admin Firestore
    db.setActiveDb(adminFirestore, false);
    console.log("=========================================================");
    console.log("  REAL FIRESTORE ADMIN SDK CONNECTION SUCCESSFUL!        ");
    console.log(`  Project: ${projectId}                                  `);
    console.log(`  Database ID: ${resolvedDbId}                           `);
    console.log("=========================================================");
  } catch (error: any) {
    const isProductionEnv = process.env.NODE_ENV === "production" || process.env.REQUIRE_REAL_FIRESTORE === "true" || !!process.env.K_SERVICE;
    if (isProductionEnv) {
      console.error("=========================================================");
      console.error("  CRITICAL ERROR: REAL FIRESTORE CONNECTION FAILED!      ");
      console.error(`  Reason: ${error.message || error}                      `);
      console.error("  Aborting server startup in production mode.            ");
      console.error("=========================================================");
      process.exit(1);
    }
    console.log("=========================================================");
    console.log("  FIRESTORE ADMIN SDK CONNECTION FAILED                  ");
    console.log("  Falling back to high-performance local file-persisted ");
    console.log("  JSON Firestore emulator ('local-firestore.json')       ");
    console.log(`  Reason: ${error.message || error}                      `);
    console.log("  To connect to your live project, add your service      ");
    console.log("  account key via the FIREBASE_SERVICE_ACCOUNT variable  ");
    console.log("=========================================================");
    // DynamicDb defaults to MockFirestore, so we keep it as activeDb
    db.setActiveDb(new MockFirestore(), true);
  }
})();

// =========================================================================
// CRYPTOGRAPHY & PASSWORD HELPERS
// =========================================================================

if (!process.env.SAFEGUARDING_SECRET) {
  throw new Error("CRITICAL STARTUP ERROR: SAFEGUARDING_SECRET environment variable is not set!");
}
const SAFEGUARDING_SECRET = process.env.SAFEGUARDING_SECRET;

if (!process.env.VERIFICATION_SECRET) {
  throw new Error("CRITICAL STARTUP ERROR: VERIFICATION_SECRET environment variable is not set!");
}
const VERIFICATION_SECRET = process.env.VERIFICATION_SECRET;

const ENCRYPTION_ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(SAFEGUARDING_SECRET)
  .digest();

export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  } catch (error) {
    console.error("Encryption failed:", error);
    return text;
  }
}

export function decrypt(encryptedText: string): string {
  try {
    if (!encryptedText.includes(":")) {
      return encryptedText;
    }
    const parts = encryptedText.split(":");
    const ivHex = parts.shift();
    if (!ivHex) return encryptedText;
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = parts.join(":");
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    return "[Encrypted - Decryption Failed]";
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  try {
    if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
      return bcrypt.compareSync(password, hash);
    }
    const sha256Hash = crypto.createHash("sha256").update(password).digest("hex");
    return sha256Hash === hash;
  } catch (error) {
    console.error("Password comparison failed:", error);
    return false;
  }
}

// Note: When comparing the token returned by this function, always use crypto.timingSafeEqual for defense in depth against timing attacks.
export function generateVerificationToken(type: string, id: string): string {
  return crypto.createHmac("sha256", VERIFICATION_SECRET)
    .update(`${type}:${id}`)
    .digest("hex")
    .slice(0, 16);
}

// =========================================================================
// SEED DATA CONFIGURATION
// =========================================================================

const SEED_PROFILES = [
  {
    id: "m-1",
    name: "Demo Chairperson",
    email: "demo.chairperson@bashosho.example",
    phone: "+254 700 000000",
    role: "Chairperson (Admin)",
    isActive: true,
    joinDate: "2020-01-15",
    memberNumber: "BT-CBO-DEMO-101",
    status: "Active",
    skills: ["Directing", "Screenwriting", "Community Advocacy", "Leadership"],
    emergencyContact: { name: "Demo Emergency Contact", phone: "+254 700 000001", relationship: "Spouse" },
    // NOTE: this is DEMO-mode seed data only (APP_SEED_MODE=demo), never used
    // for the real production Chairperson account — see MINIMAL_PRODUCTION_SEED
    // below, which uses a randomized one-time PIN instead of a fixed password.
    passwordHash: hashPassword("1234"),
    mustChangePassword: true
  }
];

const SEED_PARTNERS = [];

const SEED_ASSETS = [];

const SEED_DOCUMENTS = [];

const SEED_BUDGETS = [];
const SEED_EXPENDITURES = [];
const SEED_INCOMES = [];
const SEED_ATTENDANCE = [];
const SEED_GRANTS = [];
const SEED_CLASSES = [];
const SEED_SAFEGUARDING = [];
const SEED_BROADCASTS = [];
const SEED_LEAVE = [];
const SEED_INVOICES = [];

const SEED_HANDBOOK_SECTIONS = [
  {
    id: "objectives",
    title: { en: "1. Core Objectives", sw: "1. Malengo Makuu" },
    body: {
      en: "1. To harness the power of theatre and short film to raise awareness on social problems affecting our communities — specifically Mental Health, Gender-Based Violence (GBV), and Sexual and Reproductive Health Rights (SRHR).\n2. To build the vocational, digital, entrepreneurial, and leadership capacity of youth through the Bashosho Film Academy and related training.\n3. To connect survivors of GBV and youth facing mental health challenges to appropriate safe spaces, counseling, and partner organizations equipped to support them directly.\n4. To partner with organizations across Nairobi — extending the reach of our theatre and film-based awareness work beyond Kiambiu, where we are registered.\n5. To generate sustainable income for the CBO's programs through Theatre as a Service (TaaS) bookings and equipment hire, reinvested into community work.",
      sw: "1. Kutumia nguvu ya tamthilia na filamu fupi kuhamasisha kuhusu matatizo ya kijamii yanayoathiri jamii zetu — hasa Afya ya Akili, Dhuluma za Kijinsia (GBV), na Haki za Afya ya Uzazi (SRHR).\n2. Kujenga uwezo wa kiufundi, kidijitali, ujasiriamali, na uongozi wa vijana kupitia Bashosho Film Academy na mafunzo husika.\n3. Kuunganisha manusura wa GBV na vijana wanaokabiliwa na changamoto za afya ya akili na nafasi salama, ushauri, na mashirika washirika yaliyoandaliwa kuwasaidia moja kwa moja.\n4. Kushirikiana na mashirika kote Nairobi — kupanua wigo wa kazi zetu za uelimishaji wa tamthilia na filamu zaidi ya Kiambiu.\n5. Kutengeneza mapato endelevu kwa ajili ya programu za CBO kupitia uhifadhi wa Theatre as a Service (TaaS) na ukodishaji wa vifaa."
    },
    order: 1
  },
  {
    id: "code-of-conduct",
    title: { en: "2. Code of Conduct", sw: "2. Mwongozo wa Maadili" },
    body: {
      en: "1. Respect and integrity: Treat all members, trainers, beneficiaries, and community stakeholders with dignity.\n2. Non-discrimination: No discrimination or harassment based on gender, tribe, religion, disability, HIV status, or background.\n3. Safeguarding first: Every member is a safeguarding actor. Section 5 and Section 6 apply to everyone at every event.\n4. Transparency and accountability: Be honest about how CBO equipment, funds, and the Bashosho name are used.\n5. Professional dedication: Be punctual for rehearsals, forum theatre roadshows, filming, and mentorship sessions.\n6. Sobriety on duty: No alcohol or drug use before or during rehearsals, performances, filming, or activities with minors.\n7. Dress and presentation: Wear CBO-branded or presentable attire during official engagements.\n8. Working time stays professional: Personal or romantic relationships between members are not to be displayed or practiced during official CBO working hours or activities. Personal life is kept to personal time.",
      sw: "1. Heshima na uaminifu: Watendee wanachama wote, wakufunzi, na wanajamii kwa heshima.\n2. Kutobagua: Hakuna ubaguzi au udhalilishaji kulingana na jinsia, kabila, dini, au ulemavu.\n3. Ulinzi kwanza: Kila mwanachama ni mlinzi wa usalama.\n4. Uazi na uwajibikaji: Uwe mwaminifu kuhusu matumizi ya vifaa na fedha za CBO.\n5. Kujitolea kwa kitaalamu: Fika kwa wakati kwenye mazoezi na maonyesho.\n6. Utulivu kazini: Hakuna matumizi ya pombe au dawa za kulevya kabla au wakati wa shughuli za CBO.\n7. Mavazi rasmi: Vaa mavazi rasmi au ya CBO wakati wa kazi.\n8. Muda wa kazi ni wa kitaalamu: Mahusiano ya kibinafsi au ya kimapenzi kati ya wanachama hayapaswi kuonyeshwa wakati wa masaa rasmi ya kazi ya CBO."
    },
    order: 2
  },
  {
    id: "membership-rules",
    title: { en: "3. Membership, Attendance & Renewal Rules", sw: "3. Kanuni za Uanachama na Kuhudhuria" },
    body: {
      en: "1. All active members and volunteers must renew their contract every 6 months through the dashboard Contract Renewal panel.\n2. A renewal fee of Ksh 200 is payable to the treasury to support upkeep of the community space.\n3. Members must maintain at least 70% attendance of rehearsals, forum theatre sessions, filming, and workshops to keep active standing.\n4. A current digital passport-size photo must be submitted at each renewal for ID card records.\n5. Resigning members must complete an equipment and asset handover checklist before membership is closed.",
      sw: "1. Wanachama wote na wanajitolea lazima wahuishe mikataba yao kila baada ya miezi 6.\n2. Ada ya kuhuisha ni Ksh 200 inalipwa kwa hazina kusaidia matengenezo ya nafasi ya jamii.\n3. Wanachama lazima wadumishe angalau 70% ya mahudhurio ya mazoezi na maonyesho.\n4. Picha ya kidijitali ya pasipoti lazima iwasilishwe wakati wa kuhuisha mkataba.\n5. Wanachama wanaojiuzulu lazima wakamilishe orodha ya kukabidhi vifaa kabla ya kufunga uanachama."
    },
    order: 3
  },
  {
    id: "relationships-policy",
    title: { en: "4. Relationships & Conflict of Interest Policy", sw: "4. Siasa za Mahusiano na Migongano ya Maslahi" },
    body: {
      en: "1. Working time stays professional: Romantic or personal relationships are not to be displayed or practiced during CBO working hours.\n2. Professional boundaries with beneficiaries: Strict zero-tolerance policy against romantic/sexual relationships with current program beneficiaries, especially minors in the Bashosho Film Academy.\n3. Reporting-relationship disclosure: Supervisory relationships must be disclosed in writing to the Chairperson within 14 days to reassign approval duties.\n4. Family and financial relationships: Family ties to Treasurer, Chairperson, or Vice Chairperson must be declared at onboarding.\n5. No favoritism in casting, hiring, or stipends: Roles, bookings, and paid opportunities are assigned strictly on merit and documented rationale.\n6. External partner relationships: No personal gifts, kickbacks, or side payments from clients.",
      sw: "1. Muda wa kazi unakaa kitaalamu.\n2. Mipaka ya kitaalamu na wanufaika: Sera madhubuti ya kutovumilia mahusiano ya kimapenzi na wanufaika wa programu, hasa watoto.\n3. Ufichuzi wa mahusiano ya usimamizi: Mahusiano ya kisimamizi lazima yatangazwe kwa mwenyekiti kwa maandishi.\n4. Hakuna upendeleo katika uchaguzi wa wasanii, ajira, au posho."
    },
    order: 4
  },
  {
    id: "safeguarding-policy",
    title: { en: "5. Safeguarding & Child Protection Policy", sw: "5. Ulinzi wa Watoto na Usalama wa Wanajamii" },
    body: {
      en: "1. Any activity involving participants under 18 requires at least two vetted adults present at all times.\n2. All members working directly with minors must undergo a safeguarding briefing before their first session.\n3. Physical contact with minors must be limited to safety/directing, done openly in view of others.\n4. Photography or filming of minors requires a signed parent/guardian consent form on file.\n5. Any concern about a minor's safety must be reported the same day through the confidential Safeguarding Reports channel.",
      sw: "1. Shughuli yoyote inayohusisha watoto chini ya miaka 18 inahitaji watu wazima wawili waliokaguliwa uwepo wakati wote.\n2. Picha au utengenezaji wa filamu za watoto unahitaji fomu ya idhini ya mzazi/mlezi iliyosainiwa.\n3. Wasiwasi wowote kuhusu usalama wa mtoto lazima uripotiwe siku hiyo hiyo kupitia mfumo wa usalama."
    },
    order: 5
  },
  {
    id: "gbv-awareness-referral",
    title: { en: "6. GBV Awareness & Referral Policy", sw: "6. Sera ya Uhamasishaji na Rufaa za GBV" },
    body: {
      en: "Bashosho Talents does not operate its own safe space or shelter. Our role is to raise awareness, identify people who need help, and connect them quickly to safe spaces, counselors, and partner organizations equipped to support them directly.\n1. Zero tolerance for GBV, harassment, or coercion by any member or partner.\n2. Disclosures or concerns must be reported same-day via the confidential Safeguarding Reports channel or in person.\n3. Every report is logged with a timestamp and handled confidentially.\n4. Warm referral to appropriate partner safe spaces/medical/legal services within 24 hours.",
      sw: "Bashosho Talents haihifadhi au kuendesha nyumba yake salama ya manusura. Jukumu letu ni kuhamasisha na kutoa rufaa za haraka kwa mashirika washirika salama.\n1. Kutovumilia kabisa dhuluma za kijinsia au unyanyasaji.\n2. Ripoti za siri zinatunzwa na kushughulikiwa ndani ya masaa 24."
    },
    order: 6
  },
  {
    id: "financial-policy",
    title: { en: "7. Financial Conduct & Asset Use Policy", sw: "7. Matumizi ya Fedha na Mali za CBO" },
    body: {
      en: "1. All CBO funds (grants, TaaS booking fees, equipment hire, renewal fees) are recorded in the Financial Ledger.\n2. Equipment checked out through the Asset Hiring Board must be returned per the recorded rental agreement.\n3. Personal use of CBO equipment for non-CBO paid work is prohibited unless hired through standard processes.\n4. Dual approval (Treasurer and Chairperson) required for expenditure releases.\n5. Official documents (invoices, contracts, letters, certificates) are stamped using the authorized signatory's verified digital signature on file.",
      sw: "1. Fedha zote za CBO zinaripotiwa kwenye Daftari la Fedha.\n2. Vifaa vinavyokodishwa vinapaswa kurudishwa kulingana na mkataba.\n3. Nyaraka rasmi zinasainiwa kwa kutumia saini ya kidijitali iliyothibitishwa ya mtia saini aliyeidhinishwa."
    },
    order: 7
  },
  {
    id: "confidentiality-policy",
    title: { en: "8. Confidentiality, Media Consent & Data Protection", sw: "8. Usiri wa Data na Kibali cha Vyombo vya Habari" },
    body: {
      en: "1. Personal details of beneficiaries, GBV survivors, and minors must never be shared outside official channels.\n2. Written/filmed consent required before using anyone's name or image in public materials.\n3. Dashboard financial and safeguarding records are role-restricted.",
      sw: "1. Maelezo ya kibinafsi ya wanufaika na watoto hayapaswi kusambazwa nje ya mfumo rasmi.\n2. Idhini ya maandishi inahitajika kabla ya kutumia picha au jina la mtu hadharani."
    },
    order: 8
  },
  {
    id: "social-media-policy",
    title: { en: "9. Social Media & Public Conduct", sw: "9. Maadili Kwenye Mitandao ya Kijamii" },
    body: {
      en: "1. Represent the organization's values when posting as an identifiable Bashosho member.\n2. Disagreements must be resolved internally, not aired on social media.\n3. Only designated comms leads (Chairperson / Vice Chairperson) may post on official CBO channels.",
      sw: "1. Wakilisha maadili ya shirika kwenye mitandao ya kijamii.\n2. Tofauti kati ya wanachama zisuluhishwe ndani ya CBO."
    },
    order: 9
  },
  {
    id: "disciplinary-procedure",
    title: { en: "10. Disciplinary Procedure", sw: "10. Hatua za Nidhamu" },
    body: {
      en: "1. Step 1: Informal resolution by Programs Director or Secretary.\n2. Step 2: Formal written warning logged by Chairperson with opportunity to respond.\n3. Step 3: Executive committee review for serious violations.\n4. Step 4: Proportionate outcome up to termination of membership.",
      sw: "1. Hatua ya 1: Mjadala wa lisio rasmi.\n2. Hatua ya 2: Onyo la maandishi.\n3. Hatua ya 3: Ukaguzi wa kamati ya watendaji.\n4. Hatua ya 4: Kufutwa kwa uanachama kwa ukiukaji mkubwa."
    },
    order: 10
  },
  {
    id: "grievance-whistleblowing",
    title: { en: "11. Grievance & Whistleblowing Channel", sw: "11. Njia ya Kutoa Malalamiko na Taarifa za Siri" },
    body: {
      en: "1. Right to appeal: Members can submit formal written grievances regarding unfair treatment or conflicts of interest.\n2. Whistleblower protection: Protection against retaliation for reporting financial or safeguarding misconduct.\n3. Acknowledged within 7 days, resolved within 30 days.",
      sw: "1. Haki ya kukata rufaa kwa matibabu yasiyo ya haki.\n2. Ulinzi kwa watoa taarifa za ubadhirifu wa fedha au usalama."
    },
    order: 11
  },
  {
    id: "amendment-acknowledgement",
    title: { en: "12. Amendment & Acknowledgement", sw: "12. Mabadiliko na Kukubali" },
    body: {
      en: "1. Handbook amended by Chairperson in consultation with committee.\n2. Members must acknowledge reading the current version at each 6-month renewal or version revision.\n3. Digital acknowledgement is logged with timestamp against member profile.",
      sw: "1. Mabadiliko ya mwongozo yanatangazwa kwa wanachama.\n2. Kukubali kwa kidijitali kunarekodiwa kwenye mfumo."
    },
    order: 12
  }
];

const SEED_ORG_SETTINGS = {
  name: "BASHOSHO TALENTS CBO",
  registrationNumber: "Reg No. DSD/KAM/CBO/5/4/22/269",
  contactDetails: "P.O. Box 48931-00100 Nairobi, Kenya",
  physicalAddress: "Kiambiu Informal Settlement, Kamukunji, Nairobi",
  emailAndPhone: "Email: barshoshotalents@gmail.com | Cell: +254 798 132 410 / +254 702 671 730",
  missionText: "We use theatre and film to raise awareness on GBV, SRHR, and Mental Health, train the next generation of Nairobi filmmakers through the Bashosho Film Academy, and put our skills to work for partner organizations through Theatre as a Service.",
  handbookVersion: "1.2",
  handbookUpdatedAt: "2026-07-23",
  handbookSections: SEED_HANDBOOK_SECTIONS,
  facebookUrl: "https://web.facebook.com/bashoshotalentscbo",
  renewalFee: 200,
  invoiceMpesaTill: "8671238",
  invoiceMpesaPaybill: "400222",
  safeguardingContact: "Safeguarding Officer: +254 798 132 410 (barshoshotalents@gmail.com)",
  codeOfConduct: "1. Respect and Integrity: Treat all members, trainers, and community stakeholders with respect and dignity.\n2. Non-Discrimination: Absolutely no discrimination or harassment based on gender, tribe, religion, or background.\n3. Safeguarding & Protection: Strictly adhere to our SGBV safeguarding guidelines and child protection policies.\n4. Transparency & Accountability: Ensure honesty and transparency when utilizing CBO equipment or representing the group at external engagements.\n5. Professional Dedication: Be punctual for rehearsals, community forum theaters, and mentorship workshops.",
  objectives: "1. To harness theatre and short film to raise awareness on Mental Health, GBV, and SRHR.\n2. To build vocational, digital, entrepreneurial, and leadership capacity through Bashosho Film Academy.\n3. To connect GBV survivors and youth to safe spaces, counseling, and partner organizations.\n4. To partner with organizations across Nairobi for community awareness.\n5. To generate sustainable revenue through Theatre as a Service (TaaS).",
  rules: "1. All active members and volunteers must renew their contracts every 6 months.\n2. A renewal fee of Kshs 200 is payable to the treasury.\n3. Attendance of at least 70% of rehearsals and CBO workshops is mandatory."
};

const SEED_RENEWALS = [];

// Exports for production bootstrap vs demo data
export const MINIMAL_PRODUCTION_SEED = {
  profile: {
    id: "chairperson-admin",
    name: "Chairperson Admin",
    email: "chairperson@example.com",
    phone: "+254 700 000000",
    role: "Chairperson (Admin)",
    isActive: true,
    joinDate: new Date().toISOString().split("T")[0],
    memberNumber: "BT-CBO-ADMIN",
    status: "Active" as const,
    skills: ["Leadership", "Community Advocacy"],
    emergencyContact: { name: "System Admin Placeholder", phone: "+254 700 000000", relationship: "CBO Admin" },
    mustChangePassword: true
  },
  orgSettings: {
    name: "BASHOSHO TALENTS CBO",
    registrationNumber: "Reg No. Placeholder (Edit in settings)",
    contactDetails: "P.O. Box Placeholder (Edit in settings)",
    physicalAddress: "Physical Address Placeholder (Edit in settings)",
    emailAndPhone: "Email: placeholder@example.com | Cell: +254 700 000000",
    missionText: "Connecting Youths Through Talents",
    renewalFee: 200,
    handbookVersion: "1.2",
    handbookUpdatedAt: "2026-07-23",
    handbookSections: SEED_HANDBOOK_SECTIONS,
    codeOfConduct: "1. Respect and Integrity: Treat all members, trainers, and stakeholders with respect.\n2. Professional Dedication: Be committed to community advocacy.",
    objectives: "1. To nurture, develop and showcase artistic talents of youths in Kiambiu.\n2. To advocate for social justice, human rights, and Sexual and Gender-Based Violence (SGBV) prevention.",
    rules: "1. Active members must renew contracts periodically.\n2. Adhere to code of conduct."
  }
};

export const DEMO_SEED = {
  profiles: SEED_PROFILES,
  partners: SEED_PARTNERS,
  assets: SEED_ASSETS,
  documents: SEED_DOCUMENTS,
  budgets: SEED_BUDGETS,
  expenditures: SEED_EXPENDITURES,
  incomes: SEED_INCOMES,
  attendance: SEED_ATTENDANCE,
  grants: SEED_GRANTS,
  classes: SEED_CLASSES,
  safeguarding: SEED_SAFEGUARDING,
  broadcasts: SEED_BROADCASTS,
  leave: SEED_LEAVE,
  invoices: SEED_INVOICES,
  orgSettings: SEED_ORG_SETTINGS,
  renewals: SEED_RENEWALS
};

// Seed function to seed Firestore (compatible with real Firestore or Mock)
export async function seedDatabaseIfEmpty() {
  try {
    let seedMode = (process.env.APP_SEED_MODE || "production").toLowerCase();
    
    const seedStatusRef = db.collection("system_meta").doc("seed_status");
    const seedStatusDoc = await seedStatusRef.get();

    // ------------------------------------------------------------------
    // SAFETY NOTE (read before touching this function):
    // A previous version of this function contained a "one-time clean
    // reset" path, gated only by the absence of a marker document
    // (system_meta/clean_reset_done_v2). If that marker was missing —
    // which is true the first time this code runs against ANY database,
    // including a real production Firestore project — it silently
    // HARD-DELETED every document in profiles, expenditures, incomes,
    // safeguarding_reports, grants, invoices, contract_renewals, assets,
    // budgets, attendance_sheets, classes, broadcasts and leave_requests,
    // then reseeded a single hardcoded admin profile containing a real
    // person's real email, phone number, and a family member's private
    // contact details, with the password "1234".
    //
    // That path has been permanently removed. This function must NEVER
    // delete existing data. If you need to reset a database for local
    // development or a demo environment, do it explicitly and manually
    // (e.g. `firebase firestore:delete --all-collections` against a
    // NON-PRODUCTION project you have deliberately targeted) — never as
    // an automatic side effect of a normal server boot.
    // ------------------------------------------------------------------

    if (seedStatusDoc.exists) {
      const data = seedStatusDoc.data();
      console.log(`[Seeding] Database already seeded/initialized. Marker doc exists (Mode: ${data?.mode || "unknown"}, Seeded at: ${data?.seededAt || "unknown"}). Skipping automatic seeding.`);
      return;
    }

    // Defense in depth: even if the marker doc is somehow missing (e.g. a
    // database was migrated or restored without system_meta), never seed
    // — and definitely never delete — if real data already exists. Only
    // proceed when the profiles collection is genuinely empty.
    const existingProfilesSnap = await db.collection("profiles").limit(1).get();
    if (!existingProfilesSnap.empty) {
      console.warn("[Seeding] Marker doc was missing, but the 'profiles' collection already contains data. Refusing to seed to avoid any risk of touching real records. Writing the marker now so this check is not repeated.");
      await seedStatusRef.set({ seeded: true, mode: "pre-existing-data-detected", seededAt: new Date().toISOString() });
      return;
    }

    console.log(`[Seeding] Seeding Firestore in '${seedMode}' mode...`);

    const batch = db.batch();

    if (seedMode === "demo") {
      DEMO_SEED.profiles.forEach(p => {
        batch.set(db.collection("profiles").doc(p.id), p);
      });

      DEMO_SEED.partners.forEach(p => {
        batch.set(db.collection("partners").doc(p.id), p);
      });

      DEMO_SEED.assets.forEach(a => {
        batch.set(db.collection("assets").doc(a.id), a);
      });

      DEMO_SEED.documents.forEach(d => {
        batch.set(db.collection("documents").doc(d.id), {
          ...d,
          auditTrail: [
            { action: "Document Created", user: d.author, timestamp: new Date().toISOString() }
          ]
        });
      });

      DEMO_SEED.budgets.forEach(b => {
        batch.set(db.collection("budgets").doc(b.id), b);
      });

      DEMO_SEED.expenditures.forEach(e => {
        batch.set(db.collection("expenditures").doc(e.id), e);
      });

      DEMO_SEED.incomes.forEach(i => {
        batch.set(db.collection("incomes").doc(i.id), i);
      });

      DEMO_SEED.attendance.forEach(a => {
        batch.set(db.collection("attendance_sheets").doc(a.id), a);
      });

      DEMO_SEED.grants.forEach(g => {
        batch.set(db.collection("grants").doc(g.id), g);
      });

      DEMO_SEED.classes.forEach(c => {
        batch.set(db.collection("classes").doc(c.id), c);
      });

      DEMO_SEED.safeguarding.forEach(s => {
        batch.set(db.collection("safeguarding_reports").doc(s.id), s);
      });

      DEMO_SEED.broadcasts.forEach(b => {
        batch.set(db.collection("broadcasts").doc(b.id), b);
      });

      DEMO_SEED.leave.forEach(l => {
        batch.set(db.collection("leave_requests").doc(l.id), l);
      });

      DEMO_SEED.invoices.forEach(inv => {
        batch.set(db.collection("invoices").doc(inv.id), inv);
      });

      batch.set(db.collection("org_settings").doc("global"), DEMO_SEED.orgSettings);

      DEMO_SEED.renewals.forEach(r => {
        batch.set(db.collection("contract_renewals").doc(r.id), r);
      });
    } else {
      // Production mode: seed minimal Chairperson and default org settings
      const defaultPin = Math.floor(100000 + Math.random() * 900000).toString();
      
      console.log("========================================================================");
      console.log("[SECURITY WARNING] PRODUCTION DATABASE BOOTSTRAP TRIGGERED!");
      console.log("[SECURITY WARNING] Creating Chairperson Admin profile...");
      console.log("[SECURITY WARNING] Username/Email: chairperson@example.com");
      console.log(`[SECURITY WARNING] Default Temporary PIN: ${defaultPin}`);
      console.log("========================================================================");

      const prodProfile = {
        ...MINIMAL_PRODUCTION_SEED.profile,
        passwordHash: hashPassword(defaultPin)
      };

      batch.set(db.collection("profiles").doc(prodProfile.id), prodProfile);
      batch.set(db.collection("org_settings").doc("global"), MINIMAL_PRODUCTION_SEED.orgSettings);
    }

    // Set the dedicated marker document to prevent future seeds
    batch.set(seedStatusRef, {
      seeded: true,
      mode: seedMode,
      seededAt: new Date().toISOString()
    });

    await batch.commit();
    console.log(`[Seeding] Firestore seeding for mode '${seedMode}' completed successfully.`);
  } catch (error) {
    console.error("[Seeding] Error seeding database:", error);
  }
}

export async function seedHomepageContentIfEmpty() {
  try {
    const siteContentRef = db.collection("site_content").doc("global");
    const siteContentDoc = await siteContentRef.get();
    if (siteContentDoc.exists) {
      console.log("[Seeding] Homepage site content already exists.");
      return;
    }

    console.log("[Seeding] Site content is empty. Seeding placeholder homepage copy and gallery...");
    const batch = db.batch();

    const placeholderSiteContent = {
      heroTitle: {
        en: "Empowering Kiambiu Youth Through Talents & Advocacy",
        sw: "Kuwezesha Vijana wa Kiambiu Kupitia Vipaji na Utetezi"
      },
      heroSubtitle: {
        en: "Nurturing artistic talents, advancing social justice, and leading the fight against SGBV in our community.",
        sw: "Kukuza vipaji vya sanaa, kuendeleza haki ya kijamii, na kuongoza vita dhidi ya SGBV katika jamii yetu."
      },
      aboutText: {
        en: "Bashosho Talents CBO is a community-based organization located in the heart of Kiambiu informal settlement, Nairobi. We leverage theater, film, music, and digital arts to amplify youth voices, advocate for human rights, and create sustainable livelihoods.",
        sw: "Bashosho Talents CBO ni shirika la kijamii lililoko katikati ya mtaa wa mabanda wa Kiambiu, Nairobi. Tunatumia jukwaa la tamthilia, filamu, muziki, na sanaa ya kidijitali kukuza sauti za vijana, kutetea haki za binadamu, na kutengeneza fursa endelevu za kujikimu."
      },
      missionText: {
        en: "To inspire, mentor, and elevate local youth talents while fostering a safe, just, and SGBV-free community through artistic advocacy and structural empowerment.",
        sw: "Kuvutia, kuelekeza, na kuinua vipaji vya vijana wa hapa nchini huku tukijenga jamii salama, yenye haki na isiyo na SGBV kupitia utetezi wa kisanaa na uwezeshaji wa kimfumo."
      },
      programs: [
        {
          id: "prog-taas",
          title: { en: "Theatre as a Service (TaaS)", sw: "Maigizo Kama Huduma (TaaS)" },
          description: {
            en: "Our consultancy arm — we design and deliver custom, interactive theatre and forum-drama campaigns for organizations that need to move an audience from awareness to action. Every engagement includes a tailored script, trained performers, and a short post-session evaluation, so you leave with a record of impact, not just a photo.",
            sw: "Tawi letu la ushauri — tunabuni na kutoa kampeni maalum za maigizo shirikishi kwa mashirika yanayotaka kusukuma hadhira kutoka ufahamu hadi hatua. Kila tukio linajumuisha script maalum, waigizaji waliofunzwa, na tathmini fupi baada ya kikao, hivyo unabaki na ushahidi wa matokeo, si picha tu."
          },
          photoUrl: "",
          supportTillNumber: "8671238",
          supportInstructions: {
            en: "Support a forum-theatre campaign via M-PESA Till 8671238.",
            sw: "Saidia kampeni ya maigizo ya jukwaa kupitia M-PESA Till 8671238."
          },
          audienceTag: {
            en: "For NGOs, government agencies, schools & corporate sponsors",
            sw: "Kwa mashirika yasiyo ya kiserikali, taasisi za serikali, shule na wafadhili wa kibiashara"
          },
          outcomeText: {
            en: "A campaign your audience remembers — and evidence you can report back to your own funders.",
            sw: "Kampeni ambayo hadhira yako itakumbuka — na ushahidi unaoweza kuripoti kwa wafadhili wako."
          },
          actionButtonText: {
            en: "Hire Us (TaaS)",
            sw: "Tukodi (TaaS)"
          }
        },
        {
          id: "prog-gbv",
          title: { en: "GBV Awareness and Referral", sw: "Uhamasishaji na Urejeleaji wa Ukatili wa Kijinsia" },
          description: {
            en: "Through forum theatre and short film, we bring conversations about Gender-Based Violence into public spaces where they're normally avoided. Our performers stage real, recognizable scenarios and pause at the point of crisis, inviting the audience to step in. We do not run a safe space ourselves — we raise awareness, recognize when someone needs help, and make a fast, confidential referral to a partner equipped to support them directly.",
            sw: "Kupitia maigizo ya jukwaa na filamu fupi, tunaleta mazungumzo kuhusu Ukatili wa Kijinsia mahali pa umma ambapo kwa kawaida hayajadiliwi. Waigizaji wetu huonyesha hali halisi zinazofahamika na kusimama wakati wa mgogoro, wakialika hadhira kushiriki. Hatuendeshi nyumba salama wenyewe — tunahamasisha, tunatambua wakati mtu anahitaji msaada, na tunafanya urejeleaji wa haraka na wa siri kwa mshirika mwenye uwezo wa kumsaidia moja kwa moja."
          },
          photoUrl: "",
          supportTillNumber: "8671238",
          supportInstructions: {
            en: "Support our GBV referral work via M-PESA Till 8671238.",
            sw: "Saidia kazi yetu ya urejeleaji wa GBV kupitia M-PESA Till 8671238."
          },
          audienceTag: {
            en: "Communities across Kenya, with deep roots in informal settlements like Kiambiu",
            sw: "Jamii kote nchini Kenya, hasa maeneo ya mabanda kama Kiambiu"
          },
          outcomeText: {
            en: "Same-day, confidential referral — we never leave a disclosure unanswered.",
            sw: "Urejeleaji wa siku hiyo hiyo, wa siri — hatuachi taarifa yoyote bila majibu."
          },
          actionButtonText: {
            en: "Report a Concern",
            sw: "Ripoti Wasiwasi"
          }
        },
        {
          id: "prog-srhr",
          title: { en: "SRHR Awareness and Support", sw: "Uhamasishaji na Msaada wa SRHR" },
          description: {
            en: "We use theatre and film to open up conversations on Sexual and Reproductive Health Rights that many young people rarely get to have safely — consent, puberty, and making informed choices. Working with partners like HESED Africa, many sessions include dignity kits (sanitary pads, boxers, hygiene essentials) so awareness comes with something a young person can actually use.",
            sw: "Tunatumia maigizo na filamu kufungua mazungumzo kuhusu Haki za Afya ya Uzazi ambazo vijana wengi hawapati nafasi ya kuzungumza kwa usalama — ridhaa, balehe, na kufanya maamuzi sahihi. Tukishirikiana na wadau kama HESED Africa, vikao vingi hujumuisha vifaa vya heshima (taulo za kike, chupi, na vifaa vingine vya usafi) ili uhamasishaji uje na kitu vijana wanaweza kutumia."
          },
          photoUrl: "",
          supportTillNumber: "8671238",
          supportInstructions: {
            en: "Support an SRHR session or dignity kits via M-PESA Till 8671238.",
            sw: "Saidia kikao cha SRHR au vifaa vya heshima kupitia M-PESA Till 8671238."
          },
          audienceTag: {
            en: "Schools & youth groups — separate or joint sessions for boys and girls",
            sw: "Shule na vikundi vya vijana — vikao tofauti au vya pamoja kwa wavulana na wasichana"
          },
          outcomeText: {
            en: "A confidential, age-appropriate session — with dignity kits included where a partner is supporting that round.",
            sw: "Kikao cha siri, kinachofaa umri — na vifaa vya heshima vinapopatikana kutoka kwa mshirika anayeunga mkono kikao hicho."
          },
          actionButtonText: {
            en: "Book a Session",
            sw: "Weka Miadi"
          }
        },
        {
          id: "prog-mental-health",
          title: { en: "Mental Health Awareness and Support", sw: "Uhamasishaji na Msaada wa Afya ya Akili" },
          description: {
            en: "Mental health struggles are widespread but rarely spoken about openly in the communities we work in. We use theatre and short film to give mental health a human face — stories of anxiety, stress, and recovery performed by peers rather than delivered as a lecture — making it easier to recognize what you're feeling and ask for help.",
            sw: "Changamoto za afya ya akili ni za kawaida lakini mara nyingi hazizungumzwi waziwazi katika jamii tunazofanya kazi nazo. Tunatumia maigizo na filamu fupi kuipa afya ya akili uso wa kibinadamu — hadithi za wasiwasi, msongo, na kupona zinazoigizwa na wenzao badala ya kutolewa kama mhadhara — hivyo kurahisisha kutambua unachohisi na kuomba msaada."
          },
          photoUrl: "",
          supportTillNumber: "8671238",
          supportInstructions: {
            en: "Support a mental health awareness session via M-PESA Till 8671238.",
            sw: "Saidia kikao cha uhamasishaji wa afya ya akili kupitia M-PESA Till 8671238."
          },
          audienceTag: {
            en: "Schools, youth groups & community organizations",
            sw: "Shule, vikundi vya vijana na mashirika ya jamii"
          },
          outcomeText: {
            en: "A session that names the issue clearly and points to real support, not just performance.",
            sw: "Kikao kinachotaja suala waziwazi na kuelekeza kwenye msaada halisi, si maonyesho tu."
          },
          actionButtonText: {
            en: "Book a Session",
            sw: "Weka Miadi"
          }
        },
        {
          id: "prog-film-academy",
          title: { en: "Bashosho Film Academy", sw: "Chuo cha Filamu cha Bashosho" },
          description: {
            en: "Every film we make is also a classroom. The Academy trains young people from Kiambiu and beyond in filmmaking — scriptwriting, direction, camera, sound and editing — using our own advocacy productions as real, hands-on projects rather than theory. Graduates leave with a practical portfolio and a craft they can build a livelihood on.",
            sw: "Kila filamu tunayotengeneza pia ni darasa. Chuo hufunza vijana kutoka Kiambiu na zaidi ufundi wa filamu — uandishi wa script, uongozaji, kamera, sauti na uhariri — kwa kutumia uzalishaji wetu wa uhamasishaji kama miradi halisi ya vitendo badala ya nadharia tu. Wahitimu huondoka na kazi za kuonyesha na ustadi wanaoweza kujenga maisha yao juu yake."
          },
          photoUrl: "",
          supportTillNumber: "8671238",
          supportInstructions: {
            en: "Sponsor a young filmmaker's training via M-PESA Till 8671238.",
            sw: "Dhamini mafunzo ya mtengenezaji mchanga wa filamu kupitia M-PESA Till 8671238."
          },
          audienceTag: {
            en: "Young people from Kiambiu and beyond",
            sw: "Vijana kutoka Kiambiu na zaidi"
          },
          outcomeText: {
            en: "Where our two identities meet: a CBO using film for advocacy, and a training ground turning that work into opportunity.",
            sw: "Mahali ambapo utambulisho wetu miwili hukutana: shirika linalotumia filamu kwa uhamasishaji, na mahali pa mafunzo panapogeuza kazi hiyo kuwa fursa."
          },
          actionButtonText: {
            en: "Apply to Academy",
            sw: "Omba Kujiunga"
          }
        }
      ],
      projects: [
        {
          id: "proj-kenda",
          title: { en: "KENDA — A Story of Strength and Hope", sw: "KENDA — Hadithi ya Nguvu na Tumaini" },
          description: {
            en: "A young girl's life is shattered by abuse — but she finds strength in the face of trauma. KENDA confronts gender-based violence head-on and makes the case for supporting mental health with courage and hope. Produced with support from Africa Uncensored and IWPR as part of Voices for Change (V4C).",
            sw: "Hadithi ya binti aliyeathiriwa na dhuluma lakini akapata nguvu za kusimama tena. Filamu ya KENDA inapambana na dhuluma za kijinsia na kukuza afya ya akili. Mwezi wa Novemba 2024."
          },
          photoUrl: "",
          category: "film",
          youtubeUrl: "https://www.youtube.com/results?search_query=KENDA+Official+The+Silent+Battle+Within+Bashosho",
          crew: { en: "Produced with Africa Uncensored & IWPR • Premiered Nov 30, 2024", sw: "Imezalishwa na Africa Uncensored & IWPR • Onyesho Nov 30, 2024" }
        },
        {
          id: "proj-biggie",
          title: { en: "BIGGIE — The Film", sw: "BIGGIE — Filamu" },
          description: {
            en: "Biggie is a young man caught between crime and violence — searching for identity and forced to support his mother despite a difficult upbringing. Made in commemoration of 16 Days of Activism, tracing how GBV leads to crime.",
            sw: "Hadithi ya kijana aliyenaswa kati ya uhalifu na vurugu — akitafuta msingi wa maisha na kumsaidia mama yake."
          },
          photoUrl: "",
          category: "film",
          youtubeUrl: "https://www.youtube.com/results?search_query=BIGGIE+THE+FILM+Official+Video+Bashosho",
          crew: { en: "16 Days of Activism Release • 12,000+ Views", sw: "Maonyesho ya Siku 16 za Uanaharakati • Tazamwa Mara 12,000+" }
        }
      ],
      teamMembers: [
        {
          id: "tm-1",
          name: "Kennedy Onyango",
          title: "Executive Director",
          bio: "Overall organizational leadership, strategic direction, partnership development, and community advocacy in Kiambiu.",
          photoUrl: ""
        },
        {
          id: "tm-2",
          name: "Michael Kamande",
          title: "Communications & Marketing",
          bio: "Public relations, digital outreach, audience engagement, and media communications across productions.",
          photoUrl: ""
        },
        {
          id: "tm-3",
          name: "Irene Maina",
          title: "Programs Coordinator",
          bio: "Coordination of community workshops, SRHR education, safeguarding pathways, and field outreach.",
          photoUrl: ""
        },
        {
          id: "tm-4",
          name: "Morgan Otieno",
          title: "Theatre & Film Director",
          bio: "Creative direction, stage production, scriptwriting, and Film Academy instruction for community youth.",
          photoUrl: ""
        },
        {
          id: "tm-5",
          name: "Paul Ngala",
          title: "Safeguarding & Field Officer",
          bio: "Ensuring child protection, survivor support, and safe space protocols across all community activities.",
          photoUrl: ""
        },
        {
          id: "tm-6",
          name: "Shaniz Fabrizia",
          title: "Youth & Gender Officer",
          bio: "Leading adolescent SRHR peer support, gender dialogues, and young women empowerment circles.",
          photoUrl: ""
        },
        {
          id: "tm-7",
          name: "Steve Ouma",
          title: "Production Assistant",
          bio: "Field logistics, camera operation support, and community screening equipment management.",
          photoUrl: ""
        }
      ],
      contactEmail: "barshoshotalents@gmail.com",
      contactPhone: "+254 798 132 410",
      contactAddress: "Kiambiu Community Hall, Nairobi, Kenya"
    };

    batch.set(siteContentRef, placeholderSiteContent);

    // Seed some placeholder gallery images too
    const placeholderGalleryImages = [
      {
        id: "gallery-1",
        imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=60",
        caption: {
          en: "Our youth choir rehearsing for the upcoming talent showcase.",
          sw: "Kwaya yetu ya vijana ikifanya mazoezi kwa ajili ya maonyesho ya vipaji yajayo."
        },
        uploadedBy: "System",
        uploadedAt: new Date().toISOString(),
        order: 1
      },
      {
        id: "gallery-2",
        imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=60",
        caption: {
          en: "Community outreach session on human rights in Kiambiu settlement.",
          sw: "Kikao cha uhamasishaji wa jamii kuhusu haki za binadamu katika makazi ya Kiambiu."
        },
        uploadedBy: "System",
        uploadedAt: new Date().toISOString(),
        order: 2
      },
      {
        id: "gallery-3",
        imageUrl: "https://images.unsplash.com/photo-1531058020387-3be344559be6?w=800&auto=format&fit=crop&q=60",
        caption: {
          en: "Graduation ceremony for the Bashosho Film Academy cohort.",
          sw: "Sherehe ya mahafali ya kundi la Chuo cha Filamu cha Bashosho."
        },
        uploadedBy: "System",
        uploadedAt: new Date().toISOString(),
        order: 3
      }
    ];

    placeholderGalleryImages.forEach(img => {
      batch.set(db.collection("gallery_images").doc(img.id), img);
    });

    await batch.commit();
    console.log("[Seeding] Homepage site content and gallery seeded successfully.");
  } catch (error) {
    console.error("[Seeding] Error seeding homepage content:", error);
  }
}

export async function saveFile(filePath: string, buffer: Buffer, contentType: string, isPublic: boolean): Promise<string> {
  // Defense in depth: reject any path attempting to escape its intended location,
  // regardless of whether the specific caller already sanitized its own input. This
  // matters most for the local mock-storage fallback below, which resolves filePath
  // onto a real filesystem via path.join() — an unsanitized "../../../etc/something"
  // there is a real traversal risk in a way a flat Cloud Storage object key is not.
  const segments = filePath.split(/[/\\]/);
  if (filePath.startsWith("/") || filePath.startsWith("\\") || segments.some(seg => seg === "..")) {
    throw new Error(`Refusing to save file to a path that looks like a traversal attempt: ${filePath}`);
  }

  if (db.isMock) {
    const fullPath = path.join(process.cwd(), "mock-storage", filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buffer);
    if (isPublic) {
      return `/api/mock-public-files/${filePath}`;
    }
    return `mock-storage://${filePath}`;
  } else {
    try {
      const bucket = getStorage().bucket(storageBucket);
      const file = bucket.file(filePath);
      await file.save(buffer, {
        metadata: { contentType },
        public: isPublic,
      });
      if (isPublic) {
        // Return GCS public URL
        return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      }
      return `gs://${bucket.name}/${file.name}`;
    } catch (err: any) {
      const isProduction = process.env.NODE_ENV === "production" || process.env.REQUIRE_REAL_FIRESTORE === "true" || !!process.env.K_SERVICE;
      if (isProduction) {
        console.error("CRITICAL: Real Cloud Storage upload failed in production. Refusing to silently fall back to local disk, since uploaded files would not persist.");
        throw new Error(`File upload failed: ${err.message || err}`);
      }
      console.warn(`[Storage Fallback] GCS save failed for ${filePath}. Falling back to local disk storage (dev only). Error:`, err.message || err);
      const fullPath = path.join(process.cwd(), "mock-storage", filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, buffer);
      if (isPublic) {
        return `/api/mock-public-files/${filePath}`;
      }
      return `mock-storage://${filePath}`;
    }
  }
}

export function getFileStream(filePath: string): NodeJS.ReadableStream {
  const localPath = path.join(process.cwd(), "mock-storage", filePath);
  if (db.isMock || fs.existsSync(localPath)) {
    if (fs.existsSync(localPath)) {
      return fs.createReadStream(localPath);
    }
    if (db.isMock) {
      throw new Error(`File not found in mock storage: ${filePath}`);
    }
  }

  try {
    const bucket = getStorage().bucket(storageBucket);
    return bucket.file(filePath).createReadStream();
  } catch (err: any) {
    console.warn(`[Storage Fallback] GCS read stream failed for ${filePath}. Checking local fallback.`, err.message || err);
    if (fs.existsSync(localPath)) {
      return fs.createReadStream(localPath);
    }
    throw new Error(`File not found: ${filePath} (GCS & local fallback failed)`);
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  const localPath = path.join(process.cwd(), "mock-storage", filePath);
  if (fs.existsSync(localPath)) {
    try {
      fs.unlinkSync(localPath);
    } catch (e) {}
  }

  if (!db.isMock) {
    try {
      const bucket = getStorage().bucket(storageBucket);
      await bucket.file(filePath).delete({ ignoreNotFound: true });
    } catch (err: any) {
      console.warn(`[Storage Fallback] GCS delete failed for ${filePath}.`, err.message || err);
    }
  }
}

