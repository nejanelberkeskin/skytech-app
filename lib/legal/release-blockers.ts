/**
 * Hukuki metin sürümünün kesinleşmesini (lib/legal/version.ts'den "-taslak" ekinin kaldırılmasını) engelleyen açık
 * işler — Astra hukuk paketi 2026-10.5. Liste boşalmadan sürüm kesinleşmez; `legal-release` testi bunu zorlar.
 * Yürürlük tarihi gerçek yayın günü yazılır (otomatik tarih yok).
 * Avukat incelemesi: kullanıcı bildirimi, 12 Ekim 2026 — hazırlanan metinlere avukat onay verdi.
 */
export const LEGAL_RELEASE_BLOCKERS: readonly { key: string; owner: string; text: string }[] = [
  { key: "transfer_annex", owner: "şirket + sağlayıcılar", text: "KVKK m.9 aktarım eki: Vercel, Supabase, Resend, Google Workspace için gerçek sözleşme tarafı, ülkeler, imzalı güvence ve Kurul bildirimi kanıtı." },
  { key: "retention_jobs", owner: "teknik + şirket", text: "Saklama ve imha planındaki silme görevleri (talep 12 ay, profil 30 gün, günlük 90 gün) uygulanıp doğrulanmalı." },
];
