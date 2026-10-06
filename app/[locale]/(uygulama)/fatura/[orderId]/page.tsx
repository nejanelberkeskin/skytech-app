"use client";

/**
 * /fatura/[orderId] — sipariş özeti (B2B). Resmî fatura DEĞİLDİR: fatura elle e-Arşiv'den kesilir (K14).
 * Belgenin adı ve dipnotu mali müşavir kararına kadar bu nötr hâlde kalır (K21).
 *
 * Tasarım felsefesi:
 *   - Ekranda: Karanlık sayfa üzerinde beyaz "kağıt" gölge efektiyle
 *   - Baskıda: Sadece beyaz A4 kağıdı çıkar; menüler/butonlar gizlenir
 *   - B2B uyumlu: Kurumsal fatura bilgileri (şirket adı, vergi no) gösterilir
 *   - KDV dahil fiyatlandırma: %20 KDV ayrıştırması
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { COMPANY, companyAddressLine } from "@/lib/company";

/* ═══════════════════════════════════════════════════════════
   Şirket sabit bilgileri
   ═══════════════════════════════════════════════════════════ */
/**
 * Satıcı künyesi — tek kaynak `lib/company.ts` (kullanıcı teyitli, 22 Eylül 2026). Ortam değişkeniyle ezilmez;
 * uydurma yedek değer yoktur. Bu sayfa resmî e-Arşiv faturası değildir (fatura elle e-Arşiv; K14).
 */
const SELLER = {
  name:      COMPANY.legalName,
  taxOffice: `${COMPANY.taxOffice} Vergi Dairesi`,
  taxNo:     COMPANY.taxId,
  address:   companyAddressLine(),
  email:     COMPANY.email,
  phone:     COMPANY.phone ?? "—",
  website:   COMPANY.website.replace(/^https?:\/\//, ""),
};

const KDV_RATE = 0.20; // %20 KDV

/* ═══════════════════════════════════════════════════════════
   Tipler
   ═══════════════════════════════════════════════════════════ */
interface Allocation {
  seeds_allocated: number;
  lands: { name: string; region: string | null } | null;
}

interface InvoiceData {
  order: {
    id:               string;
    buyer_email:      string;
    order_type:       string;
    status:           string;
    total_seeds:      number;
    total_price:      number;
    shipping_address: string | null;
    created_at:       string;
  };
  allocations:    Allocation[];
  buyerProfile: {
    full_name: string;
    phone:     string | null;
    address:   string | null;
    city:      string | null;
  } | null;
  corporateQuote: {
    company_name:   string;
    tax_office:     string | null;
    tax_no:         string | null;
    contact_person: string;
  } | null;
}

/* ═══════════════════════════════════════════════════════════
   Yardımcı fonksiyonlar
   ═══════════════════════════════════════════════════════════ */
function fmtTL(amount: number): string {
  return amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function invoiceNo(orderId: string): string {
  return "SKY-" + orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/* ═══════════════════════════════════════════════════════════
   KDV Hesaplama
   ═══════════════════════════════════════════════════════════ */
interface KdvBreakdown {
  kdvHaric: number;  // KDV hariç tutar
  kdvTutar: number;  // KDV tutarı
  kdvDahil: number;  // KDV dahil toplam (= total_price)
}

function calcKdv(total: number): KdvBreakdown {
  const kdvDahil = total;
  const kdvHaric = total / (1 + KDV_RATE);
  const kdvTutar = kdvDahil - kdvHaric;
  return { kdvHaric, kdvTutar, kdvDahil };
}

/* ═══════════════════════════════════════════════════════════
   Fatura Kalemleri (Line Items)
   ═══════════════════════════════════════════════════════════ */
interface LineItem {
  description: string;
  qty:         number;
  unitPrice:   number;
  kdvHaric:    number;
  kdvTutar:    number;
  total:       number;
}

function buildLineItems(data: InvoiceData): LineItem[] {
  const { order, allocations } = data;
  const unitRaw    = order.total_price / order.total_seeds;

  if (allocations.length > 0) {
    return allocations.map((a) => {
      const lineTotal  = a.seeds_allocated * unitRaw;
      const breakdown  = calcKdv(lineTotal);
      const landLabel  = a.lands
        ? `${a.lands.name}${a.lands.region ? " – " + a.lands.region : ""}`
        : "Orman Alanı";

      return {
        description: `Otonom Drone Tohum Ekimi — ${landLabel}`,
        qty:         a.seeds_allocated,
        unitPrice:   unitRaw / (1 + KDV_RATE),
        kdvHaric:    breakdown.kdvHaric,
        kdvTutar:    breakdown.kdvTutar,
        total:       lineTotal,
      };
    });
  }

  // Tahsis kaydı yoksa tek genel kalem
  const breakdown = calcKdv(order.total_price);
  return [{
    description: order.order_type === "physical"
      ? "Premium Tohum Paketi (Ev Teslimatı)"
      : "Otonom Drone Tohum Ekimi",
    qty:       order.total_seeds,
    unitPrice: unitRaw / (1 + KDV_RATE),
    kdvHaric:  breakdown.kdvHaric,
    kdvTutar:  breakdown.kdvTutar,
    total:     order.total_price,
  }];
}

/* ═══════════════════════════════════════════════════════════
   Ana bileşen
   ═══════════════════════════════════════════════════════════ */
export default function FaturaPage() {
  const params  = useParams<{ orderId: string }>();
  const orderId = params.orderId;

  const [data,    setData]    = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    try {
      const res  = await fetch(`/api/orders/invoice/${orderId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Belge yüklenemedi."); return; }
      setData(json as InvoiceData);
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  /* ── Yükleniyor ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center print:bg-white">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 text-emerald-600 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>
          <p className="text-sm text-gray-500">Belge yükleniyor…</p>
        </div>
      </div>
    );
  }

  /* ── Hata ───────────────────────────────────────────────── */
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm">
          <span className="text-4xl block mb-4">⚠️</span>
          <p className="text-base font-semibold text-gray-800 mb-2">Belge Yüklenemedi</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const { order, buyerProfile, corporateQuote } = data;
  const lineItems = buildLineItems(data);
  const totals    = calcKdv(order.total_price);

  /* ── Alıcı bilgisi ──────────────────────────────────────── */
  const buyerName    = corporateQuote?.company_name ?? buyerProfile?.full_name ?? "—";
  const buyerAddress = buyerProfile?.address ?? order.shipping_address ?? "—";
  const buyerCity    = buyerProfile?.city ?? "";
  const buyerTax     = corporateQuote
    ? `${corporateQuote.tax_office ?? ""} / ${corporateQuote.tax_no ?? ""}`.replace(/^\/|\/$/g, "").trim()
    : null;

  /* ── Belge adı: resmî fatura değil (K14/K21) ──────────────── */
  const INVOICE_TITLE = "SİPARİŞ ÖZETİ";

  return (
    <>
      {/* ════ Print CSS ════════════════════════════════════════════════════ */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-hidden { display: none !important; }
          .paper {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 40px !important;
          }
          .page-bg {
            background: white !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* ════ Ekran wrapper ════════════════════════════════════════════════ */}
      <div className="page-bg min-h-screen bg-gray-200 py-8 px-4 print:py-0 print:px-0">

        {/* ── Aksiyon çubuğu (baskıda gizlenir) ──────────────────────── */}
        <div
          className="print-hidden max-w-4xl mx-auto mb-5 flex items-center justify-between gap-3
            bg-gray-900 rounded-2xl px-5 py-3.5 shadow-xl"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🌱</span>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Skytech Green</p>
              <p className="text-xs text-gray-400">Sipariş Özeti</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400
                hover:text-white transition-colors px-3 py-2 rounded-lg
                hover:bg-white/[0.07]"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Geri
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-semibold text-white
                px-4 py-2 rounded-xl transition-all"
              style={{ background: "linear-gradient(135deg, rgb(16,185,129), rgb(5,150,105))", boxShadow: "0 3px 12px rgba(16,185,129,0.35)" }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
              </svg>
              Yazdır / PDF Kaydet
            </button>
          </div>
        </div>

        {/* ════ KAĞIT — A4 oranı ════════════════════════════════════════════ */}
        <div
          className="paper bg-white text-gray-900 max-w-4xl mx-auto
            rounded-2xl shadow-2xl overflow-hidden
            p-10 print:rounded-none print:shadow-none print:p-10"
          style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
        >

          {/* ── BAŞLIK (Header) ────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-100">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
              >
                🌱
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-tight">Skytech Green</p>
                <p className="text-xs text-gray-400 tracking-wide">{SELLER.website}</p>
              </div>
            </div>

            {/* Belge başlık bilgileri */}
            <div className="text-right">
              <p
                className="text-xl font-black tracking-widest uppercase"
                style={{ color: "#059669" }}
              >
                {INVOICE_TITLE}
              </p>
              <div className="mt-2 space-y-0.5">
                <p className="text-xs text-gray-500">
                  Belge No:{" "}
                  <span className="font-bold text-gray-800 font-mono">{invoiceNo(order.id)}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Tarih:{" "}
                  <span className="font-semibold text-gray-700">{fmtDate(order.created_at)}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Sipariş Ref.:{" "}
                  <span className="font-mono text-gray-600 text-[10px]">{order.id}</span>
                </p>
              </div>
            </div>
          </div>

          {/* ── GÖNDEREN / ALICI ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* Gönderen */}
            <div
              className="rounded-xl p-4"
              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
            >
              <p
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: "#059669" }}
              >
                Gönderen / Satıcı
              </p>
              <p className="text-sm font-bold text-gray-900">{SELLER.name}</p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">{SELLER.address}</p>
              <div className="mt-2 space-y-0.5">
                <p className="text-xs text-gray-500">
                  Vergi Dairesi:{" "}
                  <span className="text-gray-700 font-medium">{SELLER.taxOffice}</span>
                </p>
                <p className="text-xs text-gray-500">
                  VKN:{" "}
                  <span className="font-mono font-bold text-gray-800">{SELLER.taxNo}</span>
                </p>
                <p className="text-xs text-gray-500">
                  E-posta:{" "}
                  <span className="text-gray-700">{SELLER.email}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Tel:{" "}
                  <span className="text-gray-700">{SELLER.phone}</span>
                </p>
              </div>
            </div>

            {/* Alıcı */}
            <div
              className="rounded-xl p-4"
              style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                Alıcı / Müşteri
              </p>
              <p className="text-sm font-bold text-gray-900">{buyerName}</p>
              {corporateQuote?.contact_person && (
                <p className="text-xs text-gray-500 mt-0.5">
                  İlgili: {corporateQuote.contact_person}
                </p>
              )}
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                {buyerAddress}{buyerCity ? `, ${buyerCity}` : ""}
              </p>
              <div className="mt-2 space-y-0.5">
                <p className="text-xs text-gray-500">
                  E-posta:{" "}
                  <span className="text-gray-700">{order.buyer_email}</span>
                </p>
                {buyerProfile?.phone && (
                  <p className="text-xs text-gray-500">
                    Tel: <span className="text-gray-700">{buyerProfile.phone}</span>
                  </p>
                )}
                {buyerTax && (
                  <p className="text-xs text-gray-500">
                    Vergi:{" "}
                    <span className="font-mono font-bold text-gray-700">{buyerTax}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── KALEMLER TABLOSU ───────────────────────────────────────────── */}
          <div className="mb-8">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: "#059669" }}>
                  <th className="text-left text-white font-bold px-4 py-2.5 rounded-tl-lg" style={{ width: "42%" }}>
                    Ürün / Hizmet Açıklaması
                  </th>
                  <th className="text-center text-white font-bold px-3 py-2.5" style={{ width: "10%" }}>
                    Adet
                  </th>
                  <th className="text-right text-white font-bold px-3 py-2.5" style={{ width: "16%" }}>
                    Birim Fiyat (KDV Hariç)
                  </th>
                  <th className="text-right text-white font-bold px-3 py-2.5" style={{ width: "16%" }}>
                    KDV (%20)
                  </th>
                  <th className="text-right text-white font-bold px-4 py-2.5 rounded-tr-lg" style={{ width: "16%" }}>
                    Tutar (KDV Dahil)
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => (
                  <tr
                    key={i}
                    style={{ background: i % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #f3f4f6" }}
                  >
                    <td className="px-4 py-3 text-gray-800 font-medium leading-snug">
                      {item.description}
                      <span className="block text-gray-400 font-normal text-[10px]">
                        Otonom Drone Teknolojisi · Skytech Green
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-700 font-semibold">
                      {item.qty.toLocaleString("tr-TR")}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      {fmtTL(item.unitPrice)}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500">
                      {fmtTL(item.kdvTutar)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-bold">
                      {fmtTL(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Toplam kutusu */}
            <div className="flex justify-end mt-3">
              <div
                className="rounded-xl overflow-hidden w-64"
                style={{ border: "1px solid #e5e7eb" }}
              >
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
                  <span className="text-xs text-gray-500">Ara Toplam (KDV Hariç)</span>
                  <span className="text-xs font-semibold text-gray-700">{fmtTL(totals.kdvHaric)}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50" style={{ borderTop: "1px solid #f3f4f6" }}>
                  <span className="text-xs text-gray-500">KDV (%20)</span>
                  <span className="text-xs font-semibold text-gray-700">{fmtTL(totals.kdvTutar)}</span>
                </div>
                <div
                  className="flex justify-between items-center px-4 py-3"
                  style={{ background: "#059669" }}
                >
                  <span className="text-sm font-bold text-white">GENEL TOPLAM</span>
                  <span className="text-base font-black text-white">{fmtTL(totals.kdvDahil)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── ALT BİLGİ (Footer) ─────────────────────────────────────────── */}
          <div
            className="flex items-end justify-between gap-6 pt-6"
            style={{ borderTop: "1px solid #e5e7eb" }}
          >
            {/* Sol: yasal metin */}
            <div className="flex-1 space-y-2">
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "#9ca3af" }}
              >
                Bilgilendirme
              </p>
              <p className="text-[10px] text-gray-400 leading-relaxed max-w-lg">
                Bu belge sipariş ve ödeme bilgilerinizin özetidir; resmî fatura yerine geçmez.
                Resmî faturanız {SELLER.name} tarafından ayrıca düzenlenir.
              </p>
              <div className="flex items-center gap-4 pt-1">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: "#10b981" }}
                  />
                  <span className="text-[10px] text-gray-400">{SELLER.website}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: "#10b981" }}
                  />
                  <span className="text-[10px] text-gray-400">{SELLER.email}</span>
                </div>
              </div>
            </div>

            {/* Sağ: belge numarası (QR kaldırıldı: bağlantıyı üçüncü taraf servise gönderiyordu) */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="text-center space-y-0.5">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                  Belge No
                </p>
                <p className="font-mono text-[9px] text-gray-400">
                  {invoiceNo(order.id)}
                </p>
              </div>
            </div>
          </div>

          {/* ── Alt şerit ───────────────────────────────────────────────────── */}
          <div
            className="mt-6 rounded-xl px-4 py-3 flex items-center justify-between"
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🌳</span>
              <p className="text-[10px] text-emerald-700 font-medium">
                Bu satın alım ile doğaya{" "}
                <strong>{order.total_seeds.toLocaleString("tr-TR")} tohum</strong> kazandırıldı.
                Teşekkürler!
              </p>
            </div>
            <p className="text-[10px] text-emerald-600 font-mono shrink-0">
              {fmtDate(order.created_at)}
            </p>
          </div>

        </div>
        {/* /paper */}

        {/* Alt boşluk */}
        <div className="print-hidden h-10" />
      </div>
    </>
  );
}
