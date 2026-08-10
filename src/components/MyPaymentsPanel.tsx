import React from "react";
import { Wallet, Calendar, TrendingDown, Award } from "lucide-react";

interface MyPaymentEntry {
  listId: string;
  listTitle: string;
  eventName: string;
  date: string;
  role?: string;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  deductionRate: number;
}

interface MyPaymentsPanelProps {
  lang: "en" | "sw";
}

export default function MyPaymentsPanel({ lang }: MyPaymentsPanelProps) {
  const [payments, setPayments] = React.useState<MyPaymentEntry[]>([]);
  const [stats, setStats] = React.useState({ activitiesPaidFor: 0, totalGross: 0, totalDeducted: 0, totalNet: 0 });
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/my_payments");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setPayments(data.payments || []);
            setStats({
              activitiesPaidFor: data.activitiesPaidFor || 0,
              totalGross: data.totalGross || 0,
              totalDeducted: data.totalDeducted || 0,
              totalNet: data.totalNet || 0
            });
          }
        }
      } catch (err) {
        console.error("Failed to load payment history:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!loading && payments.length === 0) return null; // nothing to show yet — don't clutter the dashboard

  const visiblePayments = expanded ? payments : payments.slice(0, 3);

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
          <Wallet className="text-[#E31E24]" size={18} />
          {lang === "en" ? "My Payments" : "Malipo Yangu"}
        </h3>
      </div>

      {loading ? (
        <p className="text-xs text-neutral-400 text-center py-3">{lang === "en" ? "Loading..." : "Inapakia..."}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-neutral-50 rounded-xl p-3 text-center">
              <p className="text-lg font-black font-mono text-neutral-900">{stats.activitiesPaidFor}</p>
              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">{lang === "en" ? "Activities Paid For" : "Shughuli"}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-lg font-black font-mono text-emerald-700">Ksh {stats.totalNet.toLocaleString()}</p>
              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">{lang === "en" ? "Total Received" : "Jumla Uliopokea"}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-lg font-black font-mono text-purple-700">Ksh {stats.totalDeducted.toLocaleString()}</p>
              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">{lang === "en" ? "Membership Fund" : "Mfuko wa Uanachama"}</p>
            </div>
          </div>

          <div className="space-y-2">
            {visiblePayments.map((p, idx) => (
              <div key={`${p.listId}-${idx}`} className="flex items-center justify-between bg-neutral-50 border border-neutral-150 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-neutral-800 truncate">{p.eventName}</p>
                  <p className="text-[10px] font-mono text-neutral-400 flex items-center gap-1">
                    <Calendar size={10} /> {p.date} {p.role && `· ${p.role}`}
                  </p>
                </div>
                <div className="text-right shrink-0 pl-3">
                  <p className="text-xs font-bold text-emerald-700 font-mono">Ksh {p.netAmount.toLocaleString()}</p>
                  {p.deductionAmount > 0 && (
                    <p className="text-[9px] text-purple-500 font-mono flex items-center gap-0.5 justify-end">
                      <TrendingDown size={9} /> -{p.deductionAmount.toLocaleString()} ({p.deductionRate}%)
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {payments.length > 3 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] font-bold text-[#E31E24] hover:underline cursor-pointer"
            >
              {expanded ? (lang === "en" ? "Show less" : "Onyesha kidogo") : (lang === "en" ? `Show all ${payments.length} payments` : `Onyesha malipo yote ${payments.length}`)}
            </button>
          )}

          {stats.totalDeducted > 0 && (
            <p className="text-[9px] text-neutral-400 border-t border-neutral-100 pt-2 flex items-center gap-1">
              <Award size={10} className="text-purple-400" />
              {lang === "en"
                ? "Membership fund deductions go toward Bashosho Talents CBO's own development and are recorded in the Financial Ledger."
                : "Makato ya mfuko wa uanachama yanaenda kwa maendeleo ya Bashosho Talents CBO na yamerekodiwa katika Daftari la Fedha."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
