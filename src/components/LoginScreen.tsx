import React from "react";
import { motion } from "motion/react";
import BashoshoLogo from "./BashoshoLogo";
import { AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";

interface LoginScreenProps {
  onLoginSuccess: (user: any) => Promise<void> | void;
  lang: "en" | "sw";
  onChangeLang: (lang: "en" | "sw") => void;
  onBackToHome?: () => void;
}

export default function LoginScreen({ onLoginSuccess, lang, onChangeLang, onBackToHome }: LoginScreenProps) {
  const [emailOrPhone, setEmailOrPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [errorDetails, setErrorDetails] = React.useState("");

  // Forgot password recovery states
  const [isForgotPassword, setIsForgotPassword] = React.useState(false);
  const [recoveryEmailOrPhone, setRecoveryEmailOrPhone] = React.useState("");
  const [recoveryEmergencyPhone, setRecoveryEmergencyPhone] = React.useState("");
  const [recoveryNewPassword, setRecoveryNewPassword] = React.useState("");
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  // Two-factor authentication step (shown after a correct password if the account has 2FA enabled)
  const [pendingTwoFactorToken, setPendingTwoFactorToken] = React.useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = React.useState("");
  const [useBackupCode, setUseBackupCode] = React.useState(false);
  const [backupCodeInput, setBackupCodeInput] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPhone || !password) {
      setError(lang === "en" ? "Please fill in all fields" : "Tafadhali jaza nafasi zote");
      return;
    }

    setIsLoading(true);
    setError("");
    setErrorDetails("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, password })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.details) {
          setErrorDetails(data.details);
        }
        throw new Error(data.error || "Login failed");
      }

      if (data.requires2FA) {
        setPendingTwoFactorToken(data.pendingToken);
        setIsLoading(false);
        return;
      }

      if (data.systemMode) {
        localStorage.setItem("bashosh_os_system_mode", data.systemMode);
      }

      await onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || (lang === "en" ? "Invalid email/phone or PIN" : "Barua pepe/Nambari au PIN si sahihi"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!useBackupCode && twoFactorCode.length !== 6) {
      setError(lang === "en" ? "Enter the 6-digit code from your authenticator app" : "Weka msimbo wa tarakimu 6 kutoka programu yako ya uthibitishaji");
      return;
    }
    if (useBackupCode && !backupCodeInput.trim()) {
      setError(lang === "en" ? "Enter one of your backup codes" : "Weka mmoja wa misimbo yako ya akiba");
      return;
    }

    setIsLoading(true);
    setError("");
    setErrorDetails("");

    try {
      const res = await fetch("/api/auth/2fa/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingToken: pendingTwoFactorToken,
          token: useBackupCode ? undefined : twoFactorCode,
          backupCode: useBackupCode ? backupCodeInput : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      if (data.systemMode) {
        localStorage.setItem("bashosh_os_system_mode", data.systemMode);
      }

      if (data.usedBackupCode) {
        alert(
          lang === "en"
            ? `You signed in with a backup code. You have ${data.backupCodesRemaining} backup code(s) left — visit Security settings to generate new ones if you're running low.`
            : `Umeingia kwa msimbo wa akiba. Una misimbo ${data.backupCodesRemaining} iliyobaki — tembelea Mipangilio ya Usalama kutengeneza mipya ukikaribia kuisha.`
        );
      }

      await onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || (lang === "en" ? "Incorrect code" : "Msimbo si sahihi"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmailOrPhone || !recoveryEmergencyPhone || !recoveryNewPassword) {
      setError(lang === "en" ? "Please fill in all verification fields" : "Tafadhali jaza nafasi zote za uthibitishaji");
      return;
    }

    if (recoveryNewPassword !== recoveryConfirmPassword) {
      setError(lang === "en" ? "New passwords do not match" : "Nenosiri jipya hailingani");
      return;
    }

    setIsLoading(true);
    setError("");
    setErrorDetails("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/auth/reset-forgotten-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailOrPhone: recoveryEmailOrPhone,
          emergencyPhone: recoveryEmergencyPhone,
          newPassword: recoveryNewPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Reset failed");
      }

      setSuccessMessage(lang === "en" ? "Password reset successful! You can now log in with your new password/PIN." : "Urejesho wa nenosiri umekamilika! Sasa unaweza kuingia na nenosiri/PIN yako mpya.");
      // Clear fields
      setRecoveryEmailOrPhone("");
      setRecoveryEmergencyPhone("");
      setRecoveryNewPassword("");
      setRecoveryConfirmPassword("");
    } catch (err: any) {
      setError(err.message || (lang === "en" ? "Verification failed" : "Uthibitishaji umeshindikana"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative colored bar top */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#E31E24]"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md mt-10">
        <div className="flex justify-center mb-4">
          <div className="w-24 h-24 rounded-full border-4 border-[#E31E24] flex items-center justify-center p-2 border-t-[#00A651] border-r-[#00A651]">
            <BashoshoLogo size={70} showText={false} />
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-neutral-900 font-sans">
          BASHOSHO OS
        </h2>
        <p className="mt-1.5 text-center text-xs font-semibold text-neutral-500 uppercase tracking-widest font-mono">
          {lang === "en" ? "Community Management System" : "Mfumo wa Utawala wa Jamii"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white py-8 px-4 shadow-sm border border-neutral-200 rounded-2xl sm:px-10"
        >
          {pendingTwoFactorToken ? (
            <form className="space-y-5" onSubmit={handleTwoFactorSubmit}>
              <div className="text-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                  {lang === "en" ? "Two-Factor Verification" : "Uthibitishaji wa Hatua Mbili"}
                </h3>
                <p className="mt-1 text-xs text-neutral-500">
                  {useBackupCode
                    ? (lang === "en" ? "Enter one of your saved backup codes." : "Weka mmoja wa misimbo yako ya akiba iliyohifadhiwa.")
                    : (lang === "en" ? "Enter the 6-digit code from your authenticator app." : "Weka msimbo wa tarakimu 6 kutoka programu yako ya uthibitishaji.")}
                </p>
              </div>

              {!useBackupCode ? (
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono px-3 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-[#E31E24] focus:border-[#E31E24]"
                />
              ) : (
                <input
                  type="text"
                  autoFocus
                  value={backupCodeInput}
                  onChange={(e) => setBackupCodeInput(e.target.value)}
                  placeholder="XXXXX-XXXXX"
                  className="w-full text-center text-sm tracking-widest font-mono px-3 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-[#E31E24] focus:border-[#E31E24]"
                />
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                  <div className="flex items-center gap-1.5"><AlertCircle size={14} className="shrink-0 text-red-600" /> {error}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[#E31E24] hover:bg-[#c21419] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E31E24] transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isLoading
                  ? (lang === "en" ? "Verifying..." : "Inathibitisha...")
                  : (lang === "en" ? "Verify & Sign In" : "Thibitisha na Ingia")}
              </button>

              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setError("");
                  setTwoFactorCode("");
                  setBackupCodeInput("");
                }}
                className="w-full text-center text-xs font-bold text-[#E31E24] hover:underline cursor-pointer"
              >
                {useBackupCode
                  ? (lang === "en" ? "Use authenticator app instead" : "Tumia programu ya uthibitishaji badala yake")
                  : (lang === "en" ? "Use a backup code instead" : "Tumia msimbo wa akiba badala yake")}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPendingTwoFactorToken(null);
                  setTwoFactorCode("");
                  setBackupCodeInput("");
                  setPassword("");
                  setError("");
                }}
                className="w-full flex justify-center items-center gap-1.5 py-2.5 px-4 border border-neutral-300 rounded-xl text-xs font-bold uppercase tracking-wider text-neutral-600 bg-white hover:bg-neutral-50 focus:outline-none transition-all cursor-pointer shadow-xs"
              >
                <ArrowLeft size={14} /> {lang === "en" ? "Back to Sign In" : "Rudi Kuingia"}
              </button>
            </form>
          ) : !isForgotPassword ? (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  {lang === "en" ? "Email Address or Phone" : "Barua pepe au Nambari ya Simu"}
                </label>
                <div className="mt-1.5">
                  <input
                    id="email"
                    name="email"
                    type="text"
                    required
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    placeholder="name@example.com"
                    className="appearance-none block w-full px-3 py-2.5 border border-neutral-300 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-[#E31E24] focus:border-[#E31E24] sm:text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label htmlFor="pin" className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                    {lang === "en" ? "Password or PIN" : "Nenosiri au PIN"}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError("");
                      setErrorDetails("");
                      setSuccessMessage("");
                    }}
                    className="text-xs font-bold text-[#E31E24] hover:underline focus:outline-none cursor-pointer"
                  >
                    {lang === "en" ? "Forgot PIN?" : "Umesahau PIN?"}
                  </button>
                </div>
                <div className="mt-1.5">
                  <input
                    id="pin"
                    name="pin"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••"
                    className="appearance-none block w-full px-3 py-2.5 border border-neutral-300 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-[#E31E24] focus:border-[#E31E24] sm:text-xs tracking-widest"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                  <div className="flex items-center gap-1.5"><AlertCircle size={14} className="shrink-0 text-red-600" /> {error}</div>
                  {errorDetails && (
                    <div className="mt-2 pt-2 border-t border-red-200 text-[10px] font-mono text-red-500 break-all whitespace-pre-wrap">
                      <strong>Details:</strong> {errorDetails}
                    </div>
                  )}
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 font-medium">
                  <div className="flex items-center gap-1.5"><CheckCircle size={14} className="shrink-0 text-green-600" /> {successMessage}</div>
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[#E31E24] hover:bg-[#c21419] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E31E24] transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin inline-block"></span>
                      {lang === "en" ? "Signing in..." : "Inaingia..."}
                    </span>
                  ) : (
                    lang === "en" ? "Sign In" : "Ingia"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onBackToHome) {
                      onBackToHome();
                    } else {
                      window.location.href = "/";
                    }
                  }}
                  className="w-full flex justify-center items-center gap-1.5 py-2.5 px-4 border border-neutral-300 rounded-xl text-xs font-bold uppercase tracking-wider text-neutral-600 bg-white hover:bg-neutral-50 focus:outline-none transition-all cursor-pointer shadow-xs"
                >
                  <ArrowLeft size={14} /> {lang === "en" ? "Back to Homepage" : "Rudi Nyumbani"}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handleRecoverySubmit}>
              <div>
                <h3 className="text-sm font-bold text-neutral-950 uppercase tracking-wide">
                  {lang === "en" ? "Self-Service PIN Recovery" : "Kujihudumia Kurejesha PIN"}
                </h3>
                <p className="mt-1 text-neutral-500 text-xs">
                  {lang === "en"
                    ? "Enter your email/phone and verify your Emergency Contact's phone number as a secondary security challenge."
                    : "Weka barua pepe/nambari ya simu na uthibitishe nambari ya simu ya Mtu wako wa Dharura."}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  {lang === "en" ? "Your Email or Phone" : "Barua Pepe au Simu Yako"}
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={recoveryEmailOrPhone}
                    onChange={(e) => setRecoveryEmailOrPhone(e.target.value)}
                    placeholder="name@example.com"
                    className="appearance-none block w-full px-3 py-2.5 border border-neutral-300 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-[#E31E24] focus:border-[#E31E24] sm:text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  {lang === "en" ? "Emergency Contact Phone Number" : "Nambari ya Simu ya Mtu wa Dharura"}
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={recoveryEmergencyPhone}
                    onChange={(e) => setRecoveryEmergencyPhone(e.target.value)}
                    placeholder="+254 7XX XXXXXX"
                    className="appearance-none block w-full px-3 py-2.5 border border-neutral-300 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-[#E31E24] focus:border-[#E31E24] sm:text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  {lang === "en" ? "New PIN / Password" : "PIN / Nenosiri Jipya"}
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={recoveryNewPassword}
                    onChange={(e) => setRecoveryNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="appearance-none block w-full px-3 py-2.5 border border-neutral-300 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-[#E31E24] focus:border-[#E31E24] sm:text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  {lang === "en" ? "Confirm New PIN" : "Thibitisha PIN Mpya"}
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={recoveryConfirmPassword}
                    onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                    placeholder="Re-enter PIN"
                    className="appearance-none block w-full px-3 py-2.5 border border-neutral-300 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-[#E31E24] focus:border-[#E31E24] sm:text-xs"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                  <div className="flex items-center gap-1.5"><AlertCircle size={14} className="shrink-0 text-red-600" /> {error}</div>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 font-medium">
                  <div className="flex items-center gap-1.5"><CheckCircle size={14} className="shrink-0 text-green-600" /> {successMessage}</div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[#E31E24] hover:bg-[#c21419] focus:outline-none transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin inline-block"></span>
                      {lang === "en" ? "Verifying..." : "Inathibitisha..."}
                    </span>
                  ) : (
                    lang === "en" ? "Reset PIN" : "Rudisha PIN"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError("");
                    setErrorDetails("");
                    setSuccessMessage("");
                  }}
                  className="w-full flex justify-center items-center gap-1.5 py-2.5 px-4 border border-neutral-300 rounded-xl text-xs font-bold uppercase tracking-wider text-neutral-600 bg-white hover:bg-neutral-50 focus:outline-none transition-all cursor-pointer shadow-xs"
                >
                  <ArrowLeft size={14} /> {lang === "en" ? "Back to Sign In" : "Rudi Kuingia"}
                </button>
              </div>
            </form>
          )}

          {/* Quick Info Block */}
          <div className="mt-6 border-t border-neutral-100 pt-6 text-center">
            <p className="text-[10px] font-mono text-neutral-400 leading-relaxed">
              {lang === "en" 
                ? "This is a secured application system for Bashosho Talents CBO Kiambiu. Access logs are automatically audited." 
                : "Huu ni mfumo wa usalama wa Bashosho Talents CBO Kiambiu. Kumbukumbu za uingiaji zinakaguliwa kiotomatiki."}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Language Switch Footer */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md mt-6 flex justify-center">
        <button
          onClick={() => onChangeLang(lang === "en" ? "sw" : "en")}
          className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border border-neutral-300 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
        >
           {lang === "en" ? "Kiswahili" : "English"}
        </button>
      </div>
    </div>
  );
}
