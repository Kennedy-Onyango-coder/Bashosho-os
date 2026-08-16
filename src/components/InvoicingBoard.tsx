import { Lock, Settings, Plus, FileText, Users, AlertTriangle, Printer, Trash2, X, Save, Sparkles } from "lucide-react";
import React from "react";
import { Invoice, Partner, UserRole, OrgSettings, getUserRoleKey } from "../types";
import { StorageService } from "../lib/storage";
import Modal from "./Modal";

interface InvoicingBoardProps {
  currentUser: any;
  lang: "en" | "sw";
  onTriggerPrint: (title: string, content: React.ReactNode, verificationUrl?: string) => void;
}

export default function InvoicingBoard({ currentUser, lang, onTriggerPrint }: InvoicingBoardProps) {
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [partners, setPartners] = React.useState<Partner[]>([]);
  const [activeTab, setActiveTab] = React.useState<"invoices" | "partners">("invoices");

  // Modals state
  const [showModal, setShowModal] = React.useState(false);
  const [showAddPartnerModal, setShowAddPartnerModal] = React.useState(false);
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);

  // Dynamic invoice settings from OrgSettings
  const [orgSettings, setOrgSettings] = React.useState<OrgSettings>(() => StorageService.getOrgSettings());

  // Invoicing Form states
  const [partnerId, setPartnerId] = React.useState("");
  const [engagementDescription, setEngagementDescription] = React.useState("");
  const [category, setCategory] = React.useState<Invoice["category"]>("other");
  const [amount, setAmount] = React.useState("");
  const [issueDate, setIssueDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = React.useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [status, setStatus] = React.useState<Invoice["status"]>("draft");
  const [isAiDrafting, setIsAiDrafting] = React.useState(false);

  const handleGenerateInvoiceAiDraft = async () => {
    const partner = partners.find(p => p.id === partnerId);
    setIsAiDrafting(true);
    try {
      const res = await fetch("/api/document_templates/generate_draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Draft a formal Invoice Statement of Work for ${partner?.name || "Corporate Partner"}.
- Fee Amount: Ksh ${amount || "150,000"}
- Issue Date: ${issueDate} | Due Date: ${dueDate}
- Initial Notes: ${engagementDescription || "3-day Forum Theatre roadshow & community campaign in Kiambiu"}`,
          docType: "invoicing",
          title: `Invoice Explanation - ${partner?.name || "Partner"}`
        })
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setEngagementDescription(data.draft);
      } else {
        throw new Error(data.error || "Failed to generate AI draft");
      }
    } catch (err: any) {
      alert("AI Draft Generation failed: " + err.message);
    } finally {
      setIsAiDrafting(false);
    }
  };

  // Inline Quick Add Partner states
  const [showQuickAddPartner, setShowQuickAddPartner] = React.useState(false);
  const [newPartnerName, setNewPartnerName] = React.useState("");
  const [newPartnerContact, setNewPartnerContact] = React.useState("");
  const [newPartnerEmail, setNewPartnerEmail] = React.useState("");
  const [newPartnerPhone, setNewPartnerPhone] = React.useState("");
  const [newPartnerCategory, setNewPartnerCategory] = React.useState<Partner["category"]>("corporate");
  const [newPartnerNotes, setNewPartnerNotes] = React.useState("");

  // Payment Options Form states
  const [paymentBankName, setPaymentBankName] = React.useState(orgSettings.invoiceBankName || "Co-operative Bank Kenya");
  const [paymentBankAccount, setPaymentBankAccount] = React.useState(orgSettings.invoiceBankAccount || "");
  const [paymentBankAccountName, setPaymentBankAccountName] = React.useState(orgSettings.invoiceBankAccountName || "Bashosho Talents CBO");
  const [paymentMpesaPaybill, setPaymentMpesaPaybill] = React.useState(orgSettings.invoiceMpesaPaybill || "400222");
  const [paymentMpesaTill, setPaymentMpesaTill] = React.useState(orgSettings.invoiceMpesaTill || "");

  React.useEffect(() => {
    const refreshData = () => {
      setInvoices(StorageService.getInvoices());
      setPartners(StorageService.getPartners());
      setOrgSettings(StorageService.getOrgSettings());
    };
    refreshData();

    window.addEventListener("bashosh_os_data_updated", refreshData);
    return () => {
      window.removeEventListener("bashosh_os_data_updated", refreshData);
    };
  }, []);

  // Keep payment modal states in sync with latest settings when opening the modal
  React.useEffect(() => {
    if (showPaymentModal) {
      const latestSettings = StorageService.getOrgSettings();
      setOrgSettings(latestSettings);
      setPaymentBankName(latestSettings.invoiceBankName || "Co-operative Bank Kenya");
      setPaymentBankAccount(latestSettings.invoiceBankAccount || "");
      setPaymentBankAccountName(latestSettings.invoiceBankAccountName || "Bashosho Talents CBO");
      setPaymentMpesaPaybill(latestSettings.invoiceMpesaPaybill || "400222");
      setPaymentMpesaTill(latestSettings.invoiceMpesaTill || "");
    }
  }, [showPaymentModal]);

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId || !engagementDescription.trim() || !amount || !issueDate || !dueDate) return;

    // Generate auto-incrementing invoice number
    let nextNum = invoices.length + 1;
    invoices.forEach(inv => {
      const match = inv.invoiceNumber.match(/BT-INV-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num >= nextNum) nextNum = num + 1;
      }
    });
    const invoiceNumber = `BT-INV-${nextNum.toString().padStart(3, "0")}`;

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      partnerId,
      engagementDescription,
      amount: parseFloat(amount) || 0,
      issueDate,
      dueDate,
      status,
      category,
    };

    const updated = [newInvoice, ...invoices];
    setInvoices(updated);
    StorageService.saveRecord("invoices", newInvoice).catch(console.error);
    setShowModal(false);

    // Reset Form
    setPartnerId("");
    setEngagementDescription("");
    setAmount("");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    setStatus("draft");
    setCategory("other");
  };

  const handleUpdateStatus = async (invoiceId: string, nextStatus: Invoice["status"]) => {
    if (nextStatus === "paid") {
      // Dedicated endpoint — this is also what triggers the automatic 30/70
      // performance-fee split for "performance"-category invoices, so it can't go
      // through the generic save path other status changes use.
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/mark_paid`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to mark invoice paid");
        setInvoices(invoices.map(inv => inv.id === invoiceId ? { ...inv, status: "paid" } : inv));
        if (data.settlement) {
          alert(lang === "en"
            ? `Marked paid. A Performance Settlement was created — go to Financial Ledger → Performance Settlements to confirm the org cut / cast pool split.`
            : `Imelipwa. Ugawaji wa mapato umeundwa — nenda Daftari la Fedha → Ugawaji wa Maonyesho kuthibitisha.`);
        }
      } catch (err: any) {
        alert(err.message);
      }
      return;
    }
    let updatedInvoice: Invoice | null = null;
    const updated = invoices.map(inv => {
      if (inv.id === invoiceId) {
        updatedInvoice = { ...inv, status: nextStatus };
        return updatedInvoice;
      }
      return inv;
    });
    setInvoices(updated);
    if (updatedInvoice) {
      StorageService.saveRecord("invoices", updatedInvoice).catch(console.error);
    }
  };

  const handleDeleteInvoice = (id: string) => {
    if (confirm(lang === "en" ? "Delete this invoice?" : "Futa ankara hii?")) {
      const updated = invoices.filter(inv => inv.id !== id);
      setInvoices(updated);
      StorageService.deleteRecord("invoices", id).catch(console.error);
    }
  };

  const isOverdue = (invoice: Invoice) => {
    if (invoice.status === "paid" || invoice.status === "draft") return false;
    return new Date(invoice.dueDate) < new Date();
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    const partner = partners.find(p => p.id === invoice.partnerId);
    const overdue = isOverdue(invoice);
    const verificationUrl = invoice.verificationUrl;

    const invoiceContent = (
      <div className="space-y-6 text-left relative bg-white min-h-[400px]">
        {/* Overdue Stamp on Printable */}
        {overdue && (
          <div className="absolute top-10 right-10 border-4 border-red-500 text-red-500 font-sans font-bold text-lg tracking-widest px-4 py-2 uppercase rounded transform rotate-12 opacity-80 select-none">
            OVERDUE / IMECHELEWA
          </div>
        )}
        
        {invoice.status === "paid" && (
          <div className="absolute top-10 right-10 border-4 border-emerald-500 text-emerald-500 font-sans font-bold text-lg tracking-widest px-4 py-2 uppercase rounded transform -rotate-12 opacity-80 select-none">
            PAID / IMELIPWA
          </div>
        )}

        <div className="grid grid-cols-2 gap-8 border-b pb-6 text-xs font-sans">
          <div>
            <h3 className="font-bold text-neutral-400 uppercase tracking-wider text-[9px] mb-2">Invoice Prepared For:</h3>
            <p className="text-sm font-bold text-neutral-900">{partner?.name || "Official Partner"}</p>
            <p className="text-neutral-600 mt-1">Attn: {partner?.contactPerson}</p>
            <p className="text-neutral-500 mt-0.5">{partner?.email} | {partner?.phone}</p>
          </div>
          <div className="text-right space-y-1">
            <h3 className="font-bold text-neutral-400 uppercase tracking-wider text-[9px] mb-1.5">Invoice Meta:</h3>
            <p><strong>Invoice Number:</strong> <span className="font-mono text-neutral-950 font-bold">{invoice.invoiceNumber}</span></p>
            <p><strong>Issue Date:</strong> <span className="font-mono">{invoice.issueDate}</span></p>
            <p><strong>Payment Due Date:</strong> <span className="font-mono text-red-600 font-bold">{invoice.dueDate}</span></p>
            <p><strong>Current Status:</strong> <span className="uppercase font-bold text-neutral-800">{invoice.status}</span></p>
          </div>
        </div>

        {/* Itemized Table */}
        <table className="w-full text-left font-sans text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-100 border-b border-neutral-300 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
              <th className="py-2.5 px-3">Description of Engagement / Advocacy Services</th>
              <th className="py-2.5 px-3 text-right">Total Fee (Ksh)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-200">
              <td className="py-4 px-3 font-medium text-neutral-800 font-serif whitespace-pre-wrap leading-relaxed">
                {invoice.engagementDescription}
              </td>
              <td className="py-4 px-3 text-right font-mono font-bold text-neutral-900">
                Ksh {(invoice?.amount || 0).toLocaleString()}
              </td>
            </tr>
            <tr className="bg-neutral-50 font-bold text-xs">
              <td className="py-3 px-3 text-right uppercase text-neutral-500">Amount Due (Total):</td>
              <td className="py-3 px-3 text-right font-mono text-neutral-950 text-sm">
                Ksh {(invoice?.amount || 0).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Payment instructions */}
        <div className="bg-neutral-50 border p-4 rounded-xl space-y-2 text-[11px] font-sans text-neutral-600 max-w-lg">
          <p className="font-bold text-neutral-800 uppercase tracking-wide text-[9px]">Payment Instructions / Maelekezo ya Malipo:</p>
          <p>Please disburse funds directly via Bank Transfer or M-Pesa to our registered community finance vault:</p>
          <div className="grid grid-cols-2 gap-2.5 font-mono text-[10px] bg-white p-3 rounded border border-neutral-200">
            {orgSettings.invoiceMpesaPaybill && (
              <p><strong>M-PESA Paybill:</strong> {orgSettings.invoiceMpesaPaybill}</p>
            )}
            {orgSettings.invoiceMpesaTill && (
              <p><strong>M-PESA Till:</strong> {orgSettings.invoiceMpesaTill}</p>
            )}
            <p><strong>Account Number:</strong> {orgSettings.invoiceBankAccount || invoice.invoiceNumber}</p>
            {orgSettings.invoiceBankName && (
              <p><strong>Bank Name:</strong> {orgSettings.invoiceBankName}</p>
            )}
            {orgSettings.invoiceBankAccountName && (
              <p><strong>Account Name:</strong> {orgSettings.invoiceBankAccountName}</p>
            )}
          </div>
        </div>
      </div>
    );

    onTriggerPrint(
      `Invoice ${invoice.invoiceNumber} - ${partner?.name || "Partner"}`,
      invoiceContent,
      verificationUrl
    );
  };

  // Quick Add Partner from Invoice Modal
  const handleQuickAddPartner = () => {
    if (!newPartnerName.trim() || !newPartnerContact.trim() || !newPartnerEmail.trim() || !newPartnerPhone.trim()) {
      alert(lang === "en" ? "Please fill in all required partner fields!" : "Tafadhali jaza maelezo yote ya mshirika!");
      return;
    }
    const newPartner: Partner = {
      id: `p-${Date.now()}`,
      name: newPartnerName.trim(),
      contactPerson: newPartnerContact.trim(),
      email: newPartnerEmail.trim(),
      phone: newPartnerPhone.trim(),
      category: newPartnerCategory,
      notes: newPartnerNotes.trim(),
      pipelineStage: "confirmed"
    };

    const updatedPartners = [...partners, newPartner];
    setPartners(updatedPartners);
    StorageService.saveRecord("partners", newPartner).catch(console.error);

    // Auto-select the newly created partner
    setPartnerId(newPartner.id);

    // Clear and close sub-form
    setNewPartnerName("");
    setNewPartnerContact("");
    setNewPartnerEmail("");
    setNewPartnerPhone("");
    setNewPartnerCategory("corporate");
    setNewPartnerNotes("");
    setShowQuickAddPartner(false);
  };

  // Full Partner handlers
  const handleUpdatePartnerStage = (partnerId: string, nextStage: Partner["pipelineStage"]) => {
    let updatedPartner: Partner | null = null;
    const updated = partners.map(p => {
      if (p.id === partnerId) {
        updatedPartner = { ...p, pipelineStage: nextStage };
        return updatedPartner;
      }
      return p;
    });
    setPartners(updated);
    if (updatedPartner) {
      StorageService.saveRecord("partners", updatedPartner).catch(console.error);
    }
  };

  const handleDeletePartner = (id: string) => {
    if (confirm(lang === "en" ? "Delete this partner/organization from record?" : "Futa mshirika/shirika hili kwenye orodha?")) {
      const updated = partners.filter(p => p.id !== id);
      setPartners(updated);
      StorageService.deleteRecord("partners", id).catch(console.error);
    }
  };

  // Save modified dynamic payment options
  const handleSavePaymentOptions = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings: OrgSettings = {
      ...orgSettings,
      invoiceBankName: paymentBankName.trim(),
      invoiceBankAccount: paymentBankAccount.trim(),
      invoiceBankAccountName: paymentBankAccountName.trim(),
      invoiceMpesaPaybill: paymentMpesaPaybill.trim(),
      invoiceMpesaTill: paymentMpesaTill.trim()
    };

    setOrgSettings(updatedSettings);
    StorageService.saveOrgSettings(updatedSettings);
    setShowPaymentModal(false);
  };

  const isAuthorized = [UserRole.TREASURER, UserRole.VICE_CHAIRPERSON, UserRole.CHAIRPERSON].includes(getUserRoleKey(currentUser) as UserRole);

  if (!isAuthorized) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center max-w-lg mx-auto">
        <Lock size={32} className="text-amber-[#E31E24]" />
        <h3 className="text-lg font-bold text-neutral-900 mt-4">
          {lang === "en" ? "Access Restricted" : "Ufikiaji Umezuiliwa"}
        </h3>
        <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
          {lang === "en"
            ? "Invoice records and billing systems are confidential and restricted to Treasurer, Vice Chairperson, and Chairperson roles."
            : "Nyaraka za Ankara na mifumo ya malipo ni siri na imezuiliwa kwa Mweka Hazina, Makamu wa Mwenyekiti, na Mwenyekiti pekee."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left" id="invoicing-module-stage">
      {/* Module Header */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-red-600 font-mono text-[9px] font-bold tracking-widest uppercase bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
            {lang === "en" ? "PARTNER BILLING & INVOICING" : "HESABU ZA KIKUNDI"}
          </span>
          <h2 className="text-xl font-black text-neutral-900 mt-1.5 font-sans">
            {lang === "en" ? "Partner Invoicing & Billings" : "Ankara na Malipo ya Washiriki"}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {lang === "en"
              ? "Draft legal financial invoices against corporate/NGO sponsors, track overdue statements, and print certified letterheads."
              : "Tengeneza ankara za kifedha kwa wadhamini/mashirika ya nje, fuatilia madeni yaliyochelewa, na chapa barua rasmi."}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold px-4 py-2.5 rounded-lg border border-neutral-200 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {lang === "en" ? "Payment Options" : "Njia za Malipo"}
          </button>
          <button
            onClick={() => {
              if (activeTab === "partners") {
                setShowAddPartnerModal(true);
              } else {
                setShowModal(true);
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {activeTab === "partners" ? (
              <>{lang === "en" ? "Add Partner" : "Sajili Mshirika"}</>
            ) : (
              <>{lang === "en" ? "Generate Invoice" : "Tengeneza Ankara"}</>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-200 gap-1">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "invoices"
              ? "border-red-600 text-red-600 bg-red-50/20"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          {lang === "en" ? "Invoices & Billings" : "Ankara na Malipo"}
        </button>
        <button
          onClick={() => setActiveTab("partners")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "partners"
              ? "border-red-600 text-red-600 bg-red-50/20"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          {lang === "en" ? "Partner Directory / CRM" : "Orodha ya Washiriki"}
        </button>
      </div>

      {/* Invoices List Tab Content */}
      {activeTab === "invoices" && (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-500 uppercase tracking-wider text-[9px]">
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Partner Name</th>
                  <th className="py-3 px-4">Engagement / Package</th>
                  <th className="py-3 px-4">Amount Due</th>
                  <th className="py-3 px-4">Timeline Dates</th>
                  <th className="py-3 px-4">Status Info</th>
                  <th className="py-3 px-4 text-right">Control Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const partner = partners.find(p => p.id === inv.partnerId);
                  const overdue = isOverdue(inv);

                  return (
                    <tr key={inv.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-neutral-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-neutral-900">
                        {partner?.name || "Unknown Partner"}
                        <span className="block text-[10px] text-neutral-400 font-medium">{partner?.contactPerson}</span>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-500 max-w-xs truncate font-serif italic">
                        "{inv.engagementDescription}"
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-neutral-900">
                        Ksh {(inv?.amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-[10px] font-mono text-neutral-500">
                        <p>Issued: <strong>{inv.issueDate}</strong></p>
                        <p>Due: <strong className={overdue ? "text-red-600" : "text-neutral-700"}>{inv.dueDate}</strong></p>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <select
                            value={inv.status}
                            onChange={(e) => handleUpdateStatus(inv.id, e.target.value as Invoice["status"])}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border focus:outline-none cursor-pointer ${
                              inv.status === "paid"
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                : inv.status === "sent"
                                ? "bg-blue-50 text-blue-600 border-blue-200"
                                : "bg-neutral-50 text-neutral-600 border-neutral-200"
                            }`}
                          >
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="paid">Paid</option>
                          </select>
                          {overdue && (
                            <span className="bg-red-50 text-red-600 font-mono text-[8px] font-bold px-1 rounded border border-red-100 uppercase tracking-wider animate-pulse mt-0.5">
                              OVERDUE / ZAMANI
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={() => handlePrintInvoice(inv)}
                            className="bg-red-50 hover:bg-red-100 text-[#E31E24] font-bold border border-red-100 rounded px-2.5 py-1 cursor-pointer transition-colors text-[11px]"
                          >
                            Print PDF
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(inv.id)}
                            className="hover:bg-neutral-100 text-neutral-400 hover:text-red-600 p-1.5 rounded cursor-pointer transition-colors"
                            title="Delete"
                          >
                            
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs text-neutral-400 font-medium">
                      No partner invoices recorded in the database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Partners Tab Content */}
      {activeTab === "partners" && (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-500 uppercase tracking-wider text-[9px]">
                  <th className="py-3 px-4">{lang === "en" ? "Partner / Organization" : "Mshirika / Shirika"}</th>
                  <th className="py-3 px-4">{lang === "en" ? "Category" : "Kundi"}</th>
                  <th className="py-3 px-4">{lang === "en" ? "Contact Person" : "Mtu wa Mawasiliano"}</th>
                  <th className="py-3 px-4">{lang === "en" ? "Email & Phone" : "Barua Pepe na Simu"}</th>
                  <th className="py-3 px-4">{lang === "en" ? "Pipeline Stage" : "Hali ya Ushirikiano"}</th>
                  <th className="py-3 px-4">{lang === "en" ? "Notes / Description" : "Maelezo"}</th>
                  <th className="py-3 px-4 text-right">{lang === "en" ? "Actions" : "Vitendo"}</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-neutral-900 text-sm">
                      {partner.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-neutral-50 text-neutral-600 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase border border-neutral-200">
                        {partner.category.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-neutral-800">
                      {partner.contactPerson}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-600 font-mono text-[11px] space-y-0.5">
                      <p>{partner.email}</p>
                      <p className="text-neutral-400">{partner.phone}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={partner.pipelineStage || "confirmed"}
                        onChange={(e) => handleUpdatePartnerStage(partner.id, e.target.value as any)}
                        className="bg-neutral-50 text-neutral-700 font-bold text-[10px] px-2 py-1 rounded border border-neutral-200 uppercase focus:outline-none cursor-pointer"
                      >
                        <option value="contacted">Contacted</option>
                        <option value="negotiating">Negotiating</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="delivered">Delivered</option>
                        <option value="reported">Reported</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-500 max-w-xs truncate" title={partner.notes}>
                      {partner.notes || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeletePartner(partner.id)}
                        className="hover:bg-neutral-100 text-neutral-400 hover:text-red-600 p-1.5 rounded cursor-pointer transition-colors"
                        title={lang === "en" ? "Delete Partner" : "Futa Mshirika"}
                      >
                        
                      </button>
                    </td>
                  </tr>
                ))}
                {partners.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs text-neutral-400 font-medium">
                      {lang === "en" ? "No partners registered in CRM." : "Hakuna washiriki waliosajiliwa kwenye CRM."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Generation Modal Form */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setShowQuickAddPartner(false);
        }}
        title={lang === "en" ? "Generate Partner Invoice" : "Tengeneza Ankara ya Washirika"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Partner Select / Quick Add Subsection */}
          <div className="space-y-2">
            {showQuickAddPartner ? (
              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-red-600 uppercase tracking-widest font-mono">
                    {lang === "en" ? "Quick Add Partner" : "Sajili Mshirika Haraka"}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddPartner(false)}
                    className="text-[10px] font-bold text-neutral-500 hover:text-neutral-800"
                  >
                    {lang === "en" ? "Cancel" : "Ghairi"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1 col-span-2">
                    <label className="block text-[9px] font-bold uppercase text-neutral-500">{lang === "en" ? "Partner / Org Name *" : "Jina la Mshirika / Shirika *"}</label>
                    <input
                      type="text"
                      value={newPartnerName}
                      onChange={(e) => setNewPartnerName(e.target.value)}
                      placeholder="e.g. UNICEF Kenya"
                      className="w-full bg-white border border-neutral-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold uppercase text-neutral-500">{lang === "en" ? "Contact Person *" : "Mtu wa Mawasiliano *"}</label>
                    <input
                      type="text"
                      value={newPartnerContact}
                      onChange={(e) => setNewPartnerContact(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-white border border-neutral-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold uppercase text-neutral-500">{lang === "en" ? "Category" : "Kundi"}</label>
                    <select
                      value={newPartnerCategory}
                      onChange={(e) => setNewPartnerCategory(e.target.value as any)}
                      className="w-full bg-white border border-neutral-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none"
                    >
                      <option value="corporate">Corporate</option>
                      <option value="civil_society">Civil Society / NGO</option>
                      <option value="government">Government</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold uppercase text-neutral-500">{lang === "en" ? "Email Address *" : "Barua Pepe *"}</label>
                    <input
                      type="email"
                      value={newPartnerEmail}
                      onChange={(e) => setNewPartnerEmail(e.target.value)}
                      placeholder="e.g. partner@unicef.org"
                      className="w-full bg-white border border-neutral-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold uppercase text-neutral-500">{lang === "en" ? "Phone Number *" : "Nambari ya Simu *"}</label>
                    <input
                      type="text"
                      value={newPartnerPhone}
                      onChange={(e) => setNewPartnerPhone(e.target.value)}
                      placeholder="e.g. +254 ..."
                      className="w-full bg-white border border-neutral-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="block text-[9px] font-bold uppercase text-neutral-500">{lang === "en" ? "Notes" : "Maelezo"}</label>
                    <textarea
                      value={newPartnerNotes}
                      onChange={(e) => setNewPartnerNotes(e.target.value)}
                      rows={2}
                      placeholder="Partnership details..."
                      className="w-full bg-white border border-neutral-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleQuickAddPartner}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-bold py-2 rounded-md transition-colors cursor-pointer"
                >
                  {lang === "en" ? "Save and Select Partner" : "Hifadhi na Umchague Mshirika"}
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between items-center mb-0.5">
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    {lang === "en" ? "Select Partner *" : "Mshirika *"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddPartner(true)}
                    className="text-[10px] font-bold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {lang === "en" ? "Create New Partner" : "Sajili Mshirika Mpya"}
                  </button>
                </div>
                <select
                  required
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-semibold"
                >
                  <option value="">-- Choose a CRM Partner --</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.contactPerson})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Package Fee / Amount (Ksh) *</label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 150000"
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Invoice["status"])}
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="draft">Draft / Kwanza</option>
                <option value="sent">Sent / Imewasilishwa</option>
                <option value="paid">Paid / Imelipwa</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Issue Date *</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Due Date *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Detailed Description of Engagement *</label>
              <button
                type="button"
                onClick={handleGenerateInvoiceAiDraft}
                disabled={isAiDrafting}
                className="text-[10px] font-extrabold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1"
              >
                {isAiDrafting ? "Drafting..." : "AI Draft Narrative"}
              </button>
            </div>
            <textarea
              required
              value={engagementDescription}
              onChange={(e) => setEngagementDescription(e.target.value)}
              rows={5}
              placeholder="e.g. Delivery of 3-Phase Interactive Forum Theatre roadshow addressing Sexual Harassment & Safeguarding metrics across Kiambiu ward informal sectors..."
              className="w-full bg-white border border-neutral-200 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-sans leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 font-mono">
              {lang === "en" ? "Invoice Type" : "Aina ya Ankara"}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Invoice["category"])}
              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="other">{lang === "en" ? "Other (grant, service, misc.)" : "Nyingine"}</option>
              <option value="performance">{lang === "en" ? "Performance / Theatre Engagement" : "Onyesho la Tamthilia"}</option>
            </select>
            <p className="text-[10px] text-neutral-400 mt-1">
              {lang === "en"
                ? "Performance invoices automatically split 30% to the organization and the rest to a cast payment pool once marked paid."
                : "Ankara za maonyesho zinagawanya 30% kwa shirika kiotomatiki, iliyobaki kwa wasanii, mara inapolipwa."}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setShowQuickAddPartner(false);
              }}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-sm"
            >
              Generate Invoice
            </button>
          </div>
        </form>
      </Modal>

      {/* Full Partner Creation Modal Form */}
      <Modal
        isOpen={showAddPartnerModal}
        onClose={() => setShowAddPartnerModal(false)}
        title={lang === "en" ? "Register CRM Partner / Organization" : "Sajili Mshirika / Shirika la Nje"}
        maxWidth="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newPartnerName.trim() || !newPartnerContact.trim() || !newPartnerEmail.trim() || !newPartnerPhone.trim()) return;
            const newPartner: Partner = {
              id: `p-${Date.now()}`,
              name: newPartnerName.trim(),
              contactPerson: newPartnerContact.trim(),
              email: newPartnerEmail.trim(),
              phone: newPartnerPhone.trim(),
              category: newPartnerCategory,
              notes: newPartnerNotes.trim(),
              pipelineStage: "confirmed"
            };

            const updated = [...partners, newPartner];
            setPartners(updated);
            StorageService.saveRecord("partners", newPartner).catch(console.error);

            // Reset and close
            setNewPartnerName("");
            setNewPartnerContact("");
            setNewPartnerEmail("");
            setNewPartnerPhone("");
            setNewPartnerCategory("corporate");
            setNewPartnerNotes("");
            setShowAddPartnerModal(false);
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Partner / Org Name *</label>
            <input
              type="text"
              required
              value={newPartnerName}
              onChange={(e) => setNewPartnerName(e.target.value)}
              placeholder="e.g. UNICEF Kenya"
              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Contact Person *</label>
              <input
                type="text"
                required
                value={newPartnerContact}
                onChange={(e) => setNewPartnerContact(e.target.value)}
                placeholder="e.g. Jane Njoroge"
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Category</label>
              <select
                value={newPartnerCategory}
                onChange={(e) => setNewPartnerCategory(e.target.value as any)}
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="corporate">Corporate</option>
                <option value="civil_society">Civil Society / NGO</option>
                <option value="government">Government</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Email Address *</label>
              <input
                type="email"
                required
                value={newPartnerEmail}
                onChange={(e) => setNewPartnerEmail(e.target.value)}
                placeholder="e.g. partner@unicef.org"
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Phone Number *</label>
              <input
                type="text"
                required
                value={newPartnerPhone}
                onChange={(e) => setNewPartnerPhone(e.target.value)}
                placeholder="e.g. +254 700 000000"
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Notes & Collaboration Description</label>
            <textarea
              value={newPartnerNotes}
              onChange={(e) => setNewPartnerNotes(e.target.value)}
              rows={3}
              placeholder="Key contacts, ongoing discussions, advocacy packages..."
              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={() => setShowAddPartnerModal(false)}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-sm"
            >
              Save Partner Record
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Options Customization Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title={lang === "en" ? "Update Invoice Payment Options" : "Rekebisha Maelezo ya Malipo"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSavePaymentOptions} className="space-y-4">
          <p className="text-xs text-neutral-500 leading-relaxed bg-neutral-50 p-3 rounded-lg border border-neutral-200">
            {lang === "en"
              ? "Define the payment channels and bank parameters that appear on printed invoices. Leave fields empty if not applicable."
              : "Sanidi njia za malipo na benki zinazoonekana kwenye ankara zilizochapishwa. Wacha wazi zisizohitajika."}
          </p>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Bank Name</label>
            <input
              type="text"
              value={paymentBankName}
              onChange={(e) => setPaymentBankName(e.target.value)}
              placeholder="e.g. Co-operative Bank Kenya"
              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Account Name</label>
              <input
                type="text"
                value={paymentBankAccountName}
                onChange={(e) => setPaymentBankAccountName(e.target.value)}
                placeholder="e.g. Bashosho Talents CBO"
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Account Number</label>
              <input
                type="text"
                value={paymentBankAccount}
                onChange={(e) => setPaymentBankAccount(e.target.value)}
                placeholder="Leave empty for dynamic Invoice No."
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
              />
              <p className="text-[9px] text-neutral-400 mt-0.5">
                {lang === "en" ? "Defaults to the current invoice number if left empty." : "Inatumia nambari ya ankara kama hutaingiza."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">M-Pesa Paybill</label>
              <input
                type="text"
                value={paymentMpesaPaybill}
                onChange={(e) => setPaymentMpesaPaybill(e.target.value)}
                placeholder="e.g. 400222"
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider">M-Pesa Till Number</label>
              <input
                type="text"
                value={paymentMpesaTill}
                onChange={(e) => setPaymentMpesaTill(e.target.value)}
                placeholder="e.g. 789101 (Optional)"
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-sm"
            >
              Save Payment Channels
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
