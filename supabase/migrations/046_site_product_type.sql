-- Saha bazında ürün tipi ve ikinci birim bedel (046).
--  • lands.product_type: sahada bırakılan ürün — coated_seed (yosun ekstraktı kaplamalı tohum) | seed_ball (tohum topu).
--    Mevcut sahaların hepsinde kaplamalı tohum bırakılıyor; varsayılan budur.
--  • sales_settings.seed_ball_unit_price_kurus: tohum topu birim bedeli (KDV dâhil, kuruş). Varsayılan 50,00 TL.
--    Mevcut unit_price_kurus kaplamalı tohumun birim bedelidir (değeri değişmez).
-- Yalnız ekleme; veri değişmez. Sipariş, sahanın ürün tipini site_snapshot içinde saklar.
-- No transaction control here: apply the entire file in one recorded transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.lands
  ADD COLUMN product_type text NOT NULL DEFAULT 'coated_seed'
    CHECK (product_type IN ('coated_seed', 'seed_ball'));
COMMENT ON COLUMN public.lands.product_type IS 'Sahada bırakılan ürün: coated_seed (yosun ekstraktı kaplamalı tohum) | seed_ball (tohum topu)';
GRANT SELECT (product_type) ON public.lands TO anon, authenticated;

ALTER TABLE public.sales_settings
  ADD COLUMN seed_ball_unit_price_kurus integer NOT NULL DEFAULT 5000
    CHECK (seed_ball_unit_price_kurus > 0);
COMMENT ON COLUMN public.sales_settings.unit_price_kurus IS 'Yosun ekstraktı kaplamalı tohum birim bedeli (KDV dâhil, kuruş)';
COMMENT ON COLUMN public.sales_settings.seed_ball_unit_price_kurus IS 'Tohum topu birim bedeli (KDV dâhil, kuruş)';
