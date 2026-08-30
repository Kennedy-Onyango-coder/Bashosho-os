import React from "react";
import BashoshoLogo from "./BashoshoLogo";
import { StorageService } from "../lib/storage";
import QRCode from "qrcode";

interface PrintWrapperProps {
  title: string;
  docType?: string;
  children: React.ReactNode;
  authorName?: string;
  authorRole?: string;
  authorSignatureUrl?: string;
  dateString?: string;
  verificationUrl?: string; // Real verification URL including the token
  watermarkText?: string;
}

export default function PrintWrapper({
  title,
  docType = "DOCUMENT",
  children,
  authorName = "Bashosho Talents CBO",
  authorRole = "",
  authorSignatureUrl,
  dateString = new Date().toLocaleDateString("en-KE"),
  verificationUrl,
  watermarkText
}: PrintWrapperProps) {
  const handlePrint = () => {
    window.print();
  };

  const [qrDataUrl, setQrDataUrl] = React.useState("");

  React.useEffect(() => {
    if (verificationUrl) {
      QRCode.toDataURL(verificationUrl, { margin: 1, width: 160 })
        .then(setQrDataUrl)
        .catch((err) => {
          console.error("Failed to generate QR Code:", err);
          setQrDataUrl("");
        });
    } else {
      setQrDataUrl("");
    }
  }, [verificationUrl]);

  const settings = StorageService.getOrgSettings();

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden max-w-4xl mx-auto my-4">
      {/* Action bar for screen - hidden during print */}
      <div className="bg-neutral-50 px-6 py-3 border-b border-neutral-200 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-mono font-semibold text-neutral-600 uppercase tracking-wider">
            {docType} PREVIEW
          </span>
        </div>
        <button
          onClick={handlePrint}
          id="print-trigger-btn"
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
          Print Official PDF
        </button>
      </div>

      {/* The Printable Page with Letterhead */}
      <div id="printable-cbo-page" className="p-10 relative bg-white min-h-[11in] text-neutral-800 font-serif">
        
        {/* Subtle Watermark - Only visible on clean prints/displays */}
        {watermarkText ? (
          <div 
            className="absolute inset-0 pointer-events-none select-none z-0" 
            style={{
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'><text fill='rgba(0,0,0,0.035)' font-size='12' font-family='sans-serif' font-weight='900' x='150' y='100' text-anchor='middle' transform='rotate(-25 150 100)'>${encodeURIComponent(watermarkText)}</text></svg>")`,
              backgroundRepeat: "repeat",
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none z-0">
            <BashoshoLogo size={380} showText={false} />
          </div>
        )}

        {/* Letterhead Header Section */}
        <div className="relative pb-5 mb-6">
          <div className="flex justify-between items-start pb-5">
            {/* Logo Crest */}
            <div className="flex-shrink-0">
              <BashoshoLogo size={110} showText={false} />
            </div>

            {/* Org Details */}
            <div className="text-right flex-grow pl-6">
              <p className="text-neutral-500 font-mono text-[9px] font-bold uppercase tracking-[0.2em] mb-1">
                Official Community Record
              </p>
              <h1 className="text-red-600 text-3xl font-bold tracking-tight uppercase leading-tight font-sans">
                {settings.name}
              </h1>
              <p className="text-neutral-500 font-mono text-[10px] font-semibold uppercase tracking-wider leading-none mt-1">
                {settings.missionText}
              </p>
              <p className="text-neutral-500 font-sans text-xs font-medium mt-1 leading-tight">
                {settings.registrationNumber}
              </p>
              <div className="text-neutral-600 font-sans text-[11px] mt-2 space-y-0.5 leading-tight">
                <p>{settings.contactDetails}</p>
                <p>{settings.physicalAddress}</p>
                <p>{settings.emailAndPhone}</p>
              </div>
            </div>
          </div>
          {/* Two-tone brand accent bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] flex">
            <div className="flex-1 bg-red-600" />
            <div className="flex-1 bg-[#00A651]" />
          </div>
        </div>

        {/* Document Title / Meta */}
        <div className="flex justify-between items-baseline mb-6 border-b border-neutral-150 pb-2">
          <div>
            <span className="text-[10px] font-mono font-bold text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5 uppercase">
              {docType}
            </span>
            <h2 className="text-xl font-bold text-neutral-900 mt-2 font-sans">{title}</h2>
          </div>
          <div className="text-right font-sans text-xs text-neutral-500">
            <p><strong>Date:</strong> {dateString}</p>
            {verificationUrl && (
              <p className="mt-1 text-[9px] font-mono text-emerald-600"> Cryptographically Secured</p>
            )}
          </div>
        </div>

        {/* Core Document Content */}
        <div className="prose max-w-none text-neutral-800 text-sm leading-relaxed min-h-[5in] font-serif">
          {children}
        </div>

        {/* Official Sign-off Footer */}
        <div className="mt-12 pt-8 border-t border-neutral-200 grid grid-cols-2 gap-8 font-sans text-xs">
          <div>
            <p className="text-neutral-500 uppercase tracking-wider font-mono text-[9px] mb-8">
              Prepared By:
            </p>
            <div className="border-b border-neutral-300 w-48 mb-1"></div>
            <p className="font-semibold text-neutral-800">{authorName}</p>
            <p className="text-neutral-500">{authorRole}</p>
          </div>

          <div className="flex flex-col items-end">
            <p className="text-neutral-500 uppercase tracking-wider font-mono text-[9px] mb-2 w-48 text-left">
              Authorized Sign-off:
            </p>
            <div className="w-48 text-left relative my-1 min-h-[2.5rem] flex items-end">
              {authorSignatureUrl ? (
                <img
                  src={authorSignatureUrl}
                  alt={`${authorName} signature`}
                  className="max-h-10 max-w-[9rem] object-contain object-left-bottom"
                />
              ) : (
                <span className="text-[9px] font-mono text-neutral-500 italic pb-1">
                  Awaiting uploaded signature
                </span>
              )}
            </div>
            <div className="border-b border-neutral-300 w-48 mb-1"></div>
            <div className="w-48 text-left">
              <p className="font-semibold text-neutral-800">{authorName}</p>
              {authorRole && <p className="text-neutral-500">{authorRole}, Bashosho Talents CBO</p>}
            </div>
          </div>
        </div>

        {/* Bottom Small Print Notice */}
        <div className="mt-12 text-center text-[10px] font-mono text-neutral-500">
          <p>This is an officially generated Bashosho OS record. Verified secure by community guidelines.</p>
          <p className="mt-0.5">Kiambiu Youth Mental Health, Gender-Based Violence & SRHR Advocacy Campaign.</p>
        </div>

        {/* Real QR Code Badge */}
        {verificationUrl && qrDataUrl ? (
          <div className="absolute bottom-16 right-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-neutral-50 border border-neutral-200 p-1 rounded flex items-center justify-center">
              <img src={qrDataUrl} alt="Verification QR code" className="w-full h-full object-contain" />
            </div>
            <span className="text-[8px] font-mono font-semibold text-neutral-500 mt-1 uppercase tracking-wider">
              SCAN TO VERIFY
            </span>
          </div>
        ) : (
          <div className="absolute bottom-16 right-10 w-44 bg-neutral-50 border border-neutral-200 p-2 rounded flex items-center justify-center text-center">
            <span className="text-[8px] font-sans font-semibold text-neutral-500 leading-tight">
              QR unavailable — reconnect and reopen to generate a verifiable code
            </span>
          </div>
        )}
      </div>

      {/* Embedded CSS for print rules */}
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Hide non-print structures */
          header, footer, nav, sidebar, aside, #print-trigger-btn, .demo-role-selector-header, .print\\:hidden {
            display: none !important;
          }
          #root {
            padding: 0 !important;
            margin: 0 !important;
          }
          #printable-cbo-page {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            position: relative !important;
            min-height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
