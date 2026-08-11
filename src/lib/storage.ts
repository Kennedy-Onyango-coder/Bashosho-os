import {
  UserRole,
  UserProfile,
  Document,
  BudgetEngagement,
  ExpenditureRequest,
  SafeguardingReport,
  Asset,
  AttendanceSheet,
  Partner,
  Class,
  Grant,
  SyncAction,
  Income,
  Broadcast,
  LeaveRequest,
  Invoice,
  OrgSettings,
  ContractRenewal,
  LeadershipAppointment,
  HandbookSection
} from "../types";

export function generateMemberNumber(existingProfiles: UserProfile[], role: UserRole): string {
  const prefix = role === UserRole.PROGRAM_MEMBER ? "BT-MB"
    : role === UserRole.VOLUNTEER ? "BT-VL"
    : "BT-CBO";
  let candidate: string;
  do {
    const num = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    candidate = `${prefix}-${num}`;
  } while (existingProfiles.some(p => p.memberNumber === candidate));
  return candidate;
}

// Seed initial data constants (empty by default for clean production data integrity)
export const SEED_PROFILES: UserProfile[] = [];
export const SEED_BROADCASTS: Broadcast[] = [];
export const SEED_LEAVE: LeaveRequest[] = [];
export const SEED_PARTNERS: Partner[] = [];
export const SEED_ASSETS: Asset[] = [];
export const SEED_DOCUMENTS: Document[] = [];
export const SEED_BUDGETS: BudgetEngagement[] = [];
export const SEED_EXPENDITURES: ExpenditureRequest[] = [];
export const SEED_INCOMES: Income[] = [];
export const SEED_ATTENDANCE: AttendanceSheet[] = [];
export const SEED_GRANTS: Grant[] = [];
export const SEED_CLASSES: Class[] = [];
export const SEED_SAFEGUARDING: SafeguardingReport[] = [];

export const SEED_HANDBOOK_SECTIONS: HandbookSection[] = [
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

// INDEXEDDB OFFLINE HELPER CLASS
export class IndexedDBHelper {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open("BashoshoOfflineDB", 2);
        request.onupgradeneeded = (e: any) => {
          const db = request.result;
          if (!db.objectStoreNames.contains("sync_queue")) {
            db.createObjectStore("sync_queue", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("local_cache")) {
            db.createObjectStore("local_cache", { keyPath: "key" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  static async getQueue(): Promise<any[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction("sync_queue", "readonly");
        const store = tx.objectStore("sync_queue");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  static async addToQueue(action: any) {
    try {
      const db = await this.getDB();
      const tx = db.transaction("sync_queue", "readwrite");
      const store = tx.objectStore("sync_queue");
      store.put(action);
    } catch (e) {
      console.error("IndexedDB addToQueue failed:", e);
    }
  }

  static async clearQueue() {
    try {
      const db = await this.getDB();
      const tx = db.transaction("sync_queue", "readwrite");
      const store = tx.objectStore("sync_queue");
      store.clear();
    } catch {}
  }

  static async deleteFromQueue(id: string) {
    try {
      const db = await this.getDB();
      const tx = db.transaction("sync_queue", "readwrite");
      const store = tx.objectStore("sync_queue");
      store.delete(id);
    } catch {}
  }

  static async setCache(key: string, value: any) {
    try {
      const db = await this.getDB();
      const tx = db.transaction("local_cache", "readwrite");
      const store = tx.objectStore("local_cache");
      store.put({ key, value });
    } catch {}
  }

  static async getCache(key: string, defaultValue: any): Promise<any> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction("local_cache", "readonly");
        const store = tx.objectStore("local_cache");
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
        req.onerror = () => resolve(defaultValue);
      });
    } catch {
      return defaultValue;
    }
  }
}

// STORAGE SERVICE
export class StorageService {
  private static get<T>(key: string, defaultValue: T): T {
    const val = localStorage.getItem(`bashosh_os_${key}`);

    if (!val) {
      let cleanDefault: any = defaultValue;
      if (key === "profiles") {
        cleanDefault = [];
      } else if (key === "org_settings") {
        cleanDefault = {
          name: "BASHOSHO TALENTS CBO",
          registrationNumber: "Reg No. DSD/KAM/CBO/5/4/22/269",
          contactDetails: "P.O. Box 48931-00100 Nairobi, Kenya",
          physicalAddress: "Community Center Hall, Kiambiu, Nairobi",
          emailAndPhone: "Email: barshoshotalents@gmail.com | Cell: +254 798 132 410",
          missionText: "Connecting Youths Through Talents",
          renewalFee: 500,
          invoiceMpesaTill: "8671238",
          codeOfConduct: "1. Respect and Integrity: Treat all members, trainers, and stakeholders with respect.\n2. Professional Dedication: Be committed to community advocacy.",
          objectives: "1. To nurture, develop and showcase artistic talents of youths in Kiambiu.\n2. To advocate for social justice, human rights, and Sexual and Gender-Based Violence (SGBV) prevention.",
          rules: "1. Active members must renew contracts periodically.\n2. Adhere to code of conduct."
        };
      } else if (Array.isArray(defaultValue)) {
        cleanDefault = [];
      }
      localStorage.setItem(`bashosh_os_${key}`, JSON.stringify(cleanDefault));
      return cleanDefault as T;
    }

    try {
      return JSON.parse(val);
    } catch {
      return defaultValue;
    }
  }

  private static async set<T>(key: string, value: T) {
    // If online, write to server FIRST
    if (StorageService.isOnline()) {
      try {
        await StorageService.replicateSingleWrite(key, value);
      } catch (err: any) {
        console.error("Server write failed:", err);
        // Dispatch error event to show toast
        window.dispatchEvent(new CustomEvent("bashosho_os_error", {
          detail: { message: `Failed to save — check connection and retry. ${err.message || ""}` }
        }));
        throw err; // Stop local write
      }
    }

    // Do NOT store safeguarding reports in local storage or IndexedDB cache!
    if (key === "safeguarding") {
      return;
    }

    // After server confirmed success (or if offline), update local state/localStorage/IndexedDB cache
    localStorage.setItem(`bashosh_os_${key}`, JSON.stringify(value));
    await IndexedDBHelper.setCache(key, value);

    if (!StorageService.isOnline()) {
      const action: SyncAction = {
        id: `sa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: key,
        payload: value,
        timestamp: new Date().toISOString(),
        status: "pending"
      };
      await IndexedDBHelper.addToQueue(action);
    }
  }

  private static async replicateSingleWrite(key: string, value: any) {
    if (key === "org_settings") {
      const res = await fetch("/api/org_settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned status ${res.status}`);
      }
    }
  }

  static async saveRecord(collection: string, record: any): Promise<boolean> {
    const pathMap: Record<string, string> = {
      profiles: "profiles",
      documents: "documents",
      budgets: "budgets",
      expenditures: "expenditures",
      safeguarding: "safeguarding",
      assets: "assets",
      attendance: "attendance",
      partners: "partners",
      incomes: "incomes",
      grants: "grants",
      classes: "classes",
      broadcasts: "broadcasts",
      leave_requests: "leave_requests",
      invoices: "invoices",
      org_settings: "org_settings",
      contract_renewals: "contract_renewals",
      leadership_appointments: "leadership_appointments"
    };

    const path = pathMap[collection];
    if (!path) return false;

    // 1. If online, POST/PUT to server
    if (StorageService.isOnline()) {
      try {
        const res = await fetch(`/api/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record)
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          if (res.status === 409 || errorData.conflict) {
            // Someone (or another tab/device) saved a newer version of this exact record
            // after we loaded it. Our edit was NOT written — pull the real server state
            // back into the local cache so the UI doesn't keep showing our stale/rejected
            // edit, then surface a clear, specific message instead of a generic failure.
            StorageService.pullFromServer().catch(() => {});
            throw new Error(
              errorData.error ||
              "This record was changed elsewhere since you loaded it. Refresh and try again."
            );
          }
          throw new Error(errorData.error || `Server returned status ${res.status}`);
        }
      } catch (err: any) {
        console.error(`Server write failed for ${collection}:`, err);
        window.dispatchEvent(new CustomEvent("bashosho_os_error", {
          detail: { message: `Failed to save ${collection} to server. ${err.message || ""}` }
        }));
        throw err;
      }
    }

    // 2. Update local storage & IndexedDB cache (except safeguarding reports)
    if (collection !== "safeguarding") {
      const localKey = collection === "attendance" ? "attendance" : collection;
      const currentDataRaw = localStorage.getItem(`bashosh_os_${localKey}`);
      if (currentDataRaw) {
        try {
          const currentData = JSON.parse(currentDataRaw);
          if (Array.isArray(currentData)) {
            const index = currentData.findIndex((item: any) => item.id === record.id);
            let updatedData;
            if (index >= 0) {
              updatedData = [...currentData];
              updatedData[index] = { ...updatedData[index], ...record, updatedAt: new Date().toISOString() };
            } else {
              updatedData = [{ ...record, updatedAt: new Date().toISOString() }, ...currentData];
            }
            localStorage.setItem(`bashosh_os_${localKey}`, JSON.stringify(updatedData));
            await IndexedDBHelper.setCache(localKey, updatedData);
          } else {
            const updatedData = { ...currentData, ...record, updatedAt: new Date().toISOString() };
            localStorage.setItem(`bashosh_os_${localKey}`, JSON.stringify(updatedData));
            await IndexedDBHelper.setCache(localKey, updatedData);
          }
        } catch (e) {
          console.error("Failed to update local cache during save:", e);
        }
      }
    }

    // 3. If offline, queue the sync action
    if (!StorageService.isOnline()) {
      const action: SyncAction = {
        id: `sa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: collection,
        payload: record,
        timestamp: new Date().toISOString(),
        status: "pending",
        type: "write"
      };
      await IndexedDBHelper.addToQueue(action);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bashosh_os_data_updated", { detail: { collection, record } }));
    }

    return true;
  }

  static async deleteRecord(collection: string, id: string): Promise<boolean> {
    const pathMap: Record<string, string> = {
      profiles: "profiles",
      documents: "documents",
      budgets: "budgets",
      expenditures: "expenditures",
      safeguarding: "safeguarding",
      assets: "assets",
      attendance: "attendance",
      partners: "partners",
      incomes: "incomes",
      grants: "grants",
      classes: "classes",
      broadcasts: "broadcasts",
      leave_requests: "leave_requests",
      invoices: "invoices",
      org_settings: "org_settings",
      contract_renewals: "contract_renewals",
      leadership_appointments: "leadership_appointments"
    };

    const path = pathMap[collection];
    if (!path) return false;

    // 1. If online, call DELETE on server
    if (StorageService.isOnline()) {
      try {
        const res = await fetch(`/api/${path}/${id}`, {
          method: "DELETE"
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Server returned status ${res.status}`);
        }
      } catch (err: any) {
        console.error(`Server delete failed for ${collection}:`, err);
        window.dispatchEvent(new CustomEvent("bashosho_os_error", {
          detail: { message: `Failed to delete from ${collection}. ${err.message || ""}` }
        }));
        throw err;
      }
    }

    // 2. Update local storage & IndexedDB cache (except safeguarding)
    if (collection !== "safeguarding") {
      const localKey = collection === "attendance" ? "attendance" : collection;
      const currentDataRaw = localStorage.getItem(`bashosh_os_${localKey}`);
      if (currentDataRaw) {
        try {
          const currentData = JSON.parse(currentDataRaw);
          if (Array.isArray(currentData)) {
            const updatedData = currentData.filter((item: any) => item.id !== id);
            localStorage.setItem(`bashosh_os_${localKey}`, JSON.stringify(updatedData));
            await IndexedDBHelper.setCache(localKey, updatedData);
          }
        } catch (e) {
          console.error("Failed to update local cache during delete:", e);
        }
      }
    }

    // 3. If offline, queue the sync action
    if (!StorageService.isOnline()) {
      const action: SyncAction = {
        id: `sa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: collection,
        payload: { id },
        timestamp: new Date().toISOString(),
        status: "pending",
        type: "delete"
      };
      await IndexedDBHelper.addToQueue(action);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bashosh_os_data_updated", { detail: { collection, id } }));
    }

    return true;
  }

  // Active login session (persisted via localStorage and verified via API)
  static getActiveUser(): UserProfile {
    const defaultUser: UserProfile = {
      id: "chairperson-admin",
      name: "Chairperson Admin",
      email: "chairperson@example.com",
      phone: "+254 700 000000",
      role: UserRole.CHAIRPERSON,
      roleKey: "chairperson",
      isActive: true,
      joinDate: new Date().toISOString().split("T")[0],
      memberNumber: "BT-CBO-ADMIN",
      status: "Active",
      emergencyContact: { name: "N/A", phone: "N/A", relationship: "N/A" },
      skills: ["CBO Management", "Community Advocacy"]
    };
    return StorageService.get<UserProfile>("active_user", defaultUser);
  }

  static setActiveUser(user: UserProfile) {
    localStorage.setItem("bashosh_os_active_user", JSON.stringify(user));
    IndexedDBHelper.setCache("active_user", user);
  }

  // Connection Simulation
  static isOnline(): boolean {
    const status = localStorage.getItem("bashosh_os_connection_mode");
    return status !== "offline";
  }

  static setOnlineMode(mode: "online" | "offline") {
    localStorage.setItem("bashosh_os_connection_mode", mode);
  }

  // Async server pull to keep cache fresh (excluding safeguarding!)
  static checkAndInvalidateCache() {
    const CURRENT_VERSION = "v1.4.0_2026_07_27";
    const storedVersion = localStorage.getItem("bashosh_os_cache_schema_version");
    if (storedVersion !== CURRENT_VERSION) {
      console.log(`[Cache Invalidation] Schema version mismatch (${storedVersion} vs ${CURRENT_VERSION}). Purging stale local caches.`);
      const activeUser = localStorage.getItem("bashosh_os_active_user");
      const lang = localStorage.getItem("bashosh_os_language");
      const connMode = localStorage.getItem("bashosh_os_connection_mode");

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("bashosh_os_") || k.startsWith("bashosho_os_"))) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
      try {
        indexedDB.deleteDatabase("BashoshoOfflineDB");
      } catch (e) {
        console.error("IndexedDB deletion error during cache invalidation:", e);
      }

      if (activeUser) localStorage.setItem("bashosh_os_active_user", activeUser);
      if (lang) localStorage.setItem("bashosh_os_language", lang);
      if (connMode) localStorage.setItem("bashosh_os_connection_mode", connMode);
      localStorage.setItem("bashosh_os_cache_schema_version", CURRENT_VERSION);
    }
  }

  static async pullFromServer(): Promise<boolean> {
    if (!StorageService.isOnline()) return false;
    try {
      const keys = [
        "profiles", "documents", "budgets", "expenditures",
        "assets", "attendance", "partners", "incomes", "grants", "classes",
        "broadcasts", "leave_requests", "invoices", "org_settings", "contract_renewals", "leadership_appointments"
      ];

      const endpoints: Record<string, string> = {
        profiles: "/api/profiles",
        documents: "/api/documents",
        budgets: "/api/budgets",
        expenditures: "/api/expenditures",
        assets: "/api/assets",
        attendance: "/api/attendance",
        partners: "/api/partners",
        incomes: "/api/incomes",
        grants: "/api/grants",
        classes: "/api/classes",
        broadcasts: "/api/broadcasts",
        leave_requests: "/api/leave_requests",
        invoices: "/api/invoices",
        org_settings: "/api/org_settings",
        contract_renewals: "/api/contract_renewals",
        leadership_appointments: "/api/leadership_appointments"
      };

      await Promise.allSettled(
        keys.map(async (key) => {
          try {
            const res = await fetch(endpoints[key]);
            if (res.ok) {
              const data = await res.json();
              localStorage.setItem(`bashosh_os_${key}`, JSON.stringify(data));
              await IndexedDBHelper.setCache(key, data);
            }
          } catch (err) {
            console.warn(`[Pull] Failed to fetch ${key}:`, err);
          }
        })
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("bashosh_os_data_updated"));
      }
      return true;
    } catch (e) {
      console.warn("Failed to pull from server:", e);
      return false;
    }
  }

  // Real offline queue synchronization
  static async syncOfflineQueue(): Promise<number> {
    if (!StorageService.isOnline()) return 0;
    try {
      const queue = await IndexedDBHelper.getQueue();
      if (queue.length === 0) return 0;

      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue })
      });

      if (res.ok) {
        await IndexedDBHelper.clearQueue();
        await StorageService.pullFromServer();
        return queue.length;
      }
      return 0;
    } catch (e) {
      console.error("Offline queue sync failed:", e);
      return 0;
    }
  }

  // Profiles / Users
  static getProfiles(): UserProfile[] {
    return StorageService.get<UserProfile[]>("profiles", SEED_PROFILES);
  }

  static getUsers(): UserProfile[] {
    return StorageService.getProfiles();
  }

  static saveProfiles(profiles: UserProfile[]) {
    StorageService.set("profiles", profiles);
  }

  static saveUser(user: UserProfile) {
    const list = StorageService.getProfiles();
    const updated = list.some((u) => u.id === user.id)
      ? list.map((u) => (u.id === user.id ? user : u))
      : [...list, user];
    StorageService.saveProfiles(updated);
  }

  // Documents
  static getDocuments(): Document[] {
    return StorageService.get<Document[]>("documents", SEED_DOCUMENTS);
  }

  // Budgets
  static getBudgets(): BudgetEngagement[] {
    return StorageService.get<BudgetEngagement[]>("budgets", SEED_BUDGETS);
  }

  // Expenditures
  static getExpenditures(): ExpenditureRequest[] {
    return StorageService.get<ExpenditureRequest[]>("expenditures", SEED_EXPENDITURES);
  }

  // Safeguarding (Strictly restricted based on logged-in role!)
  static getSafeguarding(): SafeguardingReport[] {
    return []; // Never read from plain text local storage or IndexedDB cache!
  }

  static async fetchSafeguardingOnDemand(): Promise<SafeguardingReport[]> {
    if (!StorageService.isOnline()) return [];
    try {
      const res = await fetch("/api/safeguarding");
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error("Failed to fetch safeguarding reports on-demand:", e);
    }
    return [];
  }

  // Clear all local data on logout for device safety
  static clearAllLocalData() {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("bashosh_os_")) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }

    try {
      const req = indexedDB.deleteDatabase("BashoshoOfflineDB");
      req.onsuccess = () => {
        console.log("IndexedDB database deleted successfully");
      };
      req.onerror = () => {
        console.error("Failed to delete IndexedDB database");
      };
    } catch (e) {
      console.error("Error deleting IndexedDB database:", e);
    }
  }

  // Assets
  static getAssets(): Asset[] {
    return StorageService.get<Asset[]>("assets", SEED_ASSETS);
  }

  // Attendance
  static getAttendance(): AttendanceSheet[] {
    return StorageService.get<AttendanceSheet[]>("attendance", SEED_ATTENDANCE);
  }

  // Partners
  static getPartners(): Partner[] {
    return StorageService.get<Partner[]>("partners", SEED_PARTNERS);
  }

  // Incomes
  static getIncomes(): Income[] {
    return StorageService.get<Income[]>("incomes", SEED_INCOMES);
  }

  // Grants
  static getGrants(): Grant[] {
    return StorageService.get<Grant[]>("grants", SEED_GRANTS);
  }

  // Classes
  static getClasses(): Class[] {
    return StorageService.get<Class[]>("classes", SEED_CLASSES);
  }

  // Broadcasts
  static getBroadcasts(): Broadcast[] {
    return StorageService.get<Broadcast[]>("broadcasts", SEED_BROADCASTS);
  }

  // Leave Requests
  static getLeaveRequests(): LeaveRequest[] {
    return StorageService.get<LeaveRequest[]>("leave_requests", SEED_LEAVE);
  }

  // Invoices
  static getInvoices(): Invoice[] {
    return StorageService.get<Invoice[]>("invoices", []);
  }

  // Org Settings
  static getOrgSettings(): OrgSettings {
    const settings = StorageService.get<OrgSettings>("org_settings", {
      name: "BASHOSHO TALENTS CBO",
      registrationNumber: "Reg No. DSD/KAM/CBO/5/4/22/269",
      contactDetails: "P.O. Box 48931-00100 Nairobi, Kenya",
      physicalAddress: "Kiambiu Informal Settlement, Kamukunji, Nairobi, Kenya",
      emailAndPhone: "Email: barshoshotalents@gmail.com | Cell: +254 798 132 410 / +254 702 671 730",
      missionText: "We use theatre and film to raise awareness on GBV, SRHR, and Mental Health, train the next generation of filmmakers through the Bashosho Film Academy, and put our skills to work for partner organizations through Theatre as a Service.",
      visionText: {
        en: "A Kenya where every young person has a safe space to be heard, healed, and seen — through the power of theatre and film.",
        sw: "Kenya ambapo kila kijana ana nafasi salama ya kusikilizwa, kuponywa, na kuonekana — kupitia sanaa ya tamthilia na filamu."
      },
      facebookUrl: "https://web.facebook.com/bashoshotalentscbo",
      renewalFee: 500,
      safeguardingContact: "Safeguarding Officer: +254 798 132 410 (barshoshotalents@gmail.com)",
      codeOfConduct: "1. Respect and Integrity: Treat all members, trainers, and community stakeholders with respect and dignity.\n2. Non-Discrimination: Absolutely no discrimination or harassment based on gender, tribe, religion, or background.\n3. Safeguarding & Protection: Strictly adhere to our SGBV safeguarding guidelines and child protection policies.\n4. Transparency & Accountability: Ensure honesty and transparency when utilizing CBO equipment or representing the group at external engagements.\n5. Professional Dedication: Be punctual for rehearsals, community forum theaters, and mentorship workshops.",
      objectives: "1. To harness theatre and short film to raise awareness on Mental Health, GBV, and SRHR.\n2. To build vocational, digital, entrepreneurial, and leadership capacity through Bashosho Film Academy.\n3. To connect GBV survivors and youth to safe spaces, counseling, and partner organizations.\n4. To partner with organizations across Nairobi for community awareness.\n5. To generate sustainable revenue through Theatre as a Service (TaaS).",
      rules: "1. All active members and volunteers must renew their contracts every 6 months.\n2. A renewal fee of Kshs 200 is payable to the treasury.\n3. Attendance of at least 70% of rehearsals and CBO workshops is mandatory.",
      handbookVersion: "1.2",
      handbookUpdatedAt: "2026-07-23",
      handbookSections: SEED_HANDBOOK_SECTIONS,
      invoiceBankName: "Co-operative Bank Kenya",
      invoiceBankAccount: "", // empty so it defaults to the invoice number dynamically unless overridden
      invoiceBankAccountName: "Bashosho Talents CBO",
      invoiceMpesaPaybill: "400222",
      invoiceMpesaTill: "8671238"
    });

    if (!settings.handbookSections || settings.handbookSections.length === 0 || settings.handbookVersion !== "1.2") {
      settings.handbookSections = SEED_HANDBOOK_SECTIONS;
      settings.handbookVersion = "1.2";
      settings.handbookUpdatedAt = "2026-07-23";
    }
    if (!settings.invoiceMpesaTill || settings.invoiceMpesaTill === "291002") {
      settings.invoiceMpesaTill = "8671238";
    }
    if (!settings.facebookUrl) {
      settings.facebookUrl = "https://web.facebook.com/bashoshotalentscbo";
    }
    if (!settings.safeguardingContact) {
      settings.safeguardingContact = "Safeguarding Officer: +254 798 132 410 (barshoshotalents@gmail.com)";
    }
    return settings;
  }

  static saveOrgSettings(settings: OrgSettings) {
    StorageService.set("org_settings", settings);
  }

  // Contract Renewals
  static getContractRenewals(): ContractRenewal[] {
    return StorageService.get<ContractRenewal[]>("contract_renewals", []);
  }

  // Leadership Appointments
  static getLeadershipAppointments(): LeadershipAppointment[] {
    return StorageService.get<LeadershipAppointment[]>("leadership_appointments", []);
  }

  static async saveLeadershipAppointment(appt: LeadershipAppointment): Promise<boolean> {
    const list = StorageService.getLeadershipAppointments();
    const updated = list.some(x => x.id === appt.id)
      ? list.map(x => x.id === appt.id ? appt : x)
      : [...list, appt];
    StorageService.set("leadership_appointments", updated);
    return StorageService.saveRecord("leadership_appointments", appt);
  }

  // Sync Queue (Retained for legacy/visual state counts)
  static getSyncQueue(): SyncAction[] {
    const val = localStorage.getItem("bashosh_os_sync_queue");
    return val ? JSON.parse(val) : [];
  }

  static clearSyncQueue() {
    localStorage.setItem("bashosh_os_sync_queue", JSON.stringify([]));
  }

  // Swahili Language Preference
  static getLanguage(): "en" | "sw" {
    return (localStorage.getItem("bashosh_os_language") as "en" | "sw") || "en";
  }

  static setLanguage(lang: "en" | "sw") {
    localStorage.setItem("bashosh_os_language", lang);
  }
}

