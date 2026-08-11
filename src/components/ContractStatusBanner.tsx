import React from "react";
import { Lock, Clock, FileSignature } from "lucide-react";

interface ContractStatusBannerProps {
  lang: "en" | "sw";
  onGoToRenewals: () => void;
}

export default function ContractStatusBanner({ lang, onGoToRenewals }: ContractStatusBannerProps) {
  const [status, setStatus] = React.useState<{ locked: boolean; paymentWindowOpen: boolean; daysUntilDue: number; dueDate: string; activeCycleRenewal: any; lastApprovedRenewal: any } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/my_contract_status")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (!cancelled && data) setStatus(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!status) return null;

  const neverSigned = !status.activeCycleRenewal && !status.lastApprovedRenewal;

  // Nothing to show: not locked, not within the payment window, no in-progress
  // submission, and they've signed a contract before — their contract is simply fine
  // for now. A member who has NEVER signed a contract always sees this, regardless of
  // due-date math, since that's their mandatory first signing, not a renewal reminder.
  if (!status.locked && !status.paymentWindowOpen && !status.activeCycleRenewal && !neverSigned) return null;

  if (status.locked) {
    return (
      <button
        onClick={onGoToRenewals}
        className="w-full bg-red-600 hover:bg-red-700 text-white rounded-2xl p-4 shadow-md flex items-center gap-3 text-left cursor-pointer transition-colors"
      >
        <Lock size={20} className="shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-black">{lang === "en" ? "Contract Lapsed — Renew Now" : "Mkataba Umeisha — Rejesha Sasa"}</p>
          <p className="text-xs text-red-50">
            {lang === "en" ? `Expired ${status.dueDate}. Tap here to renew or check your payment status.` : `Uliisha ${status.dueDate}. Bonyeza hapa kurejesha.`}
          </p>
        </div>
      </button>
    );
  }

  const paid = status.activeCycleRenewal ? (status.activeCycleRenewal.payments || []).reduce((s: number, p: any) => s + p.amount, 0) : 0;

  return (
    <button
      onClick={onGoToRenewals}
      className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-2xl p-4 shadow-2xs flex items-center gap-3 text-left cursor-pointer transition-colors"
    >
      {status.activeCycleRenewal ? <FileSignature size={20} className="shrink-0 text-amber-600" /> : <Clock size={20} className="shrink-0 text-amber-600" />}
      <div className="flex-1">
        <p className="text-sm font-black">
          {status.activeCycleRenewal
            ? (lang === "en" ? "Contract Submitted — Continue Payment" : "Mkataba Umewasilishwa — Endelea na Malipo")
            : neverSigned
              ? (lang === "en" ? "Sign Your Membership Contract" : "Saini Mkataba wa Uanachama")
              : (lang === "en" ? "Contract Renewal Due Soon" : "Mkataba Unahitaji Kurejeshwa Hivi Karibuni")}
        </p>
        <p className="text-xs text-amber-700">
          {status.activeCycleRenewal
            ? (lang === "en" ? `Ksh ${paid.toLocaleString()} paid so far — tap to pay the rest (Lipa Pole Pole) or check review status.` : `Ksh ${paid.toLocaleString()} zimelipwa — bonyeza kulipa iliyobaki.`)
            : neverSigned
              ? (lang === "en" ? "Every member must read and sign the annual membership contract. Tap here to get started." : "Kila mwanachama lazima asome na kusaini mkataba wa mwaka. Bonyeza hapa kuanza.")
              : (lang === "en" ? `Due ${status.dueDate} (${status.daysUntilDue} days left). Tap here to sign and start paying any time before then.` : `Mwisho ${status.dueDate} (siku ${status.daysUntilDue}). Bonyeza kusaini na kuanza kulipa.`)}
        </p>
      </div>
    </button>
  );
}
