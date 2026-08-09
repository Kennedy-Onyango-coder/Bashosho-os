import React from "react";
import { Class, ClassLesson, ClassEnrollment, UserRole, UserProfile, getCanonicalRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import Modal from "./Modal";
import { Shield, Plus, UserPlus, Trash2, Check, Circle, Video, Link2, Radio, ChevronDown, ChevronUp, Award, X } from "lucide-react";

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
  const [deliveryMode, setDeliveryMode] = React.useState<"online" | "in_person" | "hybrid">("in_person");
  const [lessonDrafts, setLessonDrafts] = React.useState<{ title: string; videoUrl: string; liveLink: string; liveDateTime: string }[]>([]);
  const [expandedStudent, setExpandedStudent] = React.useState<string | null>(null);
  const [gradeDrafts, setGradeDrafts] = React.useState<Record<string, string>>({});
  const [expandedCourse, setExpandedCourse] = React.useState<string | null>(null);

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

    const lessons: ClassLesson[] = lessonDrafts
      .filter((l) => l.title.trim())
      .map((l, idx) => ({
        id: `lsn-${Date.now()}-${idx}`,
        title: l.title.trim(),
        videoUrl: l.videoUrl.trim() || undefined,
        liveLink: l.liveLink.trim() || undefined,
        liveDateTime: l.liveDateTime || undefined,
        order: idx,
      }));

    const newClass: Class = {
      id: `c-${Date.now()}`,
      name,
      description: `${courseTag ? `[${courseTag}] ` : ""}${description}`,
      trainer,
      startDate,
      endDate,
      enrolledUserIds: [],
      deliveryMode,
      lessons,
      enrollments: [],
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
    setDeliveryMode("in_person");
    setLessonDrafts([]);
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
        const isEnrolled = c.enrolledUserIds.includes(userId);
        const enrolled = isEnrolled
          ? c.enrolledUserIds.filter(id => id !== userId)
          : [...c.enrolledUserIds, userId];

        // Keep the richer enrollments[] record in sync with enrolledUserIds, since
        // certificate verification and the older parts of this UI still check
        // enrolledUserIds directly.
        const existingEnrollments = c.enrollments || [];
        let updatedEnrollments: ClassEnrollment[];
        if (isEnrolled) {
          updatedEnrollments = existingEnrollments.filter(en => en.userId !== userId);
        } else {
          const student = profiles.find(p => p.id === userId);
          updatedEnrollments = [
            ...existingEnrollments,
            {
              userId,
              userName: student?.name || userId,
              enrolledDate: new Date().toISOString().split("T")[0],
              completedLessonIds: [],
              status: "enrolled",
            },
          ];
        }

        updatedClass = { ...c, enrolledUserIds: enrolled, enrollments: updatedEnrollments };
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

  const handleToggleLessonComplete = (classItem: Class, userId: string, lessonId: string) => {
    const enrollments = classItem.enrollments || [];
    const updatedEnrollments = enrollments.map((en) => {
      if (en.userId !== userId) return en;
      const has = en.completedLessonIds.includes(lessonId);
      const completedLessonIds = has
        ? en.completedLessonIds.filter((id) => id !== lessonId)
        : [...en.completedLessonIds, lessonId];
      const totalLessons = (classItem.lessons || []).length;
      const status: ClassEnrollment["status"] = totalLessons > 0 && completedLessonIds.length === totalLessons ? "completed" : "enrolled";
      return { ...en, completedLessonIds, status };
    });
    const updatedClass = { ...classItem, enrollments: updatedEnrollments };
    setClasses(classes.map((c) => (c.id === classItem.id ? updatedClass : c)));
    StorageService.saveRecord("classes", updatedClass).catch(console.error);
  };

  const handleSaveGrade = (classItem: Class, userId: string, grade: string) => {
    const enrollments = classItem.enrollments || [];
    const updatedEnrollments = enrollments.map((en) =>
      en.userId === userId
        ? { ...en, grade, gradedBy: currentUser.name, gradedAt: new Date().toISOString() }
        : en
    );
    const updatedClass = { ...classItem, enrollments: updatedEnrollments };
    setClasses(classes.map((c) => (c.id === classItem.id ? updatedClass : c)));
    StorageService.saveRecord("classes", updatedClass).catch(console.error);
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
    const now = new Date("2026-07-12").getTime(); // System lock date

    if (now > end) return 100;
    if (now < start) return 0;
    
    const total = end - start;
    const elapsed = now - start;
    return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  };

  const isCompleted = (endDateStr: string) => {
    return new Date(endDateStr) < new Date("2026-07-12");
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
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                        {item.deliveryMode === "online" && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[8px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-0.5">
                            <Video size={9} /> {lang === "en" ? "Online" : "Mtandaoni"}
                          </span>
                        )}
                        {item.deliveryMode === "hybrid" && (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[8px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-0.5">
                            <Radio size={9} /> {lang === "en" ? "Hybrid" : "Mchanganyiko"}
                          </span>
                        )}
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

                      {/* Lessons / online content */}
                      {item.lessons && item.lessons.length > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setExpandedCourse(expandedCourse === item.id ? null : item.id)}
                            className="w-full flex items-center justify-between text-[10px] font-bold text-neutral-600 bg-neutral-50 hover:bg-neutral-100 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors"
                          >
                            <span className="flex items-center gap-1"><Video size={11} /> {item.lessons.length} {lang === "en" ? "lessons" : "masomo"}</span>
                            {expandedCourse === item.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          {expandedCourse === item.id && (
                            <div className="mt-2 space-y-1.5">
                              {item.lessons.sort((a, b) => a.order - b.order).map((lsn, i) => (
                                <div key={lsn.id} className="flex items-center justify-between bg-white border border-neutral-100 rounded-lg px-2.5 py-1.5">
                                  <span className="text-[10px] font-medium text-neutral-700 truncate">{i + 1}. {lsn.title}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {lsn.videoUrl && isUserEnrolled && (
                                      <a href={lsn.videoUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-red-600 hover:underline flex items-center gap-0.5">
                                        <Video size={10} /> {lang === "en" ? "Watch" : "Tazama"}
                                      </a>
                                    )}
                                    {lsn.liveLink && isUserEnrolled && (
                                      <a href={lsn.liveLink} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-purple-600 hover:underline flex items-center gap-0.5">
                                        <Radio size={10} /> {lang === "en" ? "Join Live" : "Jiunge"}
                                      </a>
                                    )}
                                    {!isUserEnrolled && <Link2 size={11} className="text-neutral-300" />}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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

                      {(() => {
                        const myEnrollment = (item.enrollments || []).find((en) => en.userId === currentUser.id);
                        if (myEnrollment?.grade) {
                          return (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 flex items-center gap-1.5 w-fit">
                              <Award size={11} /> {lang === "en" ? "Grade:" : "Daraja:"} {myEnrollment.grade}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {item.lessons && item.lessons.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[9px] font-bold text-neutral-400 uppercase flex items-center gap-1">
                            <Video size={10} /> {lang === "en" ? "Class content" : "Maudhui ya Somo"}
                          </p>
                          {item.lessons.sort((a, b) => a.order - b.order).map((lsn, i) => {
                            const myEnrollment2 = (item.enrollments || []).find((en) => en.userId === currentUser.id);
                            const done = myEnrollment2?.completedLessonIds.includes(lsn.id);
                            return (
                              <div key={lsn.id} className="flex items-center justify-between bg-white border border-neutral-100 rounded-lg px-2.5 py-1.5">
                                <span className={`text-[10px] font-medium truncate ${done ? "text-emerald-600" : "text-neutral-700"}`}>
                                  {done && <Check size={10} className="inline mr-0.5" />} {i + 1}. {lsn.title}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {lsn.videoUrl && (
                                    <a href={lsn.videoUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-red-600 hover:underline flex items-center gap-0.5">
                                      <Video size={10} /> {lang === "en" ? "Watch" : "Tazama"}
                                    </a>
                                  )}
                                  {lsn.liveLink && (
                                    <a href={lsn.liveLink} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-purple-600 hover:underline flex items-center gap-0.5">
                                      <Radio size={10} /> {lang === "en" ? "Join Live" : "Jiunge"}
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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

                    {/* Enrolled students: progress, lesson completion, and grading */}
                    <div className="space-y-2 pt-3 border-t border-neutral-150">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          {lang === "en" ? "Registered Roll Members" : "Wanafunzi Waliosajiliwa"} ({item.enrolledUserIds.length})
                        </p>
                        {item.lessons && item.lessons.length > 0 && (
                          <span className="text-[10px] text-neutral-400 italic">
                            {lang === "en" ? "Click a student to mark lessons or grade" : "Bofya mwanafunzi kuweka alama au daraja"}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {item.enrolledUserIds.map(uid => {
                          const userProfile = profiles.find(p => p.id === uid);
                          if (!userProfile) return null;
                          const enrollment = (item.enrollments || []).find((en) => en.userId === uid);
                          const totalLessons = (item.lessons || []).length;
                          const completedCount = enrollment?.completedLessonIds.length || 0;
                          const rowKey = `${item.id}:${uid}`;
                          const isExpanded = expandedStudent === rowKey;

                          return (
                            <div key={uid} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setExpandedStudent(isExpanded ? null : rowKey)}
                                className="w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer hover:bg-neutral-50 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[10px] font-bold text-neutral-800 truncate">{userProfile.name}</span>
                                  <span className="text-[9px] text-neutral-400 font-mono shrink-0">{userProfile.memberNumber}</span>
                                  {enrollment?.grade && (
                                    <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5 shrink-0">
                                      <Award size={9} /> {enrollment.grade}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {totalLessons > 0 && (
                                    <span className="text-[9px] font-mono font-bold text-neutral-500">{completedCount}/{totalLessons}</span>
                                  )}
                                  {finished && (
                                    <span
                                      role="button"
                                      onClick={(e) => { e.stopPropagation(); printCertificate(item, userProfile); }}
                                      className="text-[9px] font-bold text-red-600 hover:underline cursor-pointer"
                                    >
                                      {lang === "en" ? "Cert" : "Vyeti"}
                                    </span>
                                  )}
                                  {isExpanded ? <ChevronUp size={12} className="text-neutral-400" /> : <ChevronDown size={12} className="text-neutral-400" />}
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="border-t border-neutral-100 p-3 space-y-3 bg-neutral-50">
                                  {totalLessons > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-[9px] font-bold text-neutral-400 uppercase">{lang === "en" ? "Mark lessons complete" : "Weka alama za masomo"}</p>
                                      {item.lessons!.sort((a, b) => a.order - b.order).map((lsn, i) => {
                                        const done = enrollment?.completedLessonIds.includes(lsn.id) || false;
                                        return (
                                          <label key={lsn.id} className="flex items-center gap-2 text-[10px] text-neutral-700 cursor-pointer py-0.5">
                                            <input
                                              type="checkbox"
                                              checked={done}
                                              onChange={() => handleToggleLessonComplete(item, uid, lsn.id)}
                                              className="w-3.5 h-3.5 accent-red-600 cursor-pointer"
                                            />
                                            <span className={done ? "line-through text-neutral-400" : ""}>{i + 1}. {lsn.title}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      defaultValue={enrollment?.grade || ""}
                                      onChange={(e) => setGradeDrafts((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                                      placeholder={lang === "en" ? "Grade (e.g. A, Pass, 92%)" : "Daraja (mf. A, Pass, 92%)"}
                                      className="flex-1 bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-red-400"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveGrade(item, uid, gradeDrafts[rowKey] ?? enrollment?.grade ?? "")}
                                      className="bg-neutral-900 hover:bg-black text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer shrink-0"
                                    >
                                      {lang === "en" ? "Save Grade" : "Hifadhi"}
                                    </button>
                                  </div>
                                  {enrollment?.gradedBy && (
                                    <p className="text-[9px] text-neutral-400">
                                      {lang === "en" ? "Graded by" : "Aliyeweka daraja"} {enrollment.gradedBy}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
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
            <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
              {lang === "en" ? "Delivery Mode" : "Njia ya Kufundisha"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["in_person", "online", "hybrid"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDeliveryMode(mode)}
                  className={`text-[10px] font-bold py-2 rounded-lg border transition-colors cursor-pointer capitalize ${
                    deliveryMode === mode
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  {mode.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 bg-neutral-50 border border-neutral-200 rounded-xl p-3">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                {lang === "en" ? "Lessons (optional)" : "Masomo (si lazima)"}
              </label>
              <button
                type="button"
                onClick={() => setLessonDrafts([...lessonDrafts, { title: "", videoUrl: "", liveLink: "", liveDateTime: "" }])}
                className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <Plus size={11} /> {lang === "en" ? "Add lesson" : "Ongeza somo"}
              </button>
            </div>
            {lessonDrafts.length === 0 && (
              <p className="text-[10px] text-neutral-400 italic">
                {lang === "en" ? "Add lessons with a video link (recorded) and/or a live session link so members can access class content online." : "Ongeza masomo na kiungo cha video au kikao cha moja kwa moja ili wanachama wapate maudhui mtandaoni."}
              </p>
            )}
            {lessonDrafts.map((lsn, idx) => (
              <div key={idx} className="bg-white border border-neutral-200 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={lsn.title}
                    onChange={(e) => {
                      const updated = [...lessonDrafts];
                      updated[idx] = { ...updated[idx], title: e.target.value };
                      setLessonDrafts(updated);
                    }}
                    placeholder={lang === "en" ? `Lesson ${idx + 1} title` : `Kichwa cha somo ${idx + 1}`}
                    className="flex-1 bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                  <button
                    type="button"
                    onClick={() => setLessonDrafts(lessonDrafts.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-600 cursor-pointer p-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <input
                  type="url"
                  value={lsn.videoUrl}
                  onChange={(e) => {
                    const updated = [...lessonDrafts];
                    updated[idx] = { ...updated[idx], videoUrl: e.target.value };
                    setLessonDrafts(updated);
                  }}
                  placeholder={lang === "en" ? "Recorded video link (YouTube, Drive...)" : "Kiungo cha video (YouTube, Drive...)"}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-red-400"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="url"
                    value={lsn.liveLink}
                    onChange={(e) => {
                      const updated = [...lessonDrafts];
                      updated[idx] = { ...updated[idx], liveLink: e.target.value };
                      setLessonDrafts(updated);
                    }}
                    placeholder={lang === "en" ? "Live session link (Zoom, Meet...)" : "Kiungo cha moja kwa moja"}
                    className="bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                  <input
                    type="datetime-local"
                    value={lsn.liveDateTime}
                    onChange={(e) => {
                      const updated = [...lessonDrafts];
                      updated[idx] = { ...updated[idx], liveDateTime: e.target.value };
                      setLessonDrafts(updated);
                    }}
                    className="bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                </div>
              </div>
            ))}
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
