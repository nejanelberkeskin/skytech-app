import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const A='10000000-0000-0000-0000-000000000001', B='10000000-0000-0000-0000-000000000002', LAND='20000000-0000-0000-0000-000000000001', O='30000000-0000-0000-0000-000000000001';
async function setup() {
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
 CREATE TABLE admin_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid UNIQUE,email text,full_name text,role text,is_active boolean);
 CREATE TABLE lands(id uuid PRIMARY KEY, reserved_seeds integer, filled_seeds integer,capacity_seeds integer,is_public boolean,status text);
 CREATE FUNCTION update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
 INSERT INTO admin_users VALUES ('${A}','${A}','a@example.com','A','SUPER_ADMIN',true);
 INSERT INTO lands VALUES('${LAND}',20,0,100,true,'open');`);
 for(const f of ['007_admin_audit_log.sql','016_release_orders.sql','017_sales_pause.sql','019_audit_hardening.sql']) await db.exec(await readFile(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 await db.exec(`INSERT INTO release_orders(id,order_no,status,land_id,site_snapshot,season_label,quantity,unit_price_kurus,total_kurus,vat_rate,certificate_name,buyer_type,buyer_first_name,buyer_last_name,buyer_email,buyer_phone,invoice,consents,documents_version,payment_provider,payment_id,paid_at)
 VALUES('${O}','SG-2026-TEST23','withdrawal_requested','${LAND}','{}','2026-2027',20,1000,20000,20,'Test','individual','Test','User','test@example.com','000','{}','{}','test','mock','original',now());`);
 return db;
}
test('database: last owner removal blocked for update/delete; second owner removal allowed and audited',async()=>{
 const db=await setup();try{
 for(const sql of [`UPDATE admin_users SET role='ENGINEER'`,`UPDATE admin_users SET is_active=false`,`DELETE FROM admin_users`]) await assert.rejects(db.exec(sql),/last_active_super_admin/);
 await db.exec(`INSERT INTO admin_users VALUES('${B}','${B}','b@example.com','B','SUPER_ADMIN',true)`);
 const attempts=await Promise.allSettled([db.exec(`SELECT mutate_admin_user('${A}','${B}','{"is_active":false}',false)`),db.exec(`SELECT mutate_admin_user('${A}','${A}','{"role":"ENGINEER"}',false)`)]);
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
 assert.equal((await db.query(`SELECT count(*)::int n FROM admin_users WHERE role='SUPER_ADMIN' AND is_active`)).rows[0].n,1);
 assert.ok((await db.query('SELECT count(*)::int n FROM admin_audit_logs')).rows[0].n>=2);
 await db.query(`SELECT create_admin_user('${A}','10000000-0000-0000-0000-000000000003','new@example.com','New','ENGINEER')`);
 assert.equal((await db.query(`SELECT admin_id FROM admin_audit_logs WHERE action='CREATE' ORDER BY created_at DESC LIMIT 1`)).rows[0].admin_id,A);
 }finally{await db.close();}
});
test('database: unique refund claim, atomic completion, idempotent capacity/invoice/audit',async()=>{
 const db=await setup();try{
 const claim=()=>db.query(`SELECT claim_refund_operation('${O}','mock','original',20000,false,'${A}') op`);
 const results=await Promise.all([claim(),claim()]);
 assert.equal(results.filter(r=>r.rows[0].op.fresh).length,1);
 const op=results[0].rows[0].op;
 await assert.rejects(db.query('SELECT finish_refund_operation($1)',[op.id]),/provider_result_missing/);
 await db.query(`UPDATE refund_operations SET state='provider_succeeded',result=$2 WHERE id=$1`,[op.id,JSON.stringify({ok:true,refundId:'fake-refund',method:'refund'})]);
 // Force audit failure: ALL local updates must roll back, checkpoint must survive.
 await db.exec(`CREATE FUNCTION deny_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test_audit_failure'; END $$;
 CREATE TRIGGER deny_audit BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION deny_audit();`);
 await assert.rejects(db.query('SELECT finish_refund_operation($1)',[op.id]),/test_audit_failure/);
 assert.equal((await db.query('SELECT status FROM release_orders')).rows[0].status,'withdrawal_requested');
 assert.equal((await db.query('SELECT reserved_seeds FROM lands')).rows[0].reserved_seeds,20);
 assert.equal((await db.query('SELECT state FROM refund_operations')).rows[0].state,'provider_succeeded');
 await db.exec('DROP TRIGGER deny_audit ON admin_audit_logs');
 await db.query('SELECT finish_refund_operation($1)',[op.id]);await db.query('SELECT finish_refund_operation($1)',[op.id]);
 assert.equal((await db.query('SELECT status FROM release_orders')).rows[0].status,'refunded');
 assert.equal((await db.query('SELECT reserved_seeds FROM lands')).rows[0].reserved_seeds,0);
 assert.equal((await db.query(`SELECT count(*)::int n FROM order_events WHERE type='refund_succeeded'`)).rows[0].n,1);
 }finally{await db.close();}
});
test('database: duplicate refund leaves primary order/capacity unchanged and blocks repeated provider claims',async()=>{
 const db=await setup();try{
 await db.exec(`INSERT INTO order_events(order_id,type,actor,data) VALUES('${O}','payment_succeeded','system','{"duplicate":true,"paymentId":"extra","paidKurus":20000,"provider":"mock"}')`);
 const claim=()=>db.query(`SELECT claim_refund_operation('${O}','mock','extra',20000,true,'${A}') op`);
 const op=(await claim()).rows[0].op;assert.equal(op.fresh,true);assert.equal((await claim()).rows[0].op.fresh,false);
 await db.query(`UPDATE refund_operations SET state='provider_succeeded',result='{"ok":true,"refundId":"fake-extra","method":"refund"}' WHERE id=$1`,[op.id]);
 await db.query('SELECT finish_refund_operation($1)',[op.id]);
 assert.equal((await db.query('SELECT status FROM release_orders')).rows[0].status,'withdrawal_requested');
 assert.equal((await db.query('SELECT reserved_seeds FROM lands')).rows[0].reserved_seeds,20);
 assert.equal((await claim()).rows[0].op.state,'completed');
 }finally{await db.close();}
});
test('database: persistent quota admits five and rejects subsequent calls',async()=>{
 const db=await setup();try{
 for(let i=0;i<5;i++) assert.equal((await db.query("SELECT consume_contact_quota('hash') n")).rows[0].n,0);
 assert.ok((await db.query("SELECT consume_contact_quota('hash') n")).rows[0].n>0);
 }finally{await db.close();}
});
