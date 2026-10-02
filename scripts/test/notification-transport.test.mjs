import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
const forbidden = () => { throw new Error('live_dependency_forbidden'); };
const mail = load('lib/mail.ts', { '@/lib/supabase/server': { createServiceRoleClient: forbidden }, '@/lib/requests/labels': {} });
test('outbox transport sends exact stored bytes and key, accepts only real provider IDs; all HTTP is local mock', async (t) => {
    process.env.RESEND_API_KEY = 'synthetic-unit-test-only';
    const seen = [];
    let response = { ok: true, status: 200, json: async () => ({ id: 'fixture-id' }) };
    t.mock.method(globalThis, 'fetch', async (url, options) => { seen.push({ url, options }); return response; });
    try {
        const body = '{"from":"a@example.invalid","to":["b@example.invalid"],"subject":"test","html":"fixed"}';
        assert.deepEqual(await mail.sendFrozenNotification(body, 'sg-outbox/fixture'), { id: 'fixture-id' });
        assert.equal(seen[0].options.body, body);
        assert.equal(seen[0].options.headers['Idempotency-Key'], 'sg-outbox/fixture');
        assert.ok(seen[0].options.signal);
        for (const value of [{}, { id: '' }, { id: ' ' }, { id: 'skipped-no-api-key' }]) {
            response = { ok: true, status: 200, json: async () => value };
            await assert.rejects(() => mail.sendFrozenNotification(body, 'key'), /invalid_provider_response/);
        }
        response = { ok: false, status: 409, json: async () => ({ name: 'concurrent_idempotent_requests' }) };
        await assert.rejects(() => mail.sendFrozenNotification(body, 'key'), e => e.permanent === false);
        response = { ok: false, status: 409, json: async () => ({ name: 'invalid_idempotent_request' }) };
        await assert.rejects(() => mail.sendFrozenNotification(body, 'key'), e => e.permanent === true);
        for (const status of [429, 500, 503]) {
            response = { ok: false, status, json: async () => ({ message: 'private-provider-details' }) };
            await assert.rejects(() => mail.sendFrozenNotification(body, 'key'), e => !e.permanent && !e.message.includes('private'));
        }
        delete process.env.RESEND_API_KEY;
        const before = seen.length;
        await assert.rejects(() => mail.sendFrozenNotification(body, 'key'), /not_configured/);
        assert.equal(seen.length, before);
    }
    finally {
        delete process.env.RESEND_API_KEY;
    }
});
test('six commerce templates only prepare payloads: no email, logging or client creation', () => {
    const base = { orderId: 'id', orderNo: 'SG-2026-ABCDEF', locale: 'tr', email: 'buyer@example.invalid', firstName: 'Test', buyerName: 'Test Person', buyerType: 'individual', siteName: 'Site', quantity: 20, totalText: '200 TL', certificateName: 'Person', performanceDeadlineText: 'date', withdrawalLastDayText: 'date', orderUrl: 'https://example.invalid/order', isTest: true, attachments: [{ filename: 'fixed.pdf', content: 'Zml4ZWQ=' }], receivedOnText: 'date', refundDueOnText: 'date', quantityText: '20', releasedOnText: 'date', certificateUrl: 'https://example.invalid/cert', videoUrl: 'https://example.invalid/video', siteUrl: null };
    for (const name of ['OrderConfirmation', 'OrderNotification', 'WithdrawalReceipt', 'WithdrawalNotification', 'ReleaseCertificate', 'VideoPublished']) {
        const result = mail[`prepare${name}`](base);
        assert.equal(typeof result.then, 'undefined');
        assert.ok(result.subject && result.html && result.to);
        const body = JSON.parse(mail.notificationBody(result));
        assert.deepEqual(body.to, [result.to]);
    }
});
test('worker endpoint requires secret, does not expose payloads, fails explicitly when transport unconfigured', async () => {
    let calls = 0;
    let configured = true;
    const route = load('app/api/cron/bildirimler/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, ...options }) } }, '@/lib/mail': { publicOrigin: () => 'https://example.invalid' },
        '@/lib/orders/notification-outbox': { runConfiguredNotifications: async () => { calls++; if (!configured) throw new Error('notification_sender_not_configured'); return { sent: 0, failed: 0, configured }; } },
        '@/lib/jobs/runs': { runRecorded: async (_db,_job,_trigger,_scope,_actor,fn) => ({status:'done', recorded:true, report:await fn()}) }, '@/lib/supabase/server': { createServiceRoleClient: () => ({}) }
    });
    const req = auth => ({ headers: new Headers(auth ? { authorization: auth } : {}) });
    delete process.env.CRON_SECRET;
    assert.equal((await route.GET(req())).status, 503);
    assert.equal(calls, 0);
    process.env.CRON_SECRET = 'synthetic-cron-secret';
    try {
        assert.equal((await route.GET(req())).status, 401);
        assert.equal((await route.GET(req('Bearer wrong'))).status, 401);
        assert.equal(calls, 0);
        configured = false;
        const fail = await route.GET(req('Bearer synthetic-cron-secret'));
        assert.equal(fail.status, 503);
        assert.equal(fail.body.error, 'notification_queue_unavailable');
        assert.equal(fail.headers['Cache-Control'], 'no-store');
        configured = true;
        assert.equal((await route.GET(req('Bearer synthetic-cron-secret'))).status, 200);
        assert.equal(calls, 2);
    }
    finally {
        delete process.env.CRON_SECRET;
    }
});
test('daily scheduled jobs cannot report successful notifications without configured sender', async () => {
    const jobs = load('lib/orders/jobs.ts', {
        './notification-outbox': { runNotificationOutbox: async () => ({ sent: 0, failed: 0, configured: false, byTemplate: {} }) },
        '@/lib/sites/releases': {}, './admin-actions': { confirmDueOrders: async () => 0 }, './create': { expireStaleOrders: async () => 0 },
        './schedule': { trToday: () => '2026-09-27' }, './store': { db: forbidden }
    });
    const client = { from: () => ({ select() { return this; }, eq() { return this; }, limit: async () => ({ data: [], error: null }) }) };
    await assert.rejects(() => jobs.runScheduledJobs('https://example.invalid', client), /notification_sender_not_configured/);
});
