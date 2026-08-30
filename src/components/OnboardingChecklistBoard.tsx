import React from "react";
import { ListChecks, Check } from "lucide-react";
import { OnboardingChecklist } from "../types";

interface OnboardingChecklistBoardProps {
  lang: "en" | "sw";
}

export default function OnboardingChecklistBoard({ lang }: OnboardingChecklistBoardProps) {
  const [checklists, setChecklists] = React.useState<OnboardingChecklist[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCompleted, setShowCompleted] = React.useState(false);

  const fetchChecklists = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/onboarding_checklists");
      if (res.ok) setChecklists(await res.json());
    } catch (err) {
      console.error("Failed to load onboarding checklists:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchChecklists(); }, []);

  const toggleStep = async (checklistId: string, stepId: string) => {
    try {
      const res = await fetch(`/api/onboarding_checklists/${checklistId}/toggle_step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId })
      });
      if (!res.ok) throw new Error("Failed to update step");
      fetchChecklists();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const isFullyDone = (c: OnboardingChecklist) => c.steps.every(s => s.completed);
  const visibleChecklists = [...checklists]
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
    .filter(c => showCompleted || !isFullyDone(c));

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
            <ListChecks className="text-[#E31E24]" size={20} />
            {lang === "en" ? "New Member Onboarding" : "Kuanzisha Wanachama Wapya"}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {lang === "en" ? "Automatically created when a signup is approved — track each step through to done." : "Inaundwa moja kwa moja mwanachama anapokubaliwa — fuatilia hatua kila moja."}
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 cursor-pointer">
          <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
          {lang === "en" ? "Show fully completed" : "Onyesha zilizokamilika"}
        </label>
      </div>

      {loading ? (
        <p className="text-xs text-neutral-500 py-10 text-center">{lang === "en" ? "Loading..." : "Inapakia..."}</p>
      ) : visibleChecklists.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-500 text-xs">
          {lang === "en" ? "No onboarding checklists to show." : "Hakuna orodha za kuanzisha."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleChecklists.map(c => {
            const doneCount = c.steps.filter(s => s.completed).length;
            const pct = Math.round((doneCount / c.steps.length) * 100);
            return (
              <div key={c.id} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-neutral-900">{c.userName}</h4>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${pct === 100 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    {doneCount}/{c.steps.length}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="space-y-1.5">
                  {c.steps.map(s => (
                    <label key={s.id} className="flex items-start gap-2 cursor-pointer group">
                      <button
                        onClick={() => toggleStep(c.id, s.id)}
                        className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${s.completed ? "bg-emerald-500 border-emerald-500" : "border-neutral-300 group-hover:border-emerald-400"}`}
                      >
                        {s.completed && <Check size={11} className="text-white" />}
                      </button>
                      <span className={`text-xs ${s.completed ? "text-neutral-500 line-through" : "text-neutral-700"}`}>
                        {s.label}
                        {s.completed && s.completedBy && <span className="text-[9px] text-neutral-300 font-mono block">{s.completedDate} · {s.completedBy}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
