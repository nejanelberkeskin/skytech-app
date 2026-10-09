// Kurumsal uçlar (teklifler, çalışan dağıtımı) kullanıcıyı çerezdeki oturumdan DOĞRULAMADAN almamalı.
// `getSession()` sunucuda belirteci doğrulamaz: sahte çerez başka kullanıcının oturumunu döndürebilir. Uçlar kullanıcıyı
// kimlik sunucusuna sorarak (`getUser`) almalı; sahte çerez 401 alır ve hizmet rolüyle hiçbir sorgu ya da e-posta çalışmaz.
// Gerçek rota kaynakları; Supabase ve e-posta taklit. Ağ yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { loadSource } from './load-source.mjs';

const server = createRequire(import.meta.url)('next/server');
const { NextRequest } = server;

const KURBAN = '9a3f6c2e-7b1d-4e8a-b5c4-1d2e3f4a5b6c'; // sahte çerezde yazan, başka bir şirketin kullanıcısı
const GERCEK = '4c8e2a1f-3d5b-4f6a-9e7c-8b1a2d3c4e5f'; // kimlik sunucusunun doğruladığı kullanıcı
const TEKLIF = 'e7d6c5b4-a3f2-4e1d-8c9b-0a1f2e3d4c5b';

/** Supabase kimlik istemcisi: getSession her zaman KURBAN'ın (doğrulanmamış) oturumunu döndürür. */
function kimlik(dogrulanan) {
  return {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'sahte', user: { id: KURBAN } } }, error: null }),
      getUser: async () => (dogrulanan
        ? { data: { user: { id: dogrulanan } }, error: null }
        : { data: { user: null }, error: { message: 'invalid JWT', status: 403 } }),
    },
  };
}

/** Hizmet rolü istemcisi: her zinciri kaydeder; `await` edilince boş/verilen sonuç döner. */
function servis(kayit, sonuc = () => ({ data: [], error: null })) {
  return {
    from(tablo) {
      const zincir = { tablo, cagrilar: [] };
      kayit.push(zincir);
      const p = new Proxy(function () {}, {
        get(_, k) {
          if (k === 'then') return (coz, red) => Promise.resolve(sonuc(zincir)).then(coz, red);
          return (...a) => { zincir.cagrilar.push([k, ...a]); return p; };
        },
      });
      return p;
    },
  };
}

function rota(dosya, dogrulanan, { kayit = [], postalar = [], sonuc } = {}) {
  const mod = loadSource(dosya, {
    'next/server': server,
    '@/lib/supabase/server': { createSupabaseServer: async () => kimlik(dogrulanan), createServiceRoleClient: () => servis(kayit, sonuc) },
    '@/lib/mail': { sendEmployeeCertificateEmail: async (...a) => { postalar.push(a); return { ok: true }; } },
  });
  return { mod, kayit, postalar };
}
const eqUser = (kayit) => kayit.flatMap((z) => z.cagrilar).filter(([m, k]) => m === 'eq' && k === 'user_id').map(([, , v]) => v);

test('teklifler: sahte çerez (doğrulanmamış oturum) 401 alır, hiçbir sorgu çalışmaz', async () => {
  const { mod, kayit } = rota('app/api/kurumsal/quotes/route.ts', null);
  const res = await mod.GET();
  assert.equal(res.status, 401);
  assert.equal(kayit.length, 0);
});

test('teklifler: doğrulanmış kullanıcı yalnız KENDİ tekliflerini okur (çerezdeki kimlik değil)', async () => {
  const { mod, kayit } = rota('app/api/kurumsal/quotes/route.ts', GERCEK);
  const res = await mod.GET();
  assert.equal(res.status, 200);
  assert.deepEqual(eqUser(kayit), [GERCEK]);
});

test('çalışan listesi: sahte çerez 401, sorgu yok', async () => {
  const { mod, kayit } = rota('app/api/kurumsal/employees/route.ts', null);
  const res = await mod.GET(new NextRequest(`http://localhost:3000/api/kurumsal/employees?quote_id=${TEKLIF}`));
  assert.equal(res.status, 401);
  assert.equal(kayit.length, 0);
});

test('çalışan dağıtımı (POST): sahte çerez 401, sorgu ve e-posta yok', async () => {
  const { mod, kayit, postalar } = rota('app/api/kurumsal/employees/route.ts', null);
  const res = await mod.POST(new NextRequest('http://localhost:3000/api/kurumsal/employees', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quote_id: TEKLIF, recipient_name: 'Ayşe Örnek', recipient_email: 'ayse@example.invalid', seeds_allocated: 10 }),
  }));
  assert.equal(res.status, 401);
  assert.equal(kayit.length, 0);
  assert.equal(postalar.length, 0);
});

test('çalışan listesi: doğrulanmış kullanıcının teklifi kendi kimliğiyle denetlenir', async () => {
  const { mod, kayit } = rota('app/api/kurumsal/employees/route.ts', GERCEK, { sonuc: () => ({ data: null, error: null }) });
  await mod.GET(new NextRequest(`http://localhost:3000/api/kurumsal/employees?quote_id=${TEKLIF}`));
  assert.ok(eqUser(kayit).length >= 1);
  assert.ok(eqUser(kayit).every((v) => v === GERCEK), `eq user_id: ${eqUser(kayit)}`);
});

test('kaynak denetimi: sunucu uçları kullanıcıyı getSession() ile almaz', () => {
  const kok = new URL('../../app/api/', import.meta.url).pathname;
  const dosyalar = [];
  const gez = (d) => { for (const a of readdirSync(d)) { const y = join(d, a); if (statSync(y).isDirectory()) gez(y); else if (/\.tsx?$/.test(a)) dosyalar.push(y); } };
  gez(kok);
  // İstisna: eski sipariş özeti ucu 2. dalgada (#126) getUser'a geçiyor; o dosyaya burada dokunulmaz (çakışma olmasın).
  // Canlıda B2B kapısının arkasında (503). 2. dalga birleşince bu istisna kaldırılır.
  const ISTISNA = new Set(['orders/invoice/[orderId]/route.ts']);
  const ihlal = dosyalar.filter((f) => /auth\.getSession\s*\(/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(kok.length))
    .filter((f) => !ISTISNA.has(f));
  assert.deepEqual(ihlal, []);
});
