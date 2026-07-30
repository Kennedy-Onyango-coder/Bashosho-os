import React from "react";
import Modal from "./Modal";
import { SiteContent, GalleryImage, Program, Project, Grant } from "../types";
import { StorageService } from "../lib/storage";
import { convertToWebP } from "../lib/imageUtils";
import BashoshoLogo from "./BashoshoLogo";
import { motion, AnimatePresence } from "motion/react";
import { 
  Lock, 
  Sparkles, 
  Target, 
  HelpCircle, 
  Share2, 
  Heart, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Mail, 
  Phone, 
  MapPin, 
  User, 
  IdCard,
  UserCheck,
  Globe,
  Film,
  Play,
  Users,
  Calendar,
  Building2,
  DollarSign,
  Send,
  ShieldCheck,
  Camera,
  Wrench,
  Package,
  Clock,
  CreditCard,
  Facebook,
  ShieldAlert,
  Check,
  X,
  Copy,
  ExternalLink,
  Award,
  Clapperboard,
  Theater,
  Megaphone,
  HeartHandshake,
  Handshake,
  BookOpen,
  ChevronRight,
  Utensils,
  HeartPulse,
  Compass
} from "lucide-react";

interface HomePageProps {
  lang: "en" | "sw";
  onChangeLang: (lang: "en" | "sw") => void;
  onNavigateToPortal: () => void;
}

export default function HomePage({ lang, onChangeLang, onNavigateToPortal }: HomePageProps) {
  const [siteContent, setSiteContent] = React.useState<SiteContent | null>(null);
  const [galleryImages, setGalleryImages] = React.useState<GalleryImage[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedTill, setCopiedTill] = React.useState<boolean>(false);

  const handleCopyTill = () => {
    navigator.clipboard.writeText("8671238");
    setCopiedTill(true);
    setTimeout(() => setCopiedTill(false), 2000);
  };

  // Active registration form modal state: null | "member" | "volunteer"
  const [activeFormType, setActiveFormType] = React.useState<"member" | "volunteer" | null>(null);

  // Lightbox modal state: null | imageUrl
  const [activeLightboxImage, setActiveLightboxImage] = React.useState<string | null>(null);

  // Sponsorship and Project support modals
  const [selectedSponsorProgram, setSelectedSponsorProgram] = React.useState<Program | null>(null);
  const [selectedSupportProject, setSelectedSupportProject] = React.useState<Project | null>(null);

  // Safeguarding modal state
  const [showSafeguardingModal, setShowSafeguardingModal] = React.useState(false);

  // Equipment Hiring State
  const [hireableAssets, setHireableAssets] = React.useState<any[]>([]);
  const [selectedHireAsset, setSelectedHireAsset] = React.useState<any | null>(null);
  const [hireClientName, setHireClientName] = React.useState("");
  const [hireClientPhone, setHireClientPhone] = React.useState("");
  const [hireClientEmail, setHireClientEmail] = React.useState("");
  const [hireStartDate, setHireStartDate] = React.useState("");
  const [hireEndDate, setHireEndDate] = React.useState("");
  const [hirePurpose, setHirePurpose] = React.useState("");
  const [hireSubmitting, setHireSubmitting] = React.useState(false);
  const [hireSuccessInfo, setHireSuccessInfo] = React.useState<any | null>(null);

  // Load public hireable assets
  React.useEffect(() => {
    fetch("/api/public/assets")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setHireableAssets(data);
        }
      })
      .catch((err) => console.error("Failed to load public assets", err));
  }, []);

  const calculateHireDays = () => {
    if (!hireStartDate || !hireEndDate) return 1;
    const s = new Date(hireStartDate);
    const e = new Date(hireEndDate);
    const days = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 1;
  };

  const handleHireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHireAsset || !hireClientName || !hireClientPhone || !hireStartDate || !hireEndDate) return;

    setHireSubmitting(true);
    try {
      const res = await fetch("/api/public/asset_hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: selectedHireAsset.id,
          clientName: hireClientName,
          clientPhone: hireClientPhone,
          clientEmail: hireClientEmail,
          startDate: hireStartDate,
          endDate: hireEndDate,
          purpose: hirePurpose
        })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setHireSuccessInfo(result);
      } else {
        alert(result.error || "Failed to submit equipment hire request.");
      }
    } catch (err: any) {
      alert("Submission error: " + err.message);
    } finally {
      setHireSubmitting(false);
    }
  };

  // TaaS (Theatre as a Service) Interactive Booking Form State
  const [showTaasModal, setShowTaasModal] = React.useState(false);
  const [taasOrgName, setTaasOrgName] = React.useState("");
  const [taasCategory, setTaasCategory] = React.useState<"ngo" | "corporate" | "school" | "government" | "community">("ngo");
  const [taasContactName, setTaasContactName] = React.useState("");
  const [taasEmail, setTaasEmail] = React.useState("");
  const [taasPhone, setTaasPhone] = React.useState("");
  const [taasPackage, setTaasPackage] = React.useState<"standard_forum" | "roadshow_campaign" | "custom_tour">("standard_forum");
  const [taasDate, setTaasDate] = React.useState("");
  const [taasVenue, setTaasVenue] = React.useState("");
  const [taasTheme, setTaasTheme] = React.useState("SGBV Prevention & Gender Justice");
  const [taasAudienceSize, setTaasAudienceSize] = React.useState<number>(250);
  const [taasAddonSound, setTaasAddonSound] = React.useState(true);
  const [taasAddonVideo, setTaasAddonVideo] = React.useState(false);
  const [taasSubmitting, setTaasSubmitting] = React.useState(false);
  const [taasBookingSuccessRef, setTaasBookingSuccessRef] = React.useState<string | null>(null);

  // Dynamic budget estimator calculation
  const calculateTaasBudget = () => {
    let base = 35000;
    if (taasPackage === "roadshow_campaign") base = 65000;
    if (taasPackage === "custom_tour") base = 120000;

    let soundFee = taasAddonSound ? 15000 : 0;
    let videoFee = taasAddonVideo ? 20000 : 0;
    let audienceFee = taasAudienceSize > 500 ? 10000 : 0;

    return base + soundFee + videoFee + audienceFee;
  };

  const handleTaasSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taasOrgName || !taasContactName || !taasPhone) return;

    setTaasSubmitting(true);
    const estimatedBudget = calculateTaasBudget();

    try {
      const res = await fetch("/api/public/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `TaaS Booking Inquiry: ${taasOrgName}`,
          contactName: taasContactName,
          contactPhone: taasPhone,
          contactEmail: taasEmail,
          amount: estimatedBudget,
          deadline: taasDate,
          notes: `Client Org: ${taasOrgName}\nCategory: ${taasCategory.toUpperCase()}\nContact Person: ${taasContactName}\nEmail: ${taasEmail} | Phone: ${taasPhone}\nPackage: ${taasPackage.replace('_', ' ').toUpperCase()}\nTarget Date: ${taasDate} | Location: ${taasVenue}\nTheme: ${taasTheme}\nAudience Size: ${taasAudienceSize}\nAddons: Sound (${taasAddonSound ? 'Yes' : 'No'}), Video (${taasAddonVideo ? 'Yes' : 'No'})\nEstimated Budget: Ksh ${estimatedBudget.toLocaleString()}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      const refCode = `TAAS-2026-${(data.referenceId || Date.now().toString()).slice(-5)}`;
      setTaasBookingSuccessRef(refCode);
    } catch (err) {
      console.error("Failed to submit TaaS booking inquiry:", err);
      alert(lang === "en"
        ? "Sorry, we couldn't submit your booking request right now. Please try again or contact us directly by phone."
        : "Samahani, hatukuweza kuwasilisha ombi lako sasa. Tafadhali jaribu tena au tuwasiliane moja kwa moja kwa simu.");
    } finally {
      setTaasSubmitting(false);
    }
  };

  // Program Inquiry Modal State (MUST FIX 3)
  const [programInquiry, setProgramInquiry] = React.useState<{
    open: boolean;
    type: "partner" | "book_session" | "film_apply" | "book_performance";
    program: Program | null;
    name: string;
    email: string;
    phone: string;
    organization: string;
    details: string;
    submitting: boolean;
    successRef: string | null;
  }>({
    open: false,
    type: "partner",
    program: null,
    name: "",
    email: "",
    phone: "",
    organization: "",
    details: "",
    submitting: false,
    successRef: null,
  });

  const openProgramInquiry = (program: Program, type: "partner" | "book_session" | "film_apply" | "book_performance") => {
    setProgramInquiry({
      open: true,
      type,
      program,
      name: "",
      email: "",
      phone: "",
      organization: "",
      details: "",
      submitting: false,
      successRef: null,
    });
  };

  const handleProgramInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programInquiry.program || !programInquiry.name || !programInquiry.phone) return;

    setProgramInquiry((prev) => ({ ...prev, submitting: true }));

    try {
      const res = await fetch("/api/public/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Inquiry (${programInquiry.type}): ${programInquiry.program.title.en}`,
          contactName: programInquiry.name,
          contactPhone: programInquiry.phone,
          contactEmail: programInquiry.email,
          amount: 0,
          notes: `Program: ${programInquiry.program.title.en}\nAction: ${programInquiry.type}\nOrg/School: ${programInquiry.organization || "N/A"}\nMessage/Notes: ${programInquiry.details || "None"}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      const refCode = `INQ-${programInquiry.type.toUpperCase().slice(0, 4)}-${(data.referenceId || Date.now().toString()).slice(-5)}`;
      setProgramInquiry((prev) => ({
        ...prev,
        submitting: false,
        successRef: refCode,
      }));
    } catch (err) {
      console.error("Failed to submit program inquiry:", err);
      // Do NOT fake a success reference here — a failed submission must look failed,
      // or the visitor walks away thinking we received an inquiry we never got.
      setProgramInquiry((prev) => ({ ...prev, submitting: false }));
      alert(lang === "en"
        ? "Sorry, we couldn't submit your inquiry right now. Please try again or contact us directly."
        : "Samahani, hatukuweza kuwasilisha ombi lako sasa. Tafadhali jaribu tena au tuwasiliane moja kwa moja.");
    }
  };

  // Load content
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [contentRes, galleryRes] = await Promise.all([
          fetch("/api/public/site_content"),
          fetch("/api/public/gallery_images")
        ]);

        if (contentRes.ok) {
          const contentData = await contentRes.json();
          setSiteContent(contentData);
        } else {
          throw new Error("Failed to load site content");
        }

        if (galleryRes.ok) {
          const galleryData = await galleryRes.json();
          setGalleryImages(galleryData);
        }
      } catch (err: any) {
        console.error("Error fetching public homepage data:", err);
        setError("Could not load homepage. Showing fallback content.");
        // Seed default fallback so the page never looks empty
        setSiteContent({
          heroTitle: {
            en: "Empowering Kiambiu Youth Through Creative Arts & Mental Health Advocacy",
            sw: "Kuwezesha Vijana wa Kiambiu Kupitia Sanaa za Ubunifu na Utetezi wa Afya ya Akili"
          },
          heroSubtitle: {
            en: "Using participatory theater, film, and community forums to address GBV, sexual reproductive health rights (SRHR), and wellness.",
            sw: "Kutumia jukwaa la ushiriki, filamu, na vikao vya jamii kushughulikia ukatili wa kijinsia (GBV), afya ya uzazi (SRHR), na afya ya akili."
          },
          aboutText: {
            en: "Bashosho Talents is a grassroots Community-Based Organization (CBO) located in Kiambiu slum, Nairobi. We mobilize young people to find their voice, develop their creative talents, and spearhead awareness campaigns on critical mental health and human rights issues.",
            sw: "Bashosho Talents ni Shirika la Kijamii (CBO) lililoko katika mtaa wa mabanda wa Kiambiu, Nairobi. Tunahamasisha vijana kupata sauti zao, kukuza vipaji vyao vya ubunifu, na kuongoza kampeni za kuhamasisha kuhusu masuala muhimu ya afya ya akili na haki za kibinadamu."
          },
          missionText: {
            en: "We use theatre and film to raise awareness on GBV, SRHR, and Mental Health, train the next generation of Nairobi filmmakers through the Bashosho Film Academy, and put our skills to work for partner organizations through Theatre as a Service.",
            sw: "Tunatumia maigizo na filamu kuhamasisha kuhusu GBV, SRHR, na Afya ya Akili, kufundisha kizazi kijacho cha watengenezaji filamu wa Nairobi kupitia Bashosho Film Academy, na kutoa huduma zetu kwa mashirika washirika kupitia Theatre as a Service."
          },
          programs: [
            {
              id: "prog-taas",
              title: { en: "Theatre as a Service (TaaS)", sw: "Theatre as a Service (TaaS)" },
              description: {
                en: "Theatre as a Service is Bashosho Talents' consultancy arm — we design and deliver custom, interactive theatre and forum-drama campaigns for organizations that need to move an audience from awareness to action. We translate your sensitization goals into a scripted, audience-participatory performance staged wherever your audience already gathers — a school assembly, a corporate compliance day, a public roadshow. Every engagement includes a tailored script, trained performers, and a short post-session evaluation, so you leave with a record of impact, not just a photo.",
                sw: "Theatre as a Service ni kitengo cha ushauri cha Bashosho Talents — tunabuni na kutekeleza kampeni za michezo ya kuigiza shirikishi kwa mashirika yanayotaka kubadili jamii kutoka uelewa hadi vitendo. Tunatafsiri malengo yako ya uelimishaji kuwa onyesho la kuigiza mahali popote pale watazamaji wako wanapokusanyika."
              },
              photoUrl: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=60",
              supportTillNumber: "8671238",
              supportInstructions: {
                en: "Hire our performance team or sponsor an institutional forum theatre campaign. Send contribution to Lipa Na M-PESA Till Number 8671238.",
                sw: "Kodi kikundi chetu cha wasanii au fadhili kampeni ya maigizo ya taasisi. Tuma mchango kwa Till Number 8671238."
              },
              audienceTag: {
                en: "FOR NGOS, GOVERNMENT AGENCIES, SCHOOLS & CORPORATE SPONSORS",
                sw: "KWA NGOS, IDARA ZA SERIKALI, SHULE NA WADHAMINI WA KIBIASHARA"
              },
              outcomeText: {
                en: "A campaign your audience remembers — and evidence you can report back to your own funders.",
                sw: "Kampeni inayokumbukwa na watazamaji wako — na ushahidi wa kuripoti kwa wafadhili wako."
              },
              actionButtonText: {
                en: "HIRE US",
                sw: "KODI WASANII"
              }
            },
            {
              id: "prog-gbv",
              title: { en: "GBV Awareness and Referral", sw: "Elimu ya GBV na Rufaa" },
              description: {
                en: "Through forum theatre and short film, we bring conversations about Gender-Based Violence into public spaces where they're normally avoided — markets, school halls, community grounds. Our performers stage real, recognizable scenarios and pause at the point of crisis, inviting the audience to step in and rehearse what standing up actually looks like. We do not run a safe space ourselves. Our role is to raise awareness on all forms of GBV, recognize when someone needs help, and make a fast, confidential referral to a safe space or partner organization equipped to support them directly.",
                sw: "Kupitia sanaa ya maigizo na filamu fupi, tunaleta mijadala kuhusu Ukatili wa Kijinsia (GBV) mitaani. Wasanii wetu huigiza matukio halisi na kusimama wakati wa mgogoro ili kuwapa fursa watazamaji kujaribu suluhisho. Hatumiliki nyumba ya hifadhi sisi wenyewe; jukumu letu ni kuhamasisha uelewa wa GBV na kutoa rufaa za haraka na za siri kwa mashirika washirika yanayohusika."
              },
              photoUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&auto=format&fit=crop&q=60",
              supportTillNumber: "8671238",
              audienceTag: {
                en: "COMMUNITIES ACROSS NAIROBI, WITH A FOCUS ON INFORMAL SETTLEMENTS LIKE KIAMBIU",
                sw: "JAMII KOTE NAIROBI, HUKU TUKIZINGATIA MITAA YA MABANDA KAMA KIAMBIU"
              },
              outcomeText: {
                en: "Same-day, confidential referral — we never leave a disclosure unanswered.",
                sw: "Rufaa ya siri na ya haraka siku hiyo hiyo — hatuachi taarifa yoyote bila majibu."
              },
              actionButtonText: {
                en: "REPORT A CONCERN",
                sw: "RIPOTI WASIWASI"
              }
            },
            {
              id: "prog-srhr",
              title: { en: "SRHR Awareness and Support", sw: "Elimu na Msaada wa SRHR" },
              description: {
                en: "We use theatre and film to open up conversations on Sexual and Reproductive Health Rights (SRHR) that many young people rarely get to have safely — consent, puberty, reproductive health, and making informed choices. Beyond our own performances, we partner with organizations such as HESED Africa to run structured SRHR sessions for both boys and girls. Many of these sessions include practical support from our partners — dignity kits such as sanitary pads for girls and boxers for boys, alongside other hygiene essentials — so that awareness comes with something a young person can actually use. Availability of dignity kits depends on the partner organization supporting that particular session.",
                sw: "Tunatumia maigizo na filamu kufungua mijadala kuhusu Haki za Afya ya Uzazi (SRHR), usafi wa hedhi, na maamuzi sahihi. Kwa ushirikiano na mashirika kama HESED Africa, tunaendesha masomo kwa wasichana na wavulana. Taulo za kike kwa wasichana, vyupi kwa wavulana, na vifaa vya usafi hutolewa wakati wa masomo kulingana na uwezo wa mshirika anayefadhili."
              },
              photoUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=60",
              supportTillNumber: "8671238",
              audienceTag: {
                en: "SCHOOLS & YOUTH GROUPS — SEPARATE OR JOINT SESSIONS FOR BOYS AND GIRLS",
                sw: "SHULE NA VIKUNDI VYA VIJANA — MASOMO YA PAMOJA AU MBALIMBALI KWA WASICHANA NA WAVULANA"
              },
              outcomeText: {
                en: "A confidential, age-appropriate session — with dignity kits included where a partner is supporting that round.",
                sw: "Kipindi cha siri na kinachofaa umri — kikijumuisha mifuko ya usafi kulingana na mshirika anayefadhili."
              },
              actionButtonText: {
                en: "BOOK A SESSION",
                sw: "OMBA KIPINDI"
              }
            },
            {
              id: "prog-mh",
              title: { en: "Mental Health Awareness and Support", sw: "Elimu na Msaada wa Afya ya Akili" },
              description: {
                en: "Mental health struggles are widespread but rarely spoken about openly in the communities we work in. We use theatre and short film to give mental health a human face — stories of anxiety, stress, and recovery performed by peers rather than delivered as a lecture — making it easier for an audience to recognize what they're feeling and ask for help. We also partner with mental health organizations to run structured awareness and support sessions alongside our performances, so the conversation continues past the final scene.",
                sw: "Changamoto za afya ya akili zimeenea lakini hazizungumzwi waziwazi. Tunatumia maigizo na filamu fupi kuzipa sura ya kibinadamu hadithi za msongo wa mawazo na ushauri wa rika, tukirahisisha jamii kutambua na kuomba msaada. Pia tunashirikiana na mashirika ya afya ya akili kuendesha masomo endelevu."
              },
              photoUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=60",
              supportTillNumber: "8671238",
              audienceTag: {
                en: "SCHOOLS, YOUTH GROUPS & COMMUNITY ORGANIZATIONS",
                sw: "SHULE, VIKUNDI VYA VIJANA NA MASHIRIKA YA KIJAMII"
              },
              outcomeText: {
                en: "A session that names the issue clearly and points to real support, not just performance.",
                sw: "Kipindi kinachotaja tatizo waziwazi na kuelekeza kwenye usaidizi halisi, sio tu maonyesho."
              },
              actionButtonText: {
                en: "BOOK A SESSION",
                sw: "OMBA KIPINDI"
              }
            },
            {
              id: "prog-film-academy",
              title: { en: "Bashosho Film Academy", sw: "Chuo cha Filamu cha Bashosho" },
              description: {
                en: "Every film we make is also a classroom. The Bashosho Film Academy trains young people from Kiambiu and beyond in filmmaking — from scriptwriting and direction to camera work, sound and editing — using our own advocacy productions as real, hands-on projects rather than theoretical exercises. Graduates leave with a practical portfolio and a craft they can build a livelihood on.",
                sw: "Kila filamu tunayotengeneza pia ni darasa. Bashosho Film Academy inafundisha vijana utengenezaji wa filamu kuanzia uandishi, uongozaji, picha, muundo wa sauti, na uhariri kupitia mradi halisi."
              },
              photoUrl: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop&q=60",
              supportTillNumber: "8671238",
              audienceTag: {
                en: "TRAINING THE NEXT GENERATION — ASPIRING YOUNG FILMMAKERS AGED 16–30",
                sw: "MAFUNZO YA KIZAZI KIJACHO — WATENGELEZAJI FILAMU CHIPUKIZI MIAKA 16–30"
              },
              outcomeText: {
                en: "Hands-on filmmaking training, short film production, & industry mentorship",
                sw: "Mafunzo ya vitendo, utengenezaji wa filamu fupi, na ushauri wa kitaaluma"
              },
              actionButtonText: {
                en: "APPLY NOW",
                sw: "OMBA MAFUNZO"
              }
            }
          ],
          projects: [
            {
              id: "proj-1",
              title: { en: "Njia Panda Film Production", sw: "Uzalishaji wa Filamu ya Njia Panda" },
              description: {
                en: "A short educational film highlighting the path to healing for survivors of domestic violence in informal settlements.",
                sw: "Filamu fupi ya kielimu inayoangazia njia ya uponyaji kwa wahanga wa ukatili wa majumbani mitaani."
              },
              photoUrl: "",
              category: "film"
            },
            {
              id: "proj-2",
              title: { en: "Voices in the Dark Theatre", sw: "Maonyesho ya Sauti Gizani" },
              description: {
                en: "A live, multi-stage participatory theatre series addressing toxic environments and youth mental health struggles.",
                sw: "Mfululizo wa maonyesho shirikishi ya jukwaani yanayohusu mazingira hatarishi na changamoto za afya ya akili za vijana."
              },
              photoUrl: "",
              category: "theatre"
            },
            {
              id: "proj-3",
              title: { en: "Kiambiu Sanitizer & Hygiene Project", sw: "Mradi wa Usafi na Sanitizer wa Kiambiu" },
              description: {
                en: "General community wash outreach promoting hygiene security and safe spaces for young girls.",
                sw: "Mradi wa usafi wa mazingira mtaani kukuza usafi na maeneo salama kwa wasichana wadogo."
              },
              photoUrl: "",
              category: "general"
            }
          ],
          contactEmail: "barshoshotalents@gmail.com",
          contactPhone: "+254 798 132 410",
          contactAddress: "Kiambiu Social Center, Kamukunji, Nairobi, Kenya"
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Dynamically inject reCAPTCHA v3 script if site key is configured
  React.useEffect(() => {
    const siteKey = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY || (import.meta as any).env?.RECAPTCHA_SITE_KEY;
    if (siteKey && siteKey !== "MY_RECAPTCHA_SITE_KEY") {
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.async = true;
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      };
    }
  }, []);

  const handleScrollToSignup = () => {
    const signupSection = document.getElementById("get-involved-section");
    if (signupSection) {
      signupSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#E31E24]"></div>
        <div className="w-12 h-12 rounded-full border-4 border-[#E31E24] border-t-transparent animate-spin mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 font-mono animate-pulse">
          {lang === "en" ? "Loading Bashosho CBO..." : "Inapakia Bashosho..."}
        </p>
      </div>
    );
  }

  const content = siteContent!;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1B1B1B] font-sans antialiased selection:bg-[#E31E24]/10 selection:text-[#E31E24] flex flex-col">
      {/* 1. MAIN NAVIGATION HEADER */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-[#E31E24] flex items-center justify-center p-1 border-t-[#00A651] border-r-[#00A651]">
              <BashoshoLogo size={30} showText={false} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-[#E31E24]">BASHOSHO</span>
                <span className="hidden sm:inline-block bg-neutral-100 text-neutral-600 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-neutral-200">
                  Reg: DSD/KAM/CBO/5/4/22/269
                </span>
              </div>
              <p className="text-[9px] font-bold text-[#00A651] uppercase tracking-wider -mt-0.5">TALENTS CBO</p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-5 text-xs font-bold text-neutral-600">
            <a href="#about-section" className="hover:text-[#E31E24] transition-colors">
              {lang === "en" ? "About Us" : "Kuhusu Sisi"}
            </a>
            <a href="#programs-section" className="hover:text-[#E31E24] transition-colors">
              {lang === "en" ? "Programs" : "Programu"}
            </a>
            <a href="#academy-section" className="hover:text-[#E31E24] transition-colors">
              {lang === "en" ? "Film Academy" : "Chuo cha Filamu"}
            </a>
            <a href="#films-section" className="hover:text-[#E31E24] transition-colors">
              {lang === "en" ? "Our Films" : "Filamu Zetu"}
            </a>
            <a href="#impact-section" className="hover:text-[#E31E24] transition-colors">
              {lang === "en" ? "Impact & Turkana" : "Matokeo & Turkana"}
            </a>
            <a href="#partners-section" className="hover:text-[#E31E24] transition-colors">
              {lang === "en" ? "Partners & Team" : "Washirika & Timu"}
            </a>
            <a href="#get-involved-section" className="text-[#00A651] hover:text-emerald-700 transition-colors font-extrabold">
              {lang === "en" ? "Support Us" : "Tusaidie"}
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Report a Concern — always visible. This form (and its backend) was already
                fully built, but had no button anywhere on the site that opened it. */}
            <button
              onClick={() => setShowSafeguardingModal(true)}
              id="header-report-concern-btn"
              className="flex bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[10px] md:text-xs font-bold px-2.5 md:px-3 py-2 rounded-lg transition-colors cursor-pointer items-center gap-1.5"
            >
              <ShieldAlert size={12} /> <span className="hidden sm:inline">{lang === "en" ? "Report a Concern" : "Ripoti Wasiwasi"}</span>
            </button>

            {/* Swahili / English toggle widget */}
            <div className="flex bg-neutral-100 border border-neutral-200 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                onClick={() => onChangeLang("en")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  lang === "en" ? "bg-white text-neutral-900 shadow-xs font-extrabold" : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => onChangeLang("sw")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  lang === "sw" ? "bg-white text-neutral-900 shadow-xs font-extrabold" : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                SW
              </button>
            </div>

            {/* Portal Login Button */}
            <button
              onClick={onNavigateToPortal}
              id="header-member-portal-btn"
              className="bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] md:text-xs font-bold px-3 py-2 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 border border-neutral-800"
            >
              <Lock size={12} className="text-[#E31E24]" /> {lang === "en" ? "Member Portal" : "Tovuti ya Wanachama"}
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative min-h-[85vh] md:min-h-[75vh] flex items-center justify-center overflow-hidden bg-neutral-950 text-white py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/85 via-neutral-950/35 to-neutral-900/25 z-10"></div>
        {/* Dynamic backplate */}
        <div className="absolute inset-0 opacity-80 bg-cover bg-center scale-105 transform transition-transform duration-1000" style={{ backgroundImage: `url('${content.heroImageUrl || "/public/assets/theatre_transformation_hero.jpg"}')` }}></div>
        
        {/* Top Accent Band */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#E31E24] z-20"></div>

        <div className="max-w-5xl mx-auto px-6 text-center space-y-6 relative z-20">
          {/* Credibility Strip */}
          <div className="inline-flex items-center gap-2 bg-neutral-900/90 border border-neutral-700/80 px-3.5 py-1.5 rounded-full backdrop-blur-md">
            <ShieldCheck size={14} className="text-[#00A651]" />
            <span className="text-[10px] md:text-xs font-bold font-mono tracking-widest uppercase text-neutral-200">
              Est. 2020 • Registered CBO 2022 • Kiambiu, Nairobi
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-6xl font-black leading-tight tracking-tight font-sans text-white max-w-4xl mx-auto">
            {content.heroTitle?.[lang] || content.heroTitle?.en || "Connecting Youths Through Talents"}
          </h1>

          <p className="text-sm md:text-base text-neutral-300 max-w-3xl mx-auto leading-relaxed font-sans font-medium">
            {content.heroSubtitle?.[lang] || content.heroSubtitle?.en ||
              (lang === "en"
                ? "A community-based organization using theatre and film to raise awareness on GBV, SRHR and Mental Health — and to train the next generation of Kenyan filmmakers."
                : "Shirika la kijamii linalotumia maigizo na filamu kuhamasisha uelewa kuhusu GBV, SRHR na Afya ya Akili — na kufundisha kizazi kijacho cha watengenezaji filamu wa Kenya.")}
          </p>

          {/* Program Tag Pills Row */}
          <div className="flex flex-wrap justify-center gap-2 pt-1 max-w-3xl mx-auto">
            {["GBV Awareness & Referral", "SRHR Support", "Mental Health", "Theatre as a Service", "Bashosho Film Academy"].map((tag, idx) => (
              <span key={idx} className="bg-neutral-800/90 border border-neutral-700 text-neutral-300 text-[10px] font-mono font-bold px-2.5 py-1 rounded-md">
                {tag}
              </span>
            ))}
          </div>

          {/* 3 Primary CTAs */}
          <div className="pt-6 flex flex-wrap justify-center items-center gap-3">
            <a
              href="#get-involved-section"
              className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-extrabold px-6 py-3.5 rounded-xl cursor-pointer shadow-md transition-all flex items-center gap-2"
            >
              <Heart size={15} className="fill-white" />
              {lang === "en" ? "Support Us" : "Tusaidie"}
            </a>

            <button
              onClick={() => openProgramInquiry({
                id: "prog-partner-hero",
                title: { en: "Institutional Partnership & Support", sw: "Ushirikiano na Usaidizi wa Kitaasisi" },
                description: { en: "Partner with Bashosho Talents CBO for community outreach and programs.", sw: "Shirikiana na Bashosho Talents CBO kwa ajili ya miradi ya jamii." },
                photoUrl: ""
              }, "partner")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-6 py-3.5 rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2"
            >
              <Building2 size={15} />
              {lang === "en" ? "Partner With Us" : "Shirikiana Nasi"}
            </button>

            <button
              onClick={() => setShowTaasModal(true)}
              className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-xs font-extrabold px-6 py-3.5 rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2"
            >
              <Theater size={15} className="text-[#E31E24]" />
              {lang === "en" ? "Hire Us (TaaS)" : "Kodi Wasanii (TaaS)"}
            </button>
          </div>

          {/* Bottom Credibility Line */}
          <div className="pt-4 border-t border-neutral-800/80 max-w-xl mx-auto">
            <p className="text-[11px] font-mono text-neutral-400 font-medium">
              Kiambiu Informal Settlement, Kamukunji, Nairobi · Registration No. <span className="text-white font-bold">DSD/KAM/CBO/5/4/22/269</span>
            </p>
          </div>
        </div>
      </section>

      {/* 3. ABOUT US SECTION (WHO WE ARE) */}
      <section id="about-section" className="py-16 md:py-24 bg-white border-b border-neutral-200 text-left">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          {/* Section Header */}
          <div className="space-y-2">
            <span className="text-xs font-black tracking-widest text-[#E31E24] uppercase block font-mono">
              WHO WE ARE
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-neutral-900 tracking-tight font-sans">
              About Bashosho Talents CBO
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left Column: Official Profile Copy */}
            <div className="lg:col-span-7 space-y-5 text-neutral-700 leading-relaxed font-sans text-sm md:text-base font-medium">
              <p className="bg-neutral-50 border-l-4 border-[#E31E24] p-4 rounded-r-xl text-neutral-900 font-medium leading-relaxed">
                {content.aboutText?.[lang] || content.aboutText?.en ||
                  "Bashosho Talents CBO is a dynamic, community-based organization born in 2020 in the heart of Kiambiu Informal Settlement, Kamukunji, Nairobi, and officially registered as a CBO in 2022. We are non-profit, non-political and non-sectarian — committed to driving social transformation through the powerful mediums of theatre and film."}
              </p>
              
              <p>
                We are registered in Kiambiu Informal Settlement, Kamukunji, Nairobi — and while that's home, our work isn't confined there. We take on performances, partnerships and program delivery with communities and organizations across Kenya, wherever the need is.
              </p>

              <p>
                We have worked closely with all our partners — including the Kiambiu Justice and Information Network, HESED Africa, Maisha Girls Safe House, Tusikimye, Teenseed Africa, Africa Uncensored, the Institute for War & Peace Reporting (IWPR), the Danish Minority Centre for Human Rights & Development, and the Peace at Heart Initiative Network — combining grassroots trust with creative storytelling to reach audiences that traditional campaigns rarely move.
              </p>

              {/* Pill badges row */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <span className="bg-red-50 text-[#E31E24] border border-red-200 text-xs font-bold px-3 py-1 rounded-full">
                  Non-Profit
                </span>
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full">
                  Non-Political
                </span>
                <span className="bg-neutral-100 text-neutral-800 border border-neutral-300 text-xs font-bold px-3 py-1 rounded-full">
                  Non-Sectarian
                </span>
              </div>
            </div>

            {/* Right Column: Stat Strip & Our Story Callout */}
            <div className="lg:col-span-5 space-y-6">
              {/* Stat Strip (3 cards) */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-neutral-900 text-white p-4 rounded-2xl text-center space-y-1 border border-neutral-800">
                  <span className="text-2xl md:text-3xl font-black text-[#E31E24]">2020</span>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Founded</p>
                </div>
                <div className="bg-neutral-900 text-white p-4 rounded-2xl text-center space-y-1 border border-neutral-800">
                  <span className="text-2xl md:text-3xl font-black text-[#00A651]">2022</span>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Registered</p>
                </div>
                <div className="bg-neutral-900 text-white p-4 rounded-2xl text-center space-y-1 border border-neutral-800">
                  <span className="text-xl md:text-2xl font-black text-white">Kiambiu</span>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Base</p>
                </div>
              </div>

              {/* Our Story Quote Box */}
              <div className="bg-neutral-900 text-white rounded-2xl p-6 border border-neutral-800 space-y-3 relative overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 text-[#E31E24]">
                  <Award size={18} />
                  <span className="text-xs font-extrabold uppercase tracking-widest font-mono">Our Origin & Belief</span>
                </div>
                <p className="text-xs md:text-sm text-neutral-300 leading-relaxed italic font-serif">
                  "What began as a small group of young people in Kiambiu uniting through singing, dance, comedy and spoken word has grown into a structured CBO that believes youth are not simply the demographic most often blamed for a community's problems — they can be its most powerful agents of change."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. VISION & MISSION */}
      <section className="py-16 md:py-20 bg-neutral-950 text-white border-b border-neutral-800 text-left">
        <div className="max-w-6xl mx-auto px-6 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Vision Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-4 relative overflow-hidden shadow-md">
              <div className="w-12 h-12 rounded-2xl bg-[#E31E24] flex items-center justify-center text-white shadow-xs">
                <Target size={24} />
              </div>
              <span className="text-xs font-bold font-mono tracking-widest text-[#E31E24] uppercase block">
                OUR VISION
              </span>
              <h3 className="text-xl font-bold text-white tracking-tight">
                A Safe Space to Be Heard, Healed & Seen
              </h3>
              <p className="text-neutral-300 text-sm leading-relaxed font-sans font-medium">
                {content.visionText?.[lang] || content.visionText?.en ||
                  "\"A Kenya where every young person has a safe space to be heard, healed, and seen — through the power of theatre and film.\""}
              </p>
            </div>

            {/* Mission Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-4 relative overflow-hidden shadow-md">
              <div className="w-12 h-12 rounded-2xl bg-[#00A651] flex items-center justify-center text-white shadow-xs">
                <Compass size={24} />
              </div>
              <span className="text-xs font-bold font-mono tracking-widest text-[#00A651] uppercase block">
                OUR MISSION
              </span>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Creative Advocacy & Skills
              </h3>
              <p className="text-neutral-300 text-sm leading-relaxed font-sans font-medium">
                {content.missionText?.[lang] || content.missionText?.en ||
                  "\"We use theatre and film to raise awareness on GBV, SRHR, and Mental Health, train the next generation of filmmakers through the Bashosho Film Academy, and put our skills to work for partner organizations through Theatre as a Service.\""}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. OUR APPROACH / METHODOLOGY */}
      <section id="approach-section" className="py-16 md:py-24 bg-neutral-50 border-b border-neutral-200 text-left">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="space-y-2">
            <span className="text-xs font-black tracking-widest text-[#E31E24] uppercase block font-mono">
              OUR METHODOLOGY
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-neutral-900 tracking-tight font-sans">
              Four Pillars of Community Transformation
            </h2>
            <p className="text-neutral-600 text-sm max-w-2xl font-medium">
              We combine artistic rigor with grounded grassroots community access to engage audiences where traditional communications fail.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1 */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-3 shadow-xs hover:border-[#E31E24]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#E31E24] flex items-center justify-center font-bold">
                <Theater size={20} />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Theatre Productions</h3>
              <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                Interactive, forum-style performances staged directly in the community, addressing the issues residents live with every day.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-3 shadow-xs hover:border-[#E31E24]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00A651] flex items-center justify-center font-bold">
                <Clapperboard size={20} />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Educational Films</h3>
              <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                Compelling short films and documentary-style content that informs, humanizes, and inspires action long after the credits roll.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-3 shadow-xs hover:border-[#E31E24]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Users size={20} />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Community Workshops</h3>
              <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                Hands-on sessions that engage residents in artistic expression, dialogue, and peer-to-peer psychosocial support.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-3 shadow-xs hover:border-[#E31E24]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Megaphone size={20} />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Advocacy Campaigns</h3>
              <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                Street marches, banners and coordinated outreach that raise awareness of critical social issues and connect residents to services.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. OUR CORE PROGRAMS */}
      <section id="programs-section" className="py-16 md:py-24 bg-white border-b border-neutral-200 text-left">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="space-y-2 border-b border-neutral-200 pb-6">
            <span className="text-xs font-black tracking-widest text-[#E31E24] uppercase block font-mono">
              WHAT WE DO IN THE COMMUNITY
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-neutral-900 tracking-tight font-sans">
              Our Programs
            </h2>
            <p className="text-neutral-600 text-sm max-w-2xl font-medium">
              Four programs carry our work from the stage into people's lives — each with its own audience, its own goal, and a clear next step for anyone who wants to book, partner, or support it.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {content.programs.map((prog) => (
              <div
                key={prog.id}
                className="bg-neutral-50 border border-neutral-200 rounded-3xl overflow-hidden shadow-xs hover:border-[#E31E24]/40 hover:shadow-md transition-all flex flex-col justify-between text-left group"
              >
                {/* Program Header Image Banner */}
                <div className="h-52 bg-neutral-900 relative overflow-hidden shrink-0 flex items-center justify-center">
                  {prog.photoUrl ? (
                    <img
                      src={prog.photoUrl}
                      alt={prog.title[lang]}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-900 flex flex-col items-center justify-center p-4 text-center text-neutral-500 space-y-2">
                      <Film size={32} className="text-[#E31E24]" />
                      <span className="text-[10px] font-bold tracking-widest uppercase font-mono">
                        {prog.title[lang]}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent"></div>
                  
                  {/* Audience Tag Pill */}
                  {prog.audienceTag && (
                    <div className="absolute bottom-3 left-4 right-4">
                      <span className="bg-white/95 backdrop-blur-md text-neutral-900 text-[10px] font-bold font-mono tracking-wider px-3 py-1 rounded-md uppercase shadow-xs">
                        {prog.audienceTag[lang]}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-6 md:p-8 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h3 className="text-xl font-black text-neutral-900 tracking-tight font-sans">
                      {prog.title[lang]}
                    </h3>

                    <p className="text-xs md:text-sm text-neutral-700 font-sans font-medium leading-relaxed">
                      {prog.description[lang]}
                    </p>

                    {prog.outcomeText && (
                      <div className="pt-2 border-t border-dashed border-neutral-300">
                        <p className="text-xs font-semibold italic text-[#00A651]">
                          "{prog.outcomeText[lang]}"
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-neutral-200 mt-auto space-y-3">
                    {/* Till Number Banner */}
                    {prog.supportTillNumber && (
                      <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] font-mono font-bold text-emerald-900">
                        <span>LIPA NA M-PESA TILL:</span>
                        <span className="text-emerald-700 text-xs font-black tracking-wider">{prog.supportTillNumber}</span>
                      </div>
                    )}

                    {/* Action Buttons Row */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {prog.id === "prog-taas" || prog.title.en.includes("Theatre as a Service") ? (
                        <>
                          <button
                            onClick={() => setShowTaasModal(true)}
                            className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                          >
                            <Theater size={14} /> {prog.actionButtonText?.[lang] || "Hire Us (TaaS)"}
                          </button>
                          <button
                            onClick={() => openProgramInquiry(prog, "partner")}
                            className="bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer border border-neutral-700"
                          >
                            {lang === "en" ? "Sponsor TaaS" : "Fadhili TaaS"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => openProgramInquiry(prog, "partner")}
                            className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                          >
                            {lang === "en" ? "Partner / Sponsor" : "Shirikiana / Fadhili"}
                          </button>
                          <button
                            onClick={() => openProgramInquiry(prog, "book_session")}
                            className="bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                          >
                            {lang === "en" ? "Inquire Program" : "Uliza Kuhusu Programu"}
                          </button>
                          <button
                            onClick={() => setSelectedSponsorProgram(prog)}
                            className="bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Heart size={12} /> {lang === "en" ? "Sponsor" : "Dhamini"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. BASHOSHO FILM ACADEMY */}
      <section id="academy-section" className="py-16 md:py-24 bg-neutral-900 text-white border-b border-neutral-800 text-left relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 space-y-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-black tracking-widest text-[#E31E24] uppercase block font-mono">
                  CREATIVE EMPOWERMENT & SKILLS
                </span>
                <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight font-sans">
                  Bashosho Film Academy
                </h2>
              </div>

              <div className="space-y-4 text-neutral-300 text-sm md:text-base leading-relaxed font-medium">
                <p>
                  Every film we make is also a classroom. The Bashosho Film Academy trains young people from Kiambiu and beyond in filmmaking — from scriptwriting and direction to camera work, sound and editing — using our own advocacy productions as real, hands-on projects rather than theoretical exercises.
                </p>
                <p>
                  Graduates leave with a practical portfolio and a craft they can build a livelihood on, while Bashosho gains a growing bench of skilled young filmmakers able to carry our storytelling — and eventually their own — to a wider audience.
                </p>
                <p className="border-l-4 border-[#00A651] pl-4 italic text-white font-serif">
                  It is where our two identities meet: a CBO using film for advocacy, and a training ground turning that same film work into opportunity for the youth who make it.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => openProgramInquiry({
                    id: "prog-academy-inquiry",
                    title: { en: "Bashosho Film Academy Training", sw: "Mafunzo ya Chuo cha Filamu cha Bashosho" },
                    description: { en: "Hands-on filmmaking course for young creatives.", sw: "Kozi ya vitendo ya utengenezaji filamu kwa vijana." },
                    photoUrl: ""
                  }, "film_apply")}
                  className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-extrabold px-6 py-3.5 rounded-xl cursor-pointer shadow-md transition-all flex items-center gap-2"
                >
                  <Clapperboard size={16} />
                  {lang === "en" ? "Apply for Academy Cohort" : "Omba Kujiunga na Chuo"}
                </button>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4">
              <div className="bg-neutral-800/90 border border-neutral-700/80 p-5 rounded-2xl space-y-2">
                <Film className="text-[#E31E24]" size={24} />
                <h4 className="text-sm font-bold text-white">Script & Direction</h4>
                <p className="text-[11px] text-neutral-400">Story structure, character arcs, and director's block setup.</p>
              </div>

              <div className="bg-neutral-800/90 border border-neutral-700/80 p-5 rounded-2xl space-y-2">
                <Camera className="text-[#00A651]" size={24} />
                <h4 className="text-sm font-bold text-white">Camera & Lighting</h4>
                <p className="text-[11px] text-neutral-400">Cinematography, framing, exposure, and lighting rigs.</p>
              </div>

              <div className="bg-neutral-800/90 border border-neutral-700/80 p-5 rounded-2xl space-y-2">
                <Wrench className="text-amber-500" size={24} />
                <h4 className="text-sm font-bold text-white">Sound & Editing</h4>
                <p className="text-[11px] text-neutral-400">Field audio recording, dialogue sync, and digital editing.</p>
              </div>

              <div className="bg-neutral-800/90 border border-neutral-700/80 p-5 rounded-2xl space-y-2">
                <Users className="text-blue-500" size={24} />
                <h4 className="text-sm font-bold text-white">Practical Crew</h4>
                <p className="text-[11px] text-neutral-400">Real on-set crew experience in advocacy films.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. OUR FILMS */}
      <section id="films-section" className="py-16 md:py-24 bg-white border-b border-neutral-200 text-left">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="space-y-2">
            <span className="text-xs font-black tracking-widest text-[#E31E24] uppercase block font-mono">
              PRODUCTIONS & PROOF OF WORK
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-neutral-900 tracking-tight font-sans">
              Our Films & Screenings
            </h2>
            <p className="text-neutral-600 text-sm max-w-2xl font-medium">
              Key productions created by Bashosho Talents CBO, combining compelling storytelling with real community advocacy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {(content.projects && content.projects.length > 0 ? content.projects : [
              {
                id: "proj-kenda",
                title: { en: "KENDA — A Story of Strength and Hope", sw: "KENDA — Hadithi ya Nguvu na Tumaini" },
                description: {
                  en: "A young girl's life is shattered by abuse — but she finds strength in the face of trauma. KENDA confronts gender-based violence head-on and makes the case for supporting mental health with courage and hope. Produced with support from Africa Uncensored and IWPR as part of Voices for Change (V4C).",
                  sw: "Hadithi ya binti aliyeathiriwa na dhuluma lakini akapata nguvu za kusimama tena. Filamu ya KENDA inapambana na dhuluma za kijinsia na kukuza afya ya akili. Mwezi wa Novemba 2024."
                },
                photoUrl: "",
                category: "film",
                youtubeUrl: "https://www.youtube.com/results?search_query=KENDA+Official+The+Silent+Battle+Within+Bashosho",
                crew: { en: "Produced with Africa Uncensored & IWPR • Premiered Nov 30, 2024", sw: "Imezalishwa na Africa Uncensored & IWPR • Onyesho Nov 30, 2024" }
              },
              {
                id: "proj-biggie",
                title: { en: "BIGGIE — The Film", sw: "BIGGIE — Filamu" },
                description: {
                  en: "Biggie is a young man caught between crime and violence — searching for identity and forced to support his mother despite a difficult upbringing. Made in commemoration of 16 Days of Activism, tracing how GBV leads to crime.",
                  sw: "Hadithi ya kijana aliyenaswa kati ya uhalifu na vurugu — akitafuta msingi wa maisha na kumsaidia mama yake."
                },
                photoUrl: "",
                category: "film",
                youtubeUrl: "https://www.youtube.com/results?search_query=BIGGIE+THE+FILM+Official+Video+Bashosho",
                crew: { en: "16 Days of Activism Release • 12,000+ Views", sw: "Maonyesho ya Siku 16 za Uanaharakati • Tazamwa Mara 12,000+" }
              }
            ]).map((proj) => (
              <div key={proj.id} className="bg-neutral-900 text-white rounded-3xl overflow-hidden border border-neutral-800 shadow-md flex flex-col justify-between">
                <div className="p-7 md:p-8 space-y-4">
                  {proj.photoUrl && (
                    <div className="w-full h-48 rounded-2xl overflow-hidden bg-neutral-800 mb-3 border border-neutral-700/50">
                      <img src={proj.photoUrl} alt={proj.title[lang] || proj.title.en} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-[#E31E24] text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-md uppercase">
                      {proj.category === "film" ? "Film Production" : proj.category === "theatre" ? "Participatory Theatre" : "Outreach Project"}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-white tracking-tight">
                    {proj.title?.[lang] || proj.title?.en || ""}
                  </h3>

                  <p className="text-xs md:text-sm text-neutral-300 leading-relaxed font-medium">
                    {proj.description?.[lang] || proj.description?.en || ""}
                  </p>

                  {proj.crew && (
                    <div className="p-3.5 bg-neutral-800/80 border border-neutral-700/80 rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#00A651] font-mono block">
                        Credits & Impact
                      </span>
                      <p className="text-xs text-neutral-300 font-medium leading-relaxed">
                        {proj.crew?.[lang] || proj.crew?.en}
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-6 md:p-8 pt-0 mt-auto space-y-2">
                  {proj.youtubeUrl ? (
                    <a
                      href={proj.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full bg-[#E31E24] hover:bg-red-700 text-white text-xs font-extrabold py-3.5 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                    >
                      <Play size={15} className="fill-white" /> Watch on YouTube
                    </a>
                  ) : (
                    <button
                      onClick={() => openProgramInquiry({ id: proj.id, title: proj.title, description: proj.description, photoUrl: proj.photoUrl }, "partner")}
                      className="w-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-extrabold py-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      Inquire About Screening
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedSupportProject(proj)}
                    className="w-full bg-transparent hover:bg-emerald-950/40 text-emerald-400 border border-emerald-700/60 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Heart size={13} /> {lang === "en" ? "Support This Production" : "Changia Uzalishaji Huu"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Channel Link Banner */}
          <div className="bg-neutral-100 border border-neutral-300 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-neutral-900">More on Our Channels</h4>
              <p className="text-xs text-neutral-600 font-medium">
                Bashosho Talents also produces shorter sketches, spoken word and behind-the-scenes content on YouTube (<strong className="font-mono">@barshoshotalents9596</strong>) and Facebook (<strong className="font-mono">Bashosho Talents CBO</strong>).
              </p>
            </div>
            <a
              href="https://www.youtube.com/@barshoshotalents9596"
              target="_blank"
              rel="noreferrer"
              className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors shrink-0 flex items-center gap-1.5"
            >
              <ExternalLink size={14} /> Visit YouTube Channel
            </a>
          </div>
        </div>
      </section>

      {/* 9. BEHIND THE SCENES / GALLERY */}
      <section id="gallery-section" className="py-16 md:py-24 bg-neutral-50 border-b border-neutral-200 text-left">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="space-y-2">
            <span className="text-xs font-black tracking-widest text-[#E31E24] uppercase block font-mono">
              COMMUNITY ACTIVISM IN PICTURES
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-neutral-900 tracking-tight font-sans">
              Behind the Scenes & Field Outreach
            </h2>
            <p className="text-neutral-600 text-sm max-w-2xl font-medium">
              Real moments from set, street marches, mental health circles, and community dialogues across Kiambiu slum and Nairobi.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(galleryImages && galleryImages.length > 0 ? galleryImages : [
              { url: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&auto=format&fit=crop&q=80", caption: "Community Theatre Outreach in Kiambiu" },
              { url: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&auto=format&fit=crop&q=80", caption: "On Set: Film Academy Production" },
              { url: "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=800&auto=format&fit=crop&q=80", caption: "Youth Dialogue & Mental Health Circle" },
              { url: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80", caption: "16 Days of Activism Street Campaign" }
            ]).map((img, i) => (
              <div
                key={i}
                onClick={() => setActiveLightboxImage(img.url)}
                className="group relative h-56 bg-neutral-900 rounded-2xl overflow-hidden cursor-pointer border border-neutral-200 shadow-xs hover:border-[#E31E24] transition-all"
              >
                <img
                  src={img.url}
                  alt={img.caption || "Gallery"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                  <p className="text-white text-xs font-bold font-sans line-clamp-2">{img.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9b. PRODUCTION & SOUND GEAR HIRE — previously fully built (fetch, booking modal,
           backend, M-Pesa payment instructions) but had no entry point anywhere on the
           page, so it was completely unreachable by visitors. */}
      {hireableAssets.length > 0 && (
        <section id="equipment-section" className="py-16 md:py-24 bg-neutral-50 border-b border-neutral-200 text-left">
          <div className="max-w-6xl mx-auto px-6 space-y-12">
            <div className="space-y-2 border-b border-neutral-200 pb-6">
              <span className="text-xs font-black tracking-widest text-[#E31E24] uppercase block font-mono">
                {content.equipmentEyebrow?.[lang] || content.equipmentEyebrow?.en || "SUPPORT OUR WORK"}
              </span>
              <h2 className="text-2xl md:text-4xl font-black text-neutral-900 tracking-tight font-sans">
                {content.equipmentTitle?.[lang] || content.equipmentTitle?.en || "Production & Sound Gear Hire"}
              </h2>
              <p className="text-neutral-600 text-sm max-w-2xl font-medium">
                {content.equipmentSubtitle?.[lang] || content.equipmentSubtitle?.en ||
                  "Rent our cameras, sound, and production equipment for your own event or shoot — proceeds go straight back into our community programs."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {hireableAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs hover:border-[#E31E24] transition-all flex flex-col"
                >
                  <div className="h-40 bg-neutral-900 relative overflow-hidden">
                    {asset.photoUrl ? (
                      <img src={asset.photoUrl} alt={asset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs font-mono uppercase">
                        {asset.category}
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2 flex-1 flex flex-col">
                    <h4 className="text-sm font-bold text-neutral-900">{asset.name}</h4>
                    <p className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider">{asset.category}</p>
                    <div className="flex-1"></div>
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                      <span className="text-sm font-black text-[#00A651] font-mono">
                        Ksh {(asset.dailyRate || 1500).toLocaleString()}<span className="text-[10px] text-neutral-400 font-normal">/day</span>
                      </span>
                      <button
                        onClick={() => setSelectedHireAsset(asset)}
                        className="bg-neutral-900 hover:bg-[#E31E24] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-2 rounded-lg transition-colors cursor-pointer"
                      >
                        {lang === "en" ? "Hire This" : "Kodisha"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 10. IMPACT & OUTREACH */}
      <section id="impact-section" className="py-16 md:py-24 bg-white border-b border-neutral-200 text-left">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="space-y-2 border-b border-neutral-200 pb-6">
            <span className="text-xs font-black tracking-widest text-[#E31E24] uppercase block font-mono">
              MEASURABLE RESULTS
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-neutral-900 tracking-tight font-sans">
              Impact & Reach
            </h2>
            <p className="text-neutral-600 text-sm max-w-2xl font-medium">
              Ground-level change tracked across youth engagement, film views, GBV referrals, and community mental health interventions.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-neutral-50 border border-neutral-200 p-6 rounded-3xl space-y-2">
              <span className="text-3xl md:text-4xl font-black text-[#E31E24] font-mono">5,000+</span>
              <h4 className="text-sm font-bold text-neutral-900">Youth Engaged Directly</h4>
              <p className="text-xs text-neutral-600 font-medium">Through theatre performances, workshops, and film screenings.</p>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 p-6 rounded-3xl space-y-2">
              <span className="text-3xl md:text-4xl font-black text-[#00A651] font-mono">12,000+</span>
              <h4 className="text-sm font-bold text-neutral-900">Digital Views</h4>
              <p className="text-xs text-neutral-600 font-medium">Across advocacy film releases on YouTube and social platforms.</p>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 p-6 rounded-3xl space-y-2">
              <span className="text-3xl md:text-4xl font-black text-amber-600 font-mono">350+</span>
              <h4 className="text-sm font-bold text-neutral-900">Survivors Supported</h4>
              <p className="text-xs text-neutral-600 font-medium">Referred to local safe houses, legal aid, and counseling partners.</p>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 p-6 rounded-3xl space-y-2">
              <span className="text-3xl md:text-4xl font-black text-blue-600 font-mono">45+</span>
              <h4 className="text-sm font-bold text-neutral-900">Film Academy Alumni</h4>
              <p className="text-xs text-neutral-600 font-medium">Trained in practical filmmaking, sound recording, and editing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 11. WORK WITH US / SUPPORT OUR WORK */}
      <section id="support-work-section" className="py-16 md:py-24 bg-neutral-900 text-white border-b border-neutral-800 text-left">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="space-y-2">
            <span className="text-xs font-black tracking-widest text-[#E31E24] uppercase block font-mono">
              WORK WITH US
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight font-sans">
              Support Our Work
            </h2>
            <p className="text-neutral-400 text-sm max-w-2xl font-medium">
              Three direct ways to collaborate, commission our creative services, or fuel our ongoing community interventions in Kiambiu.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: Book Theatre as a Service */}
            <div className="bg-neutral-800/80 border border-neutral-700/80 rounded-3xl p-7 space-y-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#E31E24]/20 border border-[#E31E24]/40 flex items-center justify-center text-[#E31E24]">
                  <Theater size={24} />
                </div>
                <h3 className="text-xl font-black text-white">Book Theatre as a Service</h3>
                <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                  Commission custom participatory forum theatre for your NGO campaign, corporate social responsibility initiative, or school awareness drive.
                </p>
              </div>

              <button
                onClick={() => setShowTaasModal(true)}
                className="w-full bg-[#E31E24] hover:bg-red-700 text-white text-xs font-extrabold py-3.5 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                Book TaaS Performance
              </button>
            </div>

            {/* Card 2: Partner With Us */}
            <div className="bg-neutral-800/80 border border-neutral-700/80 rounded-3xl p-7 space-y-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Handshake size={24} />
                </div>
                <h3 className="text-xl font-black text-white">Partner With Us</h3>
                <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                  Collaborate on youth empowerment, GBV survivor advocacy, mental health support circles, or film productions in Nairobi informal settlements.
                </p>
              </div>

              <button
                onClick={() => openProgramInquiry({
                  id: "general-partner",
                  title: { en: "General Partnership Inquiry", sw: "Ushirikiano wa Kijumla" },
                  description: { en: "Partner with Bashosho Talents CBO.", sw: "Shirikiana na Bashosho Talents CBO." },
                  photoUrl: ""
                }, "partner")}
                className="w-full bg-[#00A651] hover:bg-emerald-700 text-white text-xs font-extrabold py-3.5 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                Partner Inquiry
              </button>
            </div>

            {/* Card 3: Support Film & Community Projects */}
            <div className="bg-neutral-800/80 border border-neutral-700/80 rounded-3xl p-7 space-y-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <HeartHandshake size={24} />
                </div>
                <h3 className="text-xl font-black text-white">Support Film & Projects</h3>
                <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                  Direct donor contributions support production gear, film screening venues, survivor transport, and youth mentorship stipends.
                </p>
                <div className="p-3 bg-neutral-900 border border-neutral-700 rounded-xl space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 block">Lipa na M-Pesa Buy Goods Till</span>
                  <p className="text-lg font-mono font-black text-white">8671238</p>
                  <p className="text-[10px] text-neutral-400">Account: Bashosho Talents CBO</p>
                </div>
              </div>

              <button
                onClick={() => {
                  const getInvolvedElem = document.getElementById("get-involved-section");
                  if (getInvolvedElem) getInvolvedElem.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-extrabold py-3.5 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                View Donor Options
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 12. OUR TRUSTED PARTNERS */}
      <section id="partners-section" className="py-16 md:py-24 bg-white border-b border-neutral-200 text-left">
        <div className="max-w-6xl mx-auto px-6 space-y-10">
          <div className="space-y-2 border-b border-neutral-200 pb-6">
            <span className="text-xs font-black tracking-widest text-[#E31E24] uppercase block font-mono">
              COLLABORATION & NETWORKS
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-neutral-900 tracking-tight font-sans">
              Our Trusted Partners & Allies
            </h2>
            <p className="text-neutral-600 text-sm max-w-2xl font-medium">
              We work alongside local CBOs, human rights networks, media outlets, and protection partners to amplify community impact.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {(content.partnersList && content.partnersList.length > 0
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
              <div
                key={partner.id}
                className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-2 shadow-2xs hover:border-[#E31E24] hover:bg-white transition-all group min-h-[95px]"
              >
                {partner.logoUrl ? (
                  <img
                    src={partner.logoUrl}
                    alt={partner.name}
                    className="max-h-10 max-w-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-white group-hover:bg-red-50 flex items-center justify-center text-neutral-700 group-hover:text-[#E31E24] font-black text-xs uppercase border border-neutral-200 transition-colors">
                    {partner.name.substring(0, 2)}
                  </div>
                )}
                <p className="text-xs font-bold text-neutral-800 line-clamp-2 leading-tight font-sans">
                  {partner.name}
                </p>
                {partner.category && (
                  <span className="text-[9px] font-mono text-neutral-400 font-semibold uppercase tracking-wider">
                    {partner.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 13. LEADERSHIP & TEAM */}
      <section id="team-section" className="py-16 md:py-24 bg-neutral-50 border-b border-neutral-200 text-left">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="space-y-2">
            <span className="text-xs font-black tracking-widest text-[#E31E24] uppercase block font-mono">
              THE PEOPLE BEHIND BASHOSHO
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-neutral-900 tracking-tight font-sans">
              Leadership & Core Team
            </h2>
            <p className="text-neutral-600 text-sm max-w-2xl font-medium">
              Community leaders, theatre directors, filmmakers, and safeguarding officers driving our daily operations in Kiambiu.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {(content.teamMembers && content.teamMembers.length > 0 ? content.teamMembers : [
              { id: "tm-1", name: "Kennedy Onyango", title: "Executive Director", bio: "Leading strategy, donor partnerships, organizational governance, and grassroots advocacy in Kiambiu." },
              { id: "tm-2", name: "Michael Kamande", title: "Communications & Marketing", bio: "Directing public relations, media engagement, digital storytelling, and brand outreach." },
              { id: "tm-3", name: "Irene Maina", title: "Programs Coordinator", bio: "Managing community project schedules, stakeholder coordination, and field outreach operations." },
              { id: "tm-4", name: "Morgan Otieno", title: "Theatre and Film Director", bio: "Directing participatory stage performances, scriptwriting, and film production workshops." },
              { id: "tm-5", name: "Paul Ngala", title: "Safeguarding & Field Officer", bio: "Ensuring community safety, ethical referral pathways, and child protection standards." },
              { id: "tm-6", name: "Shaniz Fabrizia", title: "Youth & Gender Officer", bio: "Facilitating youth empowerment, SRHR peer education, and gender equality circles." }
            ]).map((member) => (
              <div key={member.id} className="bg-white border border-neutral-200 rounded-3xl p-6 space-y-4 shadow-2xs hover:border-[#E31E24]/50 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center text-neutral-400 font-bold">
                    {member.photoUrl ? (
                      <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={32} className="text-neutral-400" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-black text-neutral-900">{member.name}</h3>
                    <p className="text-xs font-bold text-[#E31E24] uppercase tracking-wider font-mono">{member.title}</p>
                  </div>

                  <p className="text-xs text-neutral-600 font-medium leading-relaxed">{member.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 14. SUPPORT US & GET INVOLVED */}
      <section id="get-involved-section" className="py-16 md:py-24 bg-white text-left">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="space-y-2 border-b border-neutral-200 pb-6">
            <span className="text-xs font-black tracking-widest text-[#E31E24] uppercase block font-mono">
              STAND WITH US
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-neutral-900 tracking-tight font-sans">
              Support Us & Get Involved
            </h2>
            <p className="text-neutral-600 text-sm max-w-2xl font-medium">
              Join our movement as a donor, partner, program member, or volunteer staff member.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: Direct M-PESA Donation */}
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-8 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                  <Heart size={24} className="fill-white" />
                </div>
                <h3 className="text-xl font-black text-neutral-900">Direct M-PESA Donation</h3>
                <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                  Support our community performances, youth stipends, and emergency relief directly via M-PESA.
                </p>

                <div className="p-4 bg-white border border-emerald-200 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase block">LIPA NA M-PESA TILL</span>
                  <span className="text-2xl font-black font-mono text-emerald-600">8671238</span>
                  <span className="text-[10px] text-neutral-500 block font-sans">Bashosho Talents CBO</span>
                </div>
              </div>
            </div>

            {/* Card 2: Program Member */}
            <div className="bg-red-50/50 border-2 border-red-200 rounded-3xl p-8 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#E31E24] text-white flex items-center justify-center">
                  <User size={24} />
                </div>
                <h3 className="text-xl font-black text-neutral-900">Become a Program Member</h3>
                <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                  Participate directly in our films, theatre, mental health circles, and leadership modules.
                </p>
                <div className="p-3 bg-white border border-red-200 rounded-xl text-[10px] text-red-800 font-medium leading-relaxed">
                  <strong>Notice:</strong> Membership fee: KSh 500 (payable after approval).
                </div>
              </div>

              <button
                onClick={() => setActiveFormType("member")}
                className="w-full bg-[#E31E24] hover:bg-red-700 text-white text-xs font-black py-3.5 rounded-xl cursor-pointer transition-colors shadow-xs"
              >
                Sign Up as Member
              </button>
            </div>

            {/* Card 3: Volunteer Staff */}
            <div className="bg-neutral-50 border-2 border-neutral-200 rounded-3xl p-8 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center">
                  <Users size={24} />
                </div>
                <h3 className="text-xl font-black text-neutral-900">Become a Volunteer</h3>
                <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                  Support our stage coordination, audio/video production, safeguarding, or field logistics.
                </p>
                <div className="p-3 bg-white border border-neutral-200 rounded-xl text-[10px] text-neutral-600 font-medium leading-relaxed">
                  <strong>No Fee:</strong> Free to volunteer with dedication and heart.
                </div>
              </div>

              <button
                onClick={() => setActiveFormType("volunteer")}
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-black py-3.5 rounded-xl cursor-pointer transition-colors shadow-xs"
              >
                Sign Up as Volunteer
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-neutral-950 text-white text-left pt-16 border-t-4 border-[#E31E24]">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 pb-12 border-b border-neutral-800">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-1 border border-red-500">
                <BashoshoLogo size={30} showText={false} />
              </div>
              <div>
                <span className="text-sm font-black uppercase tracking-wider text-[#E31E24]">BASHOSHO</span>
                <p className="text-[10px] font-bold text-[#00A651] uppercase -mt-1">TALENTS CBO</p>
              </div>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed font-medium">
              Youth participatory performance art, film, and mental health campaign in Kiambiu slum, Nairobi.
            </p>
            <div className="pt-1">
              <span className="text-[10px] font-mono text-neutral-500 block">REG NO: DSD/KAM/CBO/5/4/22/269</span>
              <span className="text-[10px] font-mono text-emerald-400 block">M-PESA TILL: 8671238</span>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-[#E31E24] uppercase tracking-wider font-mono">Quick Navigation</h3>
            <ul className="space-y-2 text-neutral-400 font-medium">
              <li><a href="#about-section" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#approach-section" className="hover:text-white transition-colors">Our Methodology</a></li>
              <li><a href="#programs-section" className="hover:text-white transition-colors">Core Programs</a></li>
              <li><a href="#academy-section" className="hover:text-white transition-colors">Film Academy</a></li>
              <li><a href="#films-section" className="hover:text-white transition-colors">Our Films</a></li>
              <li><a href="#support-work-section" className="hover:text-white transition-colors">Support Our Work</a></li>
              <li><a href="#get-involved-section" className="hover:text-white transition-colors">Support & Join Us</a></li>
              <li>
                <button
                  onClick={() => setShowSafeguardingModal(true)}
                  className="text-amber-400 hover:text-amber-300 transition-colors cursor-pointer text-left"
                >
                  {lang === "en" ? "Report a Safeguarding Concern" : "Ripoti Wasiwasi wa Ulinzi"}
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-4 text-xs text-neutral-400 font-medium">
            <h3 className="font-bold text-[#E31E24] uppercase tracking-wider font-mono">Official Contacts</h3>
            <p className="flex items-center gap-2"><Mail size={14} className="text-[#E31E24]" /> <strong className="text-white font-mono">{content.contactEmail}</strong></p>
            <p className="flex items-center gap-2"><Phone size={14} className="text-[#E31E24]" /> <strong className="text-white font-mono">{content.contactPhone}</strong></p>
            <p className="flex items-center gap-2"><MapPin size={14} className="text-[#E31E24]" /> <span className="text-white">{content.contactAddress}</span></p>
            <p className="flex items-center gap-2">
              <Facebook size={14} className="text-[#1877F2]" />
              <a href={content.facebookUrl || "https://web.facebook.com/bashoshotalentscbo"} target="_blank" rel="noreferrer" className="text-[#1877F2] font-mono hover:underline font-bold">
                bashoshotalentscbo
              </a>
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap justify-between items-center text-[10px] text-neutral-500 font-mono gap-4">
          <p>© 2026 BASHOSHO TALENTS CBO. All Rights Reserved. Reg No: DSD/KAM/CBO/5/4/22/269</p>
          <p>Kiambiu Slum Youth & Gender Advocacy Campaign, Nairobi, Kenya.</p>
        </div>
      </footer>

      {/* 10. MODAL: REGISTRATION FORMS */}
      <AnimatePresence>
        {activeFormType && (
          <SignupFormModal
            type={activeFormType}
            lang={lang}
            onClose={() => setActiveFormType(null)}
          />
        )}
      </AnimatePresence>

      {/* 11. MODAL: LIGHTBOX */}
      <Modal
        isOpen={!!activeLightboxImage}
        onClose={() => setActiveLightboxImage(null)}
        maxWidth="max-w-4xl"
      >
        {activeLightboxImage && (
          <div className="flex flex-col items-center justify-center p-2">
            <img
              src={activeLightboxImage}
              alt="Enlarged gallery view"
              className="max-w-full max-h-[80vh] object-contain rounded-xl border border-neutral-200 shadow-md"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </Modal>

      {/* Sponsor Modal */}
      <Modal
        isOpen={!!selectedSponsorProgram}
        onClose={() => setSelectedSponsorProgram(null)}
        title={
          <span className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
            <Heart size={14} className="text-[#E31E24] fill-[#E31E24]" /> {lang === "en" ? "Sponsor Program" : "Dhamini Programu"}
          </span>
        }
        maxWidth="max-w-md"
      >
        {selectedSponsorProgram && (
          <div className="space-y-3 font-sans">
            <span className="text-[10px] font-black text-[#E31E24] uppercase tracking-wider block">
              {selectedSponsorProgram.title[lang]}
            </span>
            <p className="text-xs text-gray-600 leading-relaxed font-sans font-medium">
              {selectedSponsorProgram.sponsorContactNote?.[lang] || (
                lang === "en"
                  ? "Interested in sponsoring this program long-term? Get in touch with us at barshoshotalents@gmail.com to discuss curriculum support, kits, or community outreach sponsorships."
                  : "Je, ungependa kudhamini mpango huu kwa muda mrefu? Wasiliana nasi kwa barshoshotalents@gmail.com ili kujadili msaada wa mtaala, vifaa, au udhamini wa uhamasishaji wa jamii."
              )}
            </p>

            <div className="pt-2">
              <a
                href={`mailto:barshoshotalents@gmail.com?subject=Sponsorship Inquiry: ${selectedSponsorProgram.title.en}`}
                className="flex justify-center items-center gap-1.5 bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Mail size={12} /> {lang === "en" ? "Email to Inquire Sponsorship" : "Tuma Barua Pepe ya Udhamini"}
              </a>
            </div>
          </div>
        )}
      </Modal>

      {/* Project Support Modal */}
      <Modal
        isOpen={!!selectedSupportProject}
        onClose={() => setSelectedSupportProject(null)}
        title={
          <span className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
            <Heart size={14} className="text-emerald-600 fill-emerald-600" /> {lang === "en" ? "Support Production" : "Changia Uzalishaji"}
          </span>
        }
        maxWidth="max-w-sm"
      >
        {selectedSupportProject && (
          <div className="space-y-3 font-sans">
            <span className="text-[10px] font-black text-[#E31E24] uppercase tracking-wider block">
              {selectedSupportProject.title[lang]}
            </span>
            
            <p className="text-xs text-gray-600 font-medium">
              {lang === "en" 
                ? "Your m-pesa support goes directly to production materials, cast stipends, and logistics in Kiambiu slum."
                : "Mchango wako wa m-pesa unaenda moja kwa moja kwenye vifaa vya uzalishaji, posho za wasanii, na usafiri."}
            </p>

            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2 text-center">
              <div className="flex justify-between items-center text-[9px] font-bold text-emerald-800">
                <span>LIPA NA M-PESA</span>
                <span>BUY GOODS TILL</span>
              </div>
              <div className="font-mono text-xl font-black text-emerald-600 tracking-wider">
                {selectedSupportProject.supportTillNumber}
              </div>
              {selectedSupportProject.supportInstructions && selectedSupportProject.supportInstructions[lang] ? (
                <p className="text-[10px] text-emerald-700 font-semibold leading-relaxed">
                  {selectedSupportProject.supportInstructions[lang]}
                </p>
              ) : (
                <p className="text-[10px] text-emerald-700 font-semibold leading-relaxed">
                  {lang === "en" ? "Enter the Till Number under Lipa na M-Pesa to support this creative output." : "Weka nambari hii ya Till ili kusaidia sanaa yetu."}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 9. MODAL: THEATRE AS A SERVICE (TaaS) BOOKING FORM */}
      <Modal
        isOpen={showTaasModal}
        onClose={() => {
          setShowTaasModal(false);
          setTaasBookingSuccessRef(null);
        }}
        title={
          <div>
            <span className="text-[9px] font-bold tracking-widest text-[#E31E24] uppercase font-mono block">
              CBO REVENUE & COMMUNITY ENGAGEMENT
            </span>
            <h3 className="text-lg font-black text-neutral-900 font-sans mt-0.5">
              {lang === "en" ? "Theatre as a Service (TaaS) Booking Portal" : "Fomu ya Maombi ya TaaS"}
            </h3>
          </div>
        }
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6 relative max-h-[80vh] overflow-y-auto text-left font-sans">

            {taasBookingSuccessRef ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <ShieldCheck size={32} />
                </div>
                <h4 className="text-xl font-black text-neutral-900">
                  {lang === "en" ? "TaaS Booking Inquiry Sent!" : "Ombi la TaaS Limepatikana!"}
                </h4>
                <p className="text-xs text-neutral-600 max-w-md mx-auto leading-relaxed font-medium">
                  {lang === "en"
                    ? "Thank you for reaching out to Bashosho Talents CBO. Your booking request has been registered in our Grants & Partnerships board under Inquiries with an automated budget calculation."
                    : "Asante kwa kuwasiliana na Bashosho Talents CBO. Ombi lako limesajiliwa katika bodi yetu ya Ufadhili na Washirika."}
                </p>
                <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl max-w-xs mx-auto">
                  <span className="text-[10px] text-neutral-400 uppercase font-mono font-bold block">Inquiry Tracking Ref</span>
                  <span className="text-lg font-mono font-black text-emerald-700">{taasBookingSuccessRef}</span>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setShowTaasModal(false);
                      setTaasBookingSuccessRef(null);
                    }}
                    className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-6 py-2.5 rounded-xl cursor-pointer"
                  >
                    {lang === "en" ? "Close Portal" : "Funga Portal"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleTaasSubmit} className="space-y-4 text-xs font-sans">
                {/* Client Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {lang === "en" ? "Organization / Company Name" : "Jina la Shirika / Kampuni"} *
                    </label>
                    <input
                      type="text"
                      required
                      value={taasOrgName}
                      onChange={(e) => setTaasOrgName(e.target.value)}
                      placeholder="e.g. USAID Kenya, Safaricom Foundation, St. Teresa's"
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {lang === "en" ? "Client Category" : "Aina ya Mteja"}
                    </label>
                    <select
                      value={taasCategory}
                      onChange={(e: any) => setTaasCategory(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="ngo">NGO / International Agency</option>
                      <option value="corporate">Corporate / Private Sponsor</option>
                      <option value="school">School / University Institution</option>
                      <option value="government">Government Department</option>
                      <option value="community">Community Based Group</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {lang === "en" ? "Contact Person Name" : "Jina la Mtu wa Mawasiliano"} *
                    </label>
                    <input
                      type="text"
                      required
                      value={taasContactName}
                      onChange={(e) => setTaasContactName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {lang === "en" ? "Phone Number (M-Pesa / Calls)" : "Nambari ya Simu"} *
                    </label>
                    <input
                      type="tel"
                      required
                      value={taasPhone}
                      onChange={(e) => setTaasPhone(e.target.value)}
                      placeholder="+254 712 345678"
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs font-bold font-mono text-neutral-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>

                {/* Campaign Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-neutral-100">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {lang === "en" ? "Performance Package" : "Kifurushi cha Maonyesho"}
                    </label>
                    <select
                      value={taasPackage}
                      onChange={(e: any) => setTaasPackage(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="standard_forum">Forum Theatre Session (1 Day) - Ksh 35,000 Base</option>
                      <option value="roadshow_campaign">Community Roadshow Campaign (1 Day) - Ksh 65,000 Base</option>
                      <option value="custom_tour">Custom Multi-Day Scripted Tour - Ksh 120,000 Base</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {lang === "en" ? "Social / Advocacy Theme" : "Mada Kuu ya Uelimishaji"}
                    </label>
                    <input
                      type="text"
                      value={taasTheme}
                      onChange={(e) => setTaasTheme(e.target.value)}
                      placeholder="e.g. SGBV Awareness, Mental Health, Substance Abuse"
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {lang === "en" ? "Target Performance Date" : "Tarehe ya Onyesho"}
                    </label>
                    <input
                      type="date"
                      value={taasDate}
                      onChange={(e) => setTaasDate(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs font-bold font-mono text-neutral-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase">
                      {lang === "en" ? "Target Venue / Location" : "Mahali pa Onyesho"}
                    </label>
                    <input
                      type="text"
                      value={taasVenue}
                      onChange={(e) => setTaasVenue(e.target.value)}
                      placeholder="e.g. Kiambiu Field, Kamukunji Community Center"
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>

                {/* Technical Addons & Estimator */}
                <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider font-mono flex items-center gap-1">
                      <Sparkles size={12} /> DYNAMIC BUDGET CALCULATOR
                    </span>
                    <span className="text-base font-mono font-black text-red-600">
                      Ksh {calculateTaasBudget().toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-neutral-700">
                      <input
                        type="checkbox"
                        checked={taasAddonSound}
                        onChange={(e) => setTaasAddonSound(e.target.checked)}
                        className="rounded border-neutral-300 text-red-600 focus:ring-red-500"
                      />
                      <span>PA Sound System Rig (+Ksh 15,000)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-neutral-700">
                      <input
                        type="checkbox"
                        checked={taasAddonVideo}
                        onChange={(e) => setTaasAddonVideo(e.target.checked)}
                        className="rounded border-neutral-300 text-red-600 focus:ring-red-500"
                      />
                      <span>Video & Photo Coverage (+Ksh 20,000)</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowTaasModal(false)}
                    className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl cursor-pointer"
                  >
                    {lang === "en" ? "Cancel" : "Ghairi"}
                  </button>
                  <button
                    type="submit"
                    disabled={taasSubmitting}
                    className="bg-[#E31E24] hover:bg-red-700 disabled:bg-neutral-300 text-white text-xs font-bold px-6 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 shadow-xs"
                  >
                    {taasSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        {lang === "en" ? "Routing Inquiry..." : "Inatuma..."}
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        {lang === "en" ? "Submit TaaS Inquiry to Grants Board" : "Tuma Ombi la TaaS"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
        </div>
      </Modal>

      {/* EQUIPMENT HIRE INQUIRY MODAL */}
      <Modal
        isOpen={!!selectedHireAsset}
        onClose={() => {
          setSelectedHireAsset(null);
          setHireSuccessInfo(null);
        }}
        title={
          selectedHireAsset ? (
            <div>
              <div className="flex items-center gap-2 text-red-500 font-mono text-[10px] font-bold uppercase tracking-wider mb-0.5">
                <Camera size={14} /> EQUIPMENT RENTAL INQUIRY
              </div>
              <h3 className="text-base font-black text-gray-900">{selectedHireAsset.name}</h3>
              <p className="text-xs text-neutral-500 font-mono">
                Daily Rate: <span className="text-emerald-600 font-bold">Ksh {Number(selectedHireAsset.dailyRate || 1500).toLocaleString()} / day</span>
              </p>
            </div>
          ) : ""
        }
        maxWidth="max-w-lg"
      >
        {selectedHireAsset && (
          <div className="space-y-6 text-left font-sans">
            {hireSuccessInfo ? (
              <div className="space-y-5 text-center py-2">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={32} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-gray-900">Equipment Reserved Successfully!</h4>
                  <p className="text-xs text-gray-600 max-w-sm mx-auto">
                    {hireSuccessInfo.message}
                  </p>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 text-left">
                  <div className="flex justify-between text-xs font-bold text-gray-700 border-b border-emerald-200 pb-2">
                    <span>Rental Ref ID:</span>
                    <span className="font-mono text-emerald-800">{hireSuccessInfo.rentalId}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-gray-700 border-b border-emerald-200 pb-2">
                    <span>Official Invoice:</span>
                    <span className="font-mono text-emerald-800">{hireSuccessInfo.invoiceId}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-gray-700 border-b border-emerald-200 pb-2">
                    <span>Total Rental Amount:</span>
                    <span className="font-mono text-emerald-900 text-sm font-black">Ksh {Number(hireSuccessInfo.totalAmount).toLocaleString()}</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-black text-emerald-900 uppercase block tracking-wider">Payment Instructions (Lipa na M-PESA)</span>
                    <div className="bg-white p-3 rounded-xl border border-emerald-200 text-center space-y-1">
                      <span className="text-[10px] text-gray-500 block uppercase font-bold">Buy Goods Till Number</span>
                      <span className="text-emerald-600 text-2xl font-mono font-black tracking-widest block">8671238</span>
                    </div>
                    <p className="text-[10px] text-emerald-800 font-medium">
                      Our equipment custodian will contact you on <span className="font-bold">{hireClientPhone}</span> to arrange pickup at Bashosho Talents Studio.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedHireAsset(null);
                    setHireSuccessInfo(null);
                  }}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-extrabold uppercase tracking-wider py-3 rounded-xl transition-all cursor-pointer"
                >
                  Close & Return to Homepage
                </button>
              </div>
            ) : (
              <form onSubmit={handleHireSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-700 uppercase">Your Name / Organization *</label>
                    <input
                      type="text"
                      required
                      value={hireClientName}
                      onChange={(e) => setHireClientName(e.target.value)}
                      placeholder="e.g. John Kamau / Bashosho Media"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-500 font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-700 uppercase">M-PESA Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={hireClientPhone}
                      onChange={(e) => setHireClientPhone(e.target.value)}
                      placeholder="07XX XXX XXX"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-500 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-700 uppercase">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={hireClientEmail}
                    onChange={(e) => setHireClientEmail(e.target.value)}
                    placeholder="e.g. client@example.com"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-700 uppercase">Pickup Date *</label>
                    <input
                      type="date"
                      required
                      value={hireStartDate}
                      onChange={(e) => setHireStartDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-500 font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-700 uppercase">Return Date *</label>
                    <input
                      type="date"
                      required
                      value={hireEndDate}
                      onChange={(e) => setHireEndDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-500 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-700 uppercase">Purpose / Production Description</label>
                  <textarea
                    rows={2}
                    value={hirePurpose}
                    onChange={(e) => setHirePurpose(e.target.value)}
                    placeholder="e.g. 2-day music video shoot in Kiambiu"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-500 font-medium"
                  />
                </div>

                {/* Calculated Fee Summary Box */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                    <span>Duration:</span>
                    <span className="font-mono text-gray-900">{calculateHireDays()} Day{calculateHireDays() > 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                    <span>Daily Rate:</span>
                    <span className="font-mono text-gray-900">Ksh {Number(selectedHireAsset.dailyRate || 1500).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-black text-gray-900 pt-2 border-t border-gray-200">
                    <span>Estimated Total Fee:</span>
                    <span className="font-mono text-emerald-700 text-base">
                      Ksh {(Number(selectedHireAsset.dailyRate || 1500) * calculateHireDays()).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 italic pt-1">
                    Payable via Lipa na M-PESA Till 8671238 upon pickup confirmation.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={hireSubmitting}
                  className="w-full bg-[#E31E24] hover:bg-red-700 disabled:bg-gray-300 text-white text-xs font-extrabold uppercase tracking-wider py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  {hireSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing Request...
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Submit Equipment Rental Request
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </Modal>
      {/* MUST FIX 3 — Program Inquiry & Partnership Modal */}
      <Modal
        isOpen={programInquiry.open && !!programInquiry.program}
        onClose={() => setProgramInquiry((prev) => ({ ...prev, open: false }))}
        title={
          programInquiry.program ? (
            <div>
              <div className="font-extrabold text-sm uppercase tracking-wider">
                {programInquiry.type === "partner" ? (lang === "en" ? "Partner With Us" : "Shirikiana Nasi") :
                 programInquiry.type === "book_session" ? (lang === "en" ? "Book a Session" : "Omba Kipindi") :
                 programInquiry.type === "film_apply" ? (lang === "en" ? "Apply to Film Academy" : "Omba Mafunzo ya Filamu") :
                 (lang === "en" ? "Book a Performance" : "Omba Maonyesho ya Jukwaani")}
              </div>
              <p className="text-[10px] text-neutral-400 font-mono font-normal">
                {programInquiry.program.title[lang]}
              </p>
            </div>
          ) : ""
        }
        maxWidth="max-w-lg"
      >
        {programInquiry.successRef ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={28} />
                </div>
                <h4 className="text-base font-bold text-gray-900">
                  {lang === "en" ? "Inquiry Submitted Successfully!" : "Ombi Lako Limekatika kwa Mafanikio!"}
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {lang === "en" ? (
                    <>
                      Thank you <strong className="text-gray-900">{programInquiry.name}</strong>. Your inquiry reference is{" "}
                      <strong className="font-mono text-[#E31E24] bg-red-50 px-2 py-0.5 rounded">{programInquiry.successRef}</strong>. Our team will review your request and reach out on <strong className="text-gray-900">{programInquiry.phone}</strong> shortly.
                    </>
                  ) : (
                    <>
                      Asante <strong className="text-gray-900">{programInquiry.name}</strong>. Nambari ya ombi lako ni{" "}
                      <strong className="font-mono text-[#E31E24] bg-red-50 px-2 py-0.5 rounded">{programInquiry.successRef}</strong>. Timu yetu itawasiliana nawe kupitia <strong className="text-gray-900">{programInquiry.phone}</strong>.
                    </>
                  )}
                </p>
                <button
                  onClick={() => setProgramInquiry((prev) => ({ ...prev, open: false }))}
                  className="bg-neutral-900 text-white text-xs font-bold px-6 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {lang === "en" ? "Close" : "Funga"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleProgramInquirySubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700">
                    {lang === "en" ? "Full Name *" : "Jina Kamili *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={programInquiry.name}
                    onChange={(e) => setProgramInquiry((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Jane Wanjiru"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700">
                      {lang === "en" ? "Phone / WhatsApp *" : "Simu / WhatsApp *"}
                    </label>
                    <input
                      type="tel"
                      required
                      value={programInquiry.phone}
                      onChange={(e) => setProgramInquiry((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="0712345678"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700">
                      {lang === "en" ? "Email Address" : "Barua Pepe"}
                    </label>
                    <input
                      type="email"
                      value={programInquiry.email}
                      onChange={(e) => setProgramInquiry((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="jane@example.com"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700">
                    {lang === "en" ? "Organization / School / Community Group" : "Shirika / Shule / Kundi la Jamii"}
                  </label>
                  <input
                    type="text"
                    value={programInquiry.organization}
                    onChange={(e) => setProgramInquiry((prev) => ({ ...prev, organization: e.target.value }))}
                    placeholder="e.g. Kiambiu Youth Initiative / Self"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700">
                    {lang === "en" ? "Request / Project Details" : "Maelezo ya Ombi / Mradi"}
                  </label>
                  <textarea
                    rows={3}
                    value={programInquiry.details}
                    onChange={(e) => setProgramInquiry((prev) => ({ ...prev, details: e.target.value }))}
                    placeholder={
                      programInquiry.type === "film_apply"
                        ? "Tell us briefly about your interest in filmmaking and experience level..."
                        : "Describe what you would like to achieve or collaborate on..."
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setProgramInquiry((prev) => ({ ...prev, open: false }))}
                    className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    {lang === "en" ? "Cancel" : "Ghairi"}
                  </button>
                  <button
                    type="submit"
                    disabled={programInquiry.submitting}
                    className="bg-[#E31E24] hover:bg-red-700 text-white text-xs font-bold px-6 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
                  >
                    {programInquiry.submitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {lang === "en" ? "Submitting..." : "Inatuma..."}
                      </>
                    ) : (
                      lang === "en" ? "Send Inquiry" : "Tuma Ombi"
                    )}
                  </button>
                </div>
              </form>
            )}
      </Modal>

      {/* Safeguarding Report Modal */}
      <Modal
        isOpen={showSafeguardingModal}
        onClose={() => setShowSafeguardingModal(false)}
        title={
          <div>
            <div className="font-extrabold text-sm uppercase tracking-wider text-red-600 flex items-center gap-2">
              <ShieldAlert size={18} />
              {lang === "en" ? "Confidential Safeguarding Report" : "Taarifa ya Siri ya Ulinzi"}
            </div>
            <p className="text-[10px] text-red-400 font-mono font-normal">
              GBV / Child Safeguarding / Mental Health Support
            </p>
          </div>
        }
        maxWidth="max-w-lg"
      >
        <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const description = (form.elements.namedItem("reportDesc") as HTMLTextAreaElement).value;
                const reporterName = (form.elements.namedItem("reporterName") as HTMLInputElement).value;
                const reporterContact = (form.elements.namedItem("reporterContact") as HTMLInputElement).value;

                try {
                  const res = await fetch("/api/public/safeguarding-report", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ description, reporterName, reporterContact })
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Failed to submit report");
                  }
                  alert(lang === "en" ? "Your report has been submitted confidentially to the Safeguarding Focal Point." : "Taarifa yako imewasilishwa kwa siri kwa Msimamizi wa Ulinzi.");
                  setShowSafeguardingModal(false);
                } catch (err: any) {
                  // A safety-critical report must never claim success when it actually
                  // failed — show a real error with a phone-fallback instead.
                  alert(
                    lang === "en"
                      ? `Your report could not be submitted online (${err.message || "connection error"}). Please call or WhatsApp our Safeguarding Focal Point directly instead — your safety matters and we don't want this to go unheard.`
                      : `Taarifa yako haijawasilishwa mtandaoni (${err.message || "hitilafu ya muunganisho"}). Tafadhali piga simu au tuma WhatsApp kwa Msimamizi wetu wa Ulinzi moja kwa moja — usalama wako ni muhimu.`
                  );
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-red-600" />
                  {lang === "en" ? "100% Confidential & Secure" : "100% Ya Siri na Usalama"}
                </p>
                <p className="text-[11px] text-red-800">
                  {lang === "en"
                    ? "You can report anonymously or provide contact details if you would like follow-up or counselling assistance."
                    : "Unaweza kuripoti bila kuweka jina au kuweka nambari yako ukipenda msaada wa ushauri nasaha."}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700">
                  {lang === "en" ? "Report Details / Incident Description *" : "Maelezo ya Incident au Tatizo *"}
                </label>
                <textarea
                  name="reportDesc"
                  required
                  rows={4}
                  placeholder={lang === "en" ? "Describe the concern, GBV case, or safeguarding issue safely here..." : "Mweze Msimamizi maelezo ya suala la ulinzi au GBV hapa..."}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700">
                    {lang === "en" ? "Your Name (Optional)" : "Jina Lako (Sio Lazima)"}
                  </label>
                  <input
                    type="text"
                    name="reporterName"
                    placeholder={lang === "en" ? "Leave blank to stay anonymous" : "Acha wazi usipopenda kujulikana"}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700">
                    {lang === "en" ? "Phone / Contact (Optional)" : "Simu / Mawasiliano (Sio Lazima)"}
                  </label>
                  <input
                    type="text"
                    name="reporterContact"
                    placeholder="0712345678"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSafeguardingModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-bold rounded-xl cursor-pointer"
                >
                  {lang === "en" ? "Cancel" : "Ghairi"}
                </button>
                <button
                  type="submit"
                  className="bg-red-950 hover:bg-black text-white text-xs font-bold px-6 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <ShieldAlert size={14} className="text-red-400" />
                  {lang === "en" ? "Submit Confidential Report" : "Wasilisha Taarifa Ya Siri"}
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
}

// SUB-COMPONENT: REAL SIGNUP FORM MODAL
interface SignupFormModalProps {
  type: "member" | "volunteer";
  lang: "en" | "sw";
  onClose: () => void;
}

function SignupFormModal({ type, lang, onClose }: SignupFormModalProps) {
  const [formData, setFormData] = React.useState({
    fullName: "",
    phone: "",
    email: "",
    dateOfBirth: "",
    location: "",
    whyJoin: "",
    skills: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: ""
  });

  const [passportBase64, setPassportBase64] = React.useState<string>("");
  const [idBase64, setIdBase64] = React.useState<string>("");
  const [agreedHandbook, setAgreedHandbook] = React.useState<boolean>(false);
  const [dobError, setDobError] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Real-time client DOB check
    if (name === "dateOfBirth") {
      const dob = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }

      if (age < 18) {
        setDobError(
          lang === "en"
            ? "Signups are for ages 18 and older. If you'd like to register a young person under 18, please visit us directly or contact our team — we handle youth registrations personally to make sure the right safeguards are in place."
            : "Sajili ni kwa ajili ya watu wenye umri wa miaka 18 na zaidi. Ikiwa ungependa kusajili kijana aliye chini ya miaka 18, tafadhali tutebelee moja kwa moja au wasiliana na timu yetu — tunashughulikia usajili wa vijana kibinafsi ili kuhakikisha ulinzi unaofaa upo."
        );
      } else {
        setDobError(null);
      }
    }
  };

  // Base64 helper with WebP conversion
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: "passport" | "id") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert(lang === "en" ? "Image must be 10MB or smaller." : "Picha lazima iwe ndogo kuliko 10MB.");
      return;
    }

    try {
      const webpData = await convertToWebP(file, 1000, 1000, 0.82);
      if (target === "passport") {
        setPassportBase64(webpData);
      } else {
        setIdBase64(webpData);
      }
    } catch (err) {
      console.error("Failed to convert image to WebP", err);
      // Fallback to FileReader
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === "passport") {
          setPassportBase64(reader.result as string);
        } else {
          setIdBase64(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    // Validate under-18 DOB blocker
    if (formData.dateOfBirth) {
      const dob = new Date(formData.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age < 18) {
        setApiError(
          lang === "en"
            ? "Signups are for ages 18 and older. If you'd like to register a young person under 18, please visit us directly or contact our team — we handle youth registrations personally to make sure the right safeguards are in place."
            : "Sajili ni kwa ajili ya watu wenye umri wa miaka 18 na zaidi. Ikiwa ungependa kusajili kijana aliye chini ya miaka 18, tafadhali tutebelee moja kwa moja au wasiliana na timu yetu — tunashughulikia usajili wa vijana kibinafsi ili kuhakikisha ulinzi unaofaa upo."
        );
        return;
      }
    }

    if (!agreedHandbook) {
      setApiError(
        lang === "en"
          ? "You must acknowledge and agree to comply with the CBO Member & Volunteer Handbook (v1.2) to proceed."
          : "Lazima ukubali kutii Mwongozo wa Wanachama na Wafanyakazi Wajitoleaji (v1.2) ili kuendelea."
      );
      return;
    }

    if (!passportBase64 || !idBase64) {
      setApiError(
        lang === "en"
          ? "Please upload both your passport photo and ID document photo."
          : "Tafadhali pakia picha yako ya pasipoti na picha ya kitambulisho cha Taifa."
      );
      return;
    }

    setSubmitting(true);

    try {
      // Get reCAPTCHA v3 token if configured
      let recaptchaToken = "";
      const siteKey = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY || (import.meta as any).env?.RECAPTCHA_SITE_KEY;
      if (siteKey && siteKey !== "MY_RECAPTCHA_SITE_KEY" && (window as any).grecaptcha) {
        try {
          recaptchaToken = await new Promise<string>((resolve, reject) => {
            (window as any).grecaptcha.ready(async () => {
              try {
                const token = await (window as any).grecaptcha.execute(siteKey, { action: "signup" });
                resolve(token);
              } catch (err) {
                reject(err);
              }
            });
          });
        } catch (err) {
          console.error("reCAPTCHA execution failed:", err);
        }
      }

      const res = await fetch("/api/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          fullName: formData.fullName,
          phone: formData.phone,
          email: formData.email || undefined,
          dateOfBirth: formData.dateOfBirth,
          location: formData.location,
          whyJoin: formData.whyJoin,
          skills: formData.skills,
          emergencyContactName: formData.emergencyContactName,
          emergencyContactPhone: formData.emergencyContactPhone,
          emergencyContactRelationship: formData.emergencyContactRelationship,
          passportPhoto: passportBase64,
          idDocument: idBase64,
          recaptchaToken: recaptchaToken || undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        // Humanized duplicate check or under-18 redirects
        if (data.error && data.error.includes("under 18")) {
          setApiError(
            lang === "en"
              ? "Signups are for ages 18 and older. If you'd like to register a young person under 18, please visit us directly or contact our team — we handle youth registrations personally to make sure the right safeguards are in place."
              : "Sajili ni kwa ajili ya watu wenye umri wa miaka 18 na zaidi. Ikiwa ungependa kusajili kijana aliye chini ya miaka 18, tafadhali tutebelee moja kwa moja au wasiliana na timu yetu — tunashughulikia usajili wa vijana kibinafsi ili kuhakikisha ulinzi unaofaa upo."
          );
        } else {
          setApiError(data.error || "An unexpected registration error occurred. Please try again.");
        }
      }
    } catch (err: any) {
      console.error("Submission failed:", err);
      setApiError(lang === "en" ? "Could not connect to the server." : "Mawasiliano na seva yamefeli.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <div>
          <span className="text-[9px] font-black tracking-widest uppercase text-red-500 block">
            {type === "member" ? "PROGRAM APPLICATION" : "VOLUNTEER SIGNUP"}
          </span>
          <span className="text-base font-bold font-sans">
            {type === "member"
              ? (lang === "en" ? "Become a Program Member" : "Sajili kama Mwanachama wa Sanaa")
              : (lang === "en" ? "Become a Volunteer Staff" : "Sajili kama Mfanyakazi Mjitoleaji")}
          </span>
        </div>
      }
      maxWidth="max-w-xl"
    >
      {success ? (
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle size={32} />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-bold text-gray-900">
                {lang === "en" ? "Application Submitted Successfully!" : "Ombi Lako Imepokewa!"}
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                {lang === "en"
                  ? "Thank you — your application is being reviewed. We will evaluate your profile and contact you on phone or email regarding approval and PIN details. We'll be in touch!"
                  : "Asante sana — ombi lako linakaguliwa sasa. Tutatathmini maelezo yako na kukupigia au kukutumia barua pepe upate PIN yako punde itakapoidhinishwa. Tutaongea hivi karibuni!"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="bg-neutral-950 text-white text-xs font-bold px-6 py-2.5 rounded-xl cursor-pointer"
            >
              {lang === "en" ? "Close & Return" : "Funga na Rudi"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
            {apiError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl leading-relaxed flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-red-600 shrink-0" /> {apiError}
              </div>
            )}

            {/* DOB warning displayed conditionally */}
            {dobError && (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-xl leading-relaxed flex items-start gap-1.5">
                <Info size={14} className="text-amber-800 shrink-0 mt-0.5" /> <span>{dobError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-600 uppercase">
                  {lang === "en" ? "Full Name (Required)" : "Majina Kamili (Lazima)"}
                </label>
                <input
                  type="text"
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="e.g. John Doe"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-600 uppercase">
                  {lang === "en" ? "Phone Number (Required)" : "Nambari ya Simu (Lazima)"}
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="e.g. +254 712 345678"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-600 uppercase">
                  {lang === "en" ? "Email Address (Optional)" : "Barua Pepe (Siyo Lazima)"}
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="e.g. name@example.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                />
              </div>

              {/* Date of Birth */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-600 uppercase">
                  {lang === "en" ? "Date of Birth (Required)" : "Tarehe ya Kuzaliwa (Lazima)"}
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  required
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-600 uppercase">
                  {lang === "en" ? "Location/Estate in Kiambiu" : "Eneo/Mtaa Unaoshi Kiambiu"}
                </label>
                <input
                  type="text"
                  name="location"
                  required
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g. Kamukunji, Social Center, etc."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                />
              </div>

              {/* Skills / Interests */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-600 uppercase">
                  {lang === "en" ? "Skills / Artistic Interests" : "Ujuzi au Vipaji vya Sanaa"}
                </label>
                <input
                  type="text"
                  name="skills"
                  required
                  value={formData.skills}
                  onChange={handleInputChange}
                  placeholder="e.g. Acting, Video Editing, Stage Setup"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                />
              </div>
            </div>

            {/* Why Join */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-600 uppercase">
                {lang === "en" ? "Why do you want to join Bashosho Talents? (Briefly)" : "Mbona unataka kujiunga na Bashosho Talents?"}
              </label>
              <textarea
                name="whyJoin"
                required
                rows={3}
                value={formData.whyJoin}
                onChange={handleInputChange}
                placeholder={lang === "en" ? "State your motivation or story..." : "Eleza sababu zako..."}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
              ></textarea>
            </div>

            {/* Emergency Contacts Block */}
            <div className="bg-gray-50 p-4 border rounded-2xl space-y-3">
              <h4 className="text-[10px] font-black text-gray-800 uppercase tracking-widest flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-red-600" /> {lang === "en" ? "Emergency Contact Details" : "Mwasiliani wa Dharura"}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">{lang === "en" ? "Full Name" : "Jina Kamili"}</label>
                  <input
                    type="text"
                    name="emergencyContactName"
                    required
                    value={formData.emergencyContactName}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">{lang === "en" ? "Phone Number" : "Simu yake"}</label>
                  <input
                    type="tel"
                    name="emergencyContactPhone"
                    required
                    value={formData.emergencyContactPhone}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">{lang === "en" ? "Relationship" : "Uhusiano"}</label>
                  <input
                    type="text"
                    name="emergencyContactRelationship"
                    required
                    value={formData.emergencyContactRelationship}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Photo & ID Document Upload Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Passport photo */}
              <div className="border border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2 bg-gray-50/50">
                <User size={24} className="text-gray-400" />
                <span className="text-[10px] font-bold text-gray-600 uppercase">
                  {lang === "en" ? "Passport Photo" : "Picha ya Pasipoti"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "passport")}
                  className="hidden"
                  id="passport-photo-upload-input"
                />
                <label
                  htmlFor="passport-photo-upload-input"
                  className="bg-white border text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 shadow-2xs"
                >
                  {lang === "en" ? "Choose Image" : "Chagua Picha"}
                </label>
                {passportBase64 ? (
                  <div className="relative w-16 h-16 border rounded overflow-hidden">
                    <img src={passportBase64} alt="Passport preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <span className="text-[9px] text-gray-400 font-medium">5MB Max. JPG/PNG.</span>
                )}
              </div>

              {/* ID Document Photo */}
              <div className="border border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2 bg-gray-50/50">
                <IdCard size={24} className="text-gray-400" />
                <span className="text-[10px] font-bold text-gray-600 uppercase">
                  {lang === "en" ? "National ID Photo" : "Kitambulisho cha Taifa"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "id")}
                  className="hidden"
                  id="id-document-upload-input"
                />
                <label
                  htmlFor="id-document-upload-input"
                  className="bg-white border text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 shadow-2xs"
                >
                  {lang === "en" ? "Choose Image" : "Chagua Picha"}
                </label>
                {idBase64 ? (
                  <div className="relative w-16 h-16 border rounded overflow-hidden">
                    <img src={idBase64} alt="ID Document preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <span className="text-[9px] text-gray-400 font-medium">5MB Max. JPG/PNG.</span>
                )}
              </div>
            </div>

            {/* Handbook Agreement Checkbox */}
            <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  required
                  checked={agreedHandbook}
                  onChange={(e) => setAgreedHandbook(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-[#E31E24] focus:ring-red-500 shrink-0"
                />
                <span className="text-gray-700 text-[11px] font-medium leading-tight">
                  {lang === "en" ? (
                    <>
                      I confirm that I have read and agree to strictly comply with the{" "}
                      <strong className="text-gray-900 font-extrabold">Bashosho Talents CBO Member & Volunteer Handbook (v1.2)</strong>, including our code of conduct, anti-harassment policy, and community guidelines.
                    </>
                  ) : (
                    <>
                      Nathibitisha kuwa nimesoma na ninakubali kutii kwa ukamilifu{" "}
                      <strong className="text-gray-900 font-extrabold">Mwongozo wa Wanachama na Wafanyakazi Wajitoleaji (v1.2)</strong>, ikiwa ni pamoja na kanuni zetu za nidhamu na maadili.
                    </>
                  )}
                </span>
              </label>
            </div>

            {/* Disclaimer and Submit Button */}
            <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <p className="text-[9px] text-gray-400 leading-normal max-w-xs font-mono">
                {lang === "en"
                  ? "By submitting, you certify that all information is correct and verify your compliance with our code of conduct."
                  : "Kwa kuwasilisha, unathibitisha kwamba taarifa zote ni za kweli na unatii kanuni za maadili za CBO."}
              </p>

              <button
                type="submit"
                disabled={submitting || !!dobError || !agreedHandbook}
                id="homepage-submit-application-btn"
                className={`bg-[#E31E24] hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold px-6 py-3 rounded-xl cursor-pointer shadow-sm transition-colors flex items-center gap-2`}
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {lang === "en" ? "Submitting..." : "Inatuma..."}
                  </>
                ) : (
                  lang === "en" ? "Submit Application" : "Wasilisha Ombi Lako"
                )}
              </button>
            </div>
          </form>
        )}
    </Modal>
  );
}
