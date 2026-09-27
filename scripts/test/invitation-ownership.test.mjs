// Real route -> permission guard -> service -> PGlite SQL. Mail and session only are mocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDb, one, IDS, restClient, sqlError} from './pglite-db.mjs';
import {loadAdminRoute, request, AAL1, AAL2_FRESH, withMfaEnforced} from './admin-gate.mjs';
import {createStaffService, DEFAULT_INVITATION_DAYS} from '../../lib/admin/staff.ts';
const base='app/api/admin/invitations/';
const absent='c0000000-0000-0000-0000-000000000099';
async function setup(){
 const db=await createDb();
 await one(db,`SELECT create_admin_role($1,'inviter','Davetçi','',ARRAY['staff.invite','sites.read'],NULL)`,[IDS.superAdmin]);
 await one(db,`SELECT create_admin_role($1,'site_reader','Saha okuma','',ARRAY['sites.read'],NULL)`,[IDS.superAdmin]);
 for(const who of [IDS.finance,IDS.operations]){
  const a=await one(db,'SELECT id FROM admin_users WHERE user_id=$1',[who]);
  await one(db,`SELECT assign_admin_role($1,$2,'inviter','{"kind":"all"}',NULL,'test')`,[IDS.superAdmin,a.id]);
 }
 const service=createStaffService({db:restClient(db),mfaStatus:async()=>null,now:()=>new Date()});
 let seq=0;
 const invite=async who=>{
  const r=await service.createInvitation(who,{email:`invite-${++seq}@example.invalid`,roleKey:'site_reader',scope:{kind:'all'},accessEndsAt:null,expiresInDays:7});
  assert.equal(r.ok,true,JSON.stringify(r));return r.invitation;
 };
 const mails=[];
 const api=(file,who,assurance=AAL1)=>loadAdminRoute(base+file,{db,userId:who,assurance,extra:{
  '@/lib/admin/staff':{DEFAULT_INVITATION_DAYS},
  '@/lib/mail':{SKIPPED_ID:'skipped',publicOrigin:()=> 'https://example.invalid',sendStaffInvitation:async data=>{mails.push(data);return {id:'test-mail'};}},
  'next/server':{after:()=>{}},
 }});
 const act=async(kind,who,id,assurance)=> (await api(`[id]/${kind}/route.ts`,who,assurance)).POST(request({body:{expiresInDays:7}}),{params:Promise.resolve({id})});
 return {db,service,invite,api,act,mails};
}
async function unchanged(db,fn){
 const before=await one(db,`SELECT (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM admin_invitations i) invitations, (SELECT count(*)::int FROM admin_audit_logs) audit`);
 const result=await fn();
 const after=await one(db,`SELECT (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM admin_invitations i) invitations, (SELECT count(*)::int FROM admin_audit_logs) audit`);
 assert.deepEqual(after,before,'rejected call cannot change token, count, state, or audit');return result;
}
test('023: GET filters before pagination, ignores caller-supplied ownership, manager sees all',async()=>{
 const {db,invite,api}=await setup();try{
  const a=await invite(IDS.finance),b=await invite(IDS.operations),c=await invite(IDS.finance);
  await db.query(`UPDATE admin_invitations SET created_at='2026-09-01T10:00:00Z'`);
  const own=await api('route.ts',IDS.finance);
  const page=await own.GET(request({query:{limit:1,canViewAll:'true',actorUserId:IDS.superAdmin,created_by:IDS.operations}}));
  assert.equal(page.status,200);assert.equal(page.body.data.items.length,1);assert.ok([a.id,c.id].includes(page.body.data.items[0].id));
  const next=await own.GET(request({query:{limit:1,cursor:page.body.data.nextCursor}}));
  assert.equal(next.status,200);assert.equal(next.body.data.items.length,1);
  assert.deepEqual([page.body.data.items[0].id,next.body.data.items[0].id].sort(),[a.id,c.id].sort());
  const last=await own.GET(request({query:{limit:1,cursor:next.body.data.nextCursor}}));assert.deepEqual(last.body.data.items,[]);
  const all=await (await api('route.ts',IDS.superAdmin)).GET(request());assert.deepEqual(all.body.data.items.map(x=>x.id).sort(),[a.id,b.id,c.id].sort());
  const data=JSON.stringify(all.body);assert.ok(!data.includes('token_hash'));assert.ok(!data.includes('created_by'));
 }finally{await db.close();}
});
test('023: foreign IDs and missing IDs have the same 404 for resend/revoke in every status, no mail/write',async()=>{
 const {db,invite,act,mails}=await setup();try{
  const foreign=await invite(IDS.operations);
  for(const kind of ['resend','revoke']){
   const missing=await unchanged(db,()=>act(kind,IDS.finance,absent));assert.equal(missing.status,404);
   for(const state of ['pending','accepted','revoked']){
    await db.query('UPDATE admin_invitations SET status=$2,expires_at=now()-interval \'1 day\' WHERE id=$1',[foreign.id,state]);
    const hidden=await unchanged(db,()=>act(kind,IDS.finance,foreign.id));assert.deepEqual(hidden,missing);
   }
  }
  assert.equal(mails.length,0);
 }finally{await db.close();}
});
test('023: own expired pending invitation can be resent and revoked; manager can act on others',async()=>{
 const {db,invite,act,mails}=await setup();try{
  const own=await invite(IDS.finance),other=await invite(IDS.operations);
  await db.query("UPDATE admin_invitations SET expires_at=now()-interval '1 day' WHERE id=$1",[own.id]);
  const before=await one(db,'SELECT token_hash FROM admin_invitations WHERE id=$1',[own.id]);
  assert.equal((await act('resend',IDS.finance,own.id)).status,200);assert.equal(mails.length,1);
  assert.notEqual((await one(db,'SELECT token_hash FROM admin_invitations WHERE id=$1',[own.id])).token_hash,before.token_hash);
  assert.equal((await act('revoke',IDS.finance,own.id)).status,200);
  assert.equal((await act('resend',IDS.superAdmin,other.id)).status,200);
  assert.equal((await act('revoke',IDS.superAdmin,other.id)).status,200);
  const accepted=await invite(IDS.finance);await db.query("UPDATE admin_invitations SET status='accepted' WHERE id=$1",[accepted.id]);
  for(const kind of ['resend','revoke'])assert.equal((await unchanged(db,()=>act(kind,IDS.finance,accepted.id))).status,410);
 }finally{await db.close();}
});
test('023: staff.manage-only remains read-only and lost staff.invite permission fails closed',async()=>{
 const {db,invite,api,act,mails}=await setup();try{
  const own=await invite(IDS.finance),other=await invite(IDS.operations);
  await db.query(`DELETE FROM admin_role_assignments WHERE admin_user_id=(SELECT id FROM admin_users WHERE user_id=$1)`,[IDS.finance]);
  await one(db,`SELECT create_admin_role($1,'staff_reader','Personel yöneticisi','',ARRAY['staff.manage'],NULL)`,[IDS.superAdmin]);
  const a=await one(db,'SELECT id FROM admin_users WHERE user_id=$1',[IDS.finance]);
  await one(db,`SELECT assign_admin_role($1,$2,'staff_reader','{"kind":"all"}',NULL,'test')`,[IDS.superAdmin,a.id]);
  assert.equal((await (await api('route.ts',IDS.finance)).GET(request())).body.data.items.length,2);
  for(const id of [own.id,other.id])for(const kind of ['resend','revoke'])assert.equal((await unchanged(db,()=>act(kind,IDS.finance,id))).status,403);
  assert.equal(mails.length,0);
 }finally{await db.close();}
});
test('023: MFA rejection happens before ownership/write and fresh MFA still cannot cross ownership',async()=>{
 const {db,invite,api,act,mails}=await setup();try{
  const own=await invite(IDS.finance),foreign=await invite(IDS.operations);
  await withMfaEnforced(async()=>{
   const list=await (await api('route.ts',IDS.finance)).GET(request());assert.equal(list.body.error.code,'mfa_required');
   for(const kind of ['resend','revoke']){
    assert.equal((await unchanged(db,()=>act(kind,IDS.finance,own.id))).body.error.code,'mfa_required');
    assert.equal((await unchanged(db,()=>act(kind,IDS.finance,foreign.id,AAL2_FRESH()))).status,404);
   }
  });assert.equal(mails.length,0);
 }finally{await db.close();}
});
test('023: direct SQL cannot bypass ownership and helper/RPC execute grants stay service-only',async()=>{
 const {db,invite}=await setup();try{
  const foreign=await invite(IDS.operations);
  for(const kind of ['resend','revoke']){
   const sql=kind==='resend'?`SELECT resend_admin_invitation($1,$2,repeat('f',64),now()+interval '7 days')`:`SELECT revoke_admin_invitation($1,$2)`;
   assert.equal(await unchanged(db,()=>sqlError(db.query(sql,[IDS.finance,foreign.id]))),'invitation_missing');
  }
  for(const signature of ['admin_can_manage_invitation(uuid,uuid)','resend_admin_invitation(uuid,uuid,text,timestamptz)','revoke_admin_invitation(uuid,uuid)']){
   for(const role of ['anon','authenticated','service_role']){
    const r=await one(db,'SELECT has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,signature]);assert.equal(r.allowed,role==='service_role');
   }
  }
 }finally{await db.close();}
});
