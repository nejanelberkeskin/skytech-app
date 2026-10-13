/**
 * Hukuki metin sürümünün kesinleşmesini engelleyen açık işler. Boş değilse sürüm "-taslak" kalmak zorundadır
 * (`legal-release` testi). Yürürlük tarihi gerçek yayın günü yazılır.
 *
 * 12 Ekim 2026: avukat onayı (kullanıcı bildirimi); kullanıcı kararıyla metinler sektördeki genel uygulama gibi
 * sadeleştirildi (2026-10.6) ve sürüm kesinleşti. Aşağıdaki uyum işleri metni engellemez ama sürdürülür.
 */
export const LEGAL_RELEASE_BLOCKERS: readonly { key: string; owner: string; text: string }[] = [];

/** Sürümü engellemeyen, sürdürülen uyum işleri (metin bunları yapılmış gibi beyan etmez). */
export const LEGAL_COMPLIANCE_FOLLOWUPS: readonly { key: string; owner: string; text: string }[] = [
  { key: "transfer_contracts", owner: "şirket + sağlayıcılar", text: "KVKK m.9: Google Workspace (Türk SCC seçeneği), Supabase, Vercel, Resend ile Kurul standart sözleşmesi (Model 2) ve 5 iş günü içinde Kurul bildirimi." },
  { key: "retention_jobs", owner: "teknik", text: "Saklama/imha görevleri (talep, profil, günlük, bildirim gövdesi) ve imha günlüğü; payments FK düzeltmesi." },
];
