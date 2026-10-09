-- Ödeme belirteci tek bir güncel siparişi gösterebilir. 024–030 kapasite taslaklarına bağımlı değildir.
-- Canlı uygulama ayrı yayın adımıdır. Eski çift kayıt varsa hiçbir kayıt silinmez/değiştirilmez: DUR.
-- No transaction control here: apply the entire file in one recorded transaction or psql --single-transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.release_orders IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.release_orders WHERE payment_token IS NOT NULL
    GROUP BY payment_token HAVING count(*) > 1
  ) THEN
    -- Belirtecin kendisini hata/günlüğe koyma.
    RAISE EXCEPTION 'payment_token_duplicates_require_reconciliation';
  END IF;
END $$;
CREATE UNIQUE INDEX release_orders_payment_token_key
  ON public.release_orders (payment_token) WHERE payment_token IS NOT NULL;
CREATE INDEX order_events_payment_token_hash_idx
  ON public.order_events ((data->>'tokenHash')) WHERE type = 'payment_started';
