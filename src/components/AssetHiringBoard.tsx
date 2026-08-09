import React from "react";
import { Modal } from "./Modal";
import { Asset, UserProfile, UserRole, Income, Invoice, getUserRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import { 
  Package, 
  Calendar, 
  DollarSign, 
  Plus, 
  Search, 
  Sliders, 
  CheckCircle, 
  Clock, 
  Coins, 
  Phone, 
  User, 
  ChevronRight,
  Sparkles,
  Info,
  Printer,
  FileText,
  Download,
  ShieldCheck
} from "lucide-react";

interface AssetHiringBoardProps {
  currentUser: UserProfile;
  lang: "en" | "sw";
  assets: Asset[];
  onRefresh: () => void;
  onTriggerPrint: (title: string, content: React.ReactNode, verificationUrl?: string) => void;
}

export default function AssetHiringBoard({
  currentUser,
  lang,
  assets,
  onRefresh,
  onTriggerPrint
}: AssetHiringBoardProps) {
  const [subTab, setSubTab] = React.useState<"inventory" | "rentals">("inventory");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [editingAssetId, setEditingAssetId] = React.useState<string | null>(null);
  const [editHireRate, setEditHireRate] = React.useState<number>(0);
  const [editAvailable, setEditAvailable] = React.useState<boolean>(false);

  // New Rental form states
  const [showRentalModal, setShowRentalModal] = React.useState(false);
  const [selectedAssetId, setSelectedAssetId] = React.useState("");
  const [clientName, setClientName] = React.useState("");
  const [clientPhone, setClientPhone] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [customRate, setCustomRate] = React.useState("");
  const [paymentStatus, setPaymentStatus] = React.useState<"paid" | "unpaid">("unpaid");

  // AI draft description states for rentals
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [aiNotes, setAiNotes] = React.useState("");
  const [agreementDraft, setAgreementDraft] = React.useState("");

  const isAuthorized = [UserRole.CHAIRPERSON, UserRole.TREASURER, UserRole.VICE_CHAIRPERSON].includes(getUserRoleKey(currentUser) as UserRole);

  // Pre-fill fields when selecting asset in the hire form
  React.useEffect(() => {
    if (selectedAssetId) {
      const asset = assets.find(a => a.id === selectedAssetId);
      if (asset && asset.dailyRate) {
        setCustomRate(asset.dailyRate.toString());
      }
    }
  }, [selectedAssetId, assets]);

  // Aggregate stats
  const rentableAssets = assets.filter(a => a.availableForHire);
  
  // Calculate total rental income
  let totalRentalRevenue = 0;
  let activeRentalsCount = 0;
  let pendingHireKsh = 0;

  const allRentals: Array<{
    assetId: string;
    assetName: string;
    rentalId: string;
    clientName: string;
    clientPhone: string;
    startDate: string;
    endDate: string;
    totalAmount: number;
    paymentStatus: "paid" | "unpaid";
    status: "out" | "returned";
  }> = [];

  assets.forEach(asset => {
    if (asset.externalRentals) {
      asset.externalRentals.forEach(rent => {
        allRentals.push({
          assetId: asset.id,
          assetName: asset.name,
          rentalId: rent.id,
          ...rent
        });

        if (rent.paymentStatus === "paid") {
          totalRentalRevenue += rent.totalAmount;
        } else {
          pendingHireKsh += rent.totalAmount;
        }

        if (rent.status === "out") {
          activeRentalsCount += 1;
        }
      });
    }
  });

  // Sort rentals by start date descending
  allRentals.sort((a, b) => b.startDate.localeCompare(a.startDate));

  // Edit Asset Hire Settings Submission
  const handleSaveHireSettings = async (asset: Asset) => {
    try {
      const updatedAsset: Asset = {
        ...asset,
        availableForHire: editAvailable,
        dailyRate: editHireRate
      };

      await StorageService.saveRecord("assets", updatedAsset);
      setEditingAssetId(null);
      onRefresh();
    } catch (err) {
      console.error("Failed to save asset hire settings:", err);
    }
  };

  const handleStartEditing = (asset: Asset) => {
    setEditingAssetId(asset.id);
    setEditHireRate(asset.dailyRate || 1000);
    setEditAvailable(!!asset.availableForHire);
  };

  // AI draft of rental terms
  const handleGenerateAgreementDraft = async () => {
    if (!selectedAssetId || !clientName) {
      alert(lang === "en" ? "Please select an asset and client name first!" : "Tafadhali chagua vifaa na jina la mteja kwanza!");
      return;
    }
    setIsAiLoading(true);
    try {
      const selectedAsset = assets.find(a => a.id === selectedAssetId);
      const res = await fetch("/api/document_templates/generate_draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Draft a formal Equipment Lease Agreement terms. 
- Equipment: ${selectedAsset?.name} (Serial: ${selectedAsset?.serialNumber})
- Lessee (Client): ${clientName} (${clientPhone})
- Rent Period: ${startDate} to ${endDate}
- Daily Hire Rate: Ksh ${customRate}
- Payment Status: ${paymentStatus.toUpperCase()}
- Extra Custom Details: ${aiNotes || "None"}`,
          docType: "invoice_explanation",
          title: `Lease Agreement - ${clientName} - ${selectedAsset?.name}`
        })
      });

      const data = await res.json();
      if (res.ok && data.draft) {
        setAgreementDraft(data.draft);
      } else {
        throw new Error(data.error || "Failed to generate lease agreement terms.");
      }
    } catch (err: any) {
      console.error(err);
      setAgreementDraft(`EQUIPMENT LEASE MEMORANDUM\n\nLessor: BASHOSHO TALENTS CBO\nLessee: ${clientName}\nEquipment: ${assets.find(a => a.id === selectedAssetId)?.name}\nPeriod: ${startDate} to ${endDate}\n\nTerms of Engagement:\n1. The equipment is rented at Kshs ${customRate}/day.\n2. Payment status is marked as ${paymentStatus.toUpperCase()}.\n3. Standard care of CBO assets is expected. Damage triggers repair penalties.`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Record New Rental Submission
  const handleRecordRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !clientName || !clientPhone || !startDate || !endDate) return;

    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset) return;

    // Calculate days
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; // standard minimum 1 day

    const finalRate = Number(customRate) || asset.dailyRate || 1000;
    const finalAmount = diffDays * finalRate;

    const newRental = {
      id: `rent-${Date.now()}`,
      clientName,
      clientPhone,
      startDate,
      endDate,
      totalAmount: finalAmount,
      paymentStatus,
      status: "out" as const
    };

    const updatedAsset: Asset = {
      ...asset,
      externalRentals: [
        ...(asset.externalRentals || []),
        newRental
      ]
    };

    try {
      // 1. Save updated asset with rental record
      await StorageService.saveRecord("assets", updatedAsset);

      // 2. Automatically generate formal invoice in Invoicing & Billing module
      const invoiceNumber = `BT-INV-RENT-${Date.now().toString().slice(-5)}`;
      const newInvoice: Invoice = {
        id: `inv-rent-${Date.now()}`,
        invoiceNumber,
        partnerId: clientName,
        engagementDescription: `Equipment Hire Contract: ${asset.name} (${asset.category.toUpperCase()}) leased to ${clientName} (${diffDays} days @ Ksh ${finalRate}/day). Till Number: 8671238.`,
        amount: finalAmount,
        issueDate: startDate,
        dueDate: endDate,
        status: paymentStatus === "paid" ? "paid" : "sent"
      };
      await StorageService.saveRecord("invoices", newInvoice);

      // 3. If rental is Paid, automatically log as dynamic income in ledger
      if (paymentStatus === "paid") {
        const newIncome: Income = {
          id: `inc-rent-${Date.now()}`,
          source: "other",
          amount: finalAmount,
          date: startDate,
          description: `Equipment Rental Income: ${asset.name} leased to ${clientName} (${diffDays} days)`,
          recordedBy: currentUser.name
        };
        await StorageService.saveRecord("incomes", newIncome);
      }

      // Reset form
      setShowRentalModal(false);
      setSelectedAssetId("");
      setClientName("");
      setClientPhone("");
      setStartDate("");
      setEndDate("");
      setCustomRate("");
      setPaymentStatus("unpaid");
      setAiNotes("");
      setAgreementDraft("");
      
      onRefresh();
    } catch (err) {
      console.error("Failed to record rental engagement:", err);
    }
  };

  // Toggle status of existing rental contract
  const handleTogglePaymentStatus = async (rentalItem: typeof allRentals[0]) => {
    const asset = assets.find(a => a.id === rentalItem.assetId);
    if (!asset || !asset.externalRentals) return;

    const updatedRentals = asset.externalRentals.map(r => {
      if (r.id === rentalItem.rentalId) {
        const nextPayment = r.paymentStatus === "paid" ? "unpaid" as const : "paid" as const;
        return { ...r, paymentStatus: nextPayment };
      }
      return r;
    });

    const updatedAsset = { ...asset, externalRentals: updatedRentals };

    try {
      await StorageService.saveRecord("assets", updatedAsset);
      
      // If payment is toggled to Paid, automatically seed the finance entry
      const currentRent = asset.externalRentals.find(r => r.id === rentalItem.rentalId);
      if (currentRent && currentRent.paymentStatus === "unpaid") { // was unpaid, now paid
        const newIncome: Income = {
          id: `inc-rent-${Date.now()}`,
          source: "other",
          amount: rentalItem.totalAmount,
          date: new Date().toISOString().split("T")[0],
          description: `Paid Rental Contract Receipt: ${asset.name} - Hired to ${rentalItem.clientName}`,
          recordedBy: currentUser.name
        };
        await StorageService.saveRecord("incomes", newIncome);
      }

      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleReturnStatus = async (rentalItem: typeof allRentals[0]) => {
    const asset = assets.find(a => a.id === rentalItem.assetId);
    if (!asset || !asset.externalRentals) return;

    const updatedRentals = asset.externalRentals.map(r => {
      if (r.id === rentalItem.rentalId) {
        const nextStatus = r.status === "returned" ? "out" as const : "returned" as const;
        return { ...r, status: nextStatus };
      }
      return r;
    });

    const updatedAsset = { ...asset, externalRentals: updatedRentals };

    try {
      await StorageService.saveRecord("assets", updatedAsset);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 text-left" id="assets-hiring-component">
      {/* 1. Header Banner */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-emerald-600 font-mono text-[9px] font-bold tracking-widest uppercase bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
            {lang === "en" ? "Production & Gear Rentals" : "Usimamizi wa Vifaa na Ukodishaji"}
          </span>
          <h2 className="text-xl font-black text-neutral-900 mt-1.5 font-sans">
            {lang === "en" ? "CBO Asset Hub & Equipment Hiring" : "Kituo cha Vifaa na Ukodishaji rasilimali"}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed max-w-xl">
            {lang === "en"
              ? "Track official media cameras, props, and costumes. Activate equipment hire rates to rent out gear to external creators as a sustainable income stream."
              : "Fuatilia kamera rasmi za mradi, props na mavazi. Weka viwango vya ukodishaji vifaa kwa wabunifu wa nje ili kupata mapato endelevu ya kikundi."}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200">
          <button
            onClick={() => setSubTab("inventory")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === "inventory" 
                ? "bg-white text-neutral-900 shadow-xs" 
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {lang === "en" ? "Asset Inventory" : "Orodha ya Vifaa"}
          </button>
          <button
            onClick={() => setSubTab("rentals")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              subTab === "rentals" 
                ? "bg-white text-[#00A651] shadow-xs" 
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Coins size={12} />
            {lang === "en" ? "Gear Rental Tracker" : "Kumbukumbu za Ukodishaji"}
          </button>
        </div>
      </div>

      {/* 2. Rental Income KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs text-left">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{lang === "en" ? "Total Hire Income" : "Mapato Kamili ya Kukodi"}</p>
          <p className="text-2xl font-black text-[#00A651] mt-1 font-mono">Ksh {totalRentalRevenue.toLocaleString()}</p>
          <span className="text-[9px] text-neutral-400 font-medium block mt-1"> {lang === "en" ? "Successfully synchronized to financials" : "Kusawazishwa kikamilifu na mhasibu"}</span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs text-left">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{lang === "en" ? "Active External Hires" : "Vifaa vilivyokodishwa Sasa"}</p>
          <p className="text-2xl font-black text-amber-600 mt-1 font-mono">{activeRentalsCount}</p>
          <span className="text-[9px] text-neutral-400 font-medium block mt-1">{lang === "en" ? "Units currently in client possession" : "Vifaa vilivyo nje kwa wateja"}</span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs text-left">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{lang === "en" ? "Pending Rent Receipts" : "Mapato ya Kukodi Yanayofuatiliwa"}</p>
          <p className="text-2xl font-black text-red-500 mt-1 font-mono">Ksh {pendingHireKsh.toLocaleString()}</p>
          <span className="text-[9px] text-neutral-400 font-medium block mt-1"> {lang === "en" ? "Unpaid client balances" : "Mabaki yanayosubiriwa kutoka kwa wateja"}</span>
        </div>
      </div>

      {/* 3. SUB-TAB CONTENT */}
      {subTab === "inventory" ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white border rounded-xl px-4 py-3 gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === "en" ? "Search serials or assets..." : "Tafuta nambari au jina la vifaa..."}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
              />
            </div>
            
            {isAuthorized && (
              <button
                onClick={() => setShowRentalModal(true)}
                className="bg-[#00A651] hover:bg-[#008f43] text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                {lang === "en" ? "Record Gear Hire" : "Sajili Ukodishaji Mpya"}
              </button>
            )}
          </div>

          {/* Assets Inventory List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {assets
              .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((item) => {
                const isEditing = editingAssetId === item.id;
                return (
                  <div key={item.id} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-red-500/20 transition-all">
                    
                    {/* Top Segment */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="bg-neutral-100 text-neutral-600 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded uppercase border">
                          {item.category}
                        </span>
                        <h4 className="text-sm font-bold text-neutral-900 mt-1 font-sans">{item.name}</h4>
                        <p className="text-[9px] font-mono font-semibold text-neutral-400">SERIAL: {item.serialNumber}</p>
                      </div>

                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold ${
                        item.condition === "excellent" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                      }`}>
                        {item.condition.toUpperCase()}
                      </span>
                    </div>

                    {/* Middle Details */}
                    <div className="border-t border-b border-neutral-100 py-3 my-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-semibold text-neutral-500">
                      <p>{lang === "en" ? "Custodian" : "Kiongozi"}: <span className="text-neutral-800 font-bold">{item.custodian}</span></p>
                      <p>{lang === "en" ? "Location" : "Eneo"}: <span className="text-neutral-800 font-bold">{item.location}</span></p>
                      <p>{lang === "en" ? "CBO Cost" : "Gharama"}: <span className="text-neutral-800 font-bold">Ksh {item.purchaseCost.toLocaleString()}</span></p>
                      <p>
                        {lang === "en" ? "Hire Rate" : "Kiwango cha Kukodi"}: {" "}
                        <span className="text-emerald-600 font-bold font-mono">
                          Ksh {item.dailyRate ? item.dailyRate.toLocaleString() : "500"}/day
                        </span>
                      </p>
                    </div>

                    {/* Hiring Controls Segment */}
                    <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200">
                      {isEditing ? (
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">Edit Hire Parameters</p>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                              <input
                                type="checkbox"
                                checked={editAvailable}
                                onChange={(e) => setEditAvailable(e.target.checked)}
                                className="rounded text-red-600 focus:ring-red-500 h-3.5 w-3.5"
                              />
                              {lang === "en" ? "Available for External Hire" : "Inaruhusu Kukodiwa Nje"}
                            </label>
                          </div>

                          {editAvailable && (
                            <div>
                              <label className="block text-[9px] font-bold text-neutral-500 uppercase">Daily Hire Rate (Ksh)</label>
                              <input
                                type="number"
                                value={editHireRate}
                                onChange={(e) => setEditHireRate(Number(e.target.value))}
                                className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 mt-0.5 font-mono"
                              />
                            </div>
                          )}

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingAssetId(null)}
                              className="text-[10px] bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold px-2.5 py-1 rounded cursor-pointer"
                            >
                              {lang === "en" ? "Cancel" : "Ghairi"}
                            </button>
                            <button
                              onClick={() => handleSaveHireSettings(item)}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded cursor-pointer"
                            >
                              {lang === "en" ? "Save Rates" : "Hifadhi"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${item.availableForHire ? "bg-emerald-500" : "bg-neutral-300"}`}></span>
                            <span className="text-xs font-semibold text-neutral-700">
                              {item.availableForHire 
                                ? (lang === "en" ? `Eligible for Hire (Ksh ${item.dailyRate}/day)` : `Huru Kukodiwa (Ksh ${item.dailyRate}/siku)`)
                                : (lang === "en" ? "Internal CBO Use Only" : "Matumizi ya Ndani Tu")}
                            </span>
                          </div>

                          {isAuthorized && (
                            <button
                              onClick={() => handleStartEditing(item)}
                              className="text-[10px] font-bold text-[#E31E24] hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <Sliders size={10} />
                              {lang === "en" ? "Configure" : "Sanidi"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        /* Gear Rentals Tracker View */
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs overflow-hidden">
          <div className="flex justify-between items-center border-b pb-4 mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">{lang === "en" ? "External Rental Engagements Ledger" : "Daftari la Mikataba na Malipo ya Vifaa"}</h3>
              <p className="text-xs text-neutral-400 mt-0.5">{lang === "en" ? "Historical log of third-party contracts, daily charges, and return statuses." : "Kumbukumbu ya vifaa vyote vilivyokodishwa kwa watu wa nje na malipo."}</p>
            </div>
            
            {isAuthorized && (
              <button
                onClick={() => setShowRentalModal(true)}
                className="bg-[#00A651] hover:bg-[#008f43] text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-sm"
              >
                <Plus size={14} />
                {lang === "en" ? "Record Rent Out" : "Sajili Ukodishaji Mpya"}
              </button>
            )}
          </div>

          {allRentals.length === 0 ? (
            <div className="py-12 text-center text-neutral-400">
              <Package className="mx-auto text-neutral-300 mb-3" size={32} />
              <p className="text-sm font-bold">{lang === "en" ? "No external rental contracts recorded." : "Hakuna kumbukumbu za ukodishaji zilizosajiliwa bado."}</p>
              <p className="text-xs text-neutral-400 mt-1">{lang === "en" ? "Equipments hired out will appear here." : "Vifaa vinavyokodishwa vitaonekana hapa."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    <th className="py-3 px-4">{lang === "en" ? "Client Details" : "Mteja"}</th>
                    <th className="py-3 px-4">{lang === "en" ? "Equipment" : "Kifaa"}</th>
                    <th className="py-3 px-4">{lang === "en" ? "Rental Period" : "Muda wa Kukodi"}</th>
                    <th className="py-3 px-4">{lang === "en" ? "Total Cost" : "Gharama"}</th>
                    <th className="py-3 px-4">{lang === "en" ? "Payment" : "Malipo"}</th>
                    <th className="py-3 px-4">{lang === "en" ? "Status" : "Hali"}</th>
                    {isAuthorized && <th className="py-3 px-4 text-right">{lang === "en" ? "Actions" : "Hatua"}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs">
                  {allRentals.map((rent) => (
                    <tr key={rent.rentalId} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-4">
                        <p className="font-bold text-neutral-900">{rent.clientName}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">{rent.clientPhone}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-neutral-700">{rent.assetName}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-neutral-600 font-mono">
                        {rent.startDate} {lang === "en" ? "to" : "hadi"} {rent.endDate}
                      </td>
                      <td className="py-3 px-4 font-bold text-neutral-900 font-mono">
                        Ksh {rent.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          rent.paymentStatus === "paid" 
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                            : "bg-red-50 text-red-500 border border-red-100"
                        }`}>
                          {rent.paymentStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 w-max ${
                          rent.status === "returned"
                            ? "bg-neutral-100 text-neutral-600"
                            : "bg-amber-50 text-amber-600 border border-amber-100"
                        }`}>
                          {rent.status === "returned" ? <CheckCircle size={10} /> : <Clock size={10} />}
                          {rent.status.toUpperCase()}
                        </span>
                      </td>
                      
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={() => {
                              const receiptContent = (
                                <div className="space-y-6">
                                  <div className="grid grid-cols-2 gap-4 text-xs font-sans border-b pb-4">
                                    <div>
                                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Receipt &amp; Contract Ref</span>
                                      <span className="font-mono font-bold text-neutral-900 text-sm">BT-RCT-{rent.rentalId.toUpperCase()}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Issue Date</span>
                                      <span className="font-mono font-semibold text-neutral-800">{rent.startDate}</span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Renter / Client Name</span>
                                      <span className="font-bold text-neutral-900 text-sm">{rent.clientName}</span>
                                      <span className="block text-[10px] font-mono text-neutral-500">{rent.clientPhone}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Rental Duration</span>
                                      <span className="font-mono font-semibold text-neutral-800">{rent.startDate} to {rent.endDate}</span>
                                    </div>
                                  </div>

                                  <table className="w-full text-left text-xs border border-neutral-200 rounded-lg overflow-hidden">
                                    <thead className="bg-neutral-100 text-[10px] font-bold text-neutral-600 uppercase">
                                      <tr>
                                        <th className="py-2.5 px-3">Equipment Item</th>
                                        <th className="py-2.5 px-3 text-center">Rental Period</th>
                                        <th className="py-2.5 px-3 text-right">Total Fee</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200">
                                      <tr>
                                        <td className="py-3 px-3 font-bold text-neutral-900">{rent.assetName}</td>
                                        <td className="py-3 px-3 text-center font-mono text-neutral-600">{rent.startDate} - {rent.endDate}</td>
                                        <td className="py-3 px-3 text-right font-mono font-black text-neutral-950 text-sm">
                                          Ksh {rent.totalAmount.toLocaleString()}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>

                                  <div className="flex flex-wrap justify-between items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                    <div>
                                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Payment Instructions / M-Pesa Till</span>
                                      <p className="text-xs font-medium text-emerald-950">
                                        Buy Goods Till Number: <strong className="font-mono text-sm font-black text-emerald-700">8671238</strong> (Bashosho Talents CBO)
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Payment Status</span>
                                      <span className={`px-2 py-0.5 rounded font-mono text-xs font-black uppercase ${
                                        rent.paymentStatus === "paid" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                                      }`}>
                                        {rent.paymentStatus.toUpperCase()}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="pt-2 grid grid-cols-2 gap-8 items-end">
                                    <div>
                                      <div className="border-b border-neutral-400 w-40 h-10 flex items-end font-mono text-xs font-bold text-neutral-800">
                                        {rent.clientName}
                                      </div>
                                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mt-1">Client Authorization Signature</span>
                                    </div>
                                  </div>
                                </div>
                              );
                              onTriggerPrint(`Equipment Hire Receipt - ${rent.assetName}`, receiptContent);
                            }}
                            className="text-[9px] font-bold bg-neutral-900 hover:bg-black text-white px-2 py-1 rounded cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <Printer size={10} />
                            {lang === "en" ? "Receipt/PDF" : "Stakabadhi"}
                          </button>

                          {isAuthorized && rent.paymentStatus === "unpaid" && (
                            <button
                              onClick={() => handleTogglePaymentStatus(rent)}
                              className="text-[9px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-2 py-1 rounded cursor-pointer border border-emerald-200"
                            >
                              {lang === "en" ? "Paid" : "Malipo"}
                            </button>
                          )}
                          {isAuthorized && rent.status === "out" && (
                            <button
                              onClick={() => handleToggleReturnStatus(rent)}
                              className="text-[9px] font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-1 rounded cursor-pointer border"
                            >
                              {lang === "en" ? "Mark Returned" : "Imerejeshwa"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. MODAL: RECORD NEW RENTAL */}
      <Modal
        isOpen={showRentalModal}
        onClose={() => setShowRentalModal(false)}
        title={
          <h3 className="font-black text-neutral-900 text-sm tracking-wide font-sans uppercase flex items-center gap-1.5">
            <Coins className="text-emerald-500" size={16} />
            {lang === "en" ? "Record External Gear Rental Engagement" : "Sajili Mkataba wa Kodisha Vifaa"}
          </h3>
        }
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleRecordRental} className="space-y-4">
              {/* Asset Select */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                  {lang === "en" ? "Select Equipment to Hire" : "Chagua Kifaa cha Kukodisha"} *
                </label>
                <select
                  required
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-bold"
                >
                  <option value="">-- {lang === "en" ? "Choose Available Asset" : "Chagua Kifaa" } --</option>
                  {rentableAssets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.category.toUpperCase()}) - Ksh {a.dailyRate}/day
                    </option>
                  ))}
                </select>
                <span className="text-[9px] text-neutral-400 block font-medium">
                  {lang === "en" 
                    ? "Only assets marked 'Available for External Hire' inside inventory settings are shown here."
                    : "Vifaa vilivyowekwa huru kwa ajili ya kukodishwa tu ndivyo vinavyoonekana hapa."}
                </span>
              </div>

              {/* Client Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    {lang === "en" ? "Client / Organization Name" : "Jina la Mteja au Kampuni"} *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. UN-Habitat Filmmakers Group"
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    {lang === "en" ? "Client Cell Number" : "Namba ya Simu ya Mteja"} *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="e.g. +254 712 345678"
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                  />
                </div>
              </div>

              {/* Rental Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    {lang === "en" ? "Rental Start Date" : "Tarehe ya Kuanza"} *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    {lang === "en" ? "Expected Return Date" : "Tarehe ya Kurudisha"} *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                  />
                </div>
              </div>

              {/* Custom Daily Rate & Payment status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    {lang === "en" ? "Negotiated Daily Rate (Ksh)" : "Kiwango cha Kukubalika cha Siku"} *
                  </label>
                  <input
                    type="number"
                    required
                    value={customRate}
                    onChange={(e) => setCustomRate(e.target.value)}
                    placeholder="e.g. 3500"
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    {lang === "en" ? "Payment Status" : "Hali ya Malipo"}
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as "paid" | "unpaid")}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-bold"
                  >
                    <option value="unpaid">{lang === "en" ? "Unpaid / Pending Balance" : "Bado Hajalipa"}</option>
                    <option value="paid">{lang === "en" ? "Fully Paid (Auto-Ledger Record)" : "Imelipwa (Inarekodi katika Daftari la Fedha)"}</option>
                  </select>
                </div>
              </div>

              {/* AI Draft Section */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-black text-neutral-800">
                  <Sparkles size={14} className="text-[#E31E24]" />
                  {lang === "en" ? "AI Official Lease Terms Writer" : "Mwandishi wa Mikataba ya Kukodi wa AI"}
                </div>
                <p className="text-[10px] text-neutral-500 leading-relaxed">
                  {lang === "en"
                    ? "Need to print or email a formal lease agreement or invoice memo? Enter any specific notes (e.g., security deposit, delivery terms) and let Gemini draft the official copy."
                    : "Unahitaji mkataba kamili kwa barua pepe? Andika dondoo yoyote (mfano, dhamana) na uruhusu Gemini aandike mkataba kamili."}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  <div className="md:col-span-5 space-y-2">
                    <textarea
                      rows={3}
                      value={aiNotes}
                      onChange={(e) => setAiNotes(e.target.value)}
                      placeholder={lang === "en" ? "Deposit Ksh 5,000 required. Deliver to UN offices directly." : "Dhamana ya Ksh 5,000 inahitajika."}
                      className="w-full bg-white border border-neutral-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                    />
                    <button
                      type="button"
                      disabled={isAiLoading || !selectedAssetId}
                      onClick={handleGenerateAgreementDraft}
                      className={`w-full py-1.5 px-3 rounded text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isAiLoading 
                          ? "bg-neutral-200 text-neutral-500" 
                          : "bg-red-600 hover:bg-red-700 text-white"
                      }`}
                    >
                      {isAiLoading ? (
                        <>
                          <div className="animate-spin h-3.5 w-3.5 border-2 border-neutral-400 border-t-transparent rounded-full"></div>
                          {lang === "en" ? "Drafting..." : "Inaandika..."}
                        </>
                      ) : (
                        <>
                          <Sparkles size={11} />
                          {lang === "en" ? "Compose Formal Terms" : "Tengeneza Mkataba"}
                        </>
                      )}
                    </button>
                  </div>

                  <div className="md:col-span-7">
                    {agreementDraft ? (
                      <div className="bg-white border rounded-lg p-3 max-h-[140px] overflow-y-auto text-[10px] font-mono text-neutral-700 whitespace-pre-wrap leading-relaxed">
                        {agreementDraft}
                      </div>
                    ) : (
                      <div className="border border-dashed rounded-lg p-4 text-center text-neutral-400 text-[10px] flex flex-col justify-center items-center h-[140px]">
                        <Info size={16} className="text-neutral-300 mb-1" />
                        {lang === "en" ? "Drafted terms will be displayed here." : "Mkataba ulioandaliwa utatokea hapa."}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowRentalModal(false)}
                  className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  {lang === "en" ? "Cancel" : "Ghairi"}
                </button>
                <button
                  type="submit"
                  className="bg-[#00A651] hover:bg-[#008f43] text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-sm transition-colors"
                >
                  {lang === "en" ? "Record Rent Out" : "Sajili Mkataba"}
                </button>
              </div>
            </form>
      </Modal>

    </div>
  );
}
