import type { Permission, Scope } from "@/lib/admin/permission-keys";
export const permissionLabels: Record<Permission, string> = {
  "orders.read": "Siparişleri görme",
  "orders.note": "Siparişe iç not ekleme",
  "orders.assign": "Sipariş sorumlusu atama",
  "orders.cancel": "Siparişi iptal etme",
  "orders.documents.read": "Tam sipariş belgelerini açma",
  "orders.export": "Siparişleri dışa aktarma",
  "customers.contact.read": "Müşteri iletişim bilgilerini görme",
  "customers.tax.read": "Kimlik ve vergi bilgilerini görme",
  "customers.export": "Müşterileri dışa aktarma",
  "refunds.request": "İade talep etme",
  "refunds.approve": "İadeyi onaylama",
  "refunds.execute": "İade gerçekleştirme ve mutabakat",
  "invoices.read": "Faturaları görme",
  "invoices.manage": "Fatura kaydı yönetme",
  "finance.read": "Finans özetini görme",
  "sites.read": "Sahaları görme",
  "sites.edit": "Saha bilgilerini düzenleme",
  "sites.publish": "Saha yayımlama",
  "sites.capacity.manage": "Saha kapasitesini değiştirme",
  "batches.read": "Partileri görme",
  "batches.plan": "Parti planlama",
  "batches.assign": "Partiye sipariş atama",
  "batches.release": "Bırakmayı kesinleştirme",
  "monitoring.edit": "İzleme kaydı düzenleme",
  "monitoring.review": "İzleme kaydı inceleme",
  "monitoring.publish": "İzleme raporu yayımlama",
  "certificates.read_private": "Özel sertifikayı açma",
  "certificates.resend": "Sertifikayı yeniden gönderme",
  "requests.read": "Talepleri görme",
  "requests.assign": "Talep sorumlusu atama",
  "requests.update": "Talep güncelleme",
  "messages.send": "Müşteriye ileti gönderme",
  "content.edit": "İçerik düzenleme",
  "content.publish": "İçerik yayımlama",
  "media.upload": "Medya yükleme",
  "legal.edit": "Hukuki metin düzenleme",
  "legal.publish": "Hukuki metin yayımlama",
  "staff.invite": "Personel davet etme",
  "staff.manage": "Personel yönetme",
  "roles.manage": "Rol ve erişim atama",
  "audit.read": "İşlem geçmişini görme",
  "sales.pause": "Satışı durdurma",
  "sales.resume": "Satışı açma",
  "sales.pricing.manage": "Satış bedelini değiştirme",
  "system.readiness.read": "Sistem hazırlığını görme",
  "system.jobs.run": "Zamanlanmış işi elle çalıştırma",
};
export function scopeLabel(
  scope: Scope,
  sites: {
    id: string;
    name: string;
  }[] = [],
): string {
  if (scope.kind === "all") return "Tüm kayıtlar";
  if (scope.kind === "assigned") return "Kişiye atanmış işler";
  return (
    scope.siteIds
      .map((id) => sites.find((s) => s.id === id)?.name ?? `Saha ${id}`)
      .join(", ") || "Saha seçilmedi"
  );
}
export function toExpiry(local: string): string | null {
  if (!local) return null;
  // Form açıkça Türkiye saati ister; tarayıcının saat dilimini kullanma.
  const date = new Date(`${local}${local.length === 16 ? ":00" : ""}+03:00`);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Geçerli bir bitiş tarihi girin.");
  if (date.getTime() <= Date.now())
    throw new Error("Erişim bitişi gelecekte olmalı.");
  return date.toISOString();
}
export function expiryInput(iso: string | null): string {
  return iso
    ? new Date(Date.parse(iso) + 3 * 3600000).toISOString().slice(0, 19)
    : "";
}
export const permissionLabel = (key: string): string =>
  permissionLabels[key as Permission] ?? key;
