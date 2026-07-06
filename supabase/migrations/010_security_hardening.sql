-- ═════════════════════════════════════════════════════════════════════════════
-- Güvenlik sertleştirme migration'ı (010)
--
--  1) Tüm public fonksiyonlarda search_path sabit — pg_catalog / başka şema
--     üzerinden hijack saldırısı engelleniyor.
--  2) SECURITY DEFINER fonksiyonlardan anon + authenticated EXECUTE haklarını
--     kaldır — tüm RPC çağrıları server-side service_role'dan geliyor.
--  3) orders / payments / user_rewards "Anyone can insert" / WITH CHECK (true)
--     policy'lerini DROP — client RLS bu işlemleri tamamen reddetsin, sadece
--     service_role bypass'tan geçen server route'ları yazabilsin.
--
-- Not: Migration apply_migration aracıyla DB'ye uygulandı; bu dosya repo'da
-- gelecek deploy'ların migration zincirini bozmaması için takip amaçlı.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1) search_path sabitleme
ALTER FUNCTION public.sync_profile_counters(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_orders_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_referral_code() SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_earned_seeds(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_profile_counters(uuid, integer, numeric, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.decrement_land_capacity(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.auto_create_certificate(uuid, uuid, integer, numeric, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.complete_order_chain(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.release_order_reservation(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.reserve_seeds_for_order(uuid, uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.confirm_order(uuid) SET search_path = public, pg_temp;

-- 2) SECURITY DEFINER fonksiyonlardan client EXECUTE haklarını kaldır
REVOKE EXECUTE ON FUNCTION public.auto_create_certificate(uuid, uuid, integer, numeric, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.complete_order_chain(uuid)                                  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.decrement_land_capacity(uuid, integer)                      FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code()                                    FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.increment_earned_seeds(uuid, integer)                       FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.increment_profile_counters(uuid, integer, numeric, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.process_gift_referral()                                     FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_profile_counters(uuid)                                 FROM anon, authenticated, public;

-- 3) Permissive INSERT policy'lerini kaldır
DROP POLICY IF EXISTS "Anyone can insert orders"        ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert payments"      ON public.payments;
DROP POLICY IF EXISTS "Service role can insert rewards" ON public.user_rewards;
