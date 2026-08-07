import React from "react";
import { Handshake, Clock3, CalendarCheck } from "lucide-react";
import { Partner, BudgetEngagement } from "../../types";
import StatCard from "./StatCard";

interface ViceChairpersonOverviewProps {
  lang: "en" | "sw";
  partners: Partner[];
  budgets: BudgetEngagement[];
}

export default function ViceChairpersonOverview({ lang, partners, budgets }: ViceChairpersonOverviewProps) {
  // "Pending follow-up" previously showed a hardcoded 2 with no underlying data. This is a
  // real (if approximate) proxy: partners still earlier in the pipeline than "confirmed"
  // genuinely do need a follow-up. The per-partner "last contact / next follow-up" dates
  // shown further down this page are still hardcoded placeholders, not wired to real data
  // yet \u2014 that's a separate, larger CRM feature, flagged but out of scope for this pass.
  const pendingFollowUps = partners.filter(p => p.pipelineStage === "contacted" || p.pipelineStage === "negotiating").length;
  const upcomingEngagements = budgets.filter(b => b.status === "approved").length;

  return (
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
  );
}
