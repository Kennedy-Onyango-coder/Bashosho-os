import React from "react";
import { AlertTriangle, Users, CheckCircle2, XCircle } from "lucide-react";
import { ContractRenewal } from "../../types";

interface MembershipPaymentsWidgetProps {
  lang: "en" | "sw";
}

// Member/leadership payment tracking ("Lipa Pole Pole" contract renewal fees) —
// fetched directly here, live, on every mount, specifically so this never suffers the
// stale-cache bug found elsewhere in the app: a member's payment claim shows up here
// the moment it's submitted. Shared between ChairpersonOverview and TreasurerOverview
// — both roles are actually authorized to confirm these claims server-side, and both
// are reasonable places someone would look for "where do I approve a payment".
export default function MembershipPaymentsWidget({ lang }: MembershipPaymentsWidgetProps) {
  const [renewals, setRenewals] = React.useState<ContractRenewal[]>([]);
  const [decidingClaimId, setDecidingClaimId] = React.useState<string | null>(null);

  const fetchRenewals = React.useCallback(async () => {
    try {
      const res = await fetch("/api/contract_renewals");
      if (res.ok) setRenewals(await res.json());
    } catch (err) {
      console.error("Failed to load contract renewals for payment tracking:", err);
    }
  }, []);

  React.useEffect(() => { fetchRenewals(); }, [fetchRenewals]);

  const decideClaim = async (renewalId: string, claimId: string, action: "confirm" | "reject") => {
    setDecidingClaimId(claimId);
    try {
      const res = await fetch(`/api/contract_renewals/${renewalId}/manual_claims/${claimId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      let data: any = {};
      const text = await res.text();
      try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
      if (!res.ok) {
        const userMsg = data?.message || data?.error || (lang === "en" ? "Failed to process claim" : "Imeshindwa kuchakata madai");
        const code = data?.code ? ` (${data.code})` : "";
        const ref = data?.referenceId ? `\nReference: ${data.referenceId}` : "";
        throw new Error(`${userMsg}${code}${ref}`);
      }
      await fetchRenewals();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDecidingClaimId(null);
    }
  };

  const pendingClaims = renewals.flatMap(r =>
    (r.pendingManualClaims || [])
      .filter(c => c.status === "pending")
      .map(c => ({ renewal: r, claim: c }))
  );

  const amountPaidOn = (r: ContractRenewal) => (r.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);

  if (renewals.length === 0 && pendingClaims.length === 0) return null;

  return (
    <>
      {pendingClaims.length > 0 && (
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-red-600" />
            {lang === "en" ? "Payment claims awaiting your verification" : "Madai ya malipo yanayosubiri uthibitisho"}
          </p>
          <div className="space-y-2">
            {pendingClaims.map(({ renewal, claim }) => (
              <div key={claim.id} className="flex items-center justify-between gap-3 bg-red-50/40 border border-red-100 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-neutral-800 truncate">{renewal.userName} <span className="font-normal text-neutral-500">({renewal.userRole})</span></p>
                  <p className="text-[10px] font-mono text-neutral-500">
                    KSh {claim.amount.toLocaleString()} — {claim.transactionCode} — {claim.claimedDate}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => decideClaim(renewal.id, claim.id, "confirm")}
                    disabled={decidingClaimId === claim.id}
                    className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 size={12} /> {lang === "en" ? "Confirm" : "Thibitisha"}
                  </button>
                  <button
                    onClick={() => decideClaim(renewal.id, claim.id, "reject")}
                    disabled={decidingClaimId === claim.id}
                    className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle size={12} /> {lang === "en" ? "Reject" : "Kataa"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {renewals.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-1.5">
            <Users size={15} className="text-neutral-500" />
            {lang === "en" ? "Membership fee payment status — live" : "Hali ya malipo ya uanachama — moja kwa moja"}
          </p>
          <div className="space-y-1.5">
            {renewals
              .slice()
              .sort((a, b) => (a.paymentStatus === "paid" ? 1 : 0) - (b.paymentStatus === "paid" ? 1 : 0))
              .map(r => {
                const paid = amountPaidOn(r);
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-neutral-100 last:border-0">
                    <span className="font-medium text-neutral-700 truncate">{r.userName} <span className="text-neutral-400 font-normal">({r.userRole})</span></span>
                    <span className={`font-mono font-bold shrink-0 ${
                      r.paymentStatus === "paid" ? "text-emerald-600" : r.paymentStatus === "exempt" ? "text-neutral-400" : "text-amber-600"
                    }`}>
                      {r.paymentStatus === "exempt" ? (lang === "en" ? "Exempt" : "Msamaha") : `KSh ${paid.toLocaleString()} / ${r.feeRequired.toLocaleString()}`}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </>
  );
}
