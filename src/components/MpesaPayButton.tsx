import React from "react";
import { Smartphone, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface MpesaPayButtonProps {
  lang: "en" | "sw";
  linkType: "contract_renewal";
  linkId: string;
  amount: number;
  defaultPhone?: string;
  onConfirmed?: () => void;
  /** Fired once when the flow discovers M-Pesa isn't configured for this org — lets
   *  the parent show a manual-payment fallback alongside this component's own notice. */
  onNotConfigured?: () => void;
  /** Shown in the "not configured" fallback message so members know exactly where to
   *  send money manually instead. */
  tillNumber?: string;
  businessName?: string;
}

type FlowState = "idle" | "entering_phone" | "initiating" | "waiting" | "success" | "failed" | "not_configured" | "error";

const t = {
  en: {
    payButton: "Pay with M-Pesa",
    phoneLabel: "M-Pesa phone number to receive the STK push prompt",
    phonePlaceholder: "e.g. 0712345678",
    sendPrompt: "Send Payment Prompt",
    cancel: "Cancel",
    initiating: "Sending prompt to your phone...",
    waiting: "Check your phone and enter your M-Pesa PIN to complete payment.",
    waitingSub: "This page updates automatically — no need to refresh.",
    success: "Payment confirmed! Thank you.",
    failed: "Payment was not completed.",
    tryAgain: "Try Again",
    notConfigured: "M-Pesa payments aren't set up for this organization yet. Please use the manual transaction code option below instead.",
    error: "Something went wrong starting the payment. Please try again or use the manual option below.",
    invalidPhone: "Please enter a valid Kenyan phone number (e.g. 0712345678 or 254712345678)."
  },
  sw: {
    payButton: "Lipa na M-Pesa",
    phoneLabel: "Nambari ya M-Pesa itakayopokea ombi la kulipa",
    phonePlaceholder: "mfano 0712345678",
    sendPrompt: "Tuma Ombi la Malipo",
    cancel: "Ghairi",
    initiating: "Inatuma ombi kwa simu yako...",
    waiting: "Angalia simu yako na uweke PIN yako ya M-Pesa kukamilisha malipo.",
    waitingSub: "Ukurasa huu unasasishwa moja kwa moja — hakuna haja ya kuonyesha upya.",
    success: "Malipo yamethibitishwa! Asante.",
    failed: "Malipo hayakukamilika.",
    tryAgain: "Jaribu Tena",
    notConfigured: "Malipo ya M-Pesa bado hayajawekwa kwa shirika hili. Tafadhali tumia chaguo la kuweka nambari ya muamala kwa mkono hapo chini.",
    error: "Hitilafu imetokea kuanzisha malipo. Tafadhali jaribu tena au tumia chaguo la mkono hapo chini.",
    invalidPhone: "Tafadhali weka nambari sahihi ya simu ya Kenya (mfano 0712345678 au 254712345678)."
  }
};

export default function MpesaPayButton({ lang, linkType, linkId, amount, defaultPhone, onConfirmed, onNotConfigured, tillNumber, businessName }: MpesaPayButtonProps) {
  const tt = t[lang];
  const [state, setState] = React.useState<FlowState>("idle");
  const [phone, setPhone] = React.useState(defaultPhone || "");
  const [transactionId, setTransactionId] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState("");
  const pollRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, []);

  React.useEffect(() => {
    if (state === "not_configured" && onNotConfigured) onNotConfigured();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const startPolling = (txId: string) => {
    let attempts = 0;
    pollRef.current = window.setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/payments/status/${txId}`, { credentials: "include" });
        const data = await res.json();
        if (data.status === "success") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setState("success");
          onConfirmed?.();
        } else if (data.status === "failed") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setState("failed");
        }
        // status === "pending" — keep polling
      } catch {
        // transient network hiccup — keep polling rather than failing the whole flow
      }
      // Give up politely after ~2 minutes (Daraja prompts expire around then anyway)
      if (attempts > 40) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setState("failed");
        setErrorMsg(lang === "en" ? "No confirmation received in time." : "Hakuna uthibitisho uliopokelewa kwa wakati.");
      }
    }, 3000);
  };

  const handleSendPrompt = async () => {
    const digits = phone.replace(/[^\d]/g, "");
    const valid = /^(254[17]\d{8}|0[17]\d{8}|[17]\d{8})$/.test(digits);
    if (!valid) {
      setErrorMsg(tt.invalidPhone);
      return;
    }
    setErrorMsg("");
    setState("initiating");
    try {
      const res = await fetch("/api/payments/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkType, linkId, phone: digits, amount })
      });
      const data = await res.json();
      if (res.status === 503) {
        setState("not_configured");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate payment");
      }
      setTransactionId(data.transactionId);
      setState("waiting");
      startPolling(data.transactionId);
    } catch (err: any) {
      setErrorMsg(err.message || tt.error);
      setState("error");
    }
  };

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={() => setState("entering_phone")}
        className="w-full bg-[#00A651] hover:bg-[#008a44] text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
      >
        <Smartphone size={14} /> {tt.payButton} (Ksh {amount.toLocaleString()})
      </button>
    );
  }

  if (state === "entering_phone") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
        <label className="block text-[10px] font-bold uppercase text-emerald-700 tracking-wider">{tt.phoneLabel}</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={tt.phonePlaceholder}
          className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
        />
        {errorMsg && <p role="alert" className="text-[11px] text-red-600 flex items-center gap-1"><AlertCircle size={11} /> {errorMsg}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setState("idle")}
            className="flex-1 px-3 py-2 border border-neutral-200 text-xs font-semibold rounded-lg text-neutral-600 hover:bg-white cursor-pointer"
          >
            {tt.cancel}
          </button>
          <button
            type="button"
            onClick={handleSendPrompt}
            className="flex-1 px-3 py-2 bg-[#00A651] hover:bg-[#008a44] text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            {tt.sendPrompt}
          </button>
        </div>
      </div>
    );
  }

  if (state === "initiating" || state === "waiting") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
        <Loader2 size={16} className="text-emerald-600 animate-spin shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-emerald-800">{state === "initiating" ? tt.initiating : tt.waiting}</p>
          {state === "waiting" && <p className="text-[10px] text-emerald-600 mt-1">{tt.waitingSub}</p>}
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2 text-emerald-700">
        <CheckCircle2 size={16} /> <span className="text-xs font-bold">{tt.success}</span>
      </div>
    );
  }

  if (state === "not_configured") {
    return (
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex items-start gap-2">
        <AlertCircle size={14} className="text-neutral-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-[11px] text-neutral-500">{tt.notConfigured}</p>
          {tillNumber && (
            <p className="text-xs font-bold text-neutral-700 font-mono bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 inline-block">
              {lang === "en" ? "Pay to Till No." : "Lipa kwa Till Na."} {tillNumber} — {businessName || "Bashosho Talents CBO"}
            </p>
          )}
        </div>
      </div>
    );
  }

  // failed / error
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
      <p className="text-xs font-bold text-red-700 flex items-center gap-1.5"><XCircle size={14} /> {state === "failed" ? tt.failed : tt.error}</p>
      {errorMsg && <p role="alert" className="text-[10px] text-red-500">{errorMsg}</p>}
      <button
        type="button"
        onClick={() => { setState("entering_phone"); setErrorMsg(""); }}
        className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
      >
        {tt.tryAgain}
      </button>
    </div>
  );
}
