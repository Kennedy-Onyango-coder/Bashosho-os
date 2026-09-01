import React from "react";
import { motion } from "motion/react";
import { Check, AlertTriangle } from "lucide-react";
import BashoshoLogo from "./BashoshoLogo";

interface ForceChangePasswordScreenProps {
  onPasswordChanged: (updatedUser: any) => void;
  currentUser: any;
  lang: "en" | "sw";
}

export default function ForceChangePasswordScreen({
  onPasswordChanged,
  currentUser,
  lang
}: ForceChangePasswordScreenProps) {
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError(
        lang === "en"
          ? "The new password or PIN must be at least 6 characters."
          : "Nenosiri au PIN mpya lazima iwe na angalau herufi 6."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        lang === "en"
          ? "Passwords do not match."
          : "Nenosiri hazilingani."
      );
      return;
    }

    if (newPassword === "1234") {
      setError(
        lang === "en"
          ? "You cannot reuse the default password. Please choose a more secure one."
          : "Huwezi kutumia nenosiri la chaguo-msingi. Tafadhali chagua salama zaidi."
      );
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Password change failed");
      }

      setSuccess(true);
      setTimeout(() => {
        onPasswordChanged({
          ...currentUser,
          mustChangePassword: false
        });
      }, 1500);
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Top security theme accent */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#E31E24]"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md mt-10">
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full border-4 border-[#E31E24] flex items-center justify-center p-2 border-t-[#00A651] border-r-[#00A651]">
            <BashoshoLogo size={60} showText={false} />
          </div>
        </div>
        <h2 className="text-center text-2xl font-extrabold tracking-tight text-neutral-900">
          {lang === "en" ? "Set Your Secure PIN / Password" : "Weka PIN / Nenosiri Lako Salama"}
        </h2>
        <p className="mt-2 text-center text-xs text-neutral-500 max-w-sm mx-auto">
          {lang === "en"
            ? "To secure organizational and financial records, you are required to change your default password before proceeding."
            : "Ili kulinda kumbukumbu za shirika na fedha, unahitajika kubadilisha nenosiri lako la chaguo-msingi kabla ya kuendelea."}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white py-8 px-4 shadow-sm border border-neutral-200 rounded-2xl sm:px-10"
        >
          {success ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900">
                {lang === "en" ? "PIN Changed Successfully!" : "PIN Imebadilishwa kwa Mafanikio!"}
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                {lang === "en" ? "Redirecting you to the system..." : "Inakupeleka kwenye mfumo..."}
              </p>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  {lang === "en" ? "New Password or PIN" : "Nenosiri jipya au PIN"}
                </label>
                <div className="mt-1.5">
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••"
                    className="appearance-none block w-full px-3 py-2.5 border border-neutral-300 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-[#E31E24] focus:border-[#E31E24] sm:text-xs tracking-widest"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  {lang === "en" ? "Confirm New Password / PIN" : "Thibitisha Nenosiri jipya au PIN"}
                </label>
                <div className="mt-1.5">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••"
                    className="appearance-none block w-full px-3 py-2.5 border border-neutral-300 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-[#E31E24] focus:border-[#E31E24] sm:text-xs tracking-widest"
                  />
                </div>
              </div>

              {error && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" /> {error}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[#E31E24] hover:bg-[#c21419] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E31E24] transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin inline-block"></span>
                      {lang === "en" ? "Updating password..." : "Inasasisha nenosiri..."}
                    </span>
                  ) : (
                    lang === "en" ? "Save Secure Password" : "Hifadhi Nenosiri Salama"
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>

      <div className="text-center text-[10px] font-mono text-neutral-500 mt-6">
        {lang === "en"
          ? "Logged in as "
          : "Umeingia kama "}
        <span className="font-bold text-neutral-600">{currentUser?.name}</span> ({currentUser?.role})
      </div>
    </div>
  );
}
