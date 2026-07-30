import React from "react";
import { PenTool, Upload, Trash2, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";

interface SignatureUploadPanelProps {
  lang: "en" | "sw";
}

const t = {
  en: {
    title: "My Signature",
    desc: "Upload a PNG of your signature (ideally on a transparent background). It will be placed automatically and professionally on official documents you generate or sign — contracts, letters, and approvals — instead of a generic placeholder.",
    tip: "Best results: sign on plain white paper with a dark pen, photograph it straight-on, then remove the background with any free PNG background-remover before uploading. A transparent background looks best, but a plain white background will still work fine.",
    current: "Current signature on file",
    none: "No signature uploaded yet",
    upload: "Upload Signature (PNG)",
    uploading: "Uploading...",
    remove: "Remove",
    removing: "Removing...",
    replace: "Replace Signature",
    success: "Signature saved. It will now appear on documents you generate or sign.",
    removedSuccess: "Signature removed.",
    error: "Failed to save your signature. Please try again.",
    invalidType: "Please upload a PNG image.",
    tooLarge: "Please choose an image under 2MB.",
    loadError: "Failed to load your current signature status."
  },
  sw: {
    title: "Sahihi Yangu",
    desc: "Pakia picha ya PNG ya sahihi yako (ikiwezekana bila mandharinyuma). Itawekwa moja kwa moja na kwa umahiri kwenye nyaraka rasmi unazounda au kutia sahihi — mikataba, barua, na idhini — badala ya nafasi tupu.",
    tip: "Matokeo bora: tia sahihi kwenye karatasi nyeupe kwa kalamu nyeusi, piga picha moja kwa moja, kisha ondoa mandharinyuma kwa kutumia zana yoyote ya bure ya kuondoa mandharinyuma kabla ya kupakia. Mandharinyuma angavu ni bora zaidi, lakini nyeupe tambarare pia itafanya kazi vizuri.",
    current: "Sahihi yako ya sasa",
    none: "Bado hujapakia sahihi",
    upload: "Pakia Sahihi (PNG)",
    uploading: "Inapakia...",
    remove: "Ondoa",
    removing: "Inaondoa...",
    replace: "Badilisha Sahihi",
    success: "Sahihi imehifadhiwa. Sasa itaonekana kwenye nyaraka unazounda au kutia sahihi.",
    removedSuccess: "Sahihi imeondolewa.",
    error: "Imeshindwa kuhifadhi sahihi yako. Tafadhali jaribu tena.",
    invalidType: "Tafadhali pakia picha ya PNG.",
    tooLarge: "Tafadhali chagua picha chini ya 2MB.",
    loadError: "Imeshindwa kupakia hali ya sahihi yako ya sasa."
  }
};

export default function SignatureUploadPanel({ lang }: SignatureUploadPanelProps) {
  const tt = t[lang];
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [signatureUrl, setSignatureUrl] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<{ name: string; email: string; phone: string } | null>(null);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const loadProfile = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      const user = data.user || data;
      setProfile({ name: user.name, email: user.email, phone: user.phone });
      setSignatureUrl(user.signatureUrl || null);
    } catch {
      setError(tt.loadError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => { loadProfile(); }, [loadProfile]);

  const persistSignature = async (newSignatureUrl: string | null) => {
    if (!profile) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          signatureUrl: newSignatureUrl || ""
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      setSignatureUrl(newSignatureUrl);
      setSuccess(newSignatureUrl ? tt.success : tt.removedSuccess);
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError(tt.error);
    } finally {
      setBusy(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow re-selecting the same file later

    if (file.type !== "image/png") {
      setError(tt.invalidType);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(tt.tooLarge);
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, filename: `signature-${Date.now()}.png` })
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || "Upload failed");
      }

      await persistSignature(uploadData.url);
    } catch {
      setError(tt.error);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center text-neutral-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
        <PenTool size={16} className="text-red-600" /> {tt.title}
      </h3>
      <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed max-w-xl">{tt.desc}</p>

      <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
        <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-700 leading-relaxed">{tt.tip}</p>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-2">
          {signatureUrl ? tt.current : tt.none}
        </p>
        <div className="border border-dashed border-neutral-300 rounded-lg bg-[repeating-conic-gradient(#f5f5f5_0%_25%,white_0%_50%)] bg-[length:16px_16px] h-28 flex items-center justify-center overflow-hidden">
          {signatureUrl ? (
            <img src={signatureUrl} alt="Your signature" className="max-h-24 max-w-[90%] object-contain" />
          ) : (
            <span className="text-xs text-neutral-400 font-mono">—</span>
          )}
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-red-600 mt-3 flex items-center gap-1.5"><AlertCircle size={12} /> {error}</p>
      )}
      {success && (
        <p className="text-[11px] text-green-600 mt-3 flex items-center gap-1.5"><CheckCircle2 size={12} /> {success}</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept="image/png" onChange={handleFileSelect} className="hidden" id="signature-file-input" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {busy ? tt.uploading : (signatureUrl ? tt.replace : tt.upload)}
        </button>
        {signatureUrl && (
          <button
            onClick={() => persistSignature(null)}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-xs font-bold text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 size={12} /> {tt.remove}
          </button>
        )}
      </div>
    </div>
  );
}
