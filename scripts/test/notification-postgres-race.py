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
sql('CREATE TABLE email_logs(id uuid DEFAULT gen_random_uuid(),template text,recipient_email text,subject text,related_id text,resend_id text,status text);')
sql('BEGIN;\n'+(root/'supabase/migrations/036_notification_outbox.sql').read_text()+'\nCOMMIT;')
order='30000000-0000-0000-0000-000000000001'
sql(f"""INSERT INTO release_orders(id,order_no,status,is_test,land_id,site_snapshot,season_label,quantity,unit_price_kurus,total_kurus,vat_rate,certificate_name,buyer_type,buyer_first_name,buyer_last_name,buyer_email,buyer_phone,invoice,consents,documents_version)
 VALUES('{order}','SG-2026-AAAAAB','awaiting_payment',true,'{ids['land']}','{{}}','2026-2027',20,1000,20000,20,'Fixture','individual','Test','Person','local@example.invalid','000','{{}}','{{}}','test');
 UPDATE release_orders SET status='paid',paid_at=now() WHERE id='{order}';""")
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
claim="SELECT coalesce(claim_order_notification(ARRAY['release_order_confirm']), 'null'::jsonb);"
claims=race(claim,'LOCK TABLE order_notification_outbox IN ACCESS EXCLUSIVE MODE;')
assert sum(x is not None for x in claims)==1
job=next(x for x in claims if x)
body=json.dumps(dict(from_='from@example.invalid',to=['local@example.invalid'],subject='fixture',html='<p>fixed</p>')).replace('from_','from')
def step(job,action,extra=''):
 return json.loads(sql(f"SELECT coalesce(advance_order_notification('{job['id']}','{job['claim_token']}','{action}'{extra}), 'null'::jsonb);"))
step(job,'freeze',f",p_body=>'{body}'")
sql(f"UPDATE order_notification_outbox SET lease_until=now()-interval '1 second' WHERE id='{job['id']}';")
next_job=json.loads(sql(claim)); assert next_job['claim_token']!=job['claim_token']
assert step(job,'begin') is None
step(next_job,'begin')
settle=f"SELECT coalesce(advance_order_notification('{job['id']}','{next_job['claim_token']}','sent',p_provider_id=>'local-provider-accepted'), 'null'::jsonb);"
settled=race(settle,f"SELECT id FROM order_notification_outbox WHERE id='{job['id']}' FOR UPDATE;")
assert sum(x is not None for x in settled)==1
assert sql("SELECT count(*) FROM order_events WHERE type='email_sent'")=='1'
assert sql('SELECT count(*) FROM email_logs')=='1'
assert sql(f"SELECT state FROM order_notification_outbox WHERE id='{job['id']}'")=='sent'
print(json.dumps(dict(postgres=sql('SHOW server_version'),network='none',real_lock_waiters=2,claim_owners=1,expired_owner_fenced=True,settlement_count=1,email_events=1,email_logs=1,external_calls=0),indent=2))
