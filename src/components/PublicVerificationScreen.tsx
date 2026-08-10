import React from "react";
import { Check, X } from "lucide-react";
import BashoshoLogo from "./BashoshoLogo";

interface VerificationResult {
  verified: boolean;
  type: string;
  name?: string;
  role?: string;
  status?: string;
  className?: string;
  invoiceNumber?: string;
  amount?: string | number;
  orgName?: string;
  error?: string;
  appointeeName?: string;
  termStart?: string;
  termEnd?: string;
  title?: string;
  docType?: string;
  author?: string;
  date?: string;
  recipientName?: string;
  tier?: string;
  hoursAtIssue?: number;
  issuedDate?: string;
  assetName?: string;
  assetCategory?: string;
  assetSerial?: string;
  assetCondition?: string;
  assetCustodian?: string;
  eventTitle?: string;
  eventType?: string;
  eventVenue?: string;
  eventDate?: string;
  attendeeCount?: number;
  approvalStatus?: string;
  eventName?: string;
  paymentDate?: string;
  payeeCount?: number;
  totalAmount?: number;
}

export default function PublicVerificationScreen({ path }: { path: string }) {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<VerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Parse path: /verify/:type/:id
  const parts = path.split("/").filter(Boolean); // ["verify", "type", "id"]
  const type = parts[1];
  const id = parts[2];

  React.useEffect(() => {
    if (!type || !id) {
      setErrorMsg("Invalid verification link format.");
      setLoading(false);
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("t");

    if (!token) {
      setErrorMsg("Missing digital verification signature.");
      setLoading(false);
      return;
    }

    // Call the public unauthenticated verification endpoint
    fetch(`/api/verify/${type}/${id}?t=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.verified) {
          setResult(data);
        } else {
          setErrorMsg(data.error || "This document could not be cryptographically verified.");
        }
      })
      .catch((err) => {
        console.error("Verification error:", err);
        setErrorMsg("Failed to connect to verification server. Please check your connection.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [type, id]);

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col justify-between p-6">
      {/* Top Brand Block */}
      <header className="flex flex-col items-center pt-8">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border border-red-500 shadow-md">
          <BashoshoLogo size={44} showText={false} />
        </div>
        <h1 className="mt-4 text-lg font-bold uppercase tracking-wider text-red-500 font-sans">
          Bashosho Talents CBO
        </h1>
        <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest mt-1">
          Official Digital Registry
        </p>
      </header>

      {/* Main Validation Frame */}
      <main className="flex-grow flex items-center justify-center my-8">
        <div className="w-full max-w-md bg-neutral-800 border border-neutral-700/60 rounded-2xl p-8 shadow-xl text-center space-y-6">
          {loading ? (
            <div className="space-y-4 py-8">
              <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-mono text-neutral-400">Performing Cryptographic Signature Check...</p>
            </div>
          ) : errorMsg ? (
            <div className="space-y-6 py-4">
              <div className="w-16 h-16 bg-red-500/10 border-2 border-red-500/30 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold font-sans text-red-500 uppercase tracking-wide">
                  Verification Failed
                </h2>
                <p className="text-xs text-neutral-300 leading-relaxed font-mono px-4">
                  {errorMsg}
                </p>
              </div>
              <p className="text-[10px] text-neutral-500 font-sans leading-normal">
                If you believe this is a system error, please contact the issuing community administrator directly.
              </p>
            </div>
          ) : result && result.verified ? (
            <div className="space-y-6">
              <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <Check className="w-8 h-8 text-emerald-500" />
              </div>
              
              <div className="space-y-1">
                <h2 className="text-xl font-black font-sans text-emerald-500 uppercase tracking-wide">
                  Document Verified
                </h2>
                <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                  Authentic Community Record
                </p>
              </div>

              {/* Safe Fields Display */}
              <div className="border-t border-b border-neutral-700/50 py-4 my-2 text-left space-y-3 font-sans text-xs">
                {result.type === "membership" && (
                  <>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Verified Holder</span>
                      <span className="font-bold text-neutral-100">{result.name}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Assigned Role</span>
                      <span className="font-semibold text-red-400 uppercase">{result.role}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-neutral-400 font-medium">Status</span>
                      <span className="font-mono font-bold text-emerald-400 uppercase">{result.status}</span>
                    </div>
                  </>
                )}

                {result.type === "class_certificate" && (
                  <>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Program Name</span>
                      <span className="font-bold text-neutral-100">{result.className}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-neutral-400 font-medium">Issuing CBO</span>
                      <span className="font-semibold text-neutral-100">{result.orgName}</span>
                    </div>
                  </>
                )}

                {result.type === "invoice" && (
                  <>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Invoice Number</span>
                      <span className="font-mono font-bold text-neutral-100">{result.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Certified Amount</span>
                      <span className="font-mono font-bold text-neutral-100">Ksh {Number(result?.amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-neutral-400 font-medium">Payment Status</span>
                      <span className="font-bold uppercase text-amber-500" style={{ color: result.status === "paid" ? "#10B981" : "#F59E0B" }}>
                        {result.status}
                      </span>
                    </div>
                  </>
                )}

                {result.type === "leadership_appointment" && (
                  <>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Appointed Leader</span>
                      <span className="font-bold text-neutral-100">{result.appointeeName}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Leadership Position</span>
                      <span className="font-semibold text-red-400 uppercase">{result.role}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Term Start Date</span>
                      <span className="font-mono text-neutral-100">{result.termStart}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-neutral-400 font-medium">Term End Date</span>
                      <span className="font-mono text-neutral-100">{result.termEnd || "Indefinite / Open-ended"}</span>
                    </div>
                  </>
                )}

                {result.type === "document" && (
                  <>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Document Title</span>
                      <span className="font-bold text-neutral-100">{result.title}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Type</span>
                      <span className="font-semibold text-red-400 uppercase">{result.docType}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Author</span>
                      <span className="font-mono text-neutral-100">{result.author}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-neutral-400 font-medium">Date</span>
                      <span className="font-mono text-neutral-100">{result.date}</span>
                    </div>
                  </>
                )}

                {result.type === "volunteer_certificate" && (
                  <>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Recipient</span>
                      <span className="font-bold text-neutral-100">{result.recipientName}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Recognition Tier</span>
                      <span className="font-semibold text-red-400 uppercase">{result.tier}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Hours of Service</span>
                      <span className="font-mono text-neutral-100">{result.hoursAtIssue} Hrs</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-neutral-400 font-medium">Issued Date</span>
                      <span className="font-mono text-neutral-100">{result.issuedDate}</span>
                    </div>
                  </>
                )}

                {result.type === "asset" && (
                  <>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Asset Name</span>
                      <span className="font-bold text-neutral-100">{result.assetName}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Category</span>
                      <span className="font-semibold text-red-400 uppercase">{result.assetCategory}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Serial Number</span>
                      <span className="font-mono text-neutral-100">{result.assetSerial}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Condition</span>
                      <span className="font-mono text-neutral-100 uppercase">{result.assetCondition}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-neutral-400 font-medium">Current Custodian</span>
                      <span className="font-mono text-neutral-100">{result.assetCustodian}</span>
                    </div>
                  </>
                )}

                {result.type === "attendance_register" && (
                  <>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Event</span>
                      <span className="font-bold text-neutral-100">{result.eventTitle}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Type</span>
                      <span className="font-semibold text-red-400 uppercase">{result.eventType}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Venue</span>
                      <span className="font-mono text-neutral-100">{result.eventVenue}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Date</span>
                      <span className="font-mono text-neutral-100">{result.eventDate}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Attendees Recorded</span>
                      <span className="font-mono text-neutral-100">{result.attendeeCount}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-neutral-400 font-medium">Approval Status</span>
                      <span className="font-mono text-neutral-100 uppercase">{result.approvalStatus}</span>
                    </div>
                  </>
                )}

                {result.type === "cast_payment_list" && (
                  <>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Event</span>
                      <span className="font-bold text-neutral-100">{result.eventName}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Payment Date</span>
                      <span className="font-mono text-neutral-100">{result.paymentDate}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Payees</span>
                      <span className="font-mono text-neutral-100">{result.payeeCount}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-neutral-700/30 pb-2">
                      <span className="text-neutral-400 font-medium">Total Amount</span>
                      <span className="font-mono text-neutral-100">Ksh {result.totalAmount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-neutral-400 font-medium">Approval Status</span>
                      <span className="font-mono text-neutral-100 uppercase">{result.approvalStatus}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Digital Signature Verification Badge */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3 text-left my-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-emerald-300 font-sans">
                    Digital Signature Verified
                  </p>
                  <p className="text-[9px] font-mono text-neutral-400">
                    Signed & Sealed by CBO Executive Leadership (Chairperson / Secretary)
                  </p>
                </div>
              </div>

              <div className="text-[10px] text-neutral-400 font-sans leading-normal">
                This verification check was authorized and logged by the <strong className="text-neutral-300">{result.orgName}</strong> server.
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="text-center text-[10px] text-neutral-500 font-mono py-4 border-t border-neutral-800/50">
        <p>Bashosho OS Cryptographic Signature & Verification Protocol.</p>
        <p className="mt-1">Kiambiu Youth Mental Health, Gender-Based Violence & SRHR Advocacy Campaign.</p>
      </footer>
    </div>
  );
}
