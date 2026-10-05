"""Only a new network-isolated, unmounted local PostgreSQL container; never an external DB."""
import concurrent.futures, json, pathlib, re, subprocess, sys, time
root=pathlib.Path(__file__).resolve().parents[2]
container=sys.argv[1]
info=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
assert info['HostConfig']['NetworkMode']=='none'
assert not info['HostConfig'].get('Binds') and not info.get('Mounts')
def sql(q):
 p=subprocess.run(['docker','exec','-i',container,'psql','-h','/tmp','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
 if p.returncode: raise RuntimeError(p.stderr)
 return p.stdout.strip()
assert sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")=='0'
src=(root/'scripts/test/pglite-db.mjs').read_text()
ids=dict(re.findall(r"(\w+): '([0-9a-f-]{36})'",src.split('const MIGRATIONS')[0]))
bootstrap=re.search(r'await db.exec\(`(.*?)`\);',src,re.S).group(1)
for k,v in ids.items():bootstrap=bootstrap.replace('${IDS.'+k+'}',v)
assert '${' not in bootstrap
sql(bootstrap)
for f in re.findall(r"'([^']+\.sql)'",src.split('const MIGRATIONS = ')[1].split(';')[0]):sql((root/'supabase/migrations'/f).read_text())
fixture=(root/'scripts/test/fixtures/b2b-payment-schema.sql').read_text().replace('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;','')
sql(fixture)
sql((root/'supabase/migrations/004_corporate_quotes_upgrade.sql').read_text().split('-- ── Email Log Table')[0])
for f in ['034_b2b_payment_result.sql','035_b2b_reconciliation.sql','037_b2b_resolution.sql','039_b2b_checkout_start.sql']:
 sql('BEGIN;\n'+(root/'supabase/migrations'/f).read_text()+'\nCOMMIT;')
def pair(queries,quote):
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  holder=pool.submit(sql,f"SET application_name='start039-holder'; BEGIN; SELECT id FROM corporate_quotes WHERE id='{quote}' FOR UPDATE; SELECT pg_sleep(2); COMMIT;")
  deadline=time.monotonic()+10
  while sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='start039-holder' AND wait_event='PgSleep'")!='1':
   assert time.monotonic()<deadline;time.sleep(.03)
  pending=[pool.submit(sql,q) for q in queries]
  while int(sql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock'"))<2:
   assert time.monotonic()<deadline;time.sleep(.03)
  holder.result();return [json.loads(p.result()) for p in pending]
user=ids['superAdmin']
def prepare(n):
 q=f'50000000-0000-4000-8000-{n:012d}'
 sql(f"INSERT INTO corporate_quotes(id,user_id,status,approved_price,approved_seed_count,corporate_email) VALUES('{q}','{user}','QUOTED',200,20,'local@example.invalid');")
 claim=f"SELECT claim_b2b_checkout('{q}','{user}',200,20,true);"
 return q,claim,json.loads(sql(claim))
def begin(p):return f"SELECT begin_b2b_checkout_start('{p}','{user}',true,'tr');"
results={}
q,claim,a=prepare(1);p=a['payment_id']
r=pair([begin(p),begin(p)],q);assert sorted(x['status'] for x in r)==['dispatch','rejected'];results['double_dispatch']=r
sql(f"UPDATE b2b_checkout_starts SET expires_at=now()-interval '1 second' WHERE payment_id='{p}';")
r=pair([claim,claim],q);assert all(x['status']=='checkout_pending' for x in r);results['dispatched_never_released']=r
q,claim,a=prepare(2);p=a['payment_id'];sql(f"UPDATE b2b_checkout_starts SET expires_at=now()-interval '1 second' WHERE payment_id='{p}';")
r=pair([claim,claim],q);assert sorted(x['status'] for x in r)==['checkout_pending','claimed'];results['double_recovery']=r
assert json.loads(sql(begin(p)))['status']=='rejected'
assert sql(f"SELECT count(*) FROM payments WHERE metadata->>'quote_id'='{q}' AND status='pending'")=='1'
assert sql(f"SELECT count(*) FROM b2b_payment_observations WHERE payment_id='{p}' AND reason='init_not_started'")=='1'
q,claim,a=prepare(3);p=a['payment_id'];sql(f"UPDATE b2b_checkout_starts SET expires_at=now()-interval '1 second' WHERE payment_id='{p}';")
r=pair([claim,begin(p)],q);assert r[0]['status']=='claimed' and r[1]['status']=='rejected';results['expired_begin_vs_recovery']=r
q,claim,a=prepare(4);p=a['payment_id'];assert json.loads(sql(begin(p)))['status']=='dispatch'
finish=f"SELECT finish_b2b_checkout_start('{p}','{user}',true,'provider_response','valid-local-token',true);"
r=pair([finish,finish],q);assert sorted(x['status'] for x in r)==['ready','stale'];results['double_finish']=r
for role in ['anon','authenticated']:
 for fn in ['claim_b2b_checkout(uuid,uuid,numeric,integer,boolean)','begin_b2b_checkout_start(uuid,uuid,boolean,text)','finish_b2b_checkout_start(uuid,uuid,boolean,text,text,boolean)']:
  assert sql(f"SELECT has_function_privilege('{role}','{fn}','EXECUTE')")=='f'
 assert sql(f"SELECT has_table_privilege('{role}','b2b_checkout_starts','SELECT')")=='f'
assert sql("SELECT has_function_privilege('service_role','claim_b2b_checkout_core(uuid,uuid,numeric,integer,boolean)','EXECUTE')")=='f'
print(json.dumps(dict(postgres=sql('SHOW server_version'),network='none',host_ports=0,external_calls=0,real_lock_waiters=2,results=results),indent=2))
