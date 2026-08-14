import React from "react";
import { CalendarClock, GraduationCap, Timer, Palmtree, FileText } from "lucide-react";
import { StorageService } from "../../lib/storage";
import StatCard from "./StatCard";
import NotificationFeed, { NotificationItem } from "./NotificationFeed";
import QuickActions, { QuickAction } from "./QuickActions";

interface ProgramsDirectorOverviewProps {
  lang: "en" | "sw";
  onNavigateToTab: (tab: string) => void;
}

// Matches the fixed system reference date used elsewhere in this app (see
// ChairpersonOverview / getDaysPending in Dashboard.tsx) so figures stay stable.
const SYSTEM_DATE = new Date();

export default function ProgramsDirectorOverview({ lang, onNavigateToTab }: ProgramsDirectorOverviewProps) {
  const classes = StorageService.getClasses();
  const attendance = StorageService.getAttendance();
  const leaveRequests = StorageService.getLeaveRequests();

  const activeClasses = classes.filter(c => {
    const end = new Date(c.endDate);
    return isNaN(end.getTime()) || end.getTime() >= SYSTEM_DATE.getTime();
  }).length;

  const upcomingRehearsals = attendance
    .filter(a => a.type === "rehearsal" && new Date(a.date).getTime() >= SYSTEM_DATE.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalVolunteerHours = attendance.reduce((sum, sheet) => {
    return sum + sheet.records.reduce((s, r) => s + (Number(r.volunteerHours) || 0), 0);
  }, 0);

  const untranscribedSheets = attendance.filter(a => !a.isTranscribed).length;
  const pendingLeave = leaveRequests.filter(l => l.status === "pending").length;

  const notifications: NotificationItem[] = [
    {
      id: "leave",
      label: lang === "en" ? "Leave requests pending your review" : "Maombi ya likizo yanayosubiri ukaguzi wako",
      count: pendingLeave,
      icon: <Palmtree size={15} />,
      onClick: () => onNavigateToTab("dashboard")
    },
    {
      id: "untranscribed",
      label: lang === "en" ? "Attendance sheets not yet transcribed" : "Fomu za mahudhurio hazijaandikwa",
      count: untranscribedSheets,
      icon: <FileText size={15} />,
      onClick: () => onNavigateToTab("dashboard")
    }
  ];

  const quickActions: QuickAction[] = [
    { id: "classes", label: lang === "en" ? "Manage classes" : "Simamia madarasa", icon: <GraduationCap size={15} />, onClick: () => onNavigateToTab("classes") }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label={lang === "en" ? "Upcoming rehearsals" : "Mazoezi yajayo"}
          value={String(upcomingRehearsals.length)}
          icon={<CalendarClock size={17} />}
          accent="community"
        />
        <StatCard
          label={lang === "en" ? "Active classes" : "Madarasa hai"}
          value={String(activeClasses)}
          icon={<GraduationCap size={17} />}
          accent="community"
          onClick={() => onNavigateToTab("classes")}
        />
        <StatCard
          label={lang === "en" ? "Total volunteer hours" : "Jumla ya saa za kujitolea"}
          value={`${totalVolunteerHours.toFixed(1)} hrs`}
          icon={<Timer size={17} />}
          accent="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-200 mb-2">{lang === "en" ? "Needs your attention" : "Inahitaji uangalifu wako"}</p>
          <NotificationFeed items={notifications} lang={lang} />
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-200 mb-2">{lang === "en" ? "Quick actions" : "Vitendo vya haraka"}</p>
          <QuickActions actions={quickActions} />
        </div>
      </div>
    </div>
  );
}
