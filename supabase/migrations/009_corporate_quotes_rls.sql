-- ─────────────────────────────────────────────────────────────────────────────
-- corporate_quotes — Row Level Security
--
-- Akış (kurumsal/teklif-al sayfası):
--   • Login ise mevcut authenticated user.id ile insert
--   • Login değilse önce supabase.auth.signUp ile yeni user yarat,
--     dönen user.id ile insert
--
-- Policy hedefi:
--   • INSERT — caller user_id sağlamalı; authenticated ise auth.uid() ile
--             eşleşmeli (başkası adına kayıt atmayı engeller).
--   • SELECT — yalnız sahibi kendi kayıtlarını görür.
--   • UPDATE/DELETE — hiçbir client policy YOK; admin işlemleri service_role
--             ile RLS bypass eder (lib/supabase/server.ts → createServiceRoleClient).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.corporate_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert quote requires owner"
  ON public.corporate_quotes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NOT NULL
    AND (auth.uid() IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "Users can view own quotes"
  ON public.corporate_quotes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
