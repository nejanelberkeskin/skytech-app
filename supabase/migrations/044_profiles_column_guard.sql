-- Profil tablosunda istemci yetkisini daraltır (güvenlik). Önceden anon ve authenticated rollerinin tabloda tam yetkisi
-- vardı ve "kendi satırını güncelle" politikası sütun sınırı koymuyordu: üye kendi puan/tohum sayılarını
-- (earned_seeds, total_seeds, referral_code, …) ve e-postasını değiştirebiliyor, istemciden satır ekleyerek eski hediye
-- ödülü tetikleyicisini çalıştırabiliyordu.
-- Sonrası: anon hiçbir yetki almaz; üye yalnız kendi satırını okur ve yalnız full_name, phone, address, city,
-- avatar_url, updated_at alanlarını günceller. Satırı handle_new_user (SECURITY DEFINER) açar; sunucu servis rolüyle yazar.
-- Veri değişmez.
-- No transaction control here: apply the entire file in one recorded transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE ALL ON public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, address, city, avatar_url, updated_at) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
