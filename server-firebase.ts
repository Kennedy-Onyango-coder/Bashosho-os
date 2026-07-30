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
  constructor(public id: string, private colName: string, private db: any) {}

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
    name: "Kennedy Onyango",
    email: "konyango98@gmail.com",
    phone: "+254 798 132 410",
    role: "Chairperson (Admin)",
    isActive: true,
    joinDate: "2020-01-15",
    memberNumber: "BT-CBO-101",
    status: "Active",
    skills: ["Directing", "Screenwriting", "Community Advocacy", "Leadership"],
    emergencyContact: { name: "Priscilla Onyango", phone: "+254 722 999111", relationship: "Spouse" },
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
    
    // Real database clean reset trigger
    const cleanResetRef = db.collection("system_meta").doc("clean_reset_done_v2");
    const cleanResetSnap = await cleanResetRef.get();
    
    if (!cleanResetSnap.exists) {
      console.log("[Seeding] Initiating one-time clean reset. Purging all demo data & profiles...");
      const COLLECTIONS_TO_PURGE = [
        "profiles",
        "partners",
        "assets",
        "documents",
        "budgets",
        "expenditures",
        "incomes",
        "attendance_sheets",
        "grants",
        "classes",
        "safeguarding_reports",
        "broadcasts",
        "leave_requests",
        "invoices",
        "contract_renewals"
      ];
      
      for (const col of COLLECTIONS_TO_PURGE) {
        try {
          const snap = await db.collection(col).get();
          if (!snap.empty) {
            const purgeBatch = db.batch();
            snap.docs.forEach(doc => {
              purgeBatch.delete(doc.ref);
            });
            await purgeBatch.commit();
            console.log(`[Purge] Cleared ${snap.size} documents from collection '${col}'.`);
          }
        } catch (err: any) {
          console.warn(`[Purge] Error clearing collection '${col}':`, err.message);
        }
      }
      
      // Seed ONLY the clean administrator profile and global org settings
      const seedBatch = db.batch();
      
      DEMO_SEED.profiles.forEach(p => {
        seedBatch.set(db.collection("profiles").doc(p.id), p);
      });
      seedBatch.set(db.collection("org_settings").doc("global"), DEMO_SEED.orgSettings);
      
      // Also write marker docs to prevent future seeds or repeats
      seedBatch.set(cleanResetRef, { completed: true, resetAt: new Date().toISOString() });
      seedBatch.set(seedStatusRef, { seeded: true, mode: "clean", seededAt: new Date().toISOString() });
      
      await seedBatch.commit();
      console.log("[Seeding] One-time clean reset completed successfully! Fresh Admin account created.");
      return;
    }

    if (seedStatusDoc.exists) {
      const data = seedStatusDoc.data();
      console.log(`[Seeding] Database already seeded/initialized. Marker doc exists (Mode: ${data?.mode || "unknown"}, Seeded at: ${data?.seededAt || "unknown"}). Skipping automatic seeding.`);
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
          id: "prog-theatre-advocacy",
          title: { en: "Theatre for Social Change", sw: "Sanaa ya Jukwaani kwa Mabadiliko" },
          description: {
            en: "An interactive, audience-participatory forum theatre method where local actors stage real-life social issues (SGBV, human rights, mental health struggles) in public spaces in Kiambiu. The performance stops at a critical conflict point, and community members are invited to step into the actors' shoes to rehearse practical solutions, test coping mechanisms, and trigger behavioral change.",
            sw: "Mbinu shirikishi ya maigizo ya jukwaani ambapo wasanii huonyesha changamoto halisi za kijamii (SGBV, haki za binadamu, afya ya akili) mitaani. Maonyesho husimama pale mzozo unapofikia kilele, na watazamaji hualikwa kuigiza badala ya wasanii ili kujaribu suluhisho la vitendo na kuleta mabadiliko ya tabia."
          },
          photoUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=60",
          supportTillNumber: "291002",
          supportInstructions: {
            en: "Donate via M-PESA Paybill/Till to support our community outreach tours.",
            sw: "Changia kupitia M-PESA Paybill/Till ili kusaidia ziara zetu za uenezi katika jamii."
          },
          audienceTag: {
            en: "Community members, grassroots leaders, youth, & human rights defenders",
            sw: "Wanajamii, viongozi wa nyanja za chini, vijana, na watetezi wa haki"
          },
          outcomeText: {
            en: "Interactive forum performance, problem-solving rehearsal, & advocacy dialogues",
            sw: "Onyesho shirikishi, mazoezi ya kutatua matatizo, na mijadala ya utetezi"
          },
          actionButtonText: {
            en: "Sponsor Forum Tour",
            sw: "Dhamini Ziara ya Jukwaani"
          }
        },
        {
          id: "prog-film-academy",
          title: { en: "Bashosho Film Academy", sw: "Chuo cha Filamu cha Bashosho" },
          description: {
            en: "A hands-on professional filmmaking curriculum designed specifically for youth in informal settlements. We provide training in screenwriting, directing, cinematography, sound design, and post-production, enabling young creatives to produce high-quality, impact-driven films that amplify local narratives, combat stigma, and build viable creative careers.",
            sw: "Mtaala wa vitendo wa utengenezaji filamu ulioundwa mahususi kwa ajili ya vijana waliotengwa katika mitaa ya mabanda. Tunatoa mafunzo ya uandishi wa skrini, uongozaji, picha, muundo wa sauti, na uhariri wa video, tukiwezesha vijana kutoa filamu zenye athari na kujenga kazi endelevu za ubunifu."
          },
          photoUrl: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop&q=60",
          supportTillNumber: "291003",
          supportInstructions: {
            en: "Sponsor a youth filmmaker's training kit.",
            sw: "Dhamini vifaa vya mafunzo vya mtengenezaji mchanga wa filamu."
          },
          audienceTag: {
            en: "Aspiring young filmmakers, storytellers, & creative youth aged 16–30",
            sw: "Watengenezaji filamu chipukizi, wasimulizi wa hadithi, na vijana miaka 16–30"
          },
          outcomeText: {
            en: "Hands-on filmmaking training, short film production, & industry mentorship",
            sw: "Mafunzo ya vitendo, utengenezaji wa filamu fupi, na ushauri wa kitaaluma"
          },
          actionButtonText: {
            en: "Sponsor Youth Filmmaker",
            sw: "Dhamini Mwanafunzi wa Filamu"
          }
        },
        {
          id: "prog-safeguarding-mel",
          title: { en: "Safe Spaces & SGBV Desk", sw: "Nafasi Salama na Dawati la SGBV" },
          description: {
            en: "A secure community-driven support desk and safe-haven network providing confidential psychosocial first aid, peer-to-peer mental health counseling circles, human rights awareness, and immediate, structured medical and legal referral pathways for survivors of Sexual and Gender-Based Violence (SGBV) in informal settlements.",
            sw: "Dawati salama linaloendeshwa na jamii na mtandao wa hifadhi unaotoa msaada wa kisaikolojia wa siri, vikundi vya ushauri vya afya ya akili, uelewa wa haki za binadamu, na mifumo ya haraka ya rufaa za matibabu na kisheria kwa manusura wa SGBV."
          },
          photoUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&auto=format&fit=crop&q=60",
          supportTillNumber: "291004",
          supportInstructions: {
            en: "Support safe space community dialogues and rescue resources.",
            sw: "Saidia mijadala ya jamii katika nafasi salama na rasilimali za uokoaji."
          },
          audienceTag: {
            en: "SGBV survivors, at-risk youth, young women, & families seeking confidential support",
            sw: "Manusura wa SGBV, vijana walio hatarini, wanawake vijana, na familia"
          },
          outcomeText: {
            en: "Confidential intake, medical/legal referral, & peer support group counseling",
            sw: "Mpokeo wa siri, rufaa ya matibabu/kisheria, na ushauri wa usaidizi wa rika"
          },
          actionButtonText: {
            en: "Support Safe Space Desk",
            sw: "Saidia Dawati la Nafasi Salama"
          }
        },
        {
          id: "prog-taas",
          title: { en: "Theatre as a Service (TaaS)", sw: "Sanaa ya Maonyesho kama Huduma (TaaS)" },
          description: {
            en: "A revenue-generating creative consultancy program where our elite performance group is hired by NGOs, government agencies, schools, and corporate sponsors to design and execute customized participatory theatre, sensitization roadshows, and interactive community outreach campaigns on topics like civic education, public health, and corporate compliance.",
            sw: "Programu ya kibiashara ambapo kikundi chetu cha wasanii nguli hukodiwa na mashirika yasiyo ya kiserikali (NGOs), idara za serikali, shule, na mashirika ya kibiashara kubuni na kutekeleza michezo ya kuigiza shirikishi, kampeni za roadshows, na uelimishaji wa jamii kuhusu afya ya umma, uraia, au maadili."
          },
          photoUrl: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=60",
          supportTillNumber: "291005",
          supportInstructions: {
            en: "Hire our performance team or sponsor an institutional forum theatre campaign.",
            sw: "Kodi kikundi chetu cha wasanii au fadhili kampeni ya maigizo ya taasisi."
          },
          audienceTag: {
            en: "NGOs, government agencies, schools, & corporate sponsors",
            sw: "NGOs, idara za serikali, shule, na wadhamini wa kibiashara"
          },
          outcomeText: {
            en: "Custom script drafting, professional cast roadshow, & audience impact reports",
            sw: "Uandishi wa hati mahususi, upelekaji wa wasanii, na ripoti za matokeo"
          },
          actionButtonText: {
            en: "Book a TaaS Session",
            sw: "Weka Miadi ya TaaS"
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

