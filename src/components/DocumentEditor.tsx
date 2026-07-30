import React from "react";
import Modal from "./Modal";
import { Document, DocumentType } from "../types";
import { StorageService } from "../lib/storage";

interface DocumentEditorProps {
  document?: Document; // Existing document if editing
  lang: "en" | "sw";
  onSave: (doc: Document) => void;
  onCancel: () => void;
  authorName: string;
  onTriggerPrint?: (title: string, content: React.ReactNode, verificationUrl?: string) => void;
}

export default function DocumentEditor({
  document,
  lang,
  onSave,
  onCancel,
  authorName,
  onTriggerPrint
}: DocumentEditorProps) {
  const [title, setTitle] = React.useState(document?.title || "");
  const [type, setType] = React.useState<DocumentType>(document?.type || "minutes");
  const [content, setContent] = React.useState(document?.content || "");
  const [roughNotes, setRoughNotes] = React.useState("");
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = React.useState(false);

  // Trigger Gemini AI draft endpoint
  const handleAiAssist = async () => {
    if (!roughNotes.trim()) {
      setAiError(lang === "en" ? "Please enter some rough notes first!" : "Tafadhali andika muhtasari kwanza!");
      return;
    }

    setIsAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch("/api/document_templates/generate_draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: roughNotes,
          docType: type,
          title: title || "New Document Draft"
        })
      });

      const data = await response.json();
      if (response.ok && data.draft) {
        setContent(data.draft);
        if (!title) {
          setTitle(`Draft - ${type.toUpperCase()} - ${new Date().toLocaleDateString()}`);
        }
      } else {
        throw new Error(data.error || "Failed to generate draft");
      }
    } catch (err: any) {
      console.error(err);
      setAiError(
        lang === "en"
          ? `Draft Assistant unavailable: ${err?.message || "Verify API configuration"}`
          : `Msaidizi wa kuandika haipatikani kwa sasa: ${err?.message || "Angalia mipangilio"}`
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const savedDoc: Document = {
      id: document?.id || `doc-${Date.now()}`,
      title,
      type,
      content,
      date: document?.date || new Date().toISOString().split("T")[0],
      author: document?.author || authorName,
      status: document?.status || "draft",
      auditTrail: [
        ...(document?.auditTrail || []),
        {
          action: document ? "Document Edited" : "Document Created",
          user: authorName,
          timestamp: new Date().toISOString(),
          notes: roughNotes ? `Expanded from rough notes: "${roughNotes.slice(0, 50)}..."` : "Manual Entry"
        }
      ]
    };

    onSave(savedDoc);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 max-w-4xl mx-auto text-left" id="document-editor-container">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-6">
        <h3 className="text-lg font-bold text-[#1B1B1B] font-sans">
          {document ? (lang === "en" ? "Edit CBO Record" : "Hariri Nyaraka") : (lang === "en" ? "Create Official Document" : "Unda Nyaraka Mpya")}
        </h3>
        <button
          onClick={onCancel}
          className="text-neutral-400 hover:text-neutral-600 text-sm font-medium border border-gray-200 rounded-lg px-3 py-1 cursor-pointer transition-colors"
        >
          {lang === "en" ? "Cancel" : "Ghairi"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Core Form Area - Left */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-5">
          {/* Document Title */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
              {lang === "en" ? "Document Title" : "Kichwa cha Nyaraka"}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === "en" ? "e.g., Kiambiu Community Hall Forum Theatre Outreaches" : "mfano, Vikao vya Vijana Kiambiu"}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
            />
          </div>

          {/* Category Select */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
              {lang === "en" ? "Document Type" : "Aina ya Nyaraka"}
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
            >
              <option value="minutes">{lang === "en" ? "Meeting Minutes" : "Kumbukumbu za Kikao"}</option>
              <option value="activity">{lang === "en" ? "Activity/Outreach Report" : "Ripoti ya Miradi"}</option>
              <option value="budget">{lang === "en" ? "Budget Explanatory Settlement" : "Ufafanuzi wa Bajeti"}</option>
            </select>
          </div>

          {/* Document Content (Reviewing Editor Panel) */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono flex justify-between items-center">
              <span>{lang === "en" ? "Official Text (Markdown/Prose)" : "Maandishi Rasmi (Markdown)"}</span>
              <span className="text-[10px] text-[#00A651] font-bold bg-[#00A651]/10 px-1.5 py-0.5 rounded border border-[#00A651]/20">
                {lang === "en" ? "Funder Ready" : "Tayari kwa Funder"}
              </span>
            </label>
            <textarea
              required
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={lang === "en" ? "Review, modify, or compose the final text here..." : "Kagua na uandike ripoti kamili hapa..."}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 font-serif leading-relaxed"
            ></textarea>
          </div>

          {/* Submit and Print buttons */}
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              {lang === "en" ? "Discard Draft" : "Tupa Rasimu"}
            </button>
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9V2h12v7"></path>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              {lang === "en" ? "Print Certified PDF" : "Chapa PDF"}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#00A651] hover:bg-[#008f43] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              {lang === "en" ? "Save & Approve Document" : "Hifadhi na Thibitisha"}
            </button>
          </div>
        </form>

        {/* AI Writing assistant Panel - Right */}
        <div className="lg:col-span-5 bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1 rounded bg-[#E31E24]/10 text-[#E31E24]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
                </svg>
              </span>
              <h4 className="text-sm font-bold text-[#1B1B1B] font-sans">
                {lang === "en" ? "Official Draft Assistant" : "Msaidizi wa Kuandika Ripoti"}
              </h4>
            </div>
            
            <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
              {lang === "en"
                ? "Enter rough bullet points, speaker quotes, or scribbled agenda notes below. The draft engine will instantly draft an elegant, formal, structured narrative directly into your editor panel."
                : "Andika muhtasari mfupi, kisha bonyeza kitufe hapa chini. Mfumo utaandika ripoti rasmi kamili yenye muundo mzuri."}
            </p>
            
            <textarea
              rows={8}
              value={roughNotes}
              onChange={(e) => setRoughNotes(e.target.value)}
              placeholder={
                lang === "en"
                  ? "Rough notes:\n- Meeting opened 2pm by Ken\n- Alice read minutes\n- Juma reported 45 girls reached at Maisha shelter\n- Budget approved for stipends 36,000 Ksh"
                  : "Dondoo fupi:\n- Kikao kilifunguliwa saa nane na Ken\n- Juma aliripoti vijana 45 walifikiwa Maisha\n- Bajeti ya posho iliidhinishwa 36,000 Ksh"
              }
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
            ></textarea>

            {aiError && (
              <div className="mt-3 bg-red-50 text-red-600 text-xs p-2 rounded border border-red-100 font-semibold font-sans">
                {aiError}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              disabled={isAiLoading}
              onClick={handleAiAssist}
              className={`w-full py-2 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                isAiLoading
                  ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                  : "bg-[#E31E24] hover:bg-[#c91a1f] text-white shadow-sm"
              }`}
            >
              {isAiLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {lang === "en" ? "Drafting Narrative..." : "Inatengeneza Rasimu..."}
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M12 3v18"></path>
                    <path d="M3 12h18"></path>
                  </svg>
                  {lang === "en" ? "Compose Draft" : "Tengeneza Rasimu"}
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-neutral-400 mt-2">
              Official CBO template engine. All suggestions require human review.
            </p>
          </div>
        </div>
      </div>

      {/* PRINT CERTIFIED DOCUMENT MODAL */}
      <Modal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title={<span className="text-xs font-bold text-neutral-500 uppercase font-mono">Certified Document Preview</span>}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-6 text-neutral-900">
          <div className="flex justify-end print:hidden">
            <button
              onClick={() => window.print()}
              className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9V2h12v7"></path>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              {lang === "en" ? "Print / Save PDF" : "Chapa / Hifadhi PDF"}
            </button>
          </div>

          {/* Printable Area */}
          <div className="p-8 border border-neutral-200 bg-white rounded-lg space-y-6 relative overflow-hidden font-serif">
            {/* CBO Letterhead Header */}
            <div className="flex justify-between items-start border-b-2 border-neutral-900 pb-4">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-[#E31E24] uppercase font-sans tracking-tight">
                  BASHOSHO TALENTS CBO
                </h2>
                <p className="text-[10px] text-neutral-600 font-mono">
                  Reg No: CBO/KBD/500/2023 | P.O. Box 1234-00100 Nairobi
                </p>
                <p className="text-[10px] text-neutral-600 font-mono">
                  Kiambiu Informal Settlement, Kamukunji, Nairobi, Kenya | Till No: 8671238
                </p>
              </div>
              <div className="text-right space-y-0.5 font-mono text-[10px] text-neutral-500">
                <p><strong className="text-neutral-900">DATE:</strong> {document?.date || new Date().toISOString().split("T")[0]}</p>
                <p><strong className="text-neutral-900">TYPE:</strong> {type.toUpperCase()}</p>
                <p><strong className="text-neutral-900">REF:</strong> DOC-{Date.now().toString().slice(-6)}</p>
              </div>
            </div>

            {/* Title & Body */}
            <div className="space-y-3">
              <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight font-sans text-center border-b pb-2">
                {title || "Official CBO Record"}
              </h3>

              <div className="text-xs text-neutral-800 leading-relaxed space-y-3 whitespace-pre-wrap font-serif pt-2">
                {content || "No document body written yet."}
              </div>
            </div>

            {/* Signature & Stamp Certification Block */}
            <div className="pt-8 border-t border-neutral-300 grid grid-cols-2 gap-8 items-end">
              <div className="space-y-2">
                <div className="h-10 border-b border-dashed border-neutral-400 flex items-end">
                  <span className="font-serif italic text-sm text-neutral-800 font-bold">Bashosho Executive Director</span>
                </div>
                <p className="text-[10px] font-mono font-bold text-neutral-600">OFFICIAL SIGNATURE & DATE</p>
                <p className="text-[9px] font-mono text-neutral-400">Author: {authorName}</p>
              </div>

              {/* Stamp overlay */}
              <div className="border-2 border-emerald-600 rounded-xl p-3 text-center bg-emerald-50/30 transform -rotate-2">
                <p className="text-[9px] font-black text-emerald-800 uppercase tracking-widest font-mono">
                  CERTIFIED OFFICIAL CBO RECORD
                </p>
                <p className="text-[8px] font-mono font-bold text-emerald-700">
                  BASHOSHO TALENTS CBO - KIAMBIU
                </p>
                <p className="text-[7px] font-mono text-emerald-600 mt-1">
                  VERIFIED & APPROVED
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
