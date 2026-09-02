// Pure M&E aggregation functions — extracted out of MEDashboardBoard.tsx for the same
// reason financialCalculations.ts and taskAuthorization.ts exist: real business logic
// deserves a standalone regression test, not just "it rendered correctly once."
//
// A subtle bug here (double-counting, wrong period boundary, NaN propagating from a
// malformed record) would silently misreport real program reach to donors — exactly
// the kind of thing worth protecting.

export interface MESessionLike {
  date: string;
  participantsReached: number;
  maleCount: number;
  femaleCount: number;
  childrenCount: number;
  location: string;
  facilitators: string;
  programArea: string;
}

export type MEPeriod = "all" | "this_year" | "this_month";

/** Filters sessions to a period, relative to a supplied reference date (never
 * `new Date()` directly inside this function, so behavior is deterministic and
 * testable rather than depending on when the test happens to run). A session with an
 * unparseable date is only included under "all", never silently included in a
 * specific year/month it can't actually be verified to belong to. */
export function filterSessionsByPeriod<T extends MESessionLike>(
  sessions: T[],
  period: MEPeriod,
  referenceDate: Date
): T[] {
  return sessions.filter(s => {
    const d = new Date(s.date);
    if (isNaN(d.getTime())) return period === "all";
    if (period === "this_year") return d.getFullYear() === referenceDate.getFullYear();
    if (period === "this_month") return d.getFullYear() === referenceDate.getFullYear() && d.getMonth() === referenceDate.getMonth();
    return true;
  });
}

export interface MESummary {
  totalSessions: number;
  totalParticipants: number;
  totalMale: number;
  totalFemale: number;
  totalChildren: number;
  uniqueLocationCount: number;
  uniqueFacilitatorCount: number;
}

/** Every number here is a straight, defensive sum of logged fields — a malformed or
 * missing numeric field (NaN, undefined, a stray string) contributes 0, never NaN,
 * so one bad record can't silently zero out or corrupt the whole dashboard's totals. */
export function computeMESummary<T extends MESessionLike>(sessions: T[]): MESummary {
  const totalParticipants = sessions.reduce((s, r) => s + (Number(r.participantsReached) || 0), 0);
  const totalMale = sessions.reduce((s, r) => s + (Number(r.maleCount) || 0), 0);
  const totalFemale = sessions.reduce((s, r) => s + (Number(r.femaleCount) || 0), 0);
  const totalChildren = sessions.reduce((s, r) => s + (Number(r.childrenCount) || 0), 0);
  const uniqueLocations = new Set(sessions.map(r => (r.location || "").trim().toLowerCase()).filter(Boolean));
  const uniqueFacilitators = new Set(
    sessions.flatMap(r => (r.facilitators || "").split(",").map(f => f.trim().toLowerCase()).filter(Boolean))
  );
  return {
    totalSessions: sessions.length,
    totalParticipants,
    totalMale,
    totalFemale,
    totalChildren,
    uniqueLocationCount: uniqueLocations.size,
    uniqueFacilitatorCount: uniqueFacilitators.size
  };
}

export interface MEAreaBreakdown {
  area: string;
  sessions: number;
  participants: number;
}

/** Participants reached grouped by program area, sorted by reach descending, with
 * areas that had zero sessions in the given set omitted entirely rather than shown
 * as a misleading zero-height bar. */
export function computeByProgramArea<T extends MESessionLike>(sessions: T[], areaKeys: string[]): MEAreaBreakdown[] {
  return areaKeys
    .map(area => {
      const rows = sessions.filter(r => r.programArea === area);
      return {
        area,
        sessions: rows.length,
        participants: rows.reduce((s, r) => s + (Number(r.participantsReached) || 0), 0)
      };
    })
    .filter(a => a.sessions > 0)
    .sort((a, b) => b.participants - a.participants);
}
