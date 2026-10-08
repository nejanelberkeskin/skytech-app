// Real migration 036 and worker; synthetic payloads/provider only. PGlite has one
// connection, so claim fencing/recovery is tested, not live two-session contention.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDb, insertOrder, one, rows, restClient, IDS } from './pglite-db.mjs';
import { loadSource as load } from './load-source.mjs';
const forbidden = () => { throw new Error('live_dependency_forbidden'); };
class DeliveryError extends Error {
    constructor(code, permanent = false) { super(code); this.code = code; this.permanent = permanent; }
}
const worker = load('lib/orders/notification-outbox.ts', { '@/lib/mail': { NotificationDeliveryError: DeliveryError, notificationSenderConfigured: forbidden, sendFrozenNotification: forbidden }, './notification-payload': { prepareNotification: forbidden } });
const sql = await readFile(new URL('../../supabase/migrations/036_notification_outbox.sql', import.meta.url), 'utf8');
const body = JSON.stringify({ from: 'test@example.invalid', to: ['buyer@example.invalid'], subject: 'Local test', html: '<p>frozen</p>', attachments: [{ filename: 'contract.pdf', content: 'RklYRUQtUERG' }] });
async function setup(migrate = true) {
    const db = await createDb();
    await db.exec(`CREATE TABLE IF NOT EXISTS email_logs(id uuid DEFAULT gen_random_uuid(),template text,recipient_email text,subject text,related_id text,resend_id text,status text);`);
    if (migrate)
        await db.exec(sql);
    return db;
}
async function paid(db) { const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null }); await db.query("UPDATE release_orders SET status='paid',paid_at=now() WHERE id=$1", [id]); return id; }
const claim = async (db, templates = ['release_order_confirm']) => (await restClient(db).rpc('claim_order_notification', { p_templates: templates, p_order: null })).data;
const step = async (db, j, action, extra = {}) => { const r = await restClient(db).rpc('advance_order_notification', { p_id: j.id, p_claim: j.claim_token, p_action: action, ...extra }); if (r.error)
    throw new Error(r.error.message); return r.data; };
const snapshot = (db, id) => one(db, 'SELECT * FROM order_notification_outbox WHERE id=$1', [id]);
const expireLease = (db, id) => db.query("UPDATE order_notification_outbox SET lease_until=now()-interval '1 second' WHERE id=$1", [id]);
const due = db => db.exec("UPDATE order_notification_outbox SET next_attempt_at=now()-interval '1 second' WHERE state='pending'");
const run = (db, deps = {}, options = {}, client = restClient(db)) => worker.runNotificationOutbox('https://example.invalid', client, { templates: ['release_order_confirm'], ...options }, { configured: () => true, prepare: async () => body, send: async () => ({ id: 'provider-fixture' }), ...deps });
test('036: transaction rollback cannot publish an outbox item; replayed paid/withdrawal transitions enqueue once', async () => {
    const db = await setup();
    try {
        const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
        await db.exec('BEGIN');
        await db.query("UPDATE release_orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
        await db.exec('ROLLBACK');
        assert.equal((await one(db, 'SELECT count(*)::int n FROM order_notification_outbox')).n, 0);
        await db.query("UPDATE release_orders SET status='paid',paid_at=now(),payment_token='private-token' WHERE id=$1", [id]);
        await db.query("UPDATE release_orders SET paid_at=now(),status='withdrawal_requested',withdrawal_requested_at=now() WHERE id=$1", [id]);
        await db.query('UPDATE release_orders SET withdrawal_requested_at=now() WHERE id=$1', [id]);
        const jobs = await rows(db, 'SELECT * FROM order_notification_outbox');
        assert.equal(jobs.length, 4);
        assert.ok(jobs.every(j => !('payment_token' in j.source.order)));
        assert.equal((await run(db, {}, { templates: null, limit: 10 })).sent, 4);
        assert.equal((await one(db, "SELECT count(*)::int n FROM order_events WHERE type='email_sent'")).n, 4);
        assert.equal((await one(db, 'SELECT count(*)::int n FROM email_logs')).n, 4);
        assert.equal((await run(db, {}, { templates: null })).sent, 0);
    }
    finally {
        await db.close();
    }
});
test('036: legacy missing logs go to manual review and never automatically replay', async () => {
    const db = await setup(false);
    try {
        const id = await insertOrder(db);
        await db.query("INSERT INTO order_events(order_id,type,actor,data) VALUES($1,'email_sent','system','{\"template\":\"release_order_notify\",\"id\":\"known-id\"}')", [id]);
        await db.exec(sql);
        const jobs = await rows(db, 'SELECT template,state,last_error FROM order_notification_outbox');
        assert.equal(jobs.length, 4);
        assert.equal(jobs.filter(j => j.state === 'needs_review').length, 3);
        assert.equal(jobs.find(j => j.template === 'release_order_notify').state, 'sent');
        assert.equal((await run(db, { send: forbidden }, { templates: null })).sent, 0);
    }
    finally {
        await db.close();
    }
});
test('036: crash before network recovers a lease and fencing rejects the old worker', async () => {
    const db = await setup();
    try {
        await paid(db);
        const old = await claim(db);
        await step(db, old, 'freeze', { p_body: body });
        assert.equal(await claim(db), null);
        await expireLease(db, old.id);
        const next = await claim(db);
        assert.notEqual(next.claim_token, old.claim_token);
        assert.equal(await step(db, old, 'begin'), null);
        assert.equal((await snapshot(db, old.id)).first_network_at, null);
        await assert.rejects(() => step(db, next, 'freeze', { p_body: body + ' ' }), /notification_body_frozen/);
        await step(db, next, 'begin');
        await step(db, next, 'sent', { p_provider_id: 'accepted' });
        assert.equal((await snapshot(db, old.id)).state, 'sent');
    }
    finally {
        await db.close();
    }
});
test('036: accepted response lost after network retries the exact frozen body and key, settles once', async () => {
    const db = await setup();
    try {
        await paid(db);
        const accepted = new Map();
        let calls = 0, prepares = 0;
        const send = async (b, k) => { calls++; if (!accepted.has(k)) {
            accepted.set(k, b);
            throw new Error('response_lost_after_acceptance');
        } assert.equal(b, accepted.get(k)); return { id: 'stable-provider-id' }; };
        assert.equal((await run(db, { send, prepare: async () => { prepares++; return body; } })).failed, 1);
        await due(db);
        assert.equal((await run(db, { send, prepare: forbidden })).sent, 1);
        assert.equal(calls, 2);
        assert.equal(prepares, 1);
        assert.equal(accepted.size, 1);
        assert.equal((await run(db, { send: forbidden })).sent, 0);
        assert.equal((await one(db, "SELECT count(*)::int n FROM order_events WHERE type='email_sent'")).n, 1);
    }
    finally {
        await db.close();
    }
});
test('036: acknowledgement DB failure after acceptance is recovered without resending different content', async () => {
    const db = await setup();
    try {
        await paid(db);
        let requests = 0;
        const broken = restClient(db, { rpc: (name, args) => name === 'advance_order_notification' && args.p_action === 'sent' ? { code: 'simulated_ack_failure' } : null });
        assert.equal((await run(db, { send: async () => { requests++; return { id: 'accepted' }; } }, {}, broken)).failed, 1);
        await due(db);
        assert.equal((await run(db, { prepare: forbidden, send: async () => { requests++; return { id: 'accepted' }; } })).sent, 1);
        assert.equal(requests, 2);
        assert.equal((await one(db, 'SELECT count(*)::int n FROM email_logs')).n, 1);
    }
    finally {
        await db.close();
    }
});
test('036: idempotency deadline stops network; review needs evidence and cannot blindly reset/replay', async () => {
    const db = await setup();
    try {
        await paid(db);
        const j = await claim(db);
        await step(db, j, 'freeze', { p_body: body });
        await step(db, j, 'begin');
        await db.query("UPDATE order_notification_outbox SET first_network_at=now()-interval '23 hours',lease_until=now()-interval '1 second' WHERE id=$1", [j.id]);
        assert.equal((await run(db, { send: forbidden })).sent, 0);
        assert.equal((await snapshot(db, j.id)).state, 'needs_review');
        const api = restClient(db);
        assert.ok((await api.rpc('review_order_notification', { p_id: j.id, p_action: 'retry', p_evidence: 'verified case reference' })).error);
        assert.ok((await api.rpc('review_order_notification', { p_id: j.id, p_action: 'confirm_sent', p_evidence: 'verified case reference', p_provider_id: '' })).error);
        const result = await api.rpc('review_order_notification', { p_id: j.id, p_action: 'confirm_sent', p_evidence: 'Provider console case TEST-1', p_provider_id: 'verified-provider-id' });
        assert.equal(result.error, null);
        assert.equal(result.data, true);
        assert.equal((await snapshot(db, j.id)).state, 'sent');
    }
    finally {
        await db.close();
    }
});
test('036: empty ID, skipped ID and provider errors never mark success; another recipient remains independent', async () => {
    const db = await setup();
    try {
        await paid(db);
        for (const value of [{}, { id: '' }, { id: 'skipped-no-api-key' }]) {
            await due(db);
            assert.equal((await run(db, { send: async () => value })).failed, 1);
        }
        assert.equal((await one(db, "SELECT count(*)::int n FROM order_events WHERE type='email_sent'")).n, 0);
        assert.equal((await run(db, {}, { templates: ['release_order_notify'] })).sent, 1);
        const failure = await one(db, "SELECT * FROM order_notification_outbox WHERE template='release_order_confirm'");
        assert.equal(failure.state, 'pending');
        await due(db);
        assert.equal((await run(db, { send: async () => { throw new DeliveryError('provider_http_422', true); } })).failed, 1);
        assert.equal((await snapshot(db, failure.id)).state, 'needs_review');
    }
    finally {
        await db.close();
    }
});
test('036: missing documents never reach provider; unconfigured sender never starts the 24h clock', async () => {
    const db = await setup();
    try {
        await paid(db);
        assert.equal((await run(db, { configured: () => false, prepare: forbidden, send: forbidden })).configured, false);
        assert.equal((await one(db, "SELECT sum(attempt_count)::int n FROM order_notification_outbox")).n, 0);
        assert.equal((await run(db, { prepare: async () => { throw new Error('documents_unavailable'); }, send: forbidden })).failed, 1);
        const r = await one(db, "SELECT * FROM order_notification_outbox WHERE template='release_order_confirm'");
        assert.equal(r.state, 'needs_review');
        assert.equal(r.first_network_at, null);
    }
    finally {
        await db.close();
    }
});
test('036: service-only ACL, private helper denied, RLS enabled and safe function search_path', async () => {
    const db = await setup();
    try {
        for (const role of ['anon', 'authenticated', 'service_role']) {
            assert.equal((await one(db, "SELECT has_function_privilege($1,'claim_order_notification(text[],uuid)','EXECUTE') allowed", [role])).allowed, role === 'service_role');
            assert.equal((await one(db, "SELECT has_table_privilege($1,'order_notification_outbox','SELECT') allowed", [role])).allowed, role === 'service_role');
            assert.equal((await one(db, "SELECT has_function_privilege($1,'settle_order_notification(uuid,text)','EXECUTE') allowed", [role])).allowed, false);
        }
        assert.equal((await one(db, "SELECT relrowsecurity FROM pg_class WHERE oid='order_notification_outbox'::regclass")).relrowsecurity, true);
        const functions = await rows(db, "SELECT proconfig FROM pg_proc WHERE proname IN ('claim_order_notification','advance_order_notification','review_order_notification')");
        assert.ok(functions.every(f => f.proconfig.includes('search_path=""')));
    }
    finally {
        await db.close();
    }
});
test('036: video acceptance settles video/order atomically and URL correction does not replay', async () => {
    const db = await setup();
    try {
        const b = (await one(db, "INSERT INTO release_batches(land_id,season_label,released_on) VALUES($1,'2026-2036',current_date) RETURNING id", [IDS.land])).id;
        const id = await insertOrder(db, { status: 'released', withdrawal_requested_at: null });
        await db.query('UPDATE release_orders SET batch_id=$2 WHERE id=$1', [id, b]);
        await db.query("UPDATE release_batches SET video_url='https://www.youtube.com/watch?v=abcdefghijk',video_published_at=now() WHERE id=$1", [b]);
        assert.equal((await run(db, {}, { templates: ['release_video'] })).sent, 1);
        const order = await one(db, 'SELECT status,video_notified_at,completed_at FROM release_orders WHERE id=$1', [id]);
        assert.equal(order.status, 'completed');
        assert.ok(order.video_notified_at && order.completed_at);
        await db.query("UPDATE release_batches SET video_url='https://www.youtube.com/watch?v=lmnopqrstuv' WHERE id=$1", [b]);
        assert.equal((await run(db, { send: forbidden }, { templates: ['release_video'] })).sent, 0);
    }
    finally {
        await db.close();
    }
});
test('036: >1000 certificate backlog is queued in SQL and sent prefix cannot hide the final item', async () => {
    const db = await setup();
    try {
        await db.query(`INSERT INTO release_orders(order_no,status,land_id,site_snapshot,season_label,quantity,unit_price_kurus,total_kurus,vat_rate,certificate_name,buyer_type,buyer_first_name,buyer_last_name,buyer_email,buyer_phone,invoice,consents,documents_version,paid_at)
    SELECT 'SG-2026-'||translate(lpad(to_hex(n),6,'0'),'0123456789abcdef','ABCDEFGHJKMNPQRS'),'released',$1,'{}','2026-2036',20,1000,20000,20,'Fixture','individual','Test','Person','test@example.invalid','000','{}','{}','test',now() FROM generate_series(1,1001)n`, [IDS.land]);
        await db.exec("UPDATE release_orders SET certificate_code='SG-AA'||substring(order_no from 9 for 2)||'-'||right(order_no,4),certificate_issued_at=now()");
        const all = await rows(db, 'SELECT id FROM order_notification_outbox ORDER BY id');
        assert.equal(all.length, 1001);
        await db.query("UPDATE order_notification_outbox SET state='sent' WHERE id<>$1", [all.at(-1).id]);
        const j = await claim(db, ['release_certificate']);
        assert.equal(j.id, all.at(-1).id);
    }
    finally {
        await db.close();
    }
});
test('036: certificate cancellation after freeze blocks every network attempt, including retries', async () => {
    const db = await setup();
    try {
        const id = await insertOrder(db, { status: 'released', withdrawal_requested_at: null });
        await db.query("UPDATE release_orders SET certificate_code='SG-ABCD-EFGH',released_at=now(),certificate_issued_at=now() WHERE id=$1", [id]);
        const job = await claim(db, ['release_certificate']);
        await step(db, job, 'freeze', { p_body: body });
        await step(db, job, 'begin');
        await step(db, job, 'retry', { p_error: 'network_timeout' });
        await db.query('UPDATE release_orders SET certificate_cancelled_at=now() WHERE id=$1', [id]);
        await due(db);
        await run(db, { prepare: forbidden, send: forbidden }, { templates: ['release_certificate'] });
        const result = await snapshot(db, job.id);
        assert.equal(result.state, 'needs_review');
        assert.equal(result.last_error, 'notification_no_longer_eligible');
    }
    finally {
        await db.close();
    }
});
test('036: video correction before first freeze uses current URL; correction after freeze blocks network', async () => {
    const db = await setup();
    try {
        const oldUrl = 'https://www.youtube.com/watch?v=abcdefghijk', newUrl = 'https://www.youtube.com/watch?v=lmnopqrstuv';
        const b = (await one(db, "INSERT INTO release_batches(land_id,season_label,released_on) VALUES($1,'2026-2036',current_date) RETURNING id", [IDS.land])).id;
        const id = await insertOrder(db, { status: 'released', withdrawal_requested_at: null });
        await db.query('UPDATE release_orders SET batch_id=$2 WHERE id=$1', [id, b]);
        await db.query('UPDATE release_batches SET video_url=$2,video_published_at=now() WHERE id=$1', [b, oldUrl]);
        await db.query('UPDATE release_batches SET video_url=$2 WHERE id=$1', [b, newUrl]);
        let renderedUrl;
        const result = await run(db, { prepare: async (job) => { renderedUrl = job.source.batch.video_url; return body; }, send: async () => { throw new Error('response_unknown'); } }, { templates: ['release_video'] });
        assert.equal(result.failed, 1);
        assert.equal(renderedUrl, newUrl);
        const job = await one(db, "SELECT * FROM order_notification_outbox WHERE template='release_video'");
        await db.query('UPDATE release_batches SET video_url=$2 WHERE id=$1', [b, oldUrl]);
        await due(db);
        const retry = await run(db, { prepare: forbidden, send: forbidden }, { templates: ['release_video'] });
        assert.equal(retry.failed, 1);
        const current = await snapshot(db, job.id);
        assert.equal(current.state, 'needs_review');
        assert.equal(current.body, body);
        assert.equal(current.last_error, 'notification_no_longer_eligible');
    }
    finally {
        await db.close();
    }
});

test('036: failed enqueue rolls back the triggering payment, withdrawal or certificate change',async()=>{
 const db=await setup();try{
  await db.exec("CREATE FUNCTION local_queue_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'local_outbox_failure'; END $$; CREATE TRIGGER local_queue_fail BEFORE INSERT ON order_notification_outbox FOR EACH ROW EXECUTE FUNCTION local_queue_fail();");
  for(const [initial,change] of [
   [{status:'awaiting_payment',paid_at:null},"status='paid',paid_at=now()"],
   [{status:'paid'},"status='withdrawal_requested',withdrawal_requested_at=now()"],
   [{status:'released'},"certificate_code='SG-AAAA-BBBB',certificate_issued_at=now()"]]){
   const id=await insertOrder(db,{...initial,withdrawal_requested_at:null});
   const before=await one(db,'SELECT to_jsonb(o) v FROM release_orders o WHERE id=$1',[id]);
   await assert.rejects(()=>db.query('UPDATE release_orders SET '+change+' WHERE id=$1',[id]),/local_outbox_failure/);
   assert.deepEqual(await one(db,'SELECT to_jsonb(o) v FROM release_orders o WHERE id=$1',[id]),before);
  }
  assert.equal((await one(db,'SELECT count(*)::int n FROM order_notification_outbox')).n,0);
 }finally{await db.close();}
});
