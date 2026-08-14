import React from "react";
import { Class, UserRole, UserProfile, getCanonicalRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import Modal from "./Modal";
import { Shield, Plus, UserPlus, Trash2, Check, Circle } from "lucide-react";

interface ClassesBoardProps {
  currentUser: UserProfile;
  lang: "en" | "sw";
  onTriggerPrint: (title: string, content: React.ReactNode, verificationUrl?: string) => void;
}

export default function ClassesBoard({ currentUser, lang, onTriggerPrint }: ClassesBoardProps) {
  const [classes, setClasses] = React.useState<Class[]>([]);
  const [profiles, setProfiles] = React.useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = React.useState<"directory" | "portfolio" | "verify" | "admin">("directory");
  
  // Modals & Action States
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showEnrollModal, setShowEnrollModal] = React.useState<Class | null>(null);

  // Verification State
  const [verificationCode, setVerificationCode] = React.useState("");
  const [verifiedCert, setVerifiedCert] = React.useState<any>(null);
  const [verifyError, setVerifyError] = React.useState(false);

  // Form states for creating a new class
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [trainer, setTrainer] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [courseTag, setCourseTag] = React.useState("Theater of the Oppressed");
  const [isAiDrafting, setIsAiDrafting] = React.useState(false);

  const handleGenerateClassSyllabusAiDraft = async () => {
    setIsAiDrafting(true);
    try {
      const res = await fetch("/api/document_templates/generate_draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Course Name: ${name || "Forum Theatre & Safeguarding Leadership"}
Category: ${courseTag}
Lead Facilitator: ${trainer || "Senior CBO Facilitator"}
Dates: ${startDate || "Upcoming"} to ${endDate || "End Date"}
Syllabus Context: ${description || "Interactive community workshops in Kiambiu"}`,
          docType: "class_syllabus",
          title: `Syllabus - ${name || "Course"}`
        })
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setDescription(data.draft);
      } else {
        throw new Error(data.error || "Failed to draft syllabus.");
      }
    } catch (err: any) {
      alert("AI Syllabus Draft failed: " + err.message);
    } finally {
      setIsAiDrafting(false);
    }
  };

  // Search filter
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    const loadData = () => {
      setClasses(StorageService.getClasses());
      setProfiles(StorageService.getProfiles());
    };
    loadData();

    // Check query params for instant certificate verification!
    const params = new URLSearchParams(window.location.search);
    const verifyId = params.get("verifyCert");
    if (verifyId) {
      setVerificationCode(verifyId);
      setActiveTab("verify");
      handleVerifyCode(verifyId);
    }

    window.addEventListener("bashosh_os_data_updated", loadData);
    return () => {
      window.removeEventListener("bashosh_os_data_updated", loadData);
    };
  }, []);

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !trainer.trim() || !startDate || !endDate) return;

    const newClass: Class = {
      id: `c-${Date.now()}`,
      name,
      description: `${courseTag ? `[${courseTag}] ` : ""}${description}`,
      trainer,
      startDate,
      endDate,
      enrolledUserIds: [],
    };

    setClasses([...classes, newClass]);
    StorageService.saveRecord("classes", newClass).catch(console.error);
    setShowAddModal(false);

    // Reset Form
    setName("");
    setDescription("");
    setTrainer("");
    setStartDate("");
    setEndDate("");
  };

  const handleDeleteClass = (classId: string) => {
    if (window.confirm(lang === "en" ? "Are you sure you want to delete this course?" : "Je, una uhakika unataka kufuta mafunzo haya?")) {
      const updated = classes.filter(c => c.id !== classId);
      setClasses(updated);
      StorageService.deleteRecord("classes", classId).catch(console.error);
    }
  };

  const handleToggleEnroll = (classId: string, userId: string) => {
    let updatedClass: Class | null = null;
    const updated = classes.map(c => {
      if (c.id === classId) {
        const enrolled = c.enrolledUserIds.includes(userId)
          ? c.enrolledUserIds.filter(id => id !== userId)
          : [...c.enrolledUserIds, userId];
        updatedClass = { ...c, enrolledUserIds: enrolled };
        return updatedClass;
      }
      return c;
    });
    setClasses(updated);
    if (updatedClass) {
      StorageService.saveRecord("classes", updatedClass).catch(console.error);
    }
    if (showEnrollModal && showEnrollModal.id === classId) {
      setShowEnrollModal(updated.find(c => c.id === classId) || null);
    }
  };

  const handleVerifyCode = (code: string) => {
    if (!code.trim()) return;
    // Decipher code: CERT-[classId]-[userId]
    const parts = code.split("-");
    if (parts.length < 3 || parts[0] !== "CERT") {
      setVerifyError(true);
      setVerifiedCert(null);
      return;
    }

    const classId = parts[1];
    const userId = parts[2];

    const targetClass = StorageService.getClasses().find(c => c.id === classId);
    const targetUser = StorageService.getProfiles().find(u => u.id === userId);

    if (targetClass && targetUser && targetClass.enrolledUserIds.includes(userId)) {
      setVerifiedCert({
        studentName: targetUser.name,
        studentNumber: targetUser.memberNumber,
        className: targetClass.name,
        trainerName: targetClass.trainer,
        completionDate: targetClass.endDate,
        certificateId: code,
      });
      setVerifyError(false);
    } else {
      setVerifyError(true);
      setVerifiedCert(null);
    }
  };

  const printCertificate = (item: Class, student: UserProfile) => {
    const certCode = `CERT-${item.id}-${student.id}`;
    const realVerificationUrl = item.verificationUrl;

    onTriggerPrint(
      `${student.name} - Certificate of Completion`,
      <div className="border-8 border-double border-red-600 p-8 text-center bg-white my-4 relative space-y-8 font-serif">
        <div className="space-y-2">
          <p className="text-red-600 font-sans text-xs tracking-widest font-black uppercase">
            BASHOSHO TALENTS COMMUNITY-BASED ORGANIZATION
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 font-sans uppercase">
            Certificate of Completion
          </h1>
          <div className="h-1 w-24 bg-red-600 mx-auto mt-4"></div>
        </div>

        <div className="space-y-4">
          <p className="text-sm italic text-neutral-500">This is to officially certify that</p>
          <h2 className="text-2xl font-black text-neutral-950 underline decoration-red-600 decoration-2 underline-offset-4">
            {student.name}
          </h2>
          <p className="text-xs font-mono font-bold text-neutral-400">MEMBER NO: {student.memberNumber}</p>
        </div>

        <div className="space-y-4 max-w-xl mx-auto">
          <p className="text-sm leading-relaxed text-neutral-600">
            has successfully attended, participated in, and fully completed the specialized capacity-building program in:
          </p>
          <h3 className="text-lg font-bold text-neutral-900 font-sans">
            "{item.name}"
          </h3>
          <p className="text-xs text-neutral-500 font-sans">
            Under the guidance and tutoring of Lead Facilitator &amp; Trainer: <strong>{item.trainer}</strong>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 pt-10 border-t border-neutral-150 text-xs font-sans max-w-lg mx-auto">
          <div>
            <p className="text-neutral-500">Course Duration:</p>
            <p className="font-bold text-neutral-800">{item.startDate} to {item.endDate}</p>
          </div>
          <div>
            <p className="text-neutral-500">Certificate Verification ID:</p>
            <p className="font-mono text-[10px] font-bold text-[#00A651]">{certCode}</p>
          </div>
        </div>

        {/* Clean verification note */}
        <p className="text-[10px] text-neutral-400 font-mono italic max-w-md mx-auto pt-4 leading-normal">
          This official credential has been registered securely on the Bashosho OS system registry. Scan the document QR code or visit the verification portal to confirm legitimacy.
        </p>
      </div>,
      realVerificationUrl
    );
  };

  const getCourseProgress = (startDateStr: string, endDateStr: string) => {
    const start = new Date(startDateStr).getTime();
    const end = new Date(endDateStr).getTime();
    const now = new Date().getTime(); // System lock date

    if (now > end) return 100;
    if (now < start) return 0;
    
    const total = end - start;
    const elapsed = now - start;
    return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  };

  const isCompleted = (endDateStr: string) => {
    return new Date(endDateStr) < new Date();
  };

  const userRoleKey = currentUser.roleKey || getCanonicalRoleKey(currentUser.role);
  const isAdmin = ["chairperson", "programs_director"].includes(userRoleKey);

  // Filter classes enrolled by current user
  const myEnrolledClasses = classes.filter(c => c.enrolledUserIds.includes(currentUser.id));

  // Search filter
  const filteredClasses = classes.filter(c => {
    const searchLower = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(searchLower) ||
      c.trainer.toLowerCase().includes(searchLower) ||
      c.description.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6 text-left" id="classes-module-stage">
      
      {/* Tab/Dashboard Header */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-red-600 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-2 py-0.5 inline-block">
              {lang === "en" ? "CAPACITY BUILDING & ROSTER" : "TAALUMA, MAFUNZO NA USIMAMIZI"}
            </span>
            <h2 className="text-xl font-black text-neutral-950 font-sans tracking-tight">
              {lang === "en" ? "CBO Talent Capacity Academy" : "Chuo cha Maendeleo ya Vipaji na Ujuzi"}
            </h2>
            <p className="text-xs text-neutral-500 max-w-2xl leading-relaxed">
              {lang === "en"
                ? "Manage capacity building workshops, professional theater curriculums, and verify official certs with roles accountability."
                : "Unda, hariri, na usimamie madarasa ya uigizaji, ulinzi wa kijamii, ujasiriamali, na vyeti rasmi vya kuhitimu."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                id="btn-publish-course"
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                 {lang === "en" ? "Publish New Course" : "Sajili Mafunzo Mapya"}
              </button>
            )}
            <button
              onClick={() => setActiveTab("verify")}
              className="bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
               {lang === "en" ? "Verify Credential" : "Kagua Cheti"}
            </button>
          </div>
        </div>

        {/* Dashboard Role-Based Authority Protocol Guide */}
        <div className="mt-5 border-t border-neutral-100 pt-4 bg-neutral-50 rounded-xl p-4 border flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-1 md:max-w-xl">
            <h4 className="text-[11px] font-bold text-neutral-900 flex items-center gap-1.5 uppercase tracking-wide">
               {lang === "en" ? "COURSES & CAPACITY GOVERNANCE PROTOCOL" : "ITIFAKI YA USIMAMIZI WA MAFUNZO"}
            </h4>
            <p className="text-[10px] text-neutral-500 leading-relaxed font-sans">
              {lang === "en"
                ? "Under CBO administrative guidelines, only the Programs Director and Chairperson are authorized to create curriculum courses, modify syllabi, assign trainers, and finalize certification grades. All active volunteers and members are eligible to enroll, track progress, and auto-generate verified completion credentials."
                : "Chini ya miongozo ya CBO, ni Mkurugenzi wa Programu na Mwenyekiti tu wenye mamlaka ya kuandaa mtaala, kusajili walimu, na kuthibitisha vyeti vya wanachama. Wanachama wote wanaruhusiwa kujiandikisha na kuchapa vyeti vyao hapa."}
            </p>
          </div>
          <div className="flex flex-col justify-center text-[10px] space-y-1 bg-white p-2.5 rounded-lg border border-neutral-150 shrink-0 md:min-w-[190px]">
            <div className="flex items-center gap-1.5 text-neutral-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{lang === "en" ? "Programs Director" : "Mkurugenzi Programu"}: <strong>Authorized</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{lang === "en" ? "CBO Chairperson" : "Mwenyekiti"}: <strong>Authorized</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>{lang === "en" ? "Other Roles" : "Nafasi Nyingine"}: <strong>Read-Only Portfolio</strong></span>
            </div>
          </div>
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="flex border-b border-neutral-200 mt-6 gap-2">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "directory"
                ? "border-red-600 text-red-600"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
             {lang === "en" ? "Course Directory" : "Katalogi ya Mafunzo"}
          </button>
          
          <button
            onClick={() => setActiveTab("portfolio")}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "portfolio"
                ? "border-red-600 text-red-600"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
             {lang === "en" ? "My Training Portfolio" : "Masomo na Vyeti Vyangu"}
            {myEnrolledClasses.length > 0 && (
              <span className="bg-red-100 text-red-600 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                {myEnrolledClasses.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("verify")}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "verify"
                ? "border-red-600 text-red-600"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
             {lang === "en" ? "Verify Credential" : "Kagua Cheti"}
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer text-red-700 ${
                activeTab === "admin"
                  ? "border-red-600 font-extrabold bg-red-50/50 rounded-t-lg"
                  : "border-transparent hover:bg-neutral-50 rounded-t-lg"
              }`}
            >
              <span className="flex items-center gap-1.5"><Shield size={14} /> {lang === "en" ? "Roster & Authority Panel" : "Udhibiti wa Madarasa"}</span>
            </button>
          )}
        </div>
      </div>

      {/* SEARCH AND QUICK FILTER CONTROLS */}
      {activeTab === "directory" && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={lang === "en" ? "Search courses, tags, trainer..." : "Tafuta masomo, lebo, mwalimu..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-neutral-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs"
              >
                
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: COURSE DIRECTORY / CATALOG */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {filteredClasses.length === 0 ? (
            <div className="bg-white border rounded-2xl p-12 text-center text-neutral-500 text-xs">
              <p className="font-medium">{lang === "en" ? "No workshops matched your search." : "Hakuna masomo yaliyopatikana."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredClasses.map(item => {
                const progress = getCourseProgress(item.startDate, item.endDate);
                const finished = isCompleted(item.endDate);
                const isUserEnrolled = item.enrolledUserIds.includes(currentUser.id);
                
                // Extract tag if specified in description [Tag]
                let cleanDesc = item.description;
                let extractedTag = "Capacity Building";
                if (item.description.startsWith("[")) {
                  const closingBracIdx = item.description.indexOf("]");
                  if (closingBracIdx > 0) {
                    extractedTag = item.description.substring(1, closingBracIdx);
                    cleanDesc = item.description.substring(closingBracIdx + 1).trim();
                  }
                }

                return (
                  <div 
                    key={item.id} 
                    className={`bg-white border rounded-2xl p-5 shadow-2xs hover:shadow-sm transition-all space-y-4 relative overflow-hidden flex flex-col justify-between ${
                      isUserEnrolled ? "border-red-200 ring-1 ring-red-100" : "border-neutral-200"
                    }`}
                  >
                    {isUserEnrolled && (
                      <div className="absolute top-0 right-0 bg-red-600 text-white font-mono font-bold text-[8px] px-2.5 py-0.5 rounded-bl-lg uppercase tracking-wider">
                        {lang === "en" ? "My Enrolled" : "Nimesajiliwa"}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-neutral-100 text-neutral-700 border border-neutral-200 text-[8px] font-black font-mono uppercase px-2 py-0.5 rounded">
                          {extractedTag}
                        </span>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                          finished 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
                            : progress > 0 
                            ? "bg-blue-50 text-blue-600 border-blue-200 animate-pulse" 
                            : "bg-amber-50 text-amber-600 border-amber-200"
                        }`}>
                          {finished 
                            ? (lang === "en" ? "Completed / Graduated" : "Kimekamilika") 
                            : progress > 0 
                            ? (lang === "en" ? `In Progress — ${progress}%` : `Yanaendelea — ${progress}%`) 
                            : (lang === "en" ? "Upcoming" : "Inatarajiwa")}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-sm font-black text-neutral-900 leading-snug">{item.name}</h3>
                        <p className="text-xs text-neutral-500 font-serif leading-relaxed line-clamp-3">
                          {cleanDesc}
                        </p>
                      </div>

                      {/* Dynamic Progress Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-neutral-400">
                          <span>{lang === "en" ? "Curriculum Progress" : "Maendeleo ya Masomo"}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              finished ? "bg-emerald-500" : "bg-red-600"
                            }`} 
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Instructor Badge */}
                      <div className="flex items-center gap-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                        <div className="w-6 h-6 rounded-full bg-[#E31E24] text-white flex items-center justify-center font-bold text-[10px]">
                          {item.trainer.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[9px] text-neutral-400 font-mono uppercase tracking-wider">{lang === "en" ? "Lead Instructor" : "Mkufunzi Mkuu"}</p>
                          <p className="text-xs font-bold text-neutral-800">{item.trainer}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-neutral-100 flex items-center justify-between">
                      <div className="text-[10px] font-mono text-neutral-400 space-y-0.5">
                        <span className="block"> {item.startDate} {lang === "en" ? "to" : "hadi"} {item.endDate}</span>
                        <span className="block text-neutral-500"> {item.enrolledUserIds.length} {lang === "en" ? "registered students" : "washiriki waliosajiliwa"}</span>
                      </div>

                      {isUserEnrolled && finished ? (
                        <button
                          onClick={() => printCertificate(item, currentUser)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                        >
                           {lang === "en" ? "Print Certificate" : "Chapa Cheti"}
                        </button>
                      ) : isUserEnrolled ? (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                           {lang === "en" ? "Active Class" : "Darasa Linaloendelea"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-400 italic">
                          {lang === "en" ? "Contact Director to enroll" : "Wasiliana na mkurugenzi kujiunga"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY PERSONAL TRAINING PORTFOLIO */}
      {activeTab === "portfolio" && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b pb-4 space-y-1">
            <h3 className="text-sm font-black text-neutral-950 uppercase tracking-wide">
               {lang === "en" ? "My Personal Training & Certifications" : "Sajili na Vyeti Vyangu vya CBO"}
            </h3>
            <p className="text-xs text-neutral-500">
              {lang === "en"
                ? "Track capacity building courses you have been assigned to, verify attendance hours, and generate official certificates."
                : "Kagua madarasa uliyopangiwa, saa za uigizaji na ulinzi wa kijamii, na pakua vyeti vyako vya uhitimu hapa."}
            </p>
          </div>

          {myEnrolledClasses.length === 0 ? (
            <div className="text-center py-10 bg-neutral-50 border border-dashed rounded-xl space-y-2">
              <span className="text-2xl block"></span>
              <p className="text-xs text-neutral-500 font-medium italic">
                {lang === "en"
                  ? "You are not currently enrolled in any workshops."
                  : "Bado haujasajiliwa kwenye mafunzo yoyote kwa sasa."}
              </p>
              <p className="text-[10px] text-neutral-400 max-w-sm mx-auto">
                {lang === "en"
                  ? "Please coordinate with the Programs Director to register your profile for upcoming theatrical, SGBV advocacy, or digital skill courses."
                  : "Tafadhali wasiliana na Mkurugenzi wa Programu ili kusajiliwa kwenye mafunzo ya michezo ya kuigizaji na stadi za kimaisha."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myEnrolledClasses.map(item => {
                const finished = isCompleted(item.endDate);
                const progress = getCourseProgress(item.startDate, item.endDate);

                return (
                  <div key={item.id} className="bg-neutral-50 border border-neutral-150 rounded-xl p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-bold text-neutral-950">{item.name}</h4>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          finished ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                        }`}>
                          {finished ? (lang === "en" ? "Completed" : "Kimekamilika") : (lang === "en" ? "In Progress" : "Yanaendelea")}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-500 leading-relaxed font-serif line-clamp-2">{item.description}</p>
                      <p className="text-[10px] text-neutral-400">Trainer: <strong className="text-neutral-700">{item.trainer}</strong></p>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] font-bold text-neutral-400">
                          <span>{lang === "en" ? "Completion Progress" : "Kiwango cha Kukamilisha"}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-neutral-200 h-1 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${finished ? "bg-emerald-500" : "bg-red-600"}`} 
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-neutral-150 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-neutral-400">{item.startDate} to {item.endDate}</span>
                      {finished ? (
                        <button
                          onClick={() => printCertificate(item, currentUser)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-xs hover:shadow-sm transition-colors cursor-pointer"
                        >
                           {lang === "en" ? "Print Certificate" : "Chapa Cheti"}
                        </button>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-400 italic">
                          {lang === "en" ? "Awaiting final completion" : "Inasubiri kukamilika kikamilifu"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PUBLIC CERTIFICATE VERIFICATION TOOL */}
      {activeTab === "verify" && (
        <div id="cert-verify-section" className="bg-[#1B1B1B] text-white rounded-2xl p-6 shadow-lg border border-neutral-800 space-y-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-red-500">
               {lang === "en" ? "Bashosho OS Official Credential Verification" : "Thibitisha Uhakiki wa Vyeti Rasmi"}
            </h3>
            <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
              {lang === "en"
                ? "Verify the authenticity of any completion certificate issued by Bashosho Talents. Enter the alphanumeric verification ID found on the printed document."
                : "Thibitisha kama cheti chochote kilichotolewa na kikundi cha Bashosho ni halali au cha kughushi. Ingiza nambari ya cheti hapa."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="e.g. CERT-c-1-m-6"
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-600 max-w-sm w-full font-mono font-bold"
            />
            <button
              onClick={() => handleVerifyCode(verificationCode)}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
            >
              {lang === "en" ? "Query Registry" : "Kagua Cheti"}
            </button>
          </div>

          {verifiedCert && (
            <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-5 text-left space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest font-mono">
                <span className="text-base"></span>
                <span>VALID CREDENTIAL REGISTERED</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <p className="text-neutral-400">Recipient Name: <strong className="text-neutral-100 block text-sm mt-0.5">{verifiedCert.studentName}</strong></p>
                <p className="text-neutral-400">Member Number: <strong className="text-neutral-100 block text-sm mt-0.5">{verifiedCert.studentNumber}</strong></p>
                <p className="text-neutral-400">Course / Workshop Title: <strong className="text-neutral-100 block text-sm mt-0.5">{verifiedCert.className}</strong></p>
                <p className="text-neutral-400">Lead Trainer / Instructor: <strong className="text-neutral-100 block text-sm mt-0.5">{verifiedCert.trainerName}</strong></p>
                <p className="text-neutral-400">Date of Attainment: <strong className="text-neutral-100 block text-sm mt-0.5">{verifiedCert.completionDate}</strong></p>
                <p className="text-neutral-400">Certificate Reference: <strong className="text-emerald-400 block font-mono font-bold mt-0.5 text-sm">{verifiedCert.certificateId}</strong></p>
              </div>
            </div>
          )}

          {verifyError && (
            <div className="bg-red-950/40 border border-red-500/50 rounded-xl p-4 text-left flex items-center gap-2.5 text-xs text-red-300 font-bold">
              <span></span>
              <span>{lang === "en" ? "CRITICAL: Credentials match not found in local CBO registry." : "HALALI HAKUNA: Cheti hicho hakijatambuliwa kwenye mfumo wetu."}</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ADMIN / AUTHORITY WORKSHOP PANEL */}
      {activeTab === "admin" && isAdmin && (
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-sm font-black text-neutral-950 uppercase tracking-wide flex items-center gap-1.5">
                  <Shield size={16} className="text-red-600 shrink-0" /> {lang === "en" ? "Programs Director Active Roster Control" : "Usimamizi wa Madarasa na Wanachama"}
                </h3>
                <p className="text-xs text-neutral-500">
                  {lang === "en" ? "Syllabus creations, roster additions, and grading completions." : "Kusimamia masomo, kusajili wanafunzi na kumaliza kozi rasmi."}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1"
              >
                <Plus size={14} /> {lang === "en" ? "New Workshop" : "Somo Jipya"}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {classes.map(item => {
                const finished = isCompleted(item.endDate);
                const progress = getCourseProgress(item.startDate, item.endDate);

                return (
                  <div key={item.id} className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h4 className="text-sm font-extrabold text-neutral-900">{item.name}</h4>
                        <p className="text-xs text-neutral-500 font-serif max-w-xl">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setShowEnrollModal(item)}
                          className="bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <UserPlus size={12} /> {lang === "en" ? "Enroll / Roll" : "Sajili"}
                        </button>
                        <button
                          onClick={() => handleDeleteClass(item.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-bold p-1.5 rounded-lg cursor-pointer border border-red-200 transition-colors"
                          title="Delete Workshop"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-neutral-200 text-xs text-neutral-600 font-sans">
                      <div>
                        <p className="text-[10px] text-neutral-400 uppercase font-mono">{lang === "en" ? "Instructor / Trainer" : "Mkufunzi"}</p>
                        <p className="font-bold text-neutral-800">{item.trainer}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 uppercase font-mono">{lang === "en" ? "Active Schedule" : "Ratiba ya Mafunzo"}</p>
                        <p className="font-medium text-neutral-800">{item.startDate} to {item.endDate}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 uppercase font-mono">{lang === "en" ? "Status & Hours" : "Hali ya Masomo"}</p>
                        <span className={`text-[10px] font-bold inline-block px-2 py-0.5 rounded ${
                          finished ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                        }`}>
                          {finished ? (lang === "en" ? "Completed / Grads Ready" : "Kimekamilika") : (lang === "en" ? "In Progress" : "Yanaendelea")}
                        </span>
                      </div>
                    </div>

                    {/* Enrolled students grid */}
                    <div className="space-y-2 pt-3 border-t border-neutral-150">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          {lang === "en" ? "Registered Roll Members" : "Wanafunzi Waliosajiliwa"} ({item.enrolledUserIds.length})
                        </p>
                        <span className="text-[10px] text-neutral-400 italic">
                          {lang === "en" ? "Graduated students can generate certs" : "Wahitimu wanaweza kutoa vyeti"}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {item.enrolledUserIds.map(uid => {
                          const userProfile = profiles.find(p => p.id === uid);
                          if (!userProfile) return null;
                          return (
                            <span 
                              key={uid} 
                              className="bg-white border text-neutral-700 text-[10px] font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs"
                            >
                              <span>{userProfile.name} ({userProfile.memberNumber})</span>
                              {finished && (
                                <button
                                  onClick={() => printCertificate(item, userProfile)}
                                  className="text-[11px] hover:text-red-600 font-bold ml-1 border-l pl-1.5 border-neutral-200"
                                  title="Print Completion Certificate"
                                >
                                   {lang === "en" ? "Cert" : "Vyeti"}
                                </button>
                              )}
                            </span>
                          );
                        })}
                        {item.enrolledUserIds.length === 0 && (
                          <span className="text-[10px] font-medium text-neutral-400 italic">No members enrolled yet. Click 'Enroll / Roll' above to register members.</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Workshop Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={lang === "en" ? "Publish Capacity Class / Workshop" : "Unda Darasa Jipya la Mafunzo"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateClass} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Course Category Tag</label>
            <select
              value={courseTag}
              onChange={(e) => setCourseTag(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="Theater of the Oppressed">Augusto Boal's Theater / Forum Theater</option>
              <option value="SGBV & Advocacy">SGBV advocacy & Safeguarding</option>
              <option value="Media & Film">Video Production & Media Skills</option>
              <option value="Peer Mentorship">Peer Mentorship & SRHR Outreach</option>
              <option value="Financial Literacy">Entrepreneurship & Budgets</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Course Title *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Forum Theatre & Spect-Actor Facilitation"
              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Trainer Name *</label>
            <input
              type="text"
              required
              value={trainer}
              onChange={(e) => setTrainer(e.target.value)}
              placeholder="e.g. Juma Rashid"
              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Start Date *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">End Date *</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Course Syllabus & Details *</label>
              <button
                type="button"
                onClick={handleGenerateClassSyllabusAiDraft}
                disabled={isAiDrafting}
                className="text-[10px] font-extrabold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1"
              >
                {isAiDrafting ? " Drafting Syllabus..." : " AI Draft Syllabus"}
              </button>
            </div>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Provide details of topics covered, milestones, or training objectives..."
              className="w-full bg-white border border-neutral-200 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-sans leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-sm"
            >
              Create Workshop
            </button>
          </div>
        </form>
      </Modal>

      {/* Enroll / Roll Management Modal */}
      <Modal
        isOpen={!!showEnrollModal}
        onClose={() => setShowEnrollModal(null)}
        title={showEnrollModal ? `Enroll Members: ${showEnrollModal.name}` : ""}
        maxWidth="max-w-sm"
      >
        {showEnrollModal && (
          <div>
            <div className="max-h-[350px] overflow-y-auto space-y-2 mb-4">
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-2">Toggle checkmarks to enroll/remove</p>
              {profiles.map(student => {
                const enrolled = showEnrollModal.enrolledUserIds.includes(student.id);
                return (
                  <button
                    key={student.id}
                    onClick={() => handleToggleEnroll(showEnrollModal.id, student.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                      enrolled 
                        ? "bg-red-50 border-red-200 font-bold text-red-700" 
                        : "bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                    }`}
                  >
                    <div>
                      <p>{student.name}</p>
                      <span className="text-[9px] text-neutral-400 font-mono font-normal block">{student.memberNumber} • {student.role}</span>
                    </div>
                    {enrolled ? <Check size={16} className="text-red-700 font-bold" /> : <Circle size={16} className="text-neutral-400" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t flex justify-end">
              <button
                onClick={() => setShowEnrollModal(null)}
                className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
