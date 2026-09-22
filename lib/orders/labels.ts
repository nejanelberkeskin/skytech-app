/** Sipariş durumları ve olayları — yönetim panelinde gösterilen Türkçe adlar (saf). */
import type { OrderEventType, OrderStatus } from "./types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Taslak",
  awaiting_payment: "Ödeme bekliyor",
  payment_failed: "Ödeme başarısız",
  expired: "Süresi doldu",
  paid: "Ödendi (cayma süresi)",
  confirmed: "Kesinleşti",
  scheduled: "Partiye alındı",
  released: "Bırakıldı",
  monitoring: "İzleme dönemi",
  completed: "Tamamlandı",
  withdrawal_requested: "Cayma bildirildi",
  cancelled_by_seller: "Satıcı iptali",
  refunded: "İade edildi",
};

export const ORDER_EVENT_LABELS: Record<OrderEventType, string> = {
  order_created: "Sipariş oluşturuldu",
  consent_recorded: "Onaylar kaydedildi",
  documents_generated: "Belgeler üretildi",
  payment_started: "Ödeme başlatıldı",
  payment_succeeded: "Ödeme onaylandı",
  payment_failed: "Ödeme başarısız",
  order_expired: "Ödeme süresi doldu",
  email_sent: "E-posta gönderildi",
  email_failed: "E-posta gönderilemedi",
  status_changed: "Durum değişti",
  withdrawal_requested: "Cayma bildirimi alındı",
  withdrawal_cancelled: "Cayma bildirimi geri alındı",
  refund_started: "İade başlatıldı",
  refund_succeeded: "İade yapıldı",
  refund_failed: "İade başarısız",
  invoice_issued: "Fatura kesildi",
  batch_assigned: "Partiye atandı",
  release_completed: "Bırakma tamamlandı",
  certificate_issued: "Sertifika düzenlendi",
  certificate_cancelled: "Sertifika iptal edildi",
  video_notified: "Video bildirimi gönderildi",
  admin_note: "Yönetici notu",
};

export const REFUND_REASON_LABELS: Record<string, string> = {
  withdrawal: "Cayma",
  seller_cancellation: "Satıcı iptali",
  non_performance: "İfa edilemedi",
  other: "Diğer",
};

export const REFUND_STATUS_LABELS: Record<string, string> = { pending: "Bekliyor", succeeded: "Yapıldı", failed: "Başarısız" };
export const INVOICE_STATUS_LABELS: Record<string, string> = { pending: "Kesilecek", issued: "Kesildi", cancelled: "İptal", failed: "Hata" };

export const CONSENT_LABELS: Record<string, string> = {
  preInfo: "Ön Bilgilendirme Formu teyidi",
  contract: "Mesafeli Hizmet Sözleşmesi kabulü",
  kvkkRead: "KVKK aydınlatma metni okundu",
  marketing: "Ticari ileti izni (isteğe bağlı)",
  certificatePublication: "Kendi adını sertifikada yayımlama izni (isteğe bağlı)",
  corporateAuthority: "Kurum adına yetki beyanı",
};

export const DOCUMENT_LABELS: Record<string, string> = {
  pre_info: "Ön Bilgilendirme Formu",
  contract: "Mesafeli Hizmet Sözleşmesi",
  withdrawal_form: "Cayma Formu",
  kvkk_notice: "KVKK Aydınlatma Metni",
};

/** Müşteriye gösterilen durum adları (Hesabım). Sipariş sayfasındaki çevirilerle aynı sözcükler. */
export const CUSTOMER_STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  paid: "Ödendi",
  confirmed: "Kesinleşti",
  scheduled: "Planlandı",
  released: "Bırakıldı",
  monitoring: "İzlemede",
  completed: "Tamamlandı",
  withdrawal_requested: "Cayma bildirildi",
  cancelled_by_seller: "İptal edildi",
  refunded: "İade edildi",
};

export const CUSTOMER_STATUS_HINTS: Partial<Record<OrderStatus, string>> = {
  paid: "Siparişiniz kesinleşti; 14 günlük cayma süresi işliyor.",
  confirmed: "Cayma süresi tamamlandı; siparişiniz bırakma planına alınabilir.",
  scheduled: "Siparişiniz bir bırakma çalışmasına atandı.",
  released: "Tohum toplarınız sahaya bırakıldı; Katılım Sertifikanız düzenlendi.",
  monitoring: "Saha inceleniyor, izleniyor ve raporlanıyor.",
  completed: "Çalışmanın görüntüleri paylaşıldı.",
  withdrawal_requested: "Cayma bildiriminiz alındı; bedelin tamamı 14 gün içinde iade edilir.",
  cancelled_by_seller: "Sipariş tarafımızca iptal edildi; bedelin tamamı iade edilir.",
  refunded: "Bedelin tamamı iade edildi.",
};
