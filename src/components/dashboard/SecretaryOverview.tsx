import React from "react";
import { Users, UserCheck, ClipboardList } from "lucide-react";
import { UserProfile, AttendanceSheet } from "../../types";
import StatCard from "./StatCard";

interface SecretaryOverviewProps {
  lang: "en" | "sw";
  profiles: UserProfile[];
  attendance: AttendanceSheet[];
}

export function getMemberAttendanceStats(memberId: string, attendance: AttendanceSheet[]) {
  let sessions = 0;
  let hours = 0;
  for (const sheet of attendance) {
    const record = sheet.records.find(r => r.userId === memberId);
    if (record && record.status === "present") {
      sessions += 1;
      hours += Number(record.volunteerHours) || 0;
    }
  }
  return { sessions, hours };
}

export default function SecretaryOverview({ lang, profiles, attendance }: SecretaryOverviewProps) {
  const activeMembers = profiles.filter(p => p.isActive).length;
  const totalSessionsLogged = attendance.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
      <StatCard
        label={lang === "en" ? "Registered members" : "Wanachama waliosajiliwa"}
        value={String(profiles.length)}
        icon={<Users size={17} />}
        accent="community"
      />
      <StatCard
        label={lang === "en" ? "Active members" : "Wanachama hai"}
        value={String(activeMembers)}
        icon={<UserCheck size={17} />}
        accent="community"
      />
      <StatCard
        label={lang === "en" ? "Sessions logged" : "Vikao vilivyorekodiwa"}
        value={String(totalSessionsLogged)}
        icon={<ClipboardList size={17} />}
        accent="neutral"
      />
    </div>
  );
}
