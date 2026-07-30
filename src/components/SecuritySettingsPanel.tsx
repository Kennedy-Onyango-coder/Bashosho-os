import React from "react";
import QRCode from "qrcode";
import { ShieldCheck, ShieldAlert, Copy, Check, AlertCircle, Loader2, KeyRound, Download } from "lucide-react";
import SignatureUploadPanel from "./SignatureUploadPanel";

interface SecuritySettingsPanelProps {
  lang: "en" | "sw";
}

type SetupStep = "idle" | "scan" | "confirm" | "backup-codes";

export default function SecuritySettingsPanel({ lang }: SecuritySettingsPanelProps) {
  const [loadingStatus, setLoadingStatus] = React.useState(true);
  const [totpEnabled, setTotpEnabled] = React.useState(false);
  const [backupCodesRemaining, setBackupCodesRemaining] = React.useState(0);
  const [error, setError] = React.useState("");

  const [setupStep, setSetupStep] = React.useState<SetupStep>("idle");
  const [qrDataUrl, setQrDataUrl] = React.useState("");
  const [manualSecret, setManualSecret] = React.useState("");
  const [confirmCode, setConfirmCode] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [showDisableForm, setShowDisableForm] = React.useState(false);
  const [disablePassword, setDisablePassword] = React.useState("");

  const t = (en: string, sw: string) => (lang === "en" ? en : sw);

  const refreshStatus = React.useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/auth/2fa/status");
      const data = await res.json();
      if (res.ok) {
        setTotpEnabled(!!data.totpEnabled);
        setBackupCodesRemaining(data.backupCodesRemaining || 0);
      }
    } catch {
      // Silent — status just won't show if this fails; the rest of the panel still works.
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  React.useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleStartSetup = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start setup.");

      setManualSecret(data.secret);
      const dataUrl = await QRCode.toDataURL(data.otpauthUri, { margin: 1, width: 220 });
      setQrDataUrl(dataUrl);
      setSetupStep("scan");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmCode.length !== 6) {
      setError(t("Enter the 6-digit code from your authenticator app.", "Weka msimbo wa tarakimu 6 kutoka programu yako."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: confirmCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That code didn't match.");

      setBackupCodes(data.backupCodes);
      setSetupStep("backup-codes");
      setConfirmCode("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFinishSetup = () => {
    setSetupStep("idle");
    setBackupCodes([]);
    setQrDataUrl("");
    setManualSecret("");
    refreshStatus();
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to disable two-factor authentication.");

      setShowDisableForm(false);
      setDisablePassword("");
      refreshStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard?.writeText(manualSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const downloadBackupCodes = () => {
    const blob = new Blob(
      [`Bashosho OS — Two-Factor Backup Codes\nGenerated: ${new Date().toISOString()}\n\n${backupCodes.join("\n")}\n\nEach code can only be used once. Keep this somewhere safe.`],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bashosho-os-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-16 text-neutral-400">
        <Loader2 size={20} className="animate-spin mr-2" /> {t("Loading security settings...", "Inapakia mipangilio ya usalama...")}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold text-neutral-900">{t("Security & Two-Factor Authentication", "Usalama na Uthibitishaji wa Hatua Mbili")}</h2>
        <p className="text-sm text-neutral-500 mt-1">
          {t(
            "Add an extra layer of protection to your account using an authenticator app like Google Authenticator or Authy.",
            "Ongeza kinga zaidi kwenye akaunti yako kwa kutumia programu ya uthibitishaji kama Google Authenticator au Authy."
          )}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-1.5">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {/* Status card + idle setup step */}
      {setupStep === "idle" && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {totpEnabled ? (
                <ShieldCheck size={22} className="text-[#00A651]" />
              ) : (
                <ShieldAlert size={22} className="text-neutral-400" />
              )}
              <div>
                <div className="text-sm font-bold text-neutral-800">
                  {totpEnabled
                    ? t("Two-factor authentication is ON", "Uthibitishaji wa hatua mbili UMEWASHWA")
                    : t("Two-factor authentication is OFF", "Uthibitishaji wa hatua mbili HAUJAWASHWA")}
                </div>
                {totpEnabled && (
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {t(`${backupCodesRemaining} backup code(s) remaining`, `Misimbo ${backupCodesRemaining} ya akiba iliyobaki`)}
                  </div>
                )}
              </div>
            </div>

            {!totpEnabled ? (
              <button
                onClick={handleStartSetup}
                disabled={busy}
                className="px-4 py-2 bg-[#E31E24] text-white text-xs font-bold rounded-xl hover:bg-[#c21419] disabled:opacity-50 cursor-pointer"
              >
                {busy ? t("Starting...", "Inaanza...") : t("Enable 2FA", "Washa 2FA")}
              </button>
            ) : (
              <button
                onClick={() => setShowDisableForm(!showDisableForm)}
                className="px-4 py-2 border border-red-300 text-red-600 text-xs font-bold rounded-xl hover:bg-red-50 cursor-pointer"
              >
                {t("Disable 2FA", "Zima 2FA")}
              </button>
            )}
          </div>

          {showDisableForm && totpEnabled && (
            <form onSubmit={handleDisable} className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
              <p className="text-xs text-neutral-500">
                {t("Confirm your password to disable two-factor authentication.", "Thibitisha nenosiri lako kuzima uthibitishaji wa hatua mbili.")}
              </p>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder={t("Your password", "Nenosiri lako")}
                autoFocus
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-[#E31E24] focus:border-[#E31E24]"
              />
              <button
                type="submit"
                disabled={busy || !disablePassword}
                className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {busy ? t("Disabling...", "Inazima...") : t("Confirm Disable", "Thibitisha Kuzima")}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Step: scan QR code */}
      {setupStep === "scan" && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-neutral-800">{t("Step 1 — Scan this QR code", "Hatua 1 — Changanua msimbo huu wa QR")}</h3>
          <p className="text-xs text-neutral-500">
            {t(
              "Open Google Authenticator, Authy, or any TOTP app, and scan this code — or enter the key manually.",
              "Fungua Google Authenticator, Authy, au programu yoyote ya TOTP, kisha changanua msimbo huu — au weka ufunguo wenyewe."
            )}
          </p>

          {qrDataUrl && (
            <div className="flex justify-center">
              <img src={qrDataUrl} alt="2FA QR code" className="border border-neutral-200 rounded-xl p-2" />
            </div>
          )}

          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 flex items-center justify-between gap-3">
            <code className="text-xs font-mono text-neutral-700 break-all">{manualSecret}</code>
            <button onClick={copySecret} className="shrink-0 p-1.5 rounded-lg hover:bg-neutral-200 cursor-pointer" aria-label="Copy secret">
              {copiedSecret ? <Check size={14} className="text-[#00A651]" /> : <Copy size={14} className="text-neutral-500" />}
            </button>
          </div>

          <form onSubmit={handleConfirmSetup} className="space-y-3 pt-2">
            <label className="text-xs font-bold text-neutral-700">
              {t("Step 2 — Enter the 6-digit code it shows", "Hatua 2 — Weka msimbo wa tarakimu 6 unaoonyeshwa")}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              autoFocus
              className="w-full text-center text-xl tracking-[0.4em] font-mono px-3 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-[#E31E24] focus:border-[#E31E24]"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || confirmCode.length !== 6}
                className="flex-1 px-4 py-2.5 bg-[#E31E24] text-white text-xs font-bold rounded-xl hover:bg-[#c21419] disabled:opacity-50 cursor-pointer"
              >
                {busy ? t("Verifying...", "Inathibitisha...") : t("Verify & Enable", "Thibitisha na Uwashe")}
              </button>
              <button
                type="button"
                onClick={() => { setSetupStep("idle"); setError(""); setConfirmCode(""); }}
                className="px-4 py-2.5 border border-neutral-300 text-neutral-600 text-xs font-bold rounded-xl hover:bg-neutral-50 cursor-pointer"
              >
                {t("Cancel", "Ghairi")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step: show backup codes once */}
      {setupStep === "backup-codes" && (
        <div className="bg-white border border-[#00A651] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#00A651]" />
            <h3 className="text-sm font-bold text-neutral-800">{t("2FA is now enabled!", "2FA imewashwa sasa!")}</h3>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-1.5">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {t(
              "Save these backup codes somewhere safe now — they will not be shown again. Each one can be used once if you lose access to your authenticator app.",
              "Hifadhi misimbo hii ya akiba mahali salama sasa — haitaonyeshwa tena. Kila mmoja unaweza kutumika mara moja ukipoteza ufikiaji wa programu yako ya uthibitishaji."
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-neutral-50 border border-neutral-200 rounded-xl p-4">
            {backupCodes.map((code) => (
              <div key={code} className="text-center py-1">{code}</div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={downloadBackupCodes}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 border border-neutral-300 text-neutral-700 text-xs font-bold rounded-xl hover:bg-neutral-50 cursor-pointer"
            >
              <Download size={14} /> {t("Download as file", "Pakua kama faili")}
            </button>
            <button
              onClick={handleFinishSetup}
              className="flex-1 px-4 py-2.5 bg-[#00A651] text-white text-xs font-bold rounded-xl hover:bg-[#008a44] cursor-pointer"
            >
              {t("I've saved them — Done", "Nimehifadhi — Nimemaliza")}
            </button>
          </div>
        </div>
      )}

      <div className="text-xs text-neutral-400 flex items-start gap-1.5">
        <KeyRound size={13} className="shrink-0 mt-0.5" />
        {t(
          "Two-factor authentication is optional but recommended, especially for Chairperson, Treasurer, and other leadership accounts with access to financial and member data.",
          "Uthibitishaji wa hatua mbili si wa lazima lakini unapendekezwa, hasa kwa akaunti za Mwenyekiti, Mweka Hazina, na uongozi mwingine wenye ufikiaji wa data za kifedha na wanachama."
        )}
      </div>

      <div className="pt-2 border-t border-neutral-100">
        <SignatureUploadPanel lang={lang} />
      </div>
    </div>
  );
}
