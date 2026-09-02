import React from "react";
import { Handshake, Clock3, CalendarCheck } from "lucide-react";
import { Partner, BudgetEngagement } from "../../types";
import StatCard from "./StatCard";
import MembershipPaymentsWidget from "./MembershipPaymentsWidget";

interface ViceChairpersonOverviewProps {
  lang: "en" | "sw";
  partners: Partner[];
  budgets: BudgetEngagement[];
}

export default function ViceChairpersonOverview({ lang, partners, budgets }: ViceChairpersonOverviewProps) {
  // Real, not a proxy: counts partners whose next follow-up date has actually arrived
  // or passed, using the real contact-log data now wired up in the Partner CRM below.
  const today = new Date().toISOString().split("T")[0];
  const pendingFollowUps = partners.filter(p => p.nextFollowUpDate && p.nextFollowUpDate <= today).length;
  const upcomingEngagements = budgets.filter(b => b.status === "approved").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label={lang === "en" ? "Active partners" : "Wadau hai"}
          value={String(partners.length)}
          icon={<Handshake size={17} />}
          accent="community"
        />
        <StatCard
          label={lang === "en" ? "Pending follow-ups" : "Ufuatiliaji unaohitajika"}
          value={String(pendingFollowUps)}
          icon={<Clock3 size={17} />}
          accent={pendingFollowUps > 0 ? "danger" : "finance"}
        />
        <StatCard
          label={lang === "en" ? "Upcoming engagements" : "Miradi inayokuja"}
          value={String(upcomingEngagements)}
          icon={<CalendarCheck size={17} />}
          accent="neutral"
        />
      </div>
      <MembershipPaymentsWidget lang={lang} />
    </div>
  );
}
