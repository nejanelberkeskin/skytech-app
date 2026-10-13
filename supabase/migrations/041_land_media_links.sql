-- Saha sayfasındaki haber ve video bağlantıları (ör. yangın sahasında o yangının haberleri). Yönetimden girilir.
-- Öğe: { kind: 'news' | 'video', title, source, url (https), date (YYYY-MM-DD | null) }. İçerik uygulamada doğrulanır;
-- veritabanı yalnız biçimi (dizi, en çok 12 öğe) korur. Yalnız ekleme; eski kod bu kolonu okumaz.
-- No transaction control here: apply the entire file in one recorded transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.lands
  ADD COLUMN media_links jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(media_links) = 'array' AND jsonb_array_length(media_links) <= 12);
COMMENT ON COLUMN public.lands.media_links IS 'Saha sayfasında gösterilen haber/video bağlantıları: [{kind, title, source, url, date}]';
