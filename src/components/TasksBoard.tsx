import React from "react";
import { CheckSquare, Plus, Clock, AlertCircle, CheckCircle2, User as UserIcon } from "lucide-react";
import { Task, TaskStatus, TaskPriority, ProgramArea, UserProfile } from "../types";

interface TasksBoardProps {
  lang: "en" | "sw";
  currentUser: UserProfile;
  canAssign: boolean; // leadership role — can create/assign tasks to others
  canReview: boolean; // tasks:edit — can approve/return submitted tasks, cancel tasks
}

const PROGRAM_AREA_LABELS: Record<ProgramArea, { en: string; sw: string }> = {
  gbv: { en: "GBV Awareness", sw: "Uhamasishaji GBV" },
  srhr: { en: "SRHR Awareness", sw: "Uhamasishaji SRHR" },
  mental_health: { en: "Mental Health", sw: "Afya ya Akili" },
  film_academy: { en: "Film Academy", sw: "Chuo cha Filamu" },
  taas: { en: "Theatre as a Service", sw: "Huduma za Tamthilia" },
  general: { en: "General / Admin", sw: "Jumla / Utawala" }
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-neutral-100 text-neutral-500 border-neutral-200"
};

function isOverdue(task: Task): boolean {
  if (task.status === "completed" || task.status === "cancelled" || !task.dueDate) return false;
  return new Date(task.dueDate) < new Date(new Date().toDateString());
}

export default function TasksBoard({ lang, currentUser, canAssign, canReview }: TasksBoardProps) {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [profiles, setProfiles] = React.useState<UserProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<"all" | TaskStatus>("all");

  // Form fields
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assignedToId, setAssignedToId] = React.useState("");
  const [priority, setPriority] = React.useState<TaskPriority>("medium");
  const [programArea, setProgramArea] = React.useState<ProgramArea>("general");
  const [dueDate, setDueDate] = React.useState("");

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [tRes, pRes] = await Promise.all([fetch("/api/tasks"), fetch("/api/profiles")]);
      if (tRes.ok) setTasks(await tRes.json());
      if (pRes.ok) setProfiles(await pRes.json());
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchAll(); }, []);

  const assignableMembers = profiles.filter(p =>
    (p.roleKey === "program_member" || p.roleKey === "volunteer" || p.role === "Program Member" || p.role === "Volunteer Staff")
    && p.id !== currentUser.id
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!title.trim() || !assignedToId) {
      setErrorMsg(lang === "en" ? "Title and assignee are required." : "Kichwa na aliyepewa jukumu vinahitajika.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, assignedToId, priority, programArea, dueDate })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create task");
      setTitle(""); setDescription(""); setAssignedToId(""); setPriority("medium"); setProgramArea("general"); setDueDate("");
      setShowForm(false);
      fetchAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (task: Task, status: TaskStatus) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update task");
      }
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const visibleTasks = filterStatus === "all" ? tasks : tasks.filter(t => t.status === filterStatus);
  const sortedTasks = [...visibleTasks].sort((a, b) => {
    const overdueDiff = Number(isOverdue(b)) - Number(isOverdue(a));
    if (overdueDiff !== 0) return overdueDiff;
    return (a.dueDate || "").localeCompare(b.dueDate || "");
  });

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
            <CheckSquare className="text-[#E31E24]" size={20} />
            {lang === "en" ? "Tasks & Action Items" : "Majukumu na Vitendo"}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {canAssign
              ? (lang === "en" ? "Assign follow-ups to members and volunteers and track them to done." : "Gawa majukumu kwa wanachama na wanaojitolea na ufuatilie hadi kukamilika.")
              : (lang === "en" ? "Tasks assigned to you by leadership, and tasks you've assigned." : "Majukumu uliyopewa na uongozi, na majukumu uliyogawa.")}
          </p>
        </div>
        {canAssign && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#E31E24] hover:bg-[#c21419] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={14} /> {lang === "en" ? "Assign Task" : "Gawa Jukumu"}
          </button>
        )}
      </div>

      {showForm && canAssign && (
        <form onSubmit={handleCreate} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-3">
          {errorMsg && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{errorMsg}</div>}
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Task Title" : "Kichwa cha Jukumu"} *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Description" : "Maelezo"}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Assign To" : "Mpe"} *</label>
              <select value={assignedToId} onChange={e => setAssignedToId(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs">
                <option value="">{lang === "en" ? "Select member/volunteer" : "Chagua mwanachama"}</option>
                {assignableMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Due Date" : "Tarehe ya Mwisho"}</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Priority" : "Kipaumbele"}</label>
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs">
                <option value="low">{lang === "en" ? "Low" : "Chini"}</option>
                <option value="medium">{lang === "en" ? "Medium" : "Wastani"}</option>
                <option value="high">{lang === "en" ? "High" : "Juu"}</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{lang === "en" ? "Program Area" : "Eneo la Mpango"}</label>
              <select value={programArea} onChange={e => setProgramArea(e.target.value as ProgramArea)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs">
                {(Object.keys(PROGRAM_AREA_LABELS) as ProgramArea[]).map(k => (
                  <option key={k} value={k}>{PROGRAM_AREA_LABELS[k][lang]}</option>
                ))}
              </select>
            </div>
          </div>
          <button disabled={submitting} className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
            {submitting ? (lang === "en" ? "Assigning..." : "Inagawa...") : (lang === "en" ? "Assign Task" : "Gawa Jukumu")}
          </button>
        </form>
      )}

      <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
        {(["all", "pending", "in_progress", "submitted", "blocked", "completed", "cancelled"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
              filterStatus === s ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400"
            }`}
          >
            {s === "all" ? (lang === "en" ? "All" : "Zote")
              : s === "pending" ? (lang === "en" ? "Pending" : "Inasubiri")
              : s === "in_progress" ? (lang === "en" ? "In Progress" : "Inaendelea")
              : s === "submitted" ? (lang === "en" ? "Awaiting Review" : "Inasubiri Ukaguzi")
              : s === "blocked" ? (lang === "en" ? "Blocked" : "Imezuiliwa")
              : s === "cancelled" ? (lang === "en" ? "Cancelled" : "Imeghairiwa")
              : (lang === "en" ? "Completed" : "Imekamilika")}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-neutral-500 py-6 text-center">{lang === "en" ? "Loading tasks..." : "Inapakia..."}</p>
      ) : sortedTasks.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-500 text-xs">
          {lang === "en" ? "No tasks found." : "Hakuna majukumu yaliyopatikana."}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map(task => {
            const overdue = isOverdue(task);
            return (
              <div key={task.id} className={`bg-white border rounded-xl p-4 shadow-sm ${overdue ? "border-red-300" : "border-neutral-200"}`}>
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-sm font-bold text-neutral-900">{task.title}</h4>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
                      <span className="text-[9px] font-mono text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">{PROGRAM_AREA_LABELS[task.programArea]?.[lang] || task.programArea}</span>
                      {overdue && (
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-600 text-white flex items-center gap-1">
                          <AlertCircle size={10} /> {lang === "en" ? "Overdue" : "Imechelewa"}
                        </span>
                      )}
                    </div>
                    {task.description && <p className="text-xs text-neutral-600 mb-2">{task.description}</p>}
                    <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-500">
                      <span className="flex items-center gap-1"><UserIcon size={11} /> {task.assignedToName}</span>
                      {task.dueDate && <span className="flex items-center gap-1"><Clock size={11} /> {task.dueDate}</span>}
                      <span>{lang === "en" ? "by" : "na"} {task.assignedByName}</span>
                    </div>
                  </div>

                  {task.assignedToId === currentUser.id && task.status !== "completed" && task.status !== "cancelled" && (
                    <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                      {task.status === "pending" && (
                        <button onClick={() => updateStatus(task, "in_progress")} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer">
                          {lang === "en" ? "Start" : "Anza"}
                        </button>
                      )}
                      {(task.status === "pending" || task.status === "in_progress") && (
                        <>
                          <button onClick={() => updateStatus(task, "blocked")} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 cursor-pointer">
                            {lang === "en" ? "Report Blocked" : "Ripoti Kizuizi"}
                          </button>
                          <button onClick={() => updateStatus(task, "submitted")} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer flex items-center gap-1">
                            <CheckCircle2 size={12} /> {lang === "en" ? "Submit for Review" : "Wasilisha Kwa Ukaguzi"}
                          </button>
                        </>
                      )}
                      {task.status === "blocked" && (
                        <button onClick={() => updateStatus(task, "in_progress")} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer">
                          {lang === "en" ? "Resume" : "Endelea"}
                        </button>
                      )}
                      {task.status === "submitted" && (
                        <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                          {lang === "en" ? "Awaiting review" : "Inasubiri ukaguzi"}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Reviewer controls — separate from the assignee's own controls above,
                      since it's entirely possible (e.g. a leader assigning to themselves)
                      for both to apply to the same task; each renders independently. */}
                  {canReview && task.status === "submitted" && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => updateStatus(task, "in_progress")} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 border border-neutral-200 hover:bg-neutral-200 cursor-pointer">
                        {lang === "en" ? "Return" : "Rudisha"}
                      </button>
                      <button onClick={() => updateStatus(task, "completed")} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer flex items-center gap-1">
                        <CheckCircle2 size={12} /> {lang === "en" ? "Approve" : "Idhinisha"}
                      </button>
                    </div>
                  )}
                  {canReview && (task.status === "pending" || task.status === "in_progress" || task.status === "blocked") && (
                    <button onClick={() => updateStatus(task, "cancelled")} className="text-[10px] font-bold px-2 py-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 cursor-pointer shrink-0">
                      {lang === "en" ? "Cancel" : "Ghairi"}
                    </button>
                  )}

                  {task.status === "completed" && (
                    <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shrink-0">
                      <CheckCircle2 size={12} /> {lang === "en" ? "Done" : "Imekamilika"}
                    </span>
                  )}
                  {task.status === "cancelled" && (
                    <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-500 border border-neutral-200 shrink-0">
                      {lang === "en" ? "Cancelled" : "Imeghairiwa"}
                    </span>
                  )}
                  {task.status === "blocked" && task.assignedToId !== currentUser.id && (
                    <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 shrink-0">
                      {lang === "en" ? "Blocked" : "Imezuiliwa"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
