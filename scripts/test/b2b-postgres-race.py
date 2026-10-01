"""Run against a NEW disposable, network-isolated PostgreSQL container only.
Usage: python3 scripts/test/b2b-postgres-race.py <container-name>
The container is supplied by the operator; no host/database URL or production credential is used.
"""
import concurrent.futures, json, pathlib, subprocess, sys, time
root = pathlib.Path(__file__).resolve().parents[2]
container = sys.argv[1]
info = json.loads(subprocess.check_output(['docker','inspect',container]))[0]
assert info['HostConfig']['NetworkMode'] == 'none', 'requires network=none'
assert not info['HostConfig'].get('Binds') and not info.get('Mounts'), 'requires disposable filesystem without volumes'
def sql(text):
    p = subprocess.run(['docker','exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=text,text=True,capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr)
    return p.stdout.strip()
assert sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'") == '0', 'requires empty database'
fixture = (root/'scripts/test/fixtures/b2b-payment-schema.sql').read_text()
upgrade = (root/'supabase/migrations/004_corporate_quotes_upgrade.sql').read_text().split('-- ── Email Log Table')[0]
sql(fixture+upgrade+(root/'supabase/migrations/034_b2b_payment_result.sql').read_text())
user='00000000-0000-4000-8000-000000000001'; quote='00000000-0000-4000-8000-000000000003'
sql(f"INSERT INTO corporate_quotes(id,user_id,status,approved_price,approved_seed_count,corporate_email) VALUES('{quote}','{user}','QUOTED',200,20,'local@example.invalid');")
def racing(a,b):
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        holder=pool.submit(sql,f"SET application_name='astra-race-holder'; BEGIN; SELECT id FROM corporate_quotes WHERE id='{quote}' FOR UPDATE; SELECT pg_sleep(2); COMMIT;")
        deadline=time.monotonic()+5
        while sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='astra-race-holder' AND wait_event='PgSleep'") != '1':
            assert time.monotonic()<deadline, 'holder did not lock'
            time.sleep(.05)
        first=pool.submit(sql,a);second=pool.submit(sql,b)
        # Both concurrent sessions must be blocked on the real row lock, not run sequentially by the script.
        while int(sql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock'"))<2:
            assert time.monotonic()<deadline, 'two lock waiters not observed'
            time.sleep(.05)
        holder.result()
        return [json.loads(first.result()),json.loads(second.result())]
claim=f"SELECT claim_b2b_checkout('{quote}','{user}',200,20,true);"
r=racing(claim,claim)
assert sorted(x['status'] for x in r)==['checkout_in_progress','claimed'],r
assert sql('SELECT count(*) FROM payments')=='1';assert sql('SELECT count(*) FROM orders')=='1'
claimed=next(x for x in r if x['status']=='claimed')
result=dict(status='success',payment_status='SUCCESS',payment_id='provider-local-race',basket_id=claimed['order_id'],conversation_id=claimed['payment_id'],currency='TRY',price_kurus=20000,paid_kurus=20000,fraud_status=1)
# A common provider-id advisory lock means the second waiter may wait there instead of at the quote row.
callback=f"SELECT record_b2b_payment_result('{claimed['payment_id']}',true,'{json.dumps(result)}'::jsonb);"
r2=racing(callback,callback)
assert sorted(x['status'] for x in r2)==['already_paid','paid'],r2
assert sql('SELECT count(*) FROM b2b_payment_observations')=='1'
assert sql("SELECT status FROM payments")=='success'
assert sql("SELECT status FROM orders")=='confirmed'
assert sql("SELECT status FROM corporate_quotes")=='PAID'
print(json.dumps(dict(postgres=sql('SHOW server_version'),network='none',checkout=r,callback=r2,order_count=1,payment_count=1,observation_count=1,real_lock_waiters=2,external_calls=0),indent=2))
