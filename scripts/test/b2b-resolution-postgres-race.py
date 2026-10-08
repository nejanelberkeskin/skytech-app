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
for f in ['034_b2b_payment_result.sql','035_b2b_reconciliation.sql','037_b2b_resolution.sql']:
 sql('BEGIN;\n'+(root/'supabase/migrations'/f).read_text()+'\nCOMMIT;')
def race(q,lock):
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  holder=pool.submit(sql,"SET application_name='notification-holder'; BEGIN; "+lock+" SELECT pg_sleep(2); COMMIT;")
  deadline=time.monotonic()+6
  while sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='notification-holder' AND wait_event='PgSleep'")!='1':
   assert time.monotonic()<deadline;time.sleep(.04)
  a=pool.submit(sql,q);b=pool.submit(sql,q)
  while int(sql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock'"))<2:
   assert time.monotonic()<deadline;time.sleep(.04)
  holder.result();return [json.loads(a.result()),json.loads(b.result())]

def prepare(n):
 q=f'40000000-0000-4000-8000-{n:012d}'
 sql(f"INSERT INTO corporate_quotes(id,user_id,status,approved_price,approved_seed_count,corporate_email) VALUES('{q}','{ids['superAdmin']}','QUOTED',200,20,'local@example.invalid');")
 claim=json.loads(sql(f"SELECT claim_b2b_checkout('{q}','{ids['superAdmin']}',200,20,true);"))
 p,o=claim['payment_id'],claim['order_id']
 op=json.loads(sql(f"SELECT begin_b2b_resolution('{p}','{ids['superAdmin']}',now(),'release','Provider closed session CASE-{n}',true,true);"))
 failure=dict(status='success',payment_status='FAILURE',payment_id=f'provider-{n}',basket_id=o,conversation_id=p,currency='TRY',price_kurus=20000,paid_kurus=0,fraud_status=None)
 finish=f"SELECT finish_b2b_resolution('{op['operationId']}','{ids['superAdmin']}',now(),true,'{json.dumps(failure)}');"
 return q,p,o,finish,failure
q,p,o,finish,failure=prepare(1)
settled=race(finish,f"SELECT id FROM corporate_quotes WHERE id='{q}' FOR UPDATE;")
assert settled==[{'status':'released'},{'status':'released'}]
assert sql("SELECT count(*) FROM admin_audit_logs WHERE entity='b2b_payment_resolution'")=='1'
# A provider callback racing a release: one serial order, neither outcome loses a charge.
q,p,o,finish,failure=prepare(2)
success={**failure,'payment_status':'SUCCESS','paid_kurus':20000,'fraud_status':1}
callback=f"SELECT record_b2b_payment_result('{p}',true,'{json.dumps(success)}');"
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 holder=pool.submit(sql,f"SET application_name='c1-holder'; BEGIN; SELECT id FROM corporate_quotes WHERE id='{q}' FOR UPDATE; SELECT pg_sleep(2); COMMIT;")
 deadline=time.monotonic()+6
 while sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='c1-holder' AND wait_event='PgSleep'")!='1':
  assert time.monotonic()<deadline;time.sleep(.04)
 a=pool.submit(sql,finish);b=pool.submit(sql,callback)
 while int(sql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock'"))<2:
  assert time.monotonic()<deadline;time.sleep(.04)
 holder.result(); outcomes=[json.loads(a.result())['status'],json.loads(b.result())['status']]
state=sql(f"SELECT status FROM payments WHERE id='{p}'")
assert (outcomes==['stale','paid'] and state=='success') or (outcomes==['released','review'] and state=='failed')
if state=='failed': assert sql(f"SELECT count(*) FROM b2b_payment_holds WHERE payment_id='{p}' AND resolved_at IS NULL")=='1'
print(json.dumps(dict(postgres=sql('SHOW server_version'),network='none',lock_waiters=2,repeated_release=settled,release_callback=outcomes,final_payment_state=state,external_calls=0),indent=2))
