// P2 ret açıklamasının yaşam döngüsü (lib/admin-context.tsx). Astra'nın #103 P3 yöntemi: GERÇEK AdminProvider kaynağı,
// denetimli React kancaları ve yanıtı elle bırakılan taşıma ile olay sırası sınanır. Tarayıcı ve ağ yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../lib/admin-context.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  fileName: 'admin-context.tsx',
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

/** Sağlayıcıyı kancaları sırayla saklayarak "render" eder; `/api/admin/me` yanıtları elle bırakılır. */
function saglayici() {
  let position = 0;
  const slots = [];
  const bekleyen = [];
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState: (initial) => {
      const i = position++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], (v) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }];
    },
    useRef: (initial) => { const i = position++; return (slots[i] ??= { current: initial }); },
    useCallback: (fn) => fn,
    useEffect: () => {},
    useContext: () => { throw new Error('kullanılmaz'); },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (_type, props) => props };
      if (name.endsWith('/transport')) return { accessRequest: () => new Promise((resolve) => bekleyen.push(resolve)) };
      if (name.endsWith('/browser')) return { supabase: {} };
      throw new Error(`taklit yok: ${name}`);
    },
  });
  const deger = () => { position = 0; return exports.AdminProvider({ children: null }).value; };
  return { deger, yanitla: (data) => bekleyen.shift()({ data }) };
}

const me = (izinler, userId = 'kisi-1') => ({
  admin: { userId, isActive: true, legacyRole: 'OPERATIONS' },
  permissions: izinler.map((key) => ({ key, scopes: [{ kind: 'all' }] })),
});
const keyOf = (m) => JSON.stringify(m && m.permissions);
// Sağlayıcı ayrı vm bağlamında çalışır: nesneler başka bir gerçekliğin prototipini taşır, karşılaştırma düz JSON üzerinden.
const duz = (v) => JSON.parse(JSON.stringify(v));
const TALEP = '/admin/talepler';
const SIPARIS = '/admin/birakma-siparisleri';
const ONCE = ['requests.read', 'requests.update'];
const SONRA = ['requests.read'];

async function yenile(p, yanit) {
  const is = p.deger().refresh();
  p.yanitla(yanit);
  await is;
}
async function reddet(p, { scope = TALEP, message = 'ret', yanit = me(SONRA), once } = {}) {
  p.deger().reportDenial({ scope, message, keyOf });
  const is = p.deger().refresh();
  if (once) once(p);
  p.yanitla(yanit);
  await is;
}

test('sayfada kalınca: yetki değişirse açıklama sayfa düzeyinde kalır', async () => {
  const p = saglayici();
  await yenile(p, me(ONCE));
  await reddet(p);
  assert.deepEqual(duz(p.deger().denial), { scope: TALEP, message: 'ret', userId: 'kisi-1' });
});

test('yetki değişmezse açıklama gösterilmez (ekran kendi iletisini korur, iki kez gösterilmez)', async () => {
  const p = saglayici();
  await yenile(p, me(ONCE));
  await reddet(p, { yanit: me(ONCE) });
  assert.equal(p.deger().denial, null);
});

test('REGRESYON (Astra #103 P3): yanıt gelmeden sayfadan çıkış bekleyen bildirimi iptal eder; eski açıklama yeniden oluşmaz', async () => {
  const p = saglayici();
  await yenile(p, me(ONCE));
  // AccessDenialNotice kaldırılırken çağırdığı temizlik: clearDenial(scope).
  await reddet(p, { once: (s) => s.deger().clearDenial(TALEP) });
  assert.equal(p.deger().denial, null, 'yanıt çıkıştan sonra dönse de açıklama oluşmaz');
  await yenile(p, me(SONRA));
  assert.equal(p.deger().denial, null, 'sonraki yenileme de eski bildirimi canlandırmaz');
});

test('yanıttan sonra sayfadan çıkış görünen açıklamayı siler', async () => {
  const p = saglayici();
  await yenile(p, me(ONCE));
  await reddet(p);
  p.deger().clearDenial(TALEP);
  assert.equal(p.deger().denial, null);
});

test('"Bildirimi kapat" yalnız görünen açıklamayı kapatır; bu arada gelen YENİ ret korunur', async () => {
  const p = saglayici();
  await yenile(p, me(['requests.read', 'requests.update', 'customers.contact.read']));
  await reddet(p, { message: 'eski', yanit: me(ONCE) });
  assert.equal(p.deger().denial?.message, 'eski');
  await reddet(p, { message: 'yeni', yanit: me(SONRA), once: (s) => s.deger().clearDenial(TALEP, { keepPending: true }) });
  assert.deepEqual(duz(p.deger().denial), { scope: TALEP, message: 'yeni', userId: 'kisi-1' });
});

test('başka sayfadan çıkış bu sayfanın bekleyen bildirimine dokunmaz', async () => {
  const p = saglayici();
  await yenile(p, me(ONCE));
  await reddet(p, { once: (s) => s.deger().clearDenial(SIPARIS) });
  assert.equal(p.deger().denial?.scope, TALEP);
});

test('başka kullanıcının yanıtında açıklama oluşmaz ve görünen açıklama silinir', async () => {
  const p = saglayici();
  await yenile(p, me(ONCE));
  await reddet(p, { yanit: me(SONRA, 'kisi-2') });
  assert.equal(p.deger().denial, null);
  const q = saglayici();
  await yenile(q, me(ONCE));
  await reddet(q);
  assert.equal(q.deger().denial?.userId, 'kisi-1');
  await yenile(q, me(SONRA, 'kisi-2'));
  assert.equal(q.deger().denial, null, 'oturum başka kullanıcıya geçince açıklama silinir');
});

test('bildirimden ÖNCE başlamış yenileme karar vermez; bildirimden sonraki yenileme verir', async () => {
  const p = saglayici();
  await yenile(p, me(ONCE));
  const a = p.deger().refresh();
  p.deger().reportDenial({ scope: TALEP, message: 'ret', keyOf });
  const b = p.deger().refresh();
  p.yanitla(me(SONRA)); await a;
  assert.equal(p.deger().denial, null, 'eski yenileme sonucu atılır');
  p.yanitla(me(SONRA)); await b;
  assert.equal(p.deger().denial?.message, 'ret');
});
