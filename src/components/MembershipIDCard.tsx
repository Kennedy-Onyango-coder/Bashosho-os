import React from "react";
import { UserProfile, UserRole, getUserRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import BashoshoLogo from "./BashoshoLogo";
import QRCode from "qrcode";
import Modal from "./Modal";

interface IDCardProps {
  key?: any;
  member: UserProfile;
  onVerify?: (member: UserProfile) => void;
}

function getMonogramAvatar(name: string, id: string): string {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name.slice(0, 2)).toUpperCase();

  let hash = 0;
  for (let i = 0; i < (id || name).length; i++) {
    hash = (hash << 5) - hash + (id || name).charCodeAt(i);
    hash |= 0;
  }
  const bgHex = Math.abs(hash) % 2 === 0 ? "E31E24" : "00A651";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="180" viewBox="0 0 150 180"><rect width="150" height="180" fill="%23${bgHex}"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="%23FFFFFF" font-family="sans-serif" font-size="52" font-weight="bold">${initials}</text></svg>`;

  return `data:image/svg+xml;utf8,${svg}`;
}

export default function MembershipIDCard({ member, onVerify }: IDCardProps) {
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [qrDataUrl, setQrDataUrl] = React.useState("");

  // AI Member Bio Draft states
  const [bioDraft, setBioDraft] = React.useState<string | null>(null);
  const [isAiDrafting, setIsAiDrafting] = React.useState(false);

  // Fetch Org Settings & Chairperson Profile
  const orgSettings = StorageService.getOrgSettings();
  const users = StorageService.getUsers();
  const chairperson = users.find((u) => getUserRoleKey(u) === UserRole.CHAIRPERSON);
  const chairpersonName = chairperson?.name || "Evans Omondi (Chairperson)";

  // Validity period calculation
  const contractRenewals = StorageService.getContractRenewals();
  const myRenewal = contractRenewals.find(
    (r) => (r.userId === member.id || r.userName === member.name) && r.status === "approved"
  );

  const validFrom =
    member.validFrom || myRenewal?.submissionDate || member.joinDate || new Date().toISOString().split("T")[0];

  let validUntil = member.validUntil || myRenewal?.expiryDate;
  if (!validUntil && validFrom) {
    const d = new Date(validFrom);
    d.setMonth(d.getMonth() + 12);
    validUntil = d.toISOString().split("T")[0];
  } else if (!validUntil) {
    const d = new Date();
    d.setMonth(d.getMonth() + 12);
    validUntil = d.toISOString().split("T")[0];
  }

  // Prefer the server-computed real-time lock state (accounts for any Chairperson
  // grace extension too) — only fall back to a plain date comparison if that field
  // hasn't loaded onto this profile yet.
  const isExpired = member.contractLocked ?? (new Date(validUntil).getTime() < new Date().getTime());

  // Avatar URL - deterministic monogram fallback
  const photoUrl = member.avatar || getMonogramAvatar(member.name, member.id || member.memberNumber);

  const handleGenerateAiBio = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAiDrafting(true);
    try {
      const res = await fetch("/api/document_templates/generate_draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Member Name: ${member.name}
Role: ${member.role}
Member Number: ${member.memberNumber}
Join Date: ${member.joinDate}
Status: ${member.status}
Valid Until: ${validUntil}
Generate formal CBO membership citation and endorsement bio for official profile and ID background records.`,
          docType: "membership_bio",
          title: `Membership Bio Citation - ${member.name}`
        })
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setBioDraft(data.draft);
      } else {
        throw new Error(data.error || "Failed to generate bio draft.");
      }
    } catch (err: any) {
      alert("AI Bio Draft failed: " + err.message);
    } finally {
      setIsAiDrafting(false);
    }
  };

  React.useEffect(() => {
    // Only ever encode the server-computed, cryptographically signed verificationUrl
    // (see /api/verify/:type/:id) — never a locally-guessed link. A guessed link would
    // render a QR code that looks legitimate but fails verification when scanned, which
    // is worse than honestly showing "QR unavailable" until the real one loads.
    if (member.verificationUrl) {
      QRCode.toDataURL(member.verificationUrl, { margin: 1, width: 160 })
        .then(setQrDataUrl)
        .catch((err) => console.error("Failed to generate QR Code:", err));
    } else {
      setQrDataUrl("");
    }
  }, [member.verificationUrl]);

  const handlePrintCard = (e: React.MouseEvent) => {
    e.stopPropagation();
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const printedPhotoUrl = photoUrl;
    const printedQrUrl = qrDataUrl || "";
    const safeguardingInfo = orgSettings.safeguardingContact || "Safeguarding Officer: +254 798 132 410";
    const conductSummary = orgSettings.codeOfConduct || "1. Treat all members with respect. 2. Zero tolerance for harassment/SGBV. 3. Protect CBO equipment and uphold transparency.";

    printWindow.document.write(`
      <html>
        <head>
          <title>ID Card Print - ${member.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 20px;
              min-height: 100vh;
              margin: 0;
              background-color: #f3f4f6;
              padding: 20px;
            }
            .print-grid {
              display: flex;
              gap: 20px;
              flex-wrap: wrap;
              justify-content: center;
            }
            .card-container {
              width: 335px;
              height: 215px;
              border: ${isExpired ? "2px solid #f59e0b" : "1px solid #d1d5db"};
              border-radius: 12px;
              background: #ffffff;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              position: relative;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header-bar {
              background-color: #E31E24;
              color: white;
              padding: 6px 10px;
              display: flex;
              align-items: center;
              gap: 8px;
              border-bottom: 3px solid #00A651;
            }
            .title-org {
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.5px;
              margin: 0;
              text-transform: uppercase;
            }
            .subtitle-org {
              font-size: 7px;
              font-weight: 500;
              margin: 0;
              opacity: 0.9;
            }
            .card-body {
              padding: 10px;
              display: flex;
              gap: 10px;
              flex-grow: 1;
              z-index: 1;
            }
            .photo-box {
              width: 70px;
              height: 85px;
              background-color: #e5e7eb;
              border-radius: 6px;
              border: 1.5px solid #d1d5db;
              overflow: hidden;
              flex-shrink: 0;
            }
            .photo-box img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .info-box {
              flex-grow: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            .member-name {
              font-size: 12px;
              font-weight: 700;
              color: #111827;
              margin: 0 0 1px 0;
            }
            .member-role {
              font-size: 8.5px;
              font-weight: 700;
              color: #E31E24;
              margin: 0 0 4px 0;
              text-transform: uppercase;
            }
            .meta-grid {
              display: grid;
              grid-template-cols: auto 1fr;
              gap: 2px 6px;
              font-size: 7.5px;
            }
            .meta-label {
              font-weight: 600;
              color: #6b7280;
            }
            .meta-value {
              font-weight: 700;
              color: #1f2937;
            }
            .qr-code-area {
              position: absolute;
              bottom: 18px;
              right: 10px;
              width: 44px;
              height: 44px;
              border: 1px solid #e5e7eb;
              border-radius: 4px;
              padding: 1px;
              z-index: 2;
              background: white;
            }
            .auth-line {
              font-size: 6px;
              color: #4b5563;
              font-weight: 600;
              margin-top: 4px;
              border-top: 1px dashed #d1d5db;
              padding-top: 2px;
            }
            .footer-strip {
              background-color: #1f2937;
              color: #d1d5db;
              font-size: 6px;
              text-align: center;
              padding: 3.5px 4px;
              font-family: monospace;
              z-index: 1;
              display: flex;
              justify-content: space-between;
            }
            .back-body {
              padding: 10px;
              font-size: 7.5px;
              color: #374151;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              height: 100%;
            }
            .expired-badge {
              position: absolute;
              top: 6px;
              right: 8px;
              background-color: #f59e0b;
              color: white;
              font-size: 6.5px;
              font-weight: 800;
              padding: 1px 4px;
              border-radius: 3px;
              text-transform: uppercase;
            }
            @media print {
              body {
                background: none;
                padding: 0;
              }
              .card-container {
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div style="font-size: 11px; font-weight: bold; color: #374151; margin-bottom: -10px;">
            BASHOSHO TALENTS CBO — OFFICIAL MEMBER ID BADGE (FRONT & BACK)
          </div>
          <div class="print-grid">
            <!-- FRONT SIDE -->
            <div class="card-container">
              ${isExpired ? `<div class="expired-badge">EXPIRED / RENEWAL DUE</div>` : ""}
              <div class="header-bar">
                <div style="width: 24px; height: 24px; background: white; border-radius: 50%; padding: 1px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                  <svg viewBox="0 0 400 400" width="100%" height="100%">
                    <circle cx="200" cy="200" r="190" stroke="#E31E24" stroke-width="20" fill="none"/>
                    <circle cx="200" cy="200" r="170" stroke="#00A651" stroke-width="15" fill="none"/>
                    <circle cx="200" cy="115" r="30" fill="#E31E24" />
                    <path d="M200 135 C175 160 155 110 135 110 C155 130 170 190 200 245 C230 190 245 130 265 110 C245 110 225 160 200 135 Z" fill="#E31E24" />
                  </svg>
                </div>
                <div>
                  <h1 class="title-org">Bashosho Talents CBO</h1>
                  <p class="subtitle-org">Connecting Youths Through Talents</p>
                </div>
              </div>
              <div class="card-body">
                <div class="photo-box">
                  <img src="${printedPhotoUrl}" alt="${member.name}" />
                </div>
                <div class="info-box">
                  <h2 class="member-name">${member.name}</h2>
                  <p class="member-role">${member.role}</p>
                  <div class="meta-grid">
                    <span class="meta-label">MEMBER ID:</span>
                    <span class="meta-value">${member.memberNumber}</span>
                    <span class="meta-label">VALID UNTIL:</span>
                    <span class="meta-value" style="color: ${isExpired ? "#d97706" : "#00A651"};">${validUntil}</span>
                    <span class="meta-label">STATUS:</span>
                    <span class="meta-value" style="color: ${isExpired ? "#dc2626" : "#00A651"};">${isExpired ? "EXPIRED" : member.status.toUpperCase()}</span>
                  </div>
                  <div class="auth-line">
                    Auth: ${chairpersonName}
                  </div>
                </div>
              </div>
              <div class="qr-code-area" style="display: flex; align-items: center; justify-content: center; text-align: center; font-size: 6px; color: #4b5563;">
                ${printedQrUrl ? `<img src="${printedQrUrl}" alt="QR Code" style="width: 100%; height: 100%; object-fit: contain;" />` : `QR`}
              </div>
              <div class="footer-strip">
                <span>${orgSettings.registrationNumber}</span>
                <span>Report concern: ${safeguardingInfo}</span>
              </div>
            </div>

            <!-- BACK SIDE -->
            <div class="card-container">
              <div class="header-bar" style="background-color: #1f2937; border-bottom: 3px solid #E31E24;">
                <div>
                  <h1 class="title-org">CODE OF CONDUCT & TERMS</h1>
                  <p class="subtitle-org">Bashosho Talents CBO Bylaws Summary</p>
                </div>
              </div>
              <div class="back-body">
                <div style="space-y: 4px;">
                  <strong style="color: #111827; font-size: 8px; display: block; margin-bottom: 3px;">MEMBER CODE SUMMARY:</strong>
                  <div style="font-size: 7px; line-height: 1.3; color: #4b5563; background: #f9fafb; padding: 6px; border-radius: 4px; border: 1px solid #e5e7eb;">
                    ${conductSummary.slice(0, 260)}${conductSummary.length > 260 ? "..." : ""}
                  </div>
                </div>

                <div style="font-size: 6.5px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 4px; space-y: 2px;">
                  <div><strong>Return Address:</strong> If found, please return to ${orgSettings.physicalAddress || "Community Center, Kiambiu"} (${orgSettings.emailAndPhone || "Cell: +254 798 132 410"})</div>
                  <div style="color: #9ca3af; font-style: italic; margin-top: 2px;">This card remains property of Bashosho Talents CBO and must be surrendered upon membership exit.</div>
                </div>
              </div>
              <div class="footer-strip">
                <span>KIAMBIU COMMUNITY ADVOCACY</span>
                <span>VERIFICATION PORTAL AVAILABLE ONLINE</span>
              </div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div
      onClick={() => onVerify?.(member)}
      id={`member-id-card-${member.id}`}
      className={`w-full max-w-sm mx-auto bg-white border ${
        isExpired ? "border-amber-500 ring-2 ring-amber-400/50" : "border-gray-200"
      } rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group relative flex flex-col justify-between`}
      style={{ height: "245px" }}
    >
      {/* Expiry Warning Ribbon */}
      {isExpired && (
        <div className="bg-amber-500 text-white text-[8px] font-extrabold uppercase tracking-wider py-0.5 px-3 text-center z-20 flex justify-between items-center">
          <span>️ MEMBERSHIP EXPIRED / RENEWAL DUE</span>
          <span className="font-mono">VALID UNTIL: {validUntil}</span>
        </div>
      )}

      {/* Subtle Logo Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none select-none z-0">
        <BashoshoLogo size={145} showText={false} />
      </div>

      {!isFlipped ? (
        /* FRONT OF CARD */
        <>
          {/* Upper Color Ribbons */}
          <div className="bg-[#E31E24] px-4 py-2 flex items-center justify-between border-b-2 border-[#00A651] z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center border border-red-500 overflow-hidden flex-shrink-0">
                <BashoshoLogo size={24} showText={false} />
              </div>
              <div className="text-left">
                <h3 className="text-[11px] font-extrabold text-white tracking-wide uppercase leading-none">
                  BASHOSHO TALENTS CBO
                </h3>
                <p className="text-[7px] font-semibold text-red-100 tracking-wider font-mono uppercase mt-0.5">
                  Connecting Youths Through Talents
                </p>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(true);
              }}
              title="Flip to back of card"
              className="bg-red-800 hover:bg-red-900 text-white text-[8px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1 border border-red-600"
            >
               Flip
            </button>
          </div>

          {/* Card Body */}
          <div className="p-3.5 flex gap-3.5 flex-grow items-center z-10">
            {/* Avatar Area */}
            <div className="w-20 h-24 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform flex items-center justify-center">
              <img
                src={photoUrl}
                alt={member.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Info Area */}
            <div className="flex-grow text-left space-y-0.5 pr-10">
              <h4 className="text-xs font-black text-[#1B1B1B] leading-tight truncate max-w-[170px]">
                {member.name}
              </h4>
              <span className="inline-block text-[8.5px] font-extrabold text-[#E31E24] uppercase tracking-wide">
                {member.role}
              </span>

              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1 text-[8.5px]">
                <div>
                  <span className="block text-neutral-500 font-medium text-[7.5px]">MEMBER ID</span>
                  <span className="font-bold text-neutral-700 font-mono text-[8.5px]">{member.memberNumber}</span>
                </div>
                <div>
                  <span className="block text-neutral-500 font-medium text-[7.5px]">VALID UNTIL</span>
                  <span className={`font-bold font-mono text-[8.5px] ${isExpired ? "text-amber-600" : "text-[#00A651]"}`}>
                    {validUntil}
                  </span>
                </div>
                <div>
                  <span className="block text-neutral-500 font-medium text-[7.5px]">STATUS</span>
                  <span className={`font-bold uppercase font-mono text-[8.5px] ${isExpired ? "text-red-600" : "text-[#00A651]"}`}>{isExpired ? "Expired" : member.status}</span>
                </div>
                <div>
                  <span className="block text-neutral-500 font-medium text-[7.5px]">EMERGENCY</span>
                  <span className="font-semibold text-neutral-700 truncate block max-w-[85px]" title={member.emergencyContact?.name || "N/A"}>
                    {member.emergencyContact?.name || "N/A"}
                  </span>
                </div>
              </div>

              <div className="pt-1.5 border-t border-dashed border-gray-200 text-[7px] text-gray-500 font-medium">
                Issued & Authorized by Chairperson: <span className="font-bold text-gray-800">{chairpersonName}</span>
              </div>
            </div>
          </div>

          {/* QR Code Anchor */}
          <div className="absolute bottom-7 right-3 flex flex-col items-center">
            {qrDataUrl ? (
              <>
                <div className="w-11 h-11 bg-white border border-gray-200 p-0.5 rounded flex items-center justify-center z-10 shadow-xs">
                  <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                </div>
                <span className="text-[5.5px] font-mono font-bold text-neutral-500 mt-0.5 tracking-wider uppercase">
                  VERIFY QR
                </span>
              </>
            ) : (
              <div className="w-11 h-11 bg-gray-50 border border-gray-200 p-1 rounded flex items-center justify-center text-center z-10">
                <span className="text-[5px] font-sans font-semibold text-neutral-500 leading-tight">
                  QR...
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        /* BACK OF CARD */
        <div className="flex-grow flex flex-col justify-between p-3.5 text-left z-10">
          <div className="space-y-2">
            <div className="flex justify-between items-center border-b pb-1.5">
              <div>
                <h4 className="text-[10px] font-black text-neutral-900 uppercase">
                  CODE OF CONDUCT & TERMS
                </h4>
                <p className="text-[7px] text-neutral-500 font-mono">
                  {orgSettings.registrationNumber}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(false);
                }}
                className="bg-neutral-800 hover:bg-neutral-900 text-white text-[8px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                 Front
              </button>
            </div>

            <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200 text-[8px] text-neutral-700 leading-relaxed font-sans max-h-[105px] overflow-y-auto">
              <strong className="block text-[8.5px] font-bold text-neutral-900 mb-0.5">Summary of Bylaws:</strong>
              <p className="whitespace-pre-line text-[7.5px] text-neutral-600">
                {orgSettings.codeOfConduct || "1. Respect and integrity across all CBO forums.\n2. Zero tolerance for discrimination or SGBV.\n3. Transparent custody of CBO assets."}
              </p>
            </div>
          </div>

          <div className="space-y-1 pt-1 border-t border-neutral-200 text-[7px] text-neutral-500">
            <p>
              <strong className="text-neutral-700">Return If Found:</strong> {orgSettings.physicalAddress || "Community Center Hall, Kiambiu"} ({orgSettings.emailAndPhone})
            </p>
            <p className="text-[6.5px] text-neutral-500 italic">
              This card remains property of Bashosho Talents CBO and must be surrendered on membership exit.
            </p>
          </div>
        </div>
      )}

      {/* Base Badge Footer */}
      <div className="bg-[#1B1B1B] py-1 px-3 flex justify-between items-center text-[6.5px] text-neutral-300 font-mono tracking-wider z-10">
        <span className="truncate max-w-[200px]" title={`Safeguarding: ${orgSettings.safeguardingContact || "Officer: +254 798 132 410"}`}>
          Safeguarding: {orgSettings.safeguardingContact || "Officer: +254 798 132 410"}
        </span>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={handleGenerateAiBio}
            disabled={isAiDrafting}
            className="bg-purple-900 hover:bg-purple-800 text-purple-200 font-sans text-[7px] font-bold px-1.5 py-0.5 rounded cursor-pointer uppercase transition-colors"
          >
            {isAiDrafting ? " Drafting..." : " AI Bio"}
          </button>
          <button
            onClick={handlePrintCard}
            id={`print-id-card-btn-${member.id}`}
            className="bg-[#E31E24] hover:bg-[#c91a1f] text-white font-sans text-[7px] font-bold px-1.5 py-0.5 rounded cursor-pointer uppercase transition-colors"
          >
            Print Card
          </button>
        </div>
      </div>

      {/* AI Member Bio Draft Modal */}
      <Modal
        isOpen={bioDraft !== null}
        onClose={() => setBioDraft(null)}
        title={`Official Member Bio Citation — ${member.name}`}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-neutral-500">
            Editable AI-generated official citation and membership profile statement for Bashosho records:
          </p>
          <textarea
            value={bioDraft || ""}
            onChange={(e) => setBioDraft(e.target.value)}
            rows={8}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs text-neutral-800 font-serif leading-relaxed focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setBioDraft(null)}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
