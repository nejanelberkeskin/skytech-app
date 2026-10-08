// Run only against the disposable, network-isolated container created for this check.
// No host DB URL, credentials, or production schema/data is used.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const container='skytech-review019';
const args=['exec','-i',container,'psql','-h','/tmp','-U','postgres','-v','ON_ERROR_STOP=1','-At'];
const sql=(input)=>execFileSync('docker',args,{input,encoding:'utf8'}).trim();
const A='10000000-0000-0000-0000-000000000001',B='10000000-0000-0000-0000-000000000002';
sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
CREATE TABLE admin_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid UNIQUE,email text,full_name text,role text,is_active boolean);
CREATE TABLE lands(id uuid PRIMARY KEY,reserved_seeds integer,filled_seeds integer,capacity_seeds integer,is_public boolean,status text);
CREATE FUNCTION update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now();RETURN NEW;END $$;
INSERT INTO admin_users VALUES('${A}','${A}','a@example.invalid','A','SUPER_ADMIN',true),('${B}','${B}','b@example.invalid','B','SUPER_ADMIN',true);`);
for(const f of ['007_admin_audit_log.sql','016_release_orders.sql','017_sales_pause.sql','019_audit_hardening.sql'])sql(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
function connection(input){const p=spawn('docker',args);let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.stdin.end(input);return {p,done:new Promise(resolve=>p.on('close',code=>resolve({code,out,err}))) };}
// First connection keeps the guard-row lock open. Wait for an explicit psql acknowledgement;
// then the second connection tries to remove the other owner while the first transaction is open.
const first=connection(`BEGIN; UPDATE admin_users SET is_active=false WHERE id='${A}';\n\\echo OWNER_LOCKED\nSELECT pg_sleep(2); COMMIT;`);
await new Promise((resolve,reject)=>{first.p.stdout.on('data',b=>{if(String(b).includes('OWNER_LOCKED'))resolve();});first.p.on('close',()=>reject(Error('first connection ended before acquiring lock')));});
const second=connection(`UPDATE admin_users SET role='ENGINEER' WHERE id='${B}';`);
const results=await Promise.all([first.done,second.done]);
assert.equal(results[0].code,0);assert.notEqual(results[1].code,0);assert.match(results[1].err,/last_active_super_admin/);
assert.equal(sql("SELECT count(*) FROM admin_users WHERE role='SUPER_ADMIN' AND is_active"),'1');
assert.equal(sql('SELECT active_count FROM admin_owner_guard'),'1');
console.log('PASS: independent PostgreSQL connections serialize concurrent owner removals; one owner remains.');
for(const input of [`UPDATE admin_users SET is_active=NULL WHERE id='${B}'`,`UPDATE admin_users SET role=NULL WHERE id='${B}'`]){
 const r=await connection(input).done;assert.notEqual(r.code,0);assert.match(r.err,/last_active_super_admin/);
}
sql(`UPDATE admin_users SET is_active=true WHERE id='${A}'`);
const bulk=await connection('UPDATE admin_users SET is_active=false').done;assert.notEqual(bulk.code,0);assert.match(bulk.err,/last_active_super_admin/);
assert.equal(sql("SELECT count(*) FROM admin_users WHERE role='SUPER_ADMIN' AND is_active"),'2');
assert.equal(sql('SELECT active_count FROM admin_owner_guard'),'2');
const invalid=await connection(`UPDATE admin_users SET is_active=NULL WHERE id='${A}'`).done;assert.notEqual(invalid.code,0);assert.match(invalid.err,/not-null/);
assert.equal(sql('SELECT active_count FROM admin_owner_guard'),'2');
console.log('PASS: NULL role/active, NOT NULL enforcement and multi-row update all roll back without counter drift.');
