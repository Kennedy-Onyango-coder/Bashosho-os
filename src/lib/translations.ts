export type TranslationKey =
  | "app_title"
  | "dashboard"
  | "members"
  | "documents"
  | "minutes"
  | "finances"
  | "assets"
  | "attendance"
  | "safeguarding"
  | "partners"
  | "grants"
  | "classes"
  | "settings"
  | "expenditure"
  | "budgets"
  | "approved"
  | "pending"
  | "rejected"
  | "draft"
  | "submit"
  | "approve"
  | "reject"
  | "save"
  | "create_new"
  | "language"
  | "role_select"
  | "offline_mode"
  | "online_mode"
  | "sync_status"
  | "volunteer_hours"
  | "stipends"
  | "safeguarding_alert"
  | "id_card"
  | "qr_verify"
  | "print_view"
  | "ai_writing_assist"
  | "rough_notes_placeholder"
  | "active_engagements"
  | "financial_health"
  | "pending_expenditures"
  | "budget_actual"
  | "funder_ready"
  | "welcome"
  | "sync_success"
  | "sync_pending";

export const DICTIONARY: Record<"en" | "sw", Record<TranslationKey, string>> = {
  en: {
    app_title: "Bashosho OS",
    dashboard: "Dashboard",
    members: "Membership",
    documents: "CBO Archives",
    minutes: "Minutes & Reports",
    finances: "Finance",
    assets: "Asset Register",
    attendance: "Attendance & Clock-In",
    safeguarding: "Safeguarding Reports",
    partners: "Partners CRM",
    grants: "Grants & Funding",
    classes: "Classes & Training",
    settings: "Settings",
    expenditure: "Expenditures",
    budgets: "Engagement Budgets",
    approved: "Approved",
    pending: "Pending Approval",
    rejected: "Rejected",
    draft: "Draft",
    submit: "Submit",
    approve: "Approve",
    reject: "Reject",
    save: "Save",
    create_new: "Create New",
    language: "Swahili / English",
    role_select: "Demo Role Selector",
    offline_mode: "Offline Mode",
    online_mode: "Online (Sync Active)",
    sync_status: "Sync Status",
    volunteer_hours: "Volunteer Hours",
    stipends: "Stipends",
    safeguarding_alert: "Safeguarding Alerts",
    id_card: "Membership ID Card",
    qr_verify: "QR Verification",
    print_view: "Print Preview",
    ai_writing_assist: "Smart Drafting Assistant",
    rough_notes_placeholder: "Enter rough bullet points or speaker notes here, then tap Smart Assist to draft a professional report...",
    active_engagements: "Active Engagements",
    financial_health: "Financial Health",
    pending_expenditures: "Pending Expenditures",
    budget_actual: "Budget vs. Actual",
    funder_ready: "Print-Ready Funder PDF",
    welcome: "Welcome",
    sync_success: "All data synced successfully",
    sync_pending: "Offline changes pending sync"
  },
  sw: {
    app_title: "Bashosho OS",
    dashboard: "Dashibodi",
    members: "Uanachama na Vijana",
    documents: "Nyaraka za CBO",
    minutes: "Kumbukumbu na Ripoti",
    finances: "Fedha na Matumizi",
    assets: "Orodha ya Mali",
    attendance: "Mahudhurio na Saa",
    safeguarding: "Ripoti za Ulinzi (Siri)",
    partners: "Wadau na Washirika",
    grants: "Mbao wa Ruzuku",
    classes: "Madarasa na Vipaji",
    settings: "Mipangilio",
    expenditure: "Malipo na Matumizi",
    budgets: "Bajeti za Miradi",
    approved: "Imekubaliwa",
    pending: "Inasubiri Idhini",
    rejected: "Imekataliwa",
    draft: "Rasimu",
    submit: "Wasilisha",
    approve: "Kamilisha Idhini",
    reject: "Kataa Malipo",
    save: "Hifadhi",
    create_new: "Unda Mpya",
    language: "Kingereza / Kiswahili",
    role_select: "Chagua Jukumu la Demo",
    offline_mode: "Nje ya Mtandao",
    online_mode: "Kwenye Mtandao (Inasawazisha)",
    sync_status: "Hali ya Usawazishaji",
    volunteer_hours: "Saa za Kujitolea",
    stipends: "Posho za Wasanii",
    safeguarding_alert: "Arifa za Kulinda Usalama",
    id_card: "Kadi ya Uanachama",
    qr_verify: "Uhakiki wa QR",
    print_view: "Kagua Kuchapa",
    ai_writing_assist: "Msaidizi wa Kuandika Ripoti",
    rough_notes_placeholder: "Andika muhtasari wa kikao hapa, kisha bonyeza Msaidizi wa Kuandika ili kuandika ripoti rasmi...",
    active_engagements: "Miradi Inayoendelea",
    financial_health: "Hali ya Kifedha",
    pending_expenditures: "Malipo Yanayosubiri",
    budget_actual: "Bajeti dhidi ya Halisi",
    funder_ready: "Chapa Ripoti kwa Funder",
    welcome: "Karibu",
    sync_success: "Data zote zimesawazishwa",
    sync_pending: "Mabadiliko ya nje ya mtandao yanangoja"
  }
};

export function getTranslation(lang: "en" | "sw", key: TranslationKey): string {
  return DICTIONARY[lang][key] || key;
}
