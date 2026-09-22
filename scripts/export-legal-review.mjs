/** Saf şablonlardan Word paketinin metinlerini üretir; veritabanı/ağ kullanmaz. */
import fs from 'node:fs';
import path from 'node:path';
import { sampleLegalContext } from '../lib/legal/sample.ts';
import { buildOrderDocuments } from '../lib/legal/documents.ts';
import { trLongDate, trDayOf } from '../lib/legal/format.ts';
import { privacyPolicyBlocks, siteTermsBlocks, cookiePolicyBlocks } from '../lib/legal/templates/site-policies.ts';
import { LEGAL_DOCUMENTS_VERSION } from '../lib/legal/version.ts';
const out = process.argv[2];
if (!out) throw new Error('Çıktı dizini gerekir');
fs.mkdirSync(out, { recursive: true });
const ctx = sampleLegalContext(new Date('2026-09-22T10:00:00Z'));
const replacements = new Map([
  [trLongDate(trDayOf(ctx.schedule.withdrawalDeadline)), '[[CAYMA_SON_GUNU_ON_HESAP]]'],
  [trLongDate(ctx.schedule.performanceDeadline), '[[BIRAKMA_SON_TARIHI]]'],
  [trLongDate(ctx.schedule.earliestReleaseOn), '[[EN_ERKEN_BIRAKMA_TARIHI]]'],
  [trLongDate(ctx.schedule.season.startsOn), '[[SEZON_BASLANGICI]]'],
  [trLongDate(ctx.orderDate), '[[SIPARIS_TARIHI]]'],
]);
function plain(value) {
  let s = value;
  for (const [a,b] of replacements) s = s.replaceAll(a,b);
  return s.replaceAll('100 adet', '[[ADET]] adet').replaceAll('[YAYIN ÖNCESİ TAMAMLANACAK: siparişe özgü kesin tarih]', '[[SIRKETIN_BILDIRECEGI_KESIN_TARIH]]');
}
const rowPlaceholders = {
 'Birim bedel (KDV dâhil)': '[[BIRIM_BEDEL]] / tohum topu', 'Adet': '[[ADET]]', 'Tohum topu adedi': '[[ADET]] adet',
 'Toplam bedel (tüm vergiler dâhil)': '[[TOPLAM_BEDEL]]', 'Toplamın içindeki KDV (%20)': '[[KDV_TUTARI]]',
 'Ödenen toplam bedel': '[[ODENEN_BEDEL]]', 'Sipariş no': '[[SIPARIS_NO]]',
};
function blockText(b, generic=false) {
 if ('text' in b) return (b.type === 'heading' ? '## ' : b.type === 'subheading' ? '### ' : '') + (generic ? plain(b.text) : b.text);
 if (b.type === 'list') return b.items.map(s => '- '+(generic?plain(s):s)).join('\n');
 if (b.type === 'table') return b.rows.map(([k,v]) => `${generic?k.replace('(%20)','(%[[KDV_ORANI]])'):k}: ${generic?rowPlaceholders[k]??plain(v):v}`).join('\n\n');
 if (b.type === 'fields') return b.labels.map(s => `${s}: ........................................................`).join('\n\n');
 throw new Error(b.type);
}
const names=['01-on-bilgilendirme.md','02-mesafeli-hizmet-sozlesmesi.md','04-cayma-formu.md','09-kvkk-aydinlatma.md'];
buildOrderDocuments(ctx).forEach(({document:d},i) => {
 const note=i===3?'':'\n\nYayın notu: Siparişe özgü alanlar sunucu verisiyle doldurulur. Sertifika ve izleme son tarihleri şirket tarafından henüz bildirilmemiştir; kesin tarih olmadan satışa açılmaz.';
 fs.writeFileSync(path.join(out,names[i]), `# ${d.title}\n\nMetin sürümü ${LEGAL_DOCUMENTS_VERSION}. Kodla aynı hukuki hükümler; sipariş alanları doldurulacak şablon olarak gösterilmiştir.${note}\n\n${d.blocks.map(b=>blockText(b,true)).join('\n\n')}\n`);
});
for (const [name,title,blocks] of [
 ['08-site-kullanim-kosullari.md','Site kullanım koşulları',siteTermsBlocks()],
 ['10-gizlilik-politikasi.md','Gizlilik politikası',privacyPolicyBlocks()],
 ['11-cerez-politikasi.md','Çerez politikası',cookiePolicyBlocks()],
]) fs.writeFileSync(path.join(out,name),`# ${title}\n\nMetin sürümü ${LEGAL_DOCUMENTS_VERSION}. İnternet sitesiyle aynı metin kaynağı.\n\n${blocks.map(b=>blockText(b)).join('\n\n')}\n`);
console.log('7 kanonik metin üretildi:',out);
