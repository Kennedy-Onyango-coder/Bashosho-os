import React from "react";
import { UserProfile, UserRole, getUserRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import BashoshoLogo from "./BashoshoLogo";

interface IDCardPrintLayoutProps {
  member: UserProfile;
  qrDataUrl: string;
  photoUrl: string;
}

// Standard CR-80 card size (the size of a bank card / most ID cards): 85.6mm x 53.98mm.
// Printing at true size means a laminator or card cutter can use it as-is.
const CARD_WIDTH_MM = 85.6;
const CARD_HEIGHT_MM = 53.98;

export default function IDCardPrintLayout({ member, qrDataUrl, photoUrl }: IDCardPrintLayoutProps) {
  const orgSettings = StorageService.getOrgSettings();
  const users = StorageService.getUsers();
  const chairperson = users.find((u) => getUserRoleKey(u) === UserRole.CHAIRPERSON);
  const chairpersonName = chairperson?.name || orgSettings.name;

  const contractRenewals = StorageService.getContractRenewals();
  const myRenewal = contractRenewals.find(
    (r) => (r.userId === member.id || r.userName === member.name) && r.status === "approved"
  );
  const validFrom = member.validFrom || myRenewal?.submissionDate || member.joinDate || new Date().toISOString().split("T")[0];
  let validUntil = member.validUntil || myRenewal?.expiryDate;
  if (!validUntil) {
    const d = new Date(validFrom);
    d.setMonth(d.getMonth() + 6);
    validUntil = d.toISOString().split("T")[0];
  }

  const cardStyle: React.CSSProperties = {
    width: `${CARD_WIDTH_MM}mm`,
    height: `${CARD_HEIGHT_MM}mm`,
    position: "relative",
    overflow: "hidden",
    background: "#ffffff",
    border: "0.3mm solid #d1d5db",
    borderRadius: "3mm",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box"
  };

  return (
    <div style={{ display: "flex", gap: "6mm", padding: "6mm", background: "#f3f4f6" }}>
      {/* FRONT */}
      <div style={cardStyle}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.04, pointerEvents: "none" }}>
          <BashoshoLogo size={130} showText={false} />
        </div>
        <div style={{ background: "#E31E24", color: "white", padding: "2.2mm 3mm", display: "flex", alignItems: "center", gap: "2mm", borderBottom: "0.8mm solid #00A651" }}>
          <div style={{ width: "6mm", height: "6mm", background: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BashoshoLogo size={16} showText={false} />
          </div>
          <div>
            <p style={{ fontSize: "2.6mm", fontWeight: 800, margin: 0, letterSpacing: "0.3px", textTransform: "uppercase", lineHeight: 1 }}>
              {orgSettings.name || "Bashosho Talents CBO"}
            </p>
            <p style={{ fontSize: "1.6mm", fontWeight: 600, margin: 0, opacity: 0.9, marginTop: "0.4mm" }}>
              {orgSettings.missionText || "Connecting Youths Through Talents"}
            </p>
          </div>
        </div>

        <div style={{ padding: "2.5mm 3mm", display: "flex", gap: "2.5mm", flexGrow: 1, position: "relative" }}>
          <div style={{ width: "16mm", height: "20mm", background: "#e5e7eb", borderRadius: "1.5mm", border: "0.3mm solid #d1d5db", overflow: "hidden", flexShrink: 0 }}>
            <img src={photoUrl} alt={member.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ flexGrow: 1, paddingRight: "12mm" }}>
            <p style={{ fontSize: "3mm", fontWeight: 800, color: "#111827", margin: 0, lineHeight: 1.15 }}>{member.name}</p>
            <p style={{ fontSize: "2.1mm", fontWeight: 800, color: "#E31E24", margin: "0.5mm 0 1.5mm", textTransform: "uppercase" }}>{member.role}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8mm 2mm", fontSize: "2mm" }}>
              <div>
                <span style={{ display: "block", color: "#9ca3af", fontSize: "1.6mm", fontWeight: 600 }}>MEMBER ID</span>
                <span style={{ fontWeight: 700, color: "#374151" }}>{member.memberNumber}</span>
              </div>
              <div>
                <span style={{ display: "block", color: "#9ca3af", fontSize: "1.6mm", fontWeight: 600 }}>VALID UNTIL</span>
                <span style={{ fontWeight: 700, color: "#00A651" }}>{validUntil}</span>
              </div>
            </div>

            <p style={{ fontSize: "1.5mm", color: "#6b7280", fontWeight: 500, marginTop: "2mm", paddingTop: "1mm", borderTop: "0.2mm dashed #e5e7eb" }}>
              Authorized by: <strong style={{ color: "#374151" }}>{chairpersonName}</strong>
            </p>
          </div>

          <div style={{ position: "absolute", bottom: "2.5mm", right: "3mm", width: "11mm", height: "11mm", background: "white", border: "0.2mm solid #e5e7eb", borderRadius: "1mm", padding: "0.3mm" }}>
            {qrDataUrl && <img src={qrDataUrl} alt="Verify" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
          </div>
        </div>

        <div style={{ background: "#1B1B1B", color: "#d1d5db", fontSize: "1.5mm", textAlign: "center", padding: "1mm", fontFamily: "monospace" }}>
          SAFEGUARDING: {orgSettings.safeguardingContact || "+254 798 132 410"}
        </div>
      </div>

      {/* BACK */}
      <div style={cardStyle}>
        <div style={{ padding: "3mm", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", boxSizing: "border-box" }}>
          <div>
            <p style={{ fontSize: "2.4mm", fontWeight: 800, color: "#111827", margin: 0, textTransform: "uppercase" }}>
              Code of Conduct &amp; Terms
            </p>
            <p style={{ fontSize: "1.6mm", color: "#9ca3af", fontFamily: "monospace", margin: "0.5mm 0 2mm" }}>
              {orgSettings.registrationNumber}
            </p>
            <div style={{ background: "#f9fafb", border: "0.2mm solid #e5e7eb", borderRadius: "1.5mm", padding: "2mm", fontSize: "1.8mm", color: "#4b5563", lineHeight: 1.4, whiteSpace: "pre-line" }}>
              {orgSettings.codeOfConduct || "1. Respect and integrity across all CBO forums.\n2. Zero tolerance for discrimination or SGBV.\n3. Transparent custody of CBO assets."}
            </div>
          </div>

          <div style={{ fontSize: "1.6mm", color: "#6b7280", borderTop: "0.2mm solid #e5e7eb", paddingTop: "1.5mm" }}>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "#374151" }}>Return if found:</strong> {orgSettings.physicalAddress || "Kiambiu Community Hall, Nairobi"}
            </p>
            <p style={{ margin: "0.5mm 0 0", color: "#9ca3af", fontStyle: "italic" }}>
              This card remains property of {orgSettings.name || "Bashosho Talents CBO"} and must be surrendered on membership exit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
