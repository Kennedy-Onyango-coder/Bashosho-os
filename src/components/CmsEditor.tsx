import React from "react";
import Modal from "./Modal";
import { SiteContent, GalleryImage, Program, Project, PartnerLogo, Asset, TeamMember } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Edit, Trash2, X, UploadCloud, CheckCircle, AlertCircle, Save, Plus, Camera } from "lucide-react";

interface CmsEditorProps {
  lang: "en" | "sw";
}

// Seed values for the Impact Stats / Pillars editors below — must match the defaults in
// HomePage.tsx exactly, so editing starts from what's actually live on the site today
// rather than blank fields.
const DEFAULT_IMPACT_STATS_SEED = [
  { id: "stat-1", value: "5,000+", label: { en: "Youth Engaged Directly", sw: "Vijana Waliofikiwa Moja kwa Moja" }, description: { en: "Through theatre performances, workshops, and film screenings.", sw: "Kupitia maonyesho ya maigizo, warsha, na uonyeshaji wa filamu." } },
  { id: "stat-2", value: "12,000+", label: { en: "Digital Views", sw: "Watazamaji wa Kidijitali" }, description: { en: "Across advocacy film releases on YouTube and social platforms.", sw: "Katika utoaji wa filamu za utetezi kwenye YouTube na mitandao ya kijamii." } },
  { id: "stat-3", value: "350+", label: { en: "Survivors Supported", sw: "Waathirika Waliosaidiwa" }, description: { en: "Referred to local safe houses, legal aid, and counseling partners.", sw: "Waliopelekwa kwenye nyumba salama, msaada wa kisheria, na washauri." } },
  { id: "stat-4", value: "45+", label: { en: "Film Academy Alumni", sw: "Wahitimu wa Chuo cha Filamu" }, description: { en: "Trained in practical filmmaking, sound recording, and editing.", sw: "Waliofundishwa utengenezaji wa filamu, urekodi wa sauti, na uhariri." } }
];

const DEFAULT_PILLARS_SEED = [
  { id: "pillar-1", title: { en: "Theatre Productions", sw: "Uzalishaji wa Maigizo" }, description: { en: "Interactive, forum-style performances staged directly in the community, addressing the issues residents live with every day.", sw: "Maonyesho ya mwingiliano yanayofanyika moja kwa moja jamiini, yakishughulikia masuala wanayokabiliana nayo wakazi kila siku." } },
  { id: "pillar-2", title: { en: "Educational Films", sw: "Filamu za Kielimu" }, description: { en: "Compelling short films and documentary-style content that informs, humanizes, and inspires action long after the credits roll.", sw: "Filamu fupi zenye mvuto na maudhui ya kishairi yanayoelimisha na kuhamasisha hatua." } },
  { id: "pillar-3", title: { en: "Community Workshops", sw: "Warsha za Jamii" }, description: { en: "Hands-on sessions that engage residents in artistic expression, dialogue, and peer-to-peer psychosocial support.", sw: "Vikao vya vitendo vinavyoshirikisha wakazi katika sanaa, mazungumzo, na msaada wa kisaikolojia." } },
  { id: "pillar-4", title: { en: "Advocacy Campaigns", sw: "Kampeni za Utetezi" }, description: { en: "Street marches, banners and coordinated outreach that raise awareness of critical social issues and connect residents to services.", sw: "Maandamano ya mitaani, mabango na uhamasishaji ulioratibiwa unaounganisha wakazi na huduma." } }
];

// The public homepage's team section falls back to these SAME 6 real people whenever
// content.teamMembers is empty in the database (which it always has been on this
// deployment) — meaning this was the real, currently-live team roster, just never
// actually saved into the editable system. Seeding the CMS editor with them means
// there's something to edit instead of a blank list with no way to start except
// retyping all 6 people from scratch.
const DEFAULT_TEAM_MEMBERS_SEED = [
  { id: "tm-1", name: "Kennedy Onyango", title: "Executive Director", bio: "Leading strategy, donor partnerships, organizational governance, and grassroots advocacy in Kiambiu." },
  { id: "tm-2", name: "Michael Kamande", title: "Communications & Marketing", bio: "Directing public relations, media engagement, digital storytelling, and brand outreach." },
  { id: "tm-3", name: "Irene Maina", title: "Programs Coordinator", bio: "Managing community project schedules, stakeholder coordination, and field outreach operations." },
  { id: "tm-4", name: "Morgan Otieno", title: "Theatre and Film Director", bio: "Directing participatory stage performances, scriptwriting, and film production workshops." },
  { id: "tm-5", name: "Paul Ngala", title: "Safeguarding & Field Officer", bio: "Ensuring community safety, ethical referral pathways, and child protection standards." },
  { id: "tm-6", name: "Shaniz Fabrizia", title: "Youth & Gender Officer", bio: "Facilitating youth empowerment, SRHR peer education, and gender equality circles." }
];

export default function CmsEditor({ lang }: CmsEditorProps) {
  const [siteContent, setSiteContent] = React.useState<SiteContent | null>(null);
  const [galleryImages, setGalleryImages] = React.useState<GalleryImage[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Gallery Uploading Form state
  const [galleryCaptionEn, setGalleryCaptionEn] = React.useState("");
  const [galleryCaptionSw, setGalleryCaptionSw] = React.useState("");
  const [galleryOrder, setGalleryOrder] = React.useState(0);
  const [galleryImageBase64, setGalleryImageBase64] = React.useState("");
  const [galleryUploading, setGalleryUploading] = React.useState(false);

  // Editing & Deleting Gallery Images state
  const [editingImage, setEditingImage] = React.useState<GalleryImage | null>(null);
  const [editCaptionEn, setEditCaptionEn] = React.useState("");
  const [editCaptionSw, setEditCaptionSw] = React.useState("");
  const [editOrder, setEditOrder] = React.useState(0);
  const [editImageBase64, setEditImageBase64] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);
  const [deletingImageId, setDeletingImageId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Program/Project/Partner/Equipment/Team modal state (add or edit)
  const [activeProg, setActiveProg] = React.useState<Partial<Program> | null>(null);
  const [activeProj, setActiveProj] = React.useState<Partial<Project> | null>(null);
  const [activePartner, setActivePartner] = React.useState<Partial<PartnerLogo> | null>(null);
  const [activeEquipment, setActiveEquipment] = React.useState<Partial<Asset> | null>(null);
  const [activeTeamMember, setActiveTeamMember] = React.useState<Partial<TeamMember> | null>(null);

  const [activeTab, setActiveTab] = React.useState<"hero_about" | "programs" | "projects" | "partners" | "equipment" | "gallery" | "role_templates" | "team">("hero_about");

  // Equipment/gear-for-hire — this tab manages the SAME `assets` collection used by the
  // Assets module and the public homepage's equipment-hire section (previously this tab
  // wrote to a separate, never-read `content.equipmentList` field: anything added or
  // edited here silently never appeared on the actual public site).
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [assetsError, setAssetsError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [contentRes, galleryRes] = await Promise.all([
        fetch("/api/public/site_content"),
        fetch("/api/public/gallery_images")
      ]);

      if (contentRes.ok) {
        const contentData = await contentRes.json();
        setSiteContent(contentData);
      } else {
        throw new Error("Failed to fetch site content");
      }

      if (galleryRes.ok) {
        const galleryData = await galleryRes.json();
        setGalleryImages(galleryData);
      }

      // Real asset inventory (the same data the public homepage's equipment-hire
      // section and the internal Assets module both read from). A 403 here just means
      // this account's role doesn't have assets:view — handled gracefully below rather
      // than failing the whole CMS load.
      try {
        const assetsRes = await fetch("/api/assets");
        if (assetsRes.ok) {
          setAssets(await assetsRes.json());
          setAssetsError(null);
        } else if (assetsRes.status === 403) {
          setAssetsError(lang === "en"
            ? "Your role doesn't have permission to view the equipment inventory. Ask a Chairperson, Programs Director, or Treasurer to grant Assets access, or to manage equipment for you."
            : "Wadhifa wako hauna ruhusa ya kuona orodha ya vifaa. Muulize Mwenyekiti, Mkurugenzi wa Miradi, au Mhazini akupe ruhusa ya Assets.");
        }
      } catch {
        setAssetsError(lang === "en" ? "Failed to load equipment inventory." : "Imeshindwa kupakia orodha ya vifaa.");
      }
    } catch (err: any) {
      console.error(err);
      setError(lang === "en" ? "Failed to load site content for editing." : "Imeshindwa kupakia maudhui ya uhariri.");
    } finally {
      setLoading(false);
    }
  }, [lang]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle saving the core site content (hero, about, programs list, projects list, contact)
  // Extracted so individual list-item mutations (partners, team, equipment) can persist
  // immediately with an explicitly-built object, rather than relying on handleSaveContent's
  // reliance on the `siteContent` state variable — which would still read the OLD value if
  // called right after setSiteContent(), since React state updates aren't synchronous.
  const persistSiteContent = async (newContent: any, successMessage?: string) => {
    setSaving(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/site_content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContent)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(successMessage || (lang === "en" ? "Saved successfully!" : "Imehifadhiwa kwa ufanisi!"));
        fetchData();
        return true;
      } else {
        setError(data.error || "Failed to save.");
        return false;
      }
    } catch (err) {
      console.error(err);
      setError(lang === "en" ? "Connection failed." : "Mawasiliano na seva yamefeli.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContent = async () => {
    if (!siteContent) return;
    await persistSiteContent(siteContent, lang === "en" ? "Homepage site content updated successfully!" : "Maudhui ya ukurasa yamehifadhiwa kwa ufanisi!");
  };

  // Helper: Convert client image files to compressed WebP data URL
  const convertToWebP = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        let width = img.width;
        let height = img.height;
        const maxDim = 1920;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const webpDataUrl = canvas.toDataURL("image/webp", 0.82);
          resolve(webpDataUrl);
        } else {
          reject(new Error("Canvas context failed"));
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image load failed for WebP conversion"));
      };
      img.src = url;
    });
  };

  // Helper: upload custom image via private base64 proxy
  const handleImageUpload = async (file: File): Promise<string> => {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("File size exceeds 10MB limit");
    }
    const webpBase64 = await convertToWebP(file);
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name.replace(/\.[^/.]+$/, "") + ".webp",
        image: webpBase64
      })
    });
    const data = await res.json();
    if (res.ok && data.url) {
      return data.url;
    } else {
      throw new Error(data.error || "Upload proxy error");
    }
  };

  // Handle uploading new gallery image
  const handleGalleryUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryImageBase64) return;

    setGalleryUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/gallery_images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: galleryImageBase64,
          caption: {
            en: galleryCaptionEn,
            sw: galleryCaptionSw
          },
          order: galleryOrder
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(lang === "en" ? "Gallery image uploaded successfully!" : "Picha ya sanaa imepakiwa kwa ufanisi!");
        setGalleryCaptionEn("");
        setGalleryCaptionSw("");
        setGalleryImageBase64("");
        setGalleryOrder(prev => prev + 1);
        fetchData();
      } else {
        setError(data.error || "Failed to upload gallery image.");
      }
    } catch (err) {
      console.error(err);
      setError(lang === "en" ? "Failed to upload." : "Imeshindwa kupakia picha.");
    } finally {
      setGalleryUploading(false);
    }
  };

  // Handle saving an edited gallery image
  const handleGalleryEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingImage) return;

    setEditSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/gallery_images/${editingImage.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: editImageBase64 || undefined,
          caption: {
            en: editCaptionEn,
            sw: editCaptionSw
          },
          order: editOrder
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(lang === "en" ? "Gallery image updated successfully!" : "Picha ya sanaa imesasishwa kwa ufanisi!");
        setEditingImage(null);
        setEditCaptionEn("");
        setEditCaptionSw("");
        setEditImageBase64("");
        setEditOrder(0);
        fetchData();
      } else {
        setError(data.error || "Failed to update gallery image.");
      }
    } catch (err) {
      console.error(err);
      setError(lang === "en" ? "Failed to save changes." : "Imeshindwa kuhifadhi mabadiliko.");
    } finally {
      setEditSaving(false);
    }
  };

  // Handle deleting a gallery image
  const handleGalleryDelete = async (id: string) => {
    setIsDeleting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/gallery_images/${id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(lang === "en" ? "Gallery image deleted successfully." : "Picha ya sanaa imefutwa kwa ufanisi.");
        setDeletingImageId(null);
        fetchData();
      } else {
        setError(data.error || "Failed to delete image.");
      }
    } catch (err) {
      console.error(err);
      setError(lang === "en" ? "Failed to delete gallery image." : "Imeshindwa kufuta picha.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#E31E24] border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs text-gray-400 font-mono tracking-widest uppercase">{lang === "en" ? "Loading CMS system..." : "Inafungua CMS..."}</p>
      </div>
    );
  }

  const content = siteContent!;

  return (
    <div className="space-y-6 text-left">
      {/* CMS HEADER CARD */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-xs font-bold text-[#E31E24] uppercase tracking-wider block">
            {lang === "en" ? "HOMEPAGE CMS & PUBLISHING" : "USIMAMIZI WA MAUDHUI YA TOVUTI"}
          </span>
          <h2 className="text-xl font-black text-gray-900 tracking-tight font-sans">
            {lang === "en" ? "Public Website CMS Editor" : "Mhariri mkuu wa Maudhui"}
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            {lang === "en" ? "Update hero banners, localized mission texts, CBO pillars, specific creative productions, and live gallery records." : "Hariri mabango ya juu, kauli mbiu, misingi ya kazi za vijana, na picha za mafanikio yetu."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSaveContent}
            disabled={saving}
            className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {lang === "en" ? "Publishing..." : "Inahifadhi..."}
              </>
            ) : (
              lang === "en" ? " Publish Site Content" : " Hifadhi na Toa Maudhui"
            )}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
           {successMsg}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl">
          ️ {error}
        </div>
      )}

      {/* SUB-TABS NAVIGATION */}
      <div className="flex flex-wrap border-b border-gray-200 text-xs font-bold gap-6">
        <button
          onClick={() => setActiveTab("hero_about")}
          className={`pb-3 border-b-2 px-1 cursor-pointer transition-all ${
            activeTab === "hero_about" ? "border-b-[#E31E24] text-[#E31E24]" : "border-b-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
           {lang === "en" ? "About" : "Bango na Kuhusu"}
        </button>
        <button
          onClick={() => setActiveTab("programs")}
          className={`pb-3 border-b-2 px-1 cursor-pointer transition-all ${
            activeTab === "programs" ? "border-b-[#E31E24] text-[#E31E24]" : "border-b-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
           {lang === "en" ? "Programs" : "Programu zetu"}
        </button>
        <button
          onClick={() => setActiveTab("projects")}
          className={`pb-3 border-b-2 px-1 cursor-pointer transition-all ${
            activeTab === "projects" ? "border-b-[#E31E24] text-[#E31E24]" : "border-b-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
           {lang === "en" ? "Projects" : "Filamu na Miradi"}
        </button>
        <button
          onClick={() => setActiveTab("partners")}
          className={`pb-3 border-b-2 px-1 cursor-pointer transition-all ${
            activeTab === "partners" ? "border-b-[#E31E24] text-[#E31E24]" : "border-b-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
           {lang === "en" ? "Partners" : "Washirika na Wadhamini"}
        </button>
        <button
          onClick={() => setActiveTab("equipment")}
          className={`pb-3 border-b-2 px-1 cursor-pointer transition-all ${
            activeTab === "equipment" ? "border-b-[#E31E24] text-[#E31E24]" : "border-b-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
           {lang === "en" ? "Equipment" : "Vifaa na Mitambo"}
        </button>
        <button
          onClick={() => setActiveTab("gallery")}
          className={`pb-3 border-b-2 px-1 cursor-pointer transition-all ${
            activeTab === "gallery" ? "border-b-[#E31E24] text-[#E31E24]" : "border-b-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
           {lang === "en" ? "Gallery" : "Maktaba ya Picha"}
        </button>
        <button
          onClick={() => setActiveTab("role_templates")}
          className={`pb-3 border-b-2 px-1 cursor-pointer transition-all ${
            activeTab === "role_templates" ? "border-b-[#E31E24] text-[#E31E24]" : "border-b-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
           {lang === "en" ? "Templates" : "Mifano ya Majukumu"}
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={`pb-3 border-b-2 px-1 cursor-pointer transition-all ${
            activeTab === "team" ? "border-b-[#E31E24] text-[#E31E24]" : "border-b-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
           {lang === "en" ? "Team" : "Viongozi na Timu"}
        </button>
      </div>

      {/* CMS EDIT PANELS */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-xs">
        {/* PANEL A: HERO & ABOUT TEXTS */}
        {activeTab === "hero_about" && (
          <div className="space-y-6">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider border-b pb-2">
              Website Greeting, Heading Banner and Context
            </h3>

            {/* Localized Hero Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Hero Title (English)</label>
                <input
                  type="text"
                  value={content.heroTitle.en}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSiteContent(prev => ({ ...prev!, heroTitle: { ...prev!.heroTitle, en: val } }));
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Hero Title (Swahili)</label>
                <input
                  type="text"
                  value={content.heroTitle.sw}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSiteContent(prev => ({ ...prev!, heroTitle: { ...prev!.heroTitle, sw: val } }));
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            {/* Hero Image Url */}
            <div className="grid grid-cols-1 gap-6 pt-4 border-t">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Hero Background Image URL or Upload</label>
                <div className="flex gap-4 items-center">
                  <input
                    type="text"
                    value={content.heroImageUrl || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, heroImageUrl: val }));
                    }}
                    placeholder="/public/assets/theatre_transformation_hero.jpg"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const url = await handleImageUpload(file);
                          setSiteContent(prev => ({ ...prev!, heroImageUrl: url }));
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }
                    }}
                    className="hidden"
                    id="hero-image-uploader"
                  />
                  <label
                    htmlFor="hero-image-uploader"
                    className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer shrink-0 transition-colors"
                  >
                    Upload Photo
                  </label>
                </div>
              </div>
            </div>

            {/* Localized Hero Subtitle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Hero Subtitle (English)</label>
                <textarea
                  rows={3}
                  value={content.heroSubtitle.en}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSiteContent(prev => ({ ...prev!, heroSubtitle: { ...prev!.heroSubtitle, en: val } }));
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-none"
                ></textarea>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Hero Subtitle (Swahili)</label>
                <textarea
                  rows={3}
                  value={content.heroSubtitle.sw}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSiteContent(prev => ({ ...prev!, heroSubtitle: { ...prev!.heroSubtitle, sw: val } }));
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-none"
                ></textarea>
              </div>
            </div>

            {/* Localized About Text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">About CBO description (English)</label>
                <textarea
                  rows={4}
                  value={content.aboutText.en}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSiteContent(prev => ({ ...prev!, aboutText: { ...prev!.aboutText, en: val } }));
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-none"
                ></textarea>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">About CBO description (Swahili)</label>
                <textarea
                  rows={4}
                  value={content.aboutText.sw}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSiteContent(prev => ({ ...prev!, aboutText: { ...prev!.aboutText, sw: val } }));
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-none"
                ></textarea>
              </div>
            </div>

            {/* Localized Vision Text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">CBO Vision text (English)</label>
                <textarea
                  rows={3}
                  value={content.visionText?.en || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSiteContent(prev => ({
                      ...prev!,
                      visionText: { ...prev!.visionText || { en: "", sw: "" }, en: val }
                    }));
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-none"
                ></textarea>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">CBO Vision text (Swahili)</label>
                <textarea
                  rows={3}
                  value={content.visionText?.sw || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSiteContent(prev => ({
                      ...prev!,
                      visionText: { ...prev!.visionText || { en: "", sw: "" }, sw: val }
                    }));
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-none"
                ></textarea>
              </div>
            </div>

            {/* Localized Mission Text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">CBO Mission text (English)</label>
                <textarea
                  rows={3}
                  value={content.missionText.en}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSiteContent(prev => ({ ...prev!, missionText: { ...prev!.missionText, en: val } }));
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-none"
                ></textarea>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">CBO Mission text (Swahili)</label>
                <textarea
                  rows={3}
                  value={content.missionText.sw}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSiteContent(prev => ({ ...prev!, missionText: { ...prev!.missionText, sw: val } }));
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-none"
                ></textarea>
              </div>
            </div>

            {/* Static Contact Details */}
            <div className="pt-4 border-t space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Contact details & footer records</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Contact Email</label>
                  <input
                    type="email"
                    value={content.contactEmail}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, contactEmail: val }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Contact Phone</label>
                  <input
                    type="text"
                    value={content.contactPhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, contactPhone: val }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Physical Address</label>
                  <input
                    type="text"
                    value={content.contactAddress}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, contactAddress: val }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Facebook Page URL</label>
                  <input
                    type="url"
                    placeholder="https://facebook.com/..."
                    value={content.facebookUrl || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, facebookUrl: val }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Production & Sound Gear Section Banner Header Editor */}
            <div className="pt-4 border-t space-y-4">
              <h4 className="text-[10px] font-black text-[#E31E24] uppercase tracking-wider">Production & Sound Gear Section Banner Header</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Equipment Eyebrow Tag (English)</label>
                  <input
                    type="text"
                    value={content.equipmentEyebrow?.en || "PRODUCTION & SOUND GEAR"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, equipmentEyebrow: { en: val, sw: prev?.equipmentEyebrow?.sw || "KODI VIFAA VYA UTENGENEZAJI" } }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Equipment Eyebrow Tag (Swahili)</label>
                  <input
                    type="text"
                    value={content.equipmentEyebrow?.sw || "KODI VIFAA VYA UTENGENEZAJI"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, equipmentEyebrow: { en: prev?.equipmentEyebrow?.en || "PRODUCTION & SOUND GEAR", sw: val } }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Equipment Section Title (English)</label>
                  <input
                    type="text"
                    value={content.equipmentTitle?.en || "Hire Our Equipment & Gear"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, equipmentTitle: { en: val, sw: prev?.equipmentTitle?.sw || "Kodi Vifaa vyetu vya Cinema na Sauti" } }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Equipment Section Title (Swahili)</label>
                  <input
                    type="text"
                    value={content.equipmentTitle?.sw || "Kodi Vifaa vyetu vya Cinema na Sauti"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, equipmentTitle: { en: prev?.equipmentTitle?.en || "Hire Our Equipment & Gear", sw: val } }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Equipment Subtitle/Description (English)</label>
                  <textarea
                    rows={2}
                    value={content.equipmentSubtitle?.en || "Subsidize community creative projects by hiring our high-grade cinema cameras, audio kits, and PA sound gear. All rental proceeds fund youth workshops."}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, equipmentSubtitle: { en: val, sw: prev?.equipmentSubtitle?.sw || "Kodi kamera, vifaa vya sauti na taa za kisasa..." } }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium"
                  ></textarea>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Equipment Subtitle/Description (Swahili)</label>
                  <textarea
                    rows={2}
                    value={content.equipmentSubtitle?.sw || "Kodi kamera, vifaa vya sauti na taa za kisasa ili kusaidia mafunzo ya vijana na kazi zetu za jamii."}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, equipmentSubtitle: { en: prev?.equipmentSubtitle?.en || "Subsidize community...", sw: val } }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium"
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Gallery Section Banner Header Editor */}
            <div className="pt-4 border-t space-y-4">
              <h4 className="text-[10px] font-black text-[#E31E24] uppercase tracking-wider">Gallery Section Banner Header</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Gallery Eyebrow Tag (English)</label>
                  <input
                    type="text"
                    value={content.galleryEyebrow?.en || "COMMUNITY ACTIVISM IN PICTURES"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, galleryEyebrow: { en: val, sw: prev?.galleryEyebrow?.sw || "UHAMASISHAJI WA JAMII KATIKA PICHA" } }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Gallery Eyebrow Tag (Swahili)</label>
                  <input
                    type="text"
                    value={content.galleryEyebrow?.sw || "UHAMASISHAJI WA JAMII KATIKA PICHA"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, galleryEyebrow: { en: prev?.galleryEyebrow?.en || "COMMUNITY ACTIVISM IN PICTURES", sw: val } }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Gallery Section Title (English)</label>
                  <input
                    type="text"
                    value={content.galleryTitle?.en || "Behind the Scenes & Field Outreach"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, galleryTitle: { en: val, sw: prev?.galleryTitle?.sw || "Nyuma ya Pazia na Ufikiaji wa Jamii" } }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Gallery Section Title (Swahili)</label>
                  <input
                    type="text"
                    value={content.galleryTitle?.sw || "Nyuma ya Pazia na Ufikiaji wa Jamii"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, galleryTitle: { en: prev?.galleryTitle?.en || "Behind the Scenes & Field Outreach", sw: val } }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Gallery Subtitle/Description (English)</label>
                  <textarea
                    rows={2}
                    value={content.gallerySubtitle?.en || "Real moments from set, street marches, mental health circles, and community dialogues across Kiambiu slum and Nairobi."}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, gallerySubtitle: { en: val, sw: prev?.gallerySubtitle?.sw || "Nyakati halisi kutoka setini, maandamano ya mitaani..." } }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium"
                  ></textarea>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Gallery Subtitle/Description (Swahili)</label>
                  <textarea
                    rows={2}
                    value={content.gallerySubtitle?.sw || "Nyakati halisi kutoka setini, maandamano ya mitaani, miduara ya afya ya akili, na majadiliano ya jamii katika mtaa wa Kiambiu na Nairobi."}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({ ...prev!, gallerySubtitle: { en: prev?.gallerySubtitle?.en || "Real moments from set...", sw: val } }));
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium"
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Impact & Reach stats — fixed at 4 cards to match the homepage grid layout,
                so this edits values/labels/descriptions rather than adding/removing cards. */}
            <div className="pt-6 border-t space-y-4">
              <div>
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Impact & Reach Stats</h3>
                <p className="text-xs text-gray-500 mt-1">The 4 result cards shown under "Impact & Reach" on the homepage.</p>
              </div>
              {(content.impactStats && content.impactStats.length === 4 ? content.impactStats : DEFAULT_IMPACT_STATS_SEED).map((stat, idx) => (
                <div key={stat.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Value (e.g. "5,000+")</label>
                      <input
                        type="text"
                        value={stat.value}
                        onChange={(e) => {
                          const base = content.impactStats && content.impactStats.length === 4 ? content.impactStats : DEFAULT_IMPACT_STATS_SEED;
                          const updated = [...base];
                          updated[idx] = { ...updated[idx], value: e.target.value };
                          setSiteContent(prev => ({ ...prev!, impactStats: updated }));
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-black font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Label (English)</label>
                      <input
                        type="text"
                        value={stat.label.en}
                        onChange={(e) => {
                          const base = content.impactStats && content.impactStats.length === 4 ? content.impactStats : DEFAULT_IMPACT_STATS_SEED;
                          const updated = [...base];
                          updated[idx] = { ...updated[idx], label: { ...updated[idx].label, en: e.target.value } };
                          setSiteContent(prev => ({ ...prev!, impactStats: updated }));
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Label (Swahili)</label>
                      <input
                        type="text"
                        value={stat.label.sw}
                        onChange={(e) => {
                          const base = content.impactStats && content.impactStats.length === 4 ? content.impactStats : DEFAULT_IMPACT_STATS_SEED;
                          const updated = [...base];
                          updated[idx] = { ...updated[idx], label: { ...updated[idx].label, sw: e.target.value } };
                          setSiteContent(prev => ({ ...prev!, impactStats: updated }));
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Description (English)</label>
                      <input
                        type="text"
                        value={stat.description.en}
                        onChange={(e) => {
                          const base = content.impactStats && content.impactStats.length === 4 ? content.impactStats : DEFAULT_IMPACT_STATS_SEED;
                          const updated = [...base];
                          updated[idx] = { ...updated[idx], description: { ...updated[idx].description, en: e.target.value } };
                          setSiteContent(prev => ({ ...prev!, impactStats: updated }));
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Description (Swahili)</label>
                      <input
                        type="text"
                        value={stat.description.sw}
                        onChange={(e) => {
                          const base = content.impactStats && content.impactStats.length === 4 ? content.impactStats : DEFAULT_IMPACT_STATS_SEED;
                          const updated = [...base];
                          updated[idx] = { ...updated[idx], description: { ...updated[idx].description, sw: e.target.value } };
                          setSiteContent(prev => ({ ...prev!, impactStats: updated }));
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Four Pillars / methodology — also fixed at 4 to match the homepage layout;
                icon and color per card are fixed by position and not edited here. */}
            <div className="pt-6 border-t space-y-4">
              <div>
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Four Pillars / Methodology</h3>
                <p className="text-xs text-gray-500 mt-1">The 4 methodology cards shown under "Our Methodology" on the homepage.</p>
              </div>
              {(content.pillars && content.pillars.length === 4 ? content.pillars : DEFAULT_PILLARS_SEED).map((pillar, idx) => (
                <div key={pillar.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Title (English)</label>
                      <input
                        type="text"
                        value={pillar.title.en}
                        onChange={(e) => {
                          const base = content.pillars && content.pillars.length === 4 ? content.pillars : DEFAULT_PILLARS_SEED;
                          const updated = [...base];
                          updated[idx] = { ...updated[idx], title: { ...updated[idx].title, en: e.target.value } };
                          setSiteContent(prev => ({ ...prev!, pillars: updated }));
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Title (Swahili)</label>
                      <input
                        type="text"
                        value={pillar.title.sw}
                        onChange={(e) => {
                          const base = content.pillars && content.pillars.length === 4 ? content.pillars : DEFAULT_PILLARS_SEED;
                          const updated = [...base];
                          updated[idx] = { ...updated[idx], title: { ...updated[idx].title, sw: e.target.value } };
                          setSiteContent(prev => ({ ...prev!, pillars: updated }));
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Description (English)</label>
                      <textarea
                        rows={2}
                        value={pillar.description.en}
                        onChange={(e) => {
                          const base = content.pillars && content.pillars.length === 4 ? content.pillars : DEFAULT_PILLARS_SEED;
                          const updated = [...base];
                          updated[idx] = { ...updated[idx], description: { ...updated[idx].description, en: e.target.value } };
                          setSiteContent(prev => ({ ...prev!, pillars: updated }));
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs font-medium"
                      ></textarea>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Description (Swahili)</label>
                      <textarea
                        rows={2}
                        value={pillar.description.sw}
                        onChange={(e) => {
                          const base = content.pillars && content.pillars.length === 4 ? content.pillars : DEFAULT_PILLARS_SEED;
                          const updated = [...base];
                          updated[idx] = { ...updated[idx], description: { ...updated[idx].description, sw: e.target.value } };
                          setSiteContent(prev => ({ ...prev!, pillars: updated }));
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs font-medium"
                      ></textarea>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PANEL B: PILLARS / PROGRAMS LIST EDITOR */}
        {activeTab === "programs" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                Manage Core Programs & Till Number Details
              </h3>
              <button
                onClick={() => setActiveProg({ id: `prog-${Date.now()}`, title: { en: "", sw: "" }, description: { en: "", sw: "" }, photoUrl: "" })}
                className="bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
              >
                + Add Program Pillar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.programs.map((prog, index) => (
                <div key={prog.id} className="p-4 border rounded-xl flex items-start gap-4 bg-gray-50/30">
                  <div className="w-16 h-16 rounded overflow-hidden bg-neutral-200 shrink-0 border relative flex items-center justify-center text-xs">
                    {prog.photoUrl ? (
                      <img src={prog.photoUrl} alt="Program" className="w-full h-full object-cover" />
                    ) : (
                      "No Image"
                    )}
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="text-xs font-bold text-gray-900">{prog.title[lang]}</h4>
                    <p className="text-[10px] text-gray-500 line-clamp-2">{prog.description[lang]}</p>
                    {prog.supportTillNumber && (
                      <span className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-800 text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded">
                        M-PESA Till: {prog.supportTillNumber}
                      </span>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setActiveProg(prog)}
                        className="text-blue-600 hover:underline text-[10px] font-bold cursor-pointer"
                      >
                        Edit Details
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm("Remove this program?")) {
                            const updated = content.programs.filter((_, i) => i !== index);
                            setSiteContent(prev => ({ ...prev!, programs: updated }));
                          }
                        }}
                        className="text-red-600 hover:underline text-[10px] font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PANEL C: CREATIVE PRODUCTIONS / PROJECTS LIST EDITOR */}
        {activeTab === "projects" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                Manage Films, Theatre Outputs, or Outreach Projects
              </h3>
              <button
                onClick={() => setActiveProj({ id: `proj-${Date.now()}`, title: { en: "", sw: "" }, description: { en: "", sw: "" }, photoUrl: "", category: "general" })}
                className="bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
              >
                + Add Film/Project
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.projects.map((proj, index) => (
                <div key={proj.id} className="p-4 border rounded-xl flex items-start gap-4 bg-gray-50/30">
                  <div className="w-16 h-16 rounded overflow-hidden bg-neutral-200 shrink-0 border relative flex items-center justify-center text-xs">
                    {proj.photoUrl ? (
                      <img src={proj.photoUrl} alt="Project" className="w-full h-full object-cover" />
                    ) : (
                      "No Image"
                    )}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-gray-900">{proj.title[lang]}</h4>
                      <span className="bg-[#E31E24] text-white text-[8px] font-black uppercase px-1.5 rounded">
                        {proj.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 line-clamp-2">{proj.description[lang]}</p>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setActiveProj(proj)}
                        className="text-blue-600 hover:underline text-[10px] font-bold cursor-pointer"
                      >
                        Edit Details
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm("Remove this project?")) {
                            const updated = content.projects.filter((_, i) => i !== index);
                            setSiteContent(prev => ({ ...prev!, projects: updated }));
                          }
                        }}
                        className="text-red-600 hover:underline text-[10px] font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PANEL D: PUBLIC GALLERY MANAGER */}
        {activeTab === "gallery" && (
          <div className="space-y-8">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider border-b pb-2">
              Upload New High-Resolution Gallery Photo
            </h3>

            {/* Upload Gallery Photo form */}
            <form onSubmit={handleGalleryUpload} className="bg-gray-50/50 p-6 rounded-2xl border grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Image selector frame */}
              <div className="md:col-span-4 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-gray-300 rounded-xl p-4 bg-white">
                <span className="text-3xl"></span>
                <span className="text-[10px] font-black text-gray-600 uppercase">Select JPEG Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const webpBase64 = await convertToWebP(file);
                        setGalleryImageBase64(webpBase64);
                      } catch (err: any) {
                        alert("WebP conversion error: " + err.message);
                      }
                    }
                  }}
                  className="hidden"
                  id="cms-gallery-upload-input"
                />
                <label
                  htmlFor="cms-gallery-upload-input"
                  className="bg-gray-100 hover:bg-gray-200 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  Choose File
                </label>
                {galleryImageBase64 ? (
                  <div className="relative w-16 h-16 border rounded overflow-hidden">
                    <img src={galleryImageBase64} alt="Gallery Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <span className="text-[9px] text-gray-400 font-medium">5MB Max. JPG or PNG.</span>
                )}
              </div>

              {/* Caption inputs & submit */}
              <div className="md:col-span-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Caption (English)</label>
                    <input
                      type="text"
                      required
                      value={galleryCaptionEn}
                      onChange={(e) => setGalleryCaptionEn(e.target.value)}
                      placeholder="e.g. Outreach roadshow at Kiambiu Hall"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Caption (Swahili)</label>
                    <input
                      type="text"
                      required
                      value={galleryCaptionSw}
                      onChange={(e) => setGalleryCaptionSw(e.target.value)}
                      placeholder="e.g. Roadshow ya ushiriki kumbi la Kiambiu"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Sorting Order (Sequence number)</label>
                    <input
                      type="number"
                      required
                      value={galleryOrder}
                      onChange={(e) => setGalleryOrder(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={galleryUploading || !galleryImageBase64}
                      className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      {galleryUploading ? "Uploading..." : "Publish to Public Gallery"}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Gallery images grid list */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Existing Published Gallery images ({galleryImages.length})
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {galleryImages.map((img) => (
                  <div key={img.id} className="border rounded-xl overflow-hidden bg-gray-50 flex flex-col justify-between group relative hover:shadow-md transition-all duration-200">
                    <div className="aspect-square bg-neutral-200 relative overflow-hidden">
                      <img src={img?.imageUrl || ""} alt="Gallery" className="w-full h-full object-cover" />
                      
                      {/* Order Tag */}
                      <span className="absolute top-2 left-2 bg-neutral-900/80 text-white font-mono text-[9px] px-1.5 py-0.5 rounded font-bold z-10">
                        Order: {img.order}
                      </span>

                      {/* Action buttons Overlay */}
                      <div className="absolute top-2 right-2 flex gap-1 z-10">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingImage(img);
                            setEditCaptionEn(img.caption.en);
                            setEditCaptionSw(img.caption.sw);
                            setEditOrder(img.order);
                            setEditImageBase64("");
                          }}
                          className="p-1.5 bg-white/90 hover:bg-white text-neutral-800 rounded-lg shadow-sm border border-neutral-200/50 hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
                          title={lang === "en" ? "Edit details" : "Hariri maelezo"}
                        >
                          <Edit size={12} className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingImageId(img.id)}
                          className="p-1.5 bg-white/90 hover:bg-red-50 text-neutral-500 hover:text-red-600 rounded-lg shadow-sm border border-neutral-200/50 hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
                          title={lang === "en" ? "Delete image" : "Futa picha"}
                        >
                          <Trash2 size={12} className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="p-3 text-left">
                      <p className="text-[10px] font-bold text-gray-900 line-clamp-1">{img.caption.en}</p>
                      <p className="text-[9px] text-gray-500 line-clamp-1">{img.caption.sw}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PANEL E: LEADERSHIP ROLE TEMPLATES */}
        {activeTab === "role_templates" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider border-b pb-2 mb-3">
                {lang === "en" ? "Leadership Role Appointment Templates" : "Mifano ya Majukumu ya Teuzi za Uongozi"}
              </h3>
              <p className="text-xs text-gray-500 mb-6">
                {lang === "en" ? "These templates pre-fill the responsibilities field when appointing new leaders. Kennedy can edit these default English and Swahili text versions." : "Mifano hii inajaza kiotomatiki sehemu ya majukumu wakati wa kuteua viongozi wapya. Kennedy anaweza kuhariri matoleo haya ya Kiingereza na Kiswahili."}
              </p>
            </div>

            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {(content.roleTemplates || []).map((template, idx) => (
                <div key={template.role} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider font-mono">
                       {template.role}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Responsibilities (English)</label>
                      <textarea
                        rows={3}
                        value={template.responsibilities.en}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updatedTemplates = [...(content.roleTemplates || [])];
                          updatedTemplates[idx] = {
                            ...template,
                            responsibilities: { ...template.responsibilities, en: val }
                          };
                          setSiteContent(prev => ({ ...prev!, roleTemplates: updatedTemplates }));
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs font-medium focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Majukumu (Kiswahili)</label>
                      <textarea
                        rows={3}
                        value={template.responsibilities.sw}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updatedTemplates = [...(content.roleTemplates || [])];
                          updatedTemplates[idx] = {
                            ...template,
                            responsibilities: { ...template.responsibilities, sw: val }
                          };
                          setSiteContent(prev => ({ ...prev!, roleTemplates: updatedTemplates }));
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs font-medium focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PANEL D: PARTNERS & SPONSORS */}
        {activeTab === "partners" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                  Trusted Partners & Donors
                </h3>
                <p className="text-xs text-gray-500">Manage partners, funding organizations, and NGO logos displayed on homepage.</p>
              </div>
              <button
                type="button"
                onClick={() => setActivePartner({ id: `partner-${Date.now()}`, name: "", category: "", logoUrl: "" })}
                className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={14} /> Add Partner / Sponsor
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {((content.partnersList && content.partnersList.length > 0)
                ? content.partnersList
                : [
                    { id: "p1", name: "Kiambiu Justice & Info Net", category: "Civil Society" },
                    { id: "p2", name: "HESED Africa", category: "NGO Partner" },
                    { id: "p3", name: "Maisha Girls Safe House", category: "Protection Partner" },
                    { id: "p4", name: "Tusikimye", category: "Gender Rights" },
                    { id: "p5", name: "Teenseed Africa", category: "Youth Empowerment" },
                    { id: "p6", name: "Africa Uncensored", category: "Media Partner" },
                    { id: "p7", name: "IWPR", category: "Human Rights" },
                    { id: "p8", name: "Danish Minority Centre", category: "International Funder" },
                    { id: "p9", name: "Peace at Heart Initiative", category: "Community Network" }
                  ]
              ).map((partner) => (
                <div key={partner.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative group">
                  <div className="flex items-center gap-3">
                    {partner.logoUrl ? (
                      <img src={partner.logoUrl} alt={partner.name} className="w-12 h-12 object-contain bg-white p-1 rounded-xl border border-gray-200 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-red-100 text-[#E31E24] font-black flex items-center justify-center text-sm border border-red-200 shrink-0">
                        {partner.name.substring(0, 2)}
                      </div>
                    )}
                    <div className="space-y-0.5 overflow-hidden">
                      <h4 className="text-xs font-black text-gray-900 truncate">{partner.name}</h4>
                      <p className="text-[10px] text-gray-500 font-mono font-medium">{partner.category || "Partner"}</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setActivePartner(partner)}
                      className="p-1.5 bg-white hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete "${partner.name}"? This saves immediately.`)) return;
                        const updated = (content.partnersList || []).filter(p => p.id !== partner.id);
                        const updatedContent = { ...content, partnersList: updated };
                        setSiteContent(updatedContent as any);
                        await persistSiteContent(updatedContent, lang === "en" ? "Partner deleted and saved." : "Mshirika amefutwa na kuhifadhiwa.");
                      }}
                      className="p-1.5 bg-white hover:bg-red-50 text-red-600 rounded-lg border border-red-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PANEL E: EQUIPMENT & GEAR */}
        {activeTab === "equipment" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                  Equipment Hire & Sound Gear CMS
                </h3>
                <p className="text-xs text-gray-500">Edit cinema camera rentals, PA sound kits, lighting gear and rental rates.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveEquipment({
                  id: `ast-${Date.now()}`,
                  name: "",
                  category: "camera",
                  dailyRate: 2000,
                  condition: "excellent",
                  photoUrl: "",
                  availableForHire: true,
                  custodian: "",
                  location: "Bashosho Studio",
                  serialNumber: "",
                  purchaseDate: new Date().toISOString().slice(0, 10),
                  purchaseCost: 0,
                  checkoutHistory: []
                })}
                className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={14} /> Add Gear / Equipment Item
              </button>
            </div>

            {/* Header Titles Editing */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-4">
              <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">Section Header Titles</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Section Eyebrow (English)</label>
                  <input
                    type="text"
                    value={content.equipmentEyebrow?.en || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({
                        ...prev!,
                        equipmentEyebrow: { ...prev!.equipmentEyebrow || { en: "", sw: "" }, en: val }
                      }));
                    }}
                    placeholder="PRODUCTION & SOUND GEAR"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Section Title (English)</label>
                  <input
                    type="text"
                    value={content.equipmentTitle?.en || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteContent(prev => ({
                        ...prev!,
                        equipmentTitle: { ...prev!.equipmentTitle || { en: "", sw: "" }, en: val }
                      }));
                    }}
                    placeholder="Hire Our Equipment & Gear"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Section Subtitle / Description (English)</label>
                <textarea
                  rows={2}
                  value={content.equipmentSubtitle?.en || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSiteContent(prev => ({
                      ...prev!,
                      equipmentSubtitle: { ...prev!.equipmentSubtitle || { en: "", sw: "" }, en: val }
                    }));
                  }}
                  placeholder="Subsidize community creative projects by hiring our high-grade cinema cameras..."
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-medium"
                ></textarea>
              </div>
            </div>

            {/* Equipment Grid — reads the real assets collection now. An item only shows
                on the public homepage when "Available for hire" is on; items that aren't
                are still listed here (grayed) so admins can find and publish them. */}
            {assetsError ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 font-medium">
                {assetsError}
              </div>
            ) : assets.length === 0 ? (
              <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-6 text-center text-xs text-gray-500">
                {lang === "en" ? "No equipment in inventory yet. Add your first item above." : "Hakuna vifaa bado. Ongeza kifaa cha kwanza hapo juu."}
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assets.map((item) => (
                <div key={item.id} className={`bg-gray-50 border rounded-2xl overflow-hidden flex flex-col justify-between shadow-xs ${item.availableForHire ? "border-gray-200" : "border-gray-200 opacity-60"}`}>
                  <div>
                    <div className="h-32 bg-neutral-900 relative">
                      {item.photoUrl ? (
                        <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500 p-2">
                          <Camera size={20} />
                          <span className="text-[9px] font-mono font-bold uppercase mt-1">NO IMAGE</span>
                        </div>
                      )}
                      <span className="absolute top-2 left-2 bg-neutral-900/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-md uppercase">
                        {item.category}
                      </span>
                      <span className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase ${item.availableForHire ? "bg-emerald-600 text-white" : "bg-gray-400 text-white"}`}>
                        {item.availableForHire ? (lang === "en" ? "Live on site" : "Iko hai") : (lang === "en" ? "Not published" : "Haijachapishwa")}
                      </span>
                    </div>

                    <div className="p-4 space-y-1">
                      <h4 className="text-xs font-black text-gray-900">{item.name}</h4>
                      <p className="text-xs font-black text-emerald-700 font-mono pt-1">
                        Ksh {(item.dailyRate || 0).toLocaleString()} / day
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-white border-t border-gray-200 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveEquipment(item)}
                      className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete "${item.name}"? This saves immediately.`)) return;
                        try {
                          const res = await fetch(`/api/assets/${item.id}`, { method: "DELETE" });
                          if (!res.ok) {
                            const data = await res.json().catch(() => ({}));
                            throw new Error(data.error || `Server returned status ${res.status}`);
                          }
                          setAssets(prev => prev.filter(a => a.id !== item.id));
                          setSuccessMsg(lang === "en" ? "Equipment item deleted." : "Kifaa kimefutwa.");
                        } catch (err: any) {
                          setError(err.message || (lang === "en" ? "Failed to delete equipment item." : "Imeshindwa kufuta kifaa."));
                        }
                      }}
                      className="px-2.5 py-1.5 bg-gray-50 hover:bg-red-50 text-red-600 rounded-lg border border-red-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {/* PANEL H: LEADERSHIP & CORE TEAM MANAGER */}
        {activeTab === "team" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                Manage Leadership & Core Team Members
              </h3>
              <button
                onClick={() => setActiveTeamMember({ id: `tm-${Date.now()}`, name: "", title: "", bio: "", photoUrl: "" })}
                className="bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"
              >
                <Plus size={12} /> Add Team Member
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(content.teamMembers && content.teamMembers.length > 0 ? content.teamMembers : DEFAULT_TEAM_MEMBERS_SEED).map((member, index) => (
                <div key={member.id} className="p-4 border rounded-2xl flex items-start gap-4 bg-gray-50/50">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-neutral-200 shrink-0 border relative flex items-center justify-center text-xs">
                    {member.photoUrl ? (
                      <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-gray-500">{member.name ? member.name.substring(0, 2).toUpperCase() : "TM"}</span>
                    )}
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="text-xs font-bold text-gray-900">{member.name}</h4>
                    <span className="text-[10px] font-bold text-[#E31E24] block">{member.title}</span>
                    <p className="text-[10px] text-gray-500 line-clamp-2">{member.bio}</p>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setActiveTeamMember(member)}
                        className="text-blue-600 hover:underline text-[10px] font-bold cursor-pointer flex items-center gap-0.5"
                      >
                        <Edit size={10} /> Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm(`Remove ${member.name}? This saves immediately.`)) {
                            const base = content.teamMembers && content.teamMembers.length > 0 ? content.teamMembers : DEFAULT_TEAM_MEMBERS_SEED;
                            const updated = base.filter((_, i) => i !== index);
                            const updatedContent = { ...content, teamMembers: updated };
                            setSiteContent(updatedContent as any);
                            await persistSiteContent(updatedContent, lang === "en" ? "Team member removed and saved." : "Mwanachama wa timu ameondolewa na kuhifadhiwa.");
                          }
                        }}
                        className="text-red-600 hover:underline text-[10px] font-bold cursor-pointer flex items-center gap-0.5"
                      >
                        <Trash2 size={10} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD/EDIT PROGRAM DETAILS */}
      <Modal
        isOpen={!!activeProg}
        onClose={() => setActiveProg(null)}
        title="Edit Program Pillar Details"
        maxWidth="max-w-lg"
      >
        {activeProg && (
          <div className="space-y-4">
              <div className="space-y-4 text-xs">
                {/* Titles */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Title (English)</label>
                    <input
                      type="text"
                      value={activeProg.title?.en || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProg(prev => ({ ...prev!, title: { ...prev!.title!, en: val } }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Title (Swahili)</label>
                    <input
                      type="text"
                      value={activeProg.title?.sw || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProg(prev => ({ ...prev!, title: { ...prev!.title!, sw: val } }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>

                {/* Descriptions */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Description (English)</label>
                    <textarea
                      rows={3}
                      value={activeProg.description?.en || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProg(prev => ({ ...prev!, description: { ...prev!.description!, en: val } }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-medium"
                    ></textarea>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Description (Swahili)</label>
                    <textarea
                      rows={3}
                      value={activeProg.description?.sw || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProg(prev => ({ ...prev!, description: { ...prev!.description!, sw: val } }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-medium"
                    ></textarea>
                  </div>
                </div>

                {/* Support details */}
                <div className="grid grid-cols-2 gap-4 border-t pt-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Support M-Pesa Till Number (Optional)</label>
                    <input
                      type="text"
                      value={activeProg.supportTillNumber || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProg(prev => ({ ...prev!, supportTillNumber: val }));
                      }}
                      placeholder="e.g. 4530ec"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Support Instructions (English)</label>
                    <input
                      type="text"
                      value={activeProg.supportInstructions?.en || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProg(prev => ({
                          ...prev!,
                          supportInstructions: { ...prev!.supportInstructions || { en: "", sw: "" }, en: val }
                        }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Support Instructions (Swahili)</label>
                    <input
                      type="text"
                      value={activeProg.supportInstructions?.sw || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProg(prev => ({
                          ...prev!,
                          supportInstructions: { ...prev!.supportInstructions || { en: "", sw: "" }, sw: val }
                        }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Sponsor Contact Note (English)</label>
                    <input
                      type="text"
                      value={activeProg.sponsorContactNote?.en || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProg(prev => ({
                          ...prev!,
                          sponsorContactNote: { ...prev!.sponsorContactNote || { en: "", sw: "" }, en: val }
                        }));
                      }}
                      placeholder="e.g. Interested in sponsoring this program long-term?"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Sponsor Contact Note (Swahili)</label>
                    <input
                      type="text"
                      value={activeProg.sponsorContactNote?.sw || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProg(prev => ({
                          ...prev!,
                          sponsorContactNote: { ...prev!.sponsorContactNote || { en: "", sw: "" }, sw: val }
                        }));
                      }}
                      placeholder="e.g. Je, ungependa kudhamini mpango huu kwa muda mrefu?"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium"
                    />
                  </div>
                </div>

                {/* Photo uploader */}
                <div className="space-y-1 border-t pt-3">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Program banner image (5MB limit)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const url = await handleImageUpload(file);
                          setActiveProg(prev => ({ ...prev!, photoUrl: url }));
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }
                    }}
                    className="w-full bg-gray-50 border p-1 rounded"
                  />
                  {activeProg.photoUrl && (
                    <p className="text-[9px] text-emerald-600 font-bold font-mono">Image loaded: {activeProg.photoUrl}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setActiveProg(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Update main content array
                    const exists = content.programs.some(p => p.id === activeProg.id);
                    let updatedList = [...content.programs];
                    if (exists) {
                      updatedList = updatedList.map(p => p.id === activeProg.id ? (activeProg as Program) : p);
                    } else {
                      updatedList.push(activeProg as Program);
                    }
                    setSiteContent(prev => ({ ...prev!, programs: updatedList }));
                    setActiveProg(null);
                  }}
                  className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Save Pillar
                </button>
              </div>
          </div>
        )}
      </Modal>

      {/* MODAL: ADD/EDIT PROJECT DETAILS */}
      <Modal
        isOpen={!!activeProj}
        onClose={() => setActiveProj(null)}
        title="Edit Production / Outreach Details"
        maxWidth="max-w-lg"
      >
        {activeProj && (
          <div className="space-y-4">
              <div className="space-y-4 text-xs">
                {/* Titles */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Title (English)</label>
                    <input
                      type="text"
                      value={activeProj.title?.en || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProj(prev => ({ ...prev!, title: { ...prev!.title!, en: val } }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Title (Swahili)</label>
                    <input
                      type="text"
                      value={activeProj.title?.sw || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProj(prev => ({ ...prev!, title: { ...prev!.title!, sw: val } }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>

                {/* Descriptions */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Description (English)</label>
                    <textarea
                      rows={3}
                      value={activeProj.description?.en || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProj(prev => ({ ...prev!, description: { ...prev!.description!, en: val } }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-medium"
                    ></textarea>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Description (Swahili)</label>
                    <textarea
                      rows={3}
                      value={activeProj.description?.sw || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProj(prev => ({ ...prev!, description: { ...prev!.description!, sw: val } }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-medium"
                    ></textarea>
                  </div>
                </div>

                {/* Category & Photo upload */}
                <div className="grid grid-cols-2 gap-4 border-t pt-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Category type</label>
                    <select
                      value={activeProj.category || "general"}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProj(prev => ({ ...prev!, category: val as any }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-bold cursor-pointer"
                    >
                      <option value="general">Outreach/General</option>
                      <option value="film">Film Production</option>
                      <option value="theatre">Participatory Theatre</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Project Image banner (5MB limit)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const url = await handleImageUpload(file);
                            setActiveProj(prev => ({ ...prev!, photoUrl: url }));
                          } catch (err: any) {
                            alert(err.message);
                          }
                        }
                      }}
                      className="w-full bg-gray-50 border p-1 rounded"
                    />
                  </div>
                </div>

                {/* Crew & YouTube URL */}
                <div className="grid grid-cols-2 gap-4 border-t pt-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Crew Details (English)</label>
                    <input
                      type="text"
                      value={activeProj.crew?.en || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProj(prev => ({
                          ...prev!,
                          crew: { ...prev!.crew || { en: "", sw: "" }, en: val }
                        }));
                      }}
                      placeholder="e.g. Directed by Kennedy | Starring Bashosho Crew"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Crew Details (Swahili)</label>
                    <input
                      type="text"
                      value={activeProj.crew?.sw || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProj(prev => ({
                          ...prev!,
                          crew: { ...prev!.crew || { en: "", sw: "" }, sw: val }
                        }));
                      }}
                      placeholder="e.g. Imeongozwa na Kennedy | Washiriki wa Bashosho"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">YouTube Watch Link (Optional)</label>
                    <input
                      type="text"
                      value={activeProj.youtubeUrl || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProj(prev => ({ ...prev!, youtubeUrl: val }));
                      }}
                      placeholder="e.g. https://youtube.com/watch?v=..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Support Till Number (Optional)</label>
                    <input
                      type="text"
                      value={activeProj.supportTillNumber || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProj(prev => ({ ...prev!, supportTillNumber: val }));
                      }}
                      placeholder="e.g. 8671238"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Support Instructions (English)</label>
                    <input
                      type="text"
                      value={activeProj.supportInstructions?.en || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProj(prev => ({
                          ...prev!,
                          supportInstructions: { ...prev!.supportInstructions || { en: "", sw: "" }, en: val }
                        }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Support Instructions (Swahili)</label>
                    <input
                      type="text"
                      value={activeProj.supportInstructions?.sw || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProj(prev => ({
                          ...prev!,
                          supportInstructions: { ...prev!.supportInstructions || { en: "", sw: "" }, sw: val }
                        }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setActiveProj(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const exists = content.projects.some(p => p.id === activeProj.id);
                    let updatedList = [...content.projects];
                    if (exists) {
                      updatedList = updatedList.map(p => p.id === activeProj.id ? (activeProj as Project) : p);
                    } else {
                      updatedList.push(activeProj as Project);
                    }
                    setSiteContent(prev => ({ ...prev!, projects: updatedList }));
                    setActiveProj(null);
                  }}
                  className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Save Project
                </button>
              </div>
          </div>
        )}
      </Modal>

      {/* EDIT GALLERY IMAGE MODAL */}
      <Modal
        isOpen={!!editingImage}
        onClose={() => setEditingImage(null)}
        title={
          <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wide flex items-center gap-2">
            <Edit size={14} className="text-[#E31E24]" />
            {lang === "en" ? "Edit Gallery Image" : "Hariri Picha ya Sanaa"}
          </h3>
        }
        maxWidth="max-w-xl"
      >
        {editingImage && (
          <form onSubmit={handleGalleryEditSave} className="space-y-4">
            {/* Image replacement select */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center border-b border-neutral-100 pb-4">
              <div className="md:col-span-4 flex justify-center">
                <img
                  src={editImageBase64 || editingImage?.imageUrl || ""}
                  alt="Preview"
                  className="w-24 h-24 object-cover rounded-xl border border-neutral-200"
                />
              </div>
                  <div className="md:col-span-8 space-y-2 text-center md:text-left">
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                      {lang === "en" ? "Replace Image File (Optional)" : "Badilisha Faili la Picha (Chaguo)"}
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const base64 = await new Promise<string>((resolve) => {
                              const reader = new FileReader();
                              reader.onloadend = () => resolve(reader.result as string);
                              reader.readAsDataURL(file);
                            });
                            setEditImageBase64(base64);
                          } catch (err: any) {
                            alert(err.message);
                          }
                        }
                      }}
                      className="hidden"
                      id="cms-gallery-edit-upload-input"
                    />
                    <label
                      htmlFor="cms-gallery-edit-upload-input"
                      className="inline-flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[10px] font-bold px-3 py-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <UploadCloud size={12} />
                      {lang === "en" ? "Choose New Image" : "Chagua Picha Mpya"}
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">
                      {lang === "en" ? "Caption (English)" : "Maelezo ya Picha (Kiingereza)"}
                    </label>
                    <input
                      type="text"
                      required
                      value={editCaptionEn}
                      onChange={(e) => setEditCaptionEn(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">
                      {lang === "en" ? "Caption (Swahili)" : "Maelezo ya Picha (Kiswahili)"}
                    </label>
                    <input
                      type="text"
                      required
                      value={editCaptionSw}
                      onChange={(e) => setEditCaptionSw(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">
                      {lang === "en" ? "Sorting Order (Sequence number)" : "Mpangilio (Nambari ya mfuatano)"}
                    </label>
                    <input
                      type="number"
                      required
                      value={editOrder}
                      onChange={(e) => setEditOrder(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setEditingImage(null)}
                    className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 rounded-xl transition-all cursor-pointer border border-neutral-200"
                  >
                    {lang === "en" ? "Cancel" : "Ghairi"}
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="bg-[#E31E24] hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {editSaving ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {lang === "en" ? "Saving..." : "Inahifadhi..."}
                      </>
                    ) : (
                      <>
                        <Save size={12} />
                        {lang === "en" ? "Save Changes" : "Hifadhi Mabadiliko"}
                      </>
                    )}
                  </button>
                </div>
              </form>
        )}
      </Modal>

      {/* DELETE GALLERY IMAGE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!deletingImageId}
        onClose={() => setDeletingImageId(null)}
        title={lang === "en" ? "Permanently Delete Photo?" : "Futa Picha Hii Milele?"}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4 text-center">
          <p className="text-xs text-neutral-500">
            {lang === "en"
              ? "Are you sure you want to delete this gallery photo? This action cannot be undone."
              : "Je, una uhakika unataka kufuta picha hii ya sanaa? Kitendo hiki hakiwezi kubatilishwa."}
          </p>

          {/* Show the preview of the image being deleted */}
          {(() => {
            const targetImg = galleryImages.find(g => g.id === deletingImageId);
            return targetImg ? (
              <div className="aspect-video relative rounded-xl overflow-hidden border border-neutral-200">
                <img src={targetImg?.imageUrl || ""} alt="ToDelete" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-black/60 p-2 text-white text-[10px] font-medium truncate">
                  {targetImg.caption[lang]}
                </div>
              </div>
            ) : null;
          })()}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeletingImageId(null)}
              className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 rounded-xl transition-all cursor-pointer border border-neutral-200"
            >
              {lang === "en" ? "Cancel" : "Ghairi"}
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => handleGalleryDelete(deletingImageId)}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isDeleting ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {lang === "en" ? "Deleting..." : "Inafuta..."}
                </>
              ) : (
                lang === "en" ? "Yes, Delete" : "Ndio, Futa"
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: ADD/EDIT PARTNER */}
      <Modal
        isOpen={!!activePartner}
        onClose={() => setActivePartner(null)}
        title={activePartner?.id && content?.partnersList?.some(p => p.id === activePartner.id) ? "Edit Partner / Sponsor" : "Add Partner / Sponsor"}
        maxWidth="max-w-md"
      >
        {activePartner && (
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Partner Name</label>
              <input
                type="text"
                value={activePartner.name || ""}
                onChange={(e) => setActivePartner(prev => ({ ...prev!, name: e.target.value }))}
                placeholder="e.g. Kiambiu Justice Network"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Category Tag</label>
              <input
                type="text"
                value={activePartner.category || ""}
                onChange={(e) => setActivePartner(prev => ({ ...prev!, category: e.target.value }))}
                placeholder="e.g. NGO Partner, Human Rights, Funder"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Partner Logo Image</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={activePartner.logoUrl || ""}
                  onChange={(e) => setActivePartner(prev => ({ ...prev!, logoUrl: e.target.value }))}
                  placeholder="https://... or upload photo"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-mono"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const url = await handleImageUpload(file);
                        setActivePartner(prev => ({ ...prev!, logoUrl: url }));
                      } catch (err: any) {
                        alert(err.message);
                      }
                    }
                  }}
                  className="hidden"
                  id="partner-logo-uploader"
                />
                <label
                  htmlFor="partner-logo-uploader"
                  className="bg-neutral-900 text-white text-[10px] font-bold px-3 py-2 rounded-xl cursor-pointer shrink-0"
                >
                  Upload
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setActivePartner(null)}
                className="bg-gray-100 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!activePartner.name) {
                    alert("Partner name is required.");
                    return;
                  }
                  const existing = content?.partnersList || [];
                  const idx = existing.findIndex(p => p.id === activePartner.id);
                  let updated = [...existing];
                  if (idx >= 0) {
                    updated[idx] = activePartner as PartnerLogo;
                  } else {
                    updated.push(activePartner as PartnerLogo);
                  }
                  const updatedContent = { ...content, partnersList: updated };
                  setSiteContent(updatedContent as any);
                  setActivePartner(null);
                  await persistSiteContent(updatedContent, lang === "en" ? "Partner saved and published." : "Mshirika amehifadhiwa na kuchapishwa.");
                }}
                className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Save Partner
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: ADD/EDIT EQUIPMENT ITEM — this saves directly to the same `assets`
          collection the public homepage reads from (see fetchData / save handler below). */}
      <Modal
        isOpen={!!activeEquipment}
        onClose={() => setActiveEquipment(null)}
        title={assets.some(e => e.id === activeEquipment?.id) ? "Edit Equipment Item" : "Add Equipment Item"}
        maxWidth="max-w-lg"
      >
        {activeEquipment && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Equipment Name</label>
                <input
                  type="text"
                  value={activeEquipment.name || ""}
                  onChange={(e) => setActiveEquipment(prev => ({ ...prev!, name: e.target.value }))}
                  placeholder="e.g. Sony FX30 Cinema Camera"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Category</label>
                <select
                  value={activeEquipment.category || "camera"}
                  onChange={(e) => setActiveEquipment(prev => ({ ...prev!, category: e.target.value as Asset["category"] }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="camera">Camera / Video</option>
                  <option value="mic">Microphones / Audio</option>
                  <option value="sound">PA & Sound</option>
                  <option value="costume">Costume</option>
                  <option value="prop">Prop</option>
                  <option value="laptop">Laptop / Editing</option>
                  <option value="furniture">Furniture</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Daily Rate (Ksh)</label>
                <input
                  type="number"
                  value={activeEquipment.dailyRate || 0}
                  onChange={(e) => setActiveEquipment(prev => ({ ...prev!, dailyRate: Number(e.target.value) }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Condition</label>
                <select
                  value={activeEquipment.condition || "excellent"}
                  onChange={(e) => setActiveEquipment(prev => ({ ...prev!, condition: e.target.value as Asset["condition"] }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="repair_needed">Needs repair</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={activeEquipment.availableForHire !== false}
                onChange={(e) => setActiveEquipment(prev => ({ ...prev!, availableForHire: e.target.checked }))}
                className="w-4 h-4"
              />
              <span className="text-xs font-bold text-emerald-800">
                Available for hire (shows on the public homepage when checked)
              </span>
            </label>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Photo Image</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={activeEquipment.photoUrl || ""}
                  onChange={(e) => setActiveEquipment(prev => ({ ...prev!, photoUrl: e.target.value }))}
                  placeholder="https://... or upload image"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-mono"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const url = await handleImageUpload(file);
                        setActiveEquipment(prev => ({ ...prev!, photoUrl: url }));
                      } catch (err: any) {
                        alert(err.message);
                      }
                    }
                  }}
                  className="hidden"
                  id="equipment-photo-uploader"
                />
                <label
                  htmlFor="equipment-photo-uploader"
                  className="bg-neutral-900 text-white text-[10px] font-bold px-3 py-2 rounded-xl cursor-pointer shrink-0"
                >
                  Upload
                </label>
              </div>
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed">
              Full inventory details (serial number, custodian, purchase cost, storage location) can be filled in from the Assets module — this quick form covers what's needed to publish an item for public hire.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setActiveEquipment(null)}
                className="bg-gray-100 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!activeEquipment.name) {
                    alert("Equipment name is required.");
                    return;
                  }
                  const isNew = !assets.some(a => a.id === activeEquipment.id);
                  const payload: Asset = {
                    id: activeEquipment.id!,
                    name: activeEquipment.name!,
                    category: activeEquipment.category || "other",
                    serialNumber: activeEquipment.serialNumber || "",
                    purchaseDate: activeEquipment.purchaseDate || new Date().toISOString().slice(0, 10),
                    purchaseCost: activeEquipment.purchaseCost || 0,
                    condition: activeEquipment.condition || "excellent",
                    custodian: activeEquipment.custodian || "",
                    location: activeEquipment.location || "Bashosho Studio",
                    photoUrl: activeEquipment.photoUrl || "",
                    availableForHire: activeEquipment.availableForHire !== false,
                    dailyRate: activeEquipment.dailyRate || 0,
                    checkoutHistory: activeEquipment.checkoutHistory || []
                  };
                  try {
                    const res = await fetch("/api/assets", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload)
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.error || `Server returned status ${res.status}`);
                    }
                    setAssets(prev => {
                      const idx = prev.findIndex(a => a.id === payload.id);
                      if (idx >= 0) {
                        const updated = [...prev];
                        updated[idx] = payload;
                        return updated;
                      }
                      return [...prev, payload];
                    });
                    setActiveEquipment(null);
                    setSuccessMsg(isNew
                      ? (lang === "en" ? "Equipment item added and published." : "Kifaa kimeongezwa na kuchapishwa.")
                      : (lang === "en" ? "Equipment item saved and published." : "Kifaa kimehifadhiwa na kuchapishwa."));
                  } catch (err: any) {
                    setError(err.message || (lang === "en" ? "Failed to save equipment item." : "Imeshindwa kuhifadhi kifaa."));
                  }
                }}
                className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Save Gear
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: ADD/EDIT TEAM MEMBER */}
      <Modal
        isOpen={!!activeTeamMember}
        onClose={() => setActiveTeamMember(null)}
        title="Edit Team Member Details"
        maxWidth="max-w-md"
      >
        {activeTeamMember && (
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-500 uppercase">Full Name</label>
              <input
                type="text"
                value={activeTeamMember.name || ""}
                onChange={(e) => setActiveTeamMember(prev => ({ ...prev!, name: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-bold"
                placeholder="e.g. Kennedy Onyango"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-500 uppercase">Role / Title</label>
              <input
                type="text"
                value={activeTeamMember.title || ""}
                onChange={(e) => setActiveTeamMember(prev => ({ ...prev!, title: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium"
                placeholder="e.g. Executive Director"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-500 uppercase">Short Bio</label>
              <textarea
                rows={3}
                value={activeTeamMember.bio || ""}
                onChange={(e) => setActiveTeamMember(prev => ({ ...prev!, bio: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-medium"
                placeholder="Brief summary of role and responsibilities..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-500 uppercase">Profile Photo (5MB Limit)</label>
              <div className="flex items-center gap-3">
                {activeTeamMember.photoUrl ? (
                  <img src={activeTeamMember.photoUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover border" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 border flex items-center justify-center text-[10px] font-bold text-gray-400">
                    No Photo
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const url = await handleImageUpload(file);
                        setActiveTeamMember(prev => ({ ...prev!, photoUrl: url }));
                      } catch (err: any) {
                        alert(err.message);
                      }
                    }
                  }}
                  className="flex-1 bg-gray-50 border p-1 rounded text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setActiveTeamMember(null)}
                className="bg-gray-100 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!activeTeamMember.name || !activeTeamMember.title) {
                    alert("Name and Title are required.");
                    return;
                  }
                  const currentList = content?.teamMembers && content.teamMembers.length > 0 ? content.teamMembers : DEFAULT_TEAM_MEMBERS_SEED;
                  const exists = currentList.some(m => m.id === activeTeamMember.id);
                  let updatedList: TeamMember[];
                  if (exists) {
                    updatedList = currentList.map(m => m.id === activeTeamMember.id ? (activeTeamMember as TeamMember) : m);
                  } else {
                    updatedList = [...currentList, activeTeamMember as TeamMember];
                  }
                  const updatedContent = { ...content, teamMembers: updatedList };
                  setSiteContent(updatedContent as any);
                  setActiveTeamMember(null);
                  await persistSiteContent(updatedContent, lang === "en" ? "Team member saved and published." : "Mwanachama wa timu amehifadhiwa na kuchapishwa.");
                }}
                className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Save Team Member
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
