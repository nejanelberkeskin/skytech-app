// Saklama/imha denetimi (Astra hukuk paketi 2026-10.5, işler 9 ve 11) — yalnız sentetik veri, PGlite.
// Canlı veritabanına, e-posta sağlayıcısına ya da İYS'ye hiçbir istek atılmaz.
//
// Kapsam:
//   (a) Üye silme: yeni model sipariş arşivi (release_orders + belge/olay/fatura) kalır, kişi bağı kopar;
//       eski (legacy) ödeme satırı ise CASCADE ile silinir — BULGU; taslak düzeltme (_taslak_saklama_odeme_fk.sql) sınanır.
//   (b) Pazarlama: kampanya gönderen kod yolu ve pazarlama kuyruğu YOK; bildirim kuyruğu kapalı işlem şablonu listesidir.
//   (c) İşlem e-postaları: müşteriye giden şablonlarda kampanya/tanıtım içeriği yok.
//   (d) "Talebime dönün" onayı ile ticari ileti izni ayrı alanlarda; talep kaydında pazarlama alanı yok.
//
// Eski tabloların (profiles, orders, payments, certificates, corporate_quotes, user_rewards) yapısı repoda migration
// olarak yok; aşağıdaki LEGACY şeması canlı şema kopyasının (skytech-prova-dalga2, 039 sonrası) FK silme kurallarıyla
// birebir kurulmuştur (12 Ekim 2026 katalog sorgusu: outputs/claude-saklama-imha/KARSILASTIRMA.md, Ek A).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createDb, insertOrder, one, rows, sqlError } from './pglite-db.mjs';
import { loadSource } from './load-source.mjs';
import * as requestLabels from '../../lib/requests/labels.ts';
import { consentsSchema } from '../../lib/orders/schema.ts';
import { contactSchema } from '../../lib/requests/schema.ts';
import { isSuspendedApi } from '../../lib/site-config.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const USER = 'aaaaaaaa-0000-0000-0000-00000000000a';
const B2B_USER = 'aaaaaaaa-0000-0000-0000-00000000000d';

const LEGACY = `
  ALTER TABLE auth.users ADD COLUMN email text, ADD COLUMN raw_user_meta_data jsonb;
  CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, full_name text, email text, phone text, created_at timestamptz DEFAULT now(), updated_at timestamptz);
  CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), buyer_email text NOT NULL, user_id uuid, total_seeds integer NOT NULL,
    referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL CONSTRAINT payments_order_id_fkey REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id uuid CONSTRAINT payments_user_id_fkey REFERENCES auth.users(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL, status text DEFAULT 'pending', created_at timestamptz DEFAULT now());
  CREATE TABLE public.certificates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id), order_id uuid REFERENCES public.orders(id), recipient_name text NOT NULL);
  CREATE TABLE public.corporate_quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id), company_name text, corporate_email text);
  CREATE TABLE public.user_rewards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL);`;

/** Canlı kopyadaki auth.users'a dayanan FK silme kuralları (12 Ekim 2026, skytech-prova-dalga2). */
const LIVE_AUTH_FK = {
  'admin_users.user_id': 'CASCADE',
  'certificates.user_id': 'NO ACTION',
  'corporate_quotes.user_id': 'NO ACTION',
  'payments.user_id': 'CASCADE',
  'profiles.id': 'CASCADE',
  'release_orders.user_id': 'SET NULL',
  'service_requests.handled_by': 'SET NULL',
  'service_requests.user_id': 'SET NULL',
  'system_settings.updated_by': 'NO ACTION',
  'user_rewards.user_id': 'CASCADE',
};

async function setup({ draft = false } = {}) {
  const db = await createDb();
  await db.exec(LEGACY);
  await db.exec(read('supabase/migrations/014_service_requests.sql'));
  await db.exec('CREATE TABLE IF NOT EXISTS email_logs(id uuid DEFAULT gen_random_uuid(),template text,recipient_email text,subject text,related_id text,resend_id text,status text);');
  await db.exec(read('supabase/migrations/036_notification_outbox.sql'));
  if (draft) await db.exec(read('supabase/migrations/_taslak_saklama_odeme_fk.sql'));
  return db;
}

/** Üye + profil + gerçek (deneme olmayan) yeni model sipariş + belge/olay/fatura + talep + eski sipariş/ödeme. */
async function seedMember(db) {
  await db.query(`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,'silinecek@example.invalid','{"full_name":"Sentetik Kişi"}')`, [USER]);
  const orderId = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
  await db.query(`UPDATE release_orders SET user_id=$1, buyer_email='silinecek@example.invalid', marketing_consent=true WHERE id=$2`, [USER, orderId]);
  await db.query(`UPDATE release_orders SET status='paid', paid_at=now() WHERE id=$1`, [orderId]);
  await db.query(`INSERT INTO order_events(order_id,type,actor,data) VALUES ($1,'order_created','system','{}')`, [orderId]);
  await db.query(`INSERT INTO order_documents(order_id,kind,template_version,locale,title,html,sha256) VALUES ($1,'contract','test','tr','Sözleşme','<p>s</p>',repeat('a',64))`, [orderId]);
  await db.query(`INSERT INTO order_invoices(order_id) VALUES ($1)`, [orderId]);
  await db.query(`INSERT INTO service_requests(request_no,type,user_id,contact_name,email) VALUES ('TLP-SENTETIK','seed_purchase',$1,'Sentetik Kişi','silinecek@example.invalid')`, [USER]);
  const legacy = await one(db, `INSERT INTO orders(buyer_email,user_id,total_seeds) VALUES ('silinecek@example.invalid',$1,10) RETURNING id`, [USER]);
  await db.query(`INSERT INTO payments(order_id,user_id,amount,status) VALUES ($1,$2,100,'success')`, [legacy.id, USER]);
  return { orderId, legacyOrderId: legacy.id };
}

const counts = async (db, orderId) => ({
  events: (await one(db, 'SELECT count(*)::int n FROM order_events WHERE order_id=$1', [orderId])).n,
  documents: (await one(db, 'SELECT count(*)::int n FROM order_documents WHERE order_id=$1', [orderId])).n,
  invoices: (await one(db, 'SELECT count(*)::int n FROM order_invoices WHERE order_id=$1', [orderId])).n,
  outbox: (await one(db, 'SELECT count(*)::int n FROM order_notification_outbox WHERE order_id=$1', [orderId])).n,
});

// ── (a) Üye silme ve kanuni arşiv ──────────────────────────────────────────────────────────────────────────────

test('saklama (a1): üye silinince yeni model sipariş, belge, olay ve fatura kalır; profil silinir, sipariş/talep bağı kopar', async () => {
  const db = await setup();
  try {
    const { orderId } = await seedMember(db);
    assert.equal((await one(db, 'SELECT count(*)::int n FROM profiles WHERE id=$1', [USER])).n, 1, 'profil Auth tetikleyicisiyle oluştu (014)');
    const before = await counts(db, orderId);
    assert.ok(before.outbox >= 1, 'ödeme bildirimi kuyruğa girdi');

    await db.query('DELETE FROM auth.users WHERE id=$1', [USER]);

    assert.equal((await one(db, 'SELECT count(*)::int n FROM profiles WHERE id=$1', [USER])).n, 0, 'profil CASCADE ile silindi');
    const order = await one(db, 'SELECT user_id, buyer_email, marketing_consent FROM release_orders WHERE id=$1', [orderId]);
    assert.ok(order, 'sipariş (kanuni arşiv) duruyor');
    assert.equal(order.user_id, null, 'hesap bağı koptu (SET NULL)');
    assert.equal(order.buyer_email, 'silinecek@example.invalid', 'arşivdeki alıcı bilgisi siparişin parçası olarak kalır');
    assert.deepEqual(await counts(db, orderId), before, 'belge/olay/fatura/bildirim sayısı değişmedi; silme yeni bildirim üretmedi');
    const req = await one(db, "SELECT user_id, email FROM service_requests WHERE request_no='TLP-SENTETIK'");
    assert.equal(req.user_id, null);
    assert.equal(req.email, 'silinecek@example.invalid', 'BOŞLUK: talep iletişim verisi kalır; 12 aylık öneriyi uygulayan görev yok');
    // Kanuni arşiv kişisel bağ koptuktan sonra da pazarlama bayrağını taşır: kampanya kaynağı olarak kullanılmamalı (bkz. b2).
    assert.equal(order.marketing_consent, true);
  } finally { await db.close(); }
});

test('saklama (a2): gerçek sipariş, olay ve belge doğrudan da silinemez; fatura satırında silme yasağı yok (BULGU P3)', async () => {
  const db = await setup();
  try {
    const { orderId } = await seedMember(db);
    assert.match(await sqlError(db.query('DELETE FROM release_orders WHERE id=$1', [orderId])), /silinemez/);
    assert.match(await sqlError(db.query('DELETE FROM order_events WHERE order_id=$1', [orderId])), /silinemez/);
    assert.match(await sqlError(db.query('DELETE FROM order_documents WHERE order_id=$1', [orderId])), /silinemez/);
    // BULGU (P3): fatura ve iade satırlarında silme yasağı tetikleyicisi yok; sipariş silinemediği için toplu kayıp olmaz,
    // ama service_role tekil fatura satırını silebilir. Uygulama kodunda böyle bir silme yok (a6).
    assert.equal(await sqlError(db.query('DELETE FROM order_invoices WHERE order_id=$1', [orderId])), null);
    assert.equal((await one(db, 'SELECT count(*)::int n FROM release_orders WHERE id=$1', [orderId])).n, 1);
  } finally { await db.close(); }
});

test('saklama (a3) BULGU: üye silinince eski ödeme satırı CASCADE ile kaybolur, eski sipariş kalır (mevcut canlı kural)', async () => {
  const db = await setup();
  try {
    const { legacyOrderId } = await seedMember(db);
    await db.query('DELETE FROM auth.users WHERE id=$1', [USER]);
    assert.equal((await one(db, 'SELECT count(*)::int n FROM orders WHERE id=$1', [legacyOrderId])).n, 1);
    assert.equal((await one(db, 'SELECT count(*)::int n FROM payments WHERE order_id=$1', [legacyOrderId])).n, 0,
      'RİSK: ödeme kaydı sessizce silindi — taslak düzeltme uygulanana kadar üye silme muhasebe arşivini bozar');
  } finally { await db.close(); }
});

test('saklama (a4): taslak FK düzeltmesiyle ödeme satırı kalır, kişi bağı kopar; eski sipariş ödemesiyle birlikte sessizce silinemez', async () => {
  const db = await setup({ draft: true });
  try {
    const { orderId, legacyOrderId } = await seedMember(db);
    await db.query('DELETE FROM auth.users WHERE id=$1', [USER]);
    const pay = await rows(db, 'SELECT user_id FROM payments WHERE order_id=$1', [legacyOrderId]);
    assert.equal(pay.length, 1, 'ödeme kaydı korundu');
    assert.equal(pay[0].user_id, null, 'kişi bağı koptu');
    assert.equal((await one(db, 'SELECT count(*)::int n FROM profiles WHERE id=$1', [USER])).n, 0);
    assert.equal((await one(db, 'SELECT count(*)::int n FROM release_orders WHERE id=$1', [orderId])).n, 1);
    assert.match(await sqlError(db.query('DELETE FROM orders WHERE id=$1', [legacyOrderId])), /foreign key|violates/i);
  } finally { await db.close(); }
});

test('saklama (a5) BULGU: kurumsal teklif ya da eski sertifika sahibi üye silinemez (NO ACTION) — silme/anonimleştirme süreci tanımsız', async () => {
  const db = await setup({ draft: true });
  try {
    await db.query(`INSERT INTO auth.users(id,email) VALUES ($1,'b2b@example.invalid')`, [B2B_USER]);
    await db.query(`INSERT INTO corporate_quotes(user_id,company_name,corporate_email) VALUES ($1,'Sentetik AŞ','b2b@example.invalid')`, [B2B_USER]);
    assert.match(await sqlError(db.query('DELETE FROM auth.users WHERE id=$1', [B2B_USER])), /foreign key|violates/i);
    assert.equal((await one(db, 'SELECT count(*)::int n FROM corporate_quotes WHERE user_id=$1', [B2B_USER])).n, 1, 'veri kaybı yok, ama silme talebi elle çözülmeli');
  } finally { await db.close(); }
});

test('saklama (a6): repo migrationlarındaki auth.users FK kuralları canlı kopyayla aynı; hesap silme ucu ve kişisel veri silen görev yok', async () => {
  const db = await setup();
  try {
    const fk = await rows(db, `SELECT conrelid::regclass::text || '.' || a.attname AS col,
        CASE confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' END AS rule
      FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
      WHERE contype='f' AND confrelid='auth.users'::regclass`);
    for (const { col, rule } of fk) {
      const key = col.replace(/^public\./, '');
      if (key in LIVE_AUTH_FK) assert.equal(rule, LIVE_AUTH_FK[key], `${key}`);
    }
    assert.ok(fk.some((r) => r.col.endsWith('release_orders.user_id')) && fk.some((r) => r.col.endsWith('service_requests.user_id')));
  } finally { await db.close(); }
  const files = walk('app').concat(walk('lib'));
  const deleteUser = files.filter((f) => /auth\.admin\.deleteUser|deleteUser\(/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(deleteUser, [], 'uygulamada hesap silme yolu yok (bugün yalnız Supabase panelinden elle)');
  const cronJobs = JSON.parse(read('vercel.json')).crons.map((c) => c.path).sort();
  assert.deepEqual(cronJobs, ['/api/cron/b2b-odeme-mutabakati', '/api/cron/bildirimler', '/api/cron/siparis-isleri'], 'saklama/imha görevi yok; yeni kalıcı silme görevi eklenmedi');
  const personalTables = /from\("(profiles|service_requests|release_orders|email_logs|order_notification_outbox|admin_audit_logs|corporate_quotes|payments)"\)\s*\.delete\(/;
  assert.deepEqual(files.filter((f) => personalTables.test(readFileSync(f, 'utf8'))), [], 'kişisel veri tablolarında uygulama içi silme yok');
});

// ── (b) Pazarlama / İYS ────────────────────────────────────────────────────────────────────────────────────────

function walk(dir) {
  const out = [];
  const go = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) go(p);
      else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p);
    }
  };
  go(new URL(dir, ROOT).pathname);
  return out;
}

test('saklama (b1): kampanya/toplu gönderim kod yolu yok; e-posta yalnız lib/mail.ts üzerinden, bilinen işlem şablonlarıyla gider', () => {
  const files = walk('app').concat(walk('lib'), walk('components'));
  const providerCallers = files.filter((f) => /api\.resend\.com/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(providerCallers.map((f) => f.slice(f.indexOf('lib/'))), ['lib/mail.ts'], 'sağlayıcıya yalnız lib/mail.ts gider');
  const campaign = /(broadcast|audiences|batch\/?emails|\/emails\/batch|newsletter|campaign|kampanya[A-Z_]|sendMarketing|sendCampaign|iys\.|iys-api|ileti-yonetim)/;
  const hits = files.filter((f) => !f.includes('/lib/legal/templates/') && campaign.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits, [], 'kampanya, liste ya da İYS entegrasyonu kodu yok');
  const mail = read('lib/mail.ts');
  const exported = [...mail.matchAll(/export (?:async )?function (send\w+)|export const (send\w+)/g)].map((m) => m[1] ?? m[2]).sort();
  assert.deepEqual(exported, ['sendB2BQuoteReadyEmail', 'sendContactFormNotification', 'sendEmployeeCertificateEmail', 'sendFrozenNotification',
    'sendRefundCompleted', 'sendSellerCancellationNotice', 'sendServiceRequestConfirmation', 'sendServiceRequestNotification', 'sendStaffInvitation'].sort(),
    'yeni bir gönderim fonksiyonu eklenirse bu denetim ve İYS kararı yeniden gözden geçirilmeli');
  // Ticari ileti izni hiçbir sorguda alıcı seçmek için kullanılmıyor; İYS senkron alanı yazılmıyor.
  const usesConsentAsFilter = files.filter((f) => /\.(eq|is|filter|match)\(\s*["'](marketing_consent|iys_synced_at)/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(usesConsentAsFilter, []);
  assert.deepEqual(files.filter((f) => /iys_synced_at/.test(readFileSync(f, 'utf8'))), [], 'iys_synced_at kolonu kodda hiç yazılmıyor/okunmuyor (İYS kurulmadı)');
});

test('saklama (b2): bildirim kuyruğu kapalı işlem şablonu listesi; pazarlama şablonu eklenemez, izin bayrağı kuyruğu değiştirmez', async () => {
  const db = await setup();
  try {
    const tmpl = /template text NOT NULL CHECK \(template IN \(([^)]*)\)\)/.exec(read('supabase/migrations/036_notification_outbox.sql'))[1];
    assert.deepEqual(tmpl.replace(/'/g, '').split(',').sort(), ['release_certificate', 'release_order_confirm', 'release_order_notify', 'release_video', 'release_withdrawal_notify', 'release_withdrawal_receipt']);
    const orderId = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
    assert.match(await sqlError(db.query(`INSERT INTO order_notification_outbox(order_id,template,source) VALUES ($1,'campaign','{}')`, [orderId])), /check|violates/i);
    const withConsent = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
    await db.query('UPDATE release_orders SET marketing_consent=true WHERE id=$1', [withConsent]);
    for (const id of [orderId, withConsent]) await db.query("UPDATE release_orders SET status='paid', paid_at=now() WHERE id=$1", [id]);
    const set = async (id) => (await rows(db, 'SELECT template FROM order_notification_outbox WHERE order_id=$1 ORDER BY template', [id])).map((r) => r.template);
    assert.ok((await set(orderId)).length > 0, 'ödeme işlem bildirimleri kuyrukta');
    assert.deepEqual(await set(withConsent), await set(orderId), 'ticari ileti izni ek gönderim üretmez');
    // Ret/geri alma: ayrı pazarlama kuyruğu olmadığı için durdurulacak kuyruk da yok; izin geri alma ucu da yok (boşluk).
    const files = walk('app').concat(walk('lib'));
    assert.deepEqual(files.filter((f) => /marketing_consent\s*:\s*false|marketing_consent=false|revokeMarketing|marketing.*revokedAt/.test(readFileSync(f, 'utf8'))), [],
      'BOŞLUK: ticari ileti iznini geri alma/ret kaydı yolu yok (info@ üzerinden elle)');
  } finally { await db.close(); }
});

// ── (c) İşlem e-postalarında tanıtım içeriği ───────────────────────────────────────────────────────────────────

const PROMO = /kampanya|indirim|fırsat|promosyon|bülten|abone ol|kupon|yeni sahalar|hemen (satın|sipariş)|davet kodu|referans kodu|instagram|facebook|linkedin|twitter|wa\.me|whatsapp|discount|campaign|promo|newsletter|subscribe|coupon|special offer/i;

function loadMail(logs = []) {
  return loadSource('lib/mail.ts', {
    '@/lib/supabase/server': { createServiceRoleClient: () => ({ from: (table) => ({ insert: async (row) => { logs.push({ table, row }); return { error: null }; } }) }) },
    '@/lib/requests/labels': requestLabels,
  });
}

async function captureSend(send, input) {
  const realFetch = globalThis.fetch;
  const savedKey = process.env.RESEND_API_KEY;
  const calls = [];
  process.env.RESEND_API_KEY = 'test-anahtari-gonderilmez';
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ id: 'taklit' }) }; };
  try { await send(input); return calls; } finally {
    globalThis.fetch = realFetch;
    if (savedKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = savedKey;
  }
}

test('saklama (c1): müşteriye giden işlem e-postaları (TR/EN) kampanya, sosyal ağ ya da indirim içeriği taşımaz', async () => {
  const mail = loadMail();
  const base = { orderId: 'o-1', orderNo: 'SG-2026-AAAAAA', email: 'alici@example.invalid', firstName: 'Deneme', siteName: 'Ana Saha', totalText: '200,00 TL', isTest: false };
  for (const locale of ['tr', 'en', 'ru']) {
    const bodies = [
      mail.prepareOrderConfirmation({ ...base, locale, quantity: 20, certificateName: 'Deneme Kişi', performanceDeadlineText: '31 Mart 2027', withdrawalLastDayText: '1 Kasım 2026', orderUrl: 'https://example.invalid/s', attachments: [] }),
      mail.prepareWithdrawalReceipt({ ...base, locale, receivedOnText: '1 Kasım 2026', refundDueOnText: '15 Kasım 2026' }),
      mail.prepareReleaseCertificate({ ...base, locale, certificateName: 'Deneme Kişi', quantityText: '20', releasedOnText: '12 Kasım 2026', certificateUrl: 'https://example.invalid/c', orderUrl: 'https://example.invalid/s' }),
      mail.prepareVideoPublished({ ...base, locale, videoUrl: 'https://example.invalid/v', releasedOnText: '12 Kasım 2026', siteUrl: 'https://example.invalid/saha', orderUrl: 'https://example.invalid/s' }),
    ];
    for (const b of bodies) {
      assert.equal(b.to, 'alici@example.invalid');
      assert.doesNotMatch(b.subject + b.html, PROMO, `${locale}: ${b.subject}`);
    }
    for (const send of [mail.sendSellerCancellationNotice, mail.sendRefundCompleted]) {
      const calls = await captureSend(send, { ...base, locale, dateText: '5 Kasım 2026' });
      assert.equal(calls.length, 1);
      assert.doesNotMatch(calls[0].body.subject + calls[0].body.html, PROMO);
    }
  }
  const request = { id: '5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', request_no: 'TLP-PROVA1', type: 'seed_purchase', status: 'new', user_id: null, contact_name: 'Deneme',
    email: 'alici@example.invalid', phone: null, company: null, locale: 'tr', land_id: null, total_seeds: 100, seed_items: [], message: null, consent_at: '2026-10-01T08:00:00Z',
    consent_version: 'v1', ip_hash: null, user_agent: null, source_path: '/talep', admin_note: null, handled_by: null, handled_at: null,
    created_at: '2026-10-01T08:00:00Z', updated_at: '2026-10-01T08:00:00Z', details: {} };
  const calls = await captureSend(mail.sendServiceRequestConfirmation, { request, landName: null, accountLink: false });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].body.subject + calls[0].body.html, PROMO, 'talep teyidi tanıtım içermez');
});

test('saklama (c2) BULGU: kapalı B2B çalışan sertifikası e-postası paylaşım çağrısı (WhatsApp) taşır; uç bayrak kapalıyken 503', () => {
  const mail = read('lib/mail.ts');
  const employee = mail.slice(mail.indexOf('export async function sendEmployeeCertificateEmail'), mail.indexOf('// CONTACT FORM') > 0 ? mail.indexOf('// CONTACT FORM') : mail.indexOf('export async function sendContactFormNotification'));
  assert.match(employee, /wa\.me/, 'B2B açılmadan önce gözden geçirilmeli');
  assert.equal(isSuspendedApi('/api/kurumsal/employees'), true, 'TRANSACTIONS_ENABLED kapalı: uç 503');
});

// ── (d) "Talebime dönün" ≠ ticari ileti izni ───────────────────────────────────────────────────────────────────

test('saklama (d1): talep onayı yalnız aydınlatma + talebe dönüş; pazarlama alanı yok ve gönderilse de saklanmaz', () => {
  const parsed = contactSchema.parse({ contactName: 'Deneme Kişi', email: 'a@example.invalid', consent: true, marketing: true, locale: 'tr' });
  assert.equal('marketing' in parsed, false, 'istemci pazarlama alanı gönderse bile talep şemasından düşer');
  assert.equal(parsed.consent, true);
  const sr = read('supabase/migrations/014_service_requests.sql');
  const table = sr.slice(sr.indexOf('CREATE TABLE'), sr.indexOf(');', sr.indexOf('CREATE TABLE')));
  assert.doesNotMatch(table, /marketing|iys|ticari/i, 'service_requests tablosunda pazarlama izni kolonu yok');
  const route = read('app/api/public/talep/route.ts');
  assert.doesNotMatch(route, /marketing/i, 'talep ucu ticari ileti izni yazmaz');
  const tr = JSON.parse(read('messages/tr.json'));
  assert.match(tr.requestForms.common.consent, /Talebimle ilgili/);
  assert.doesNotMatch(tr.requestForms.common.consent, /kampanya|ticari ileti|tanıtım/i);
});

test('saklama (d2): siparişte ticari ileti izni ayrı, isteğe bağlı ve varsayılan kapalı; zorunlu onaylardan türetilmez', () => {
  const required = { preInfo: true, contract: true };
  assert.equal(consentsSchema.parse(required).marketing, false, 'işaretlenmezse false');
  assert.equal(consentsSchema.safeParse({ ...required, marketing: true }).success, true);
  assert.equal(consentsSchema.safeParse({ marketing: true }).success, false, 'pazarlama izni zorunlu onayların yerine geçmez');
  const create = read('lib/orders/create.ts');
  assert.match(create, /marketing_consent:\s*MARKETING_CONSENT_ENABLED && payload\.consents\.marketing/, 'yalnız kutunun kendisinden ve İYS bayrağı açıkken yazılır');
});
