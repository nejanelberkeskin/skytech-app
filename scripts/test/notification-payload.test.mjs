import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
const forbidden = () => { throw new Error('live_dependency_forbidden'); };
const mail = load('lib/mail.ts', { '@/lib/supabase/server': { createServiceRoleClient: forbidden }, '@/lib/requests/labels': {} });
const pricing = load('lib/pricing.ts');
const order = { id: 'fixture', order_no: 'SG-2026-ABCDEF', locale: 'tr', buyer_email: 'local@example.invalid', buyer_first_name: 'First', buyer_last_name: 'Last', buyer_type: 'individual', site_snapshot: { name: 'Local site' }, total_kurus: 20000, quantity: 20, is_test: true, certificate_name: 'Name', created_at: '2026-09-27T12:00:00Z', withdrawal_deadline: null, performance_deadline: null };
function setup(prepared) {
    let pdfs = 0;
    const docs = ['pre_info', 'contract', 'withdrawal_form', 'kvkk_notice'].map(kind => ({ kind, title: kind, sha256: 'a'.repeat(64), meta: [], blocks: [{ type: 'paragraph', text: 'Stored contract' }] }));
    const client = { from: table => ({ select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; }, maybeSingle: async () => ({ error: null, data: table === 'release_orders' ? order : { data: { version: 'historical', documents: docs } } }) }) };
    const payload = load('lib/orders/notification-payload.ts', {
        '@/lib/legal/format': {}, '@/lib/legal/render-pdf': { renderLegalPdf: () => { pdfs++; return Buffer.from(`PDF-${pdfs}`); } },
        '@/lib/mail': mail, '@/lib/pricing': pricing, './access': { orderPagePath: () => '/siparis/test?t=fixture' },
        './dates': load('lib/orders/dates.ts'), './schedule': { trToday: () => '2026-09-27' }, './withdrawal-dates': { refundDueDay: () => '2026-10-11' },
        './preparation': { isOrderPrepared: async () => prepared }
    });
    return { client, payload, pdfs: () => pdfs };
}
test('payment payload fails closed on invalid saved documents, without even rendering PDFs', async () => {
    const { client, payload, pdfs } = setup(false);
    await assert.rejects(() => payload.prepareNotification({ order_id: order.id, template: 'release_order_confirm', source: { order } }, client, 'https://example.invalid'), /documents_unavailable/);
    assert.equal(pdfs(), 0);
});
test('payment payload contains all four saved legal PDFs, ready to freeze once', async () => {
    const { client, payload, pdfs } = setup(true);
    const result = JSON.parse(await payload.prepareNotification({ order_id: order.id, template: 'release_order_confirm', source: { order } }, client, 'https://example.invalid'));
    assert.equal(pdfs(), 4);
    assert.equal(result.attachments.length, 4);
    assert.deepEqual(result.to, [order.buyer_email]);
    assert.ok(result.attachments.every(a => a.filename.endsWith('.pdf')));
    assert.match(result.html, /example.invalid/);
});
