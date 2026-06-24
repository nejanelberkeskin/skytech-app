-- ═════════════════════════════════════════════════════════════════════════════
-- Demo bölge ayarı: yalnız Çanakkale, İzmir, Bursa aktif demo saha olacak.
-- Diğer tüm land'ler is_public=false yapılır (UI listing'leri is_public=true
-- ile filtreliyor — listede artık görünmezler). Order/allocation referansları
-- bozulmaması için satırlar silinmez, sadece gizlenir.
-- ═════════════════════════════════════════════════════════════════════════════

UPDATE public.lands SET is_public = false;

UPDATE public.lands
SET is_public = true,
    name = 'İzmir Demo Sahası',
    status = 'open'
WHERE id = '202c05e1-4963-4982-89f7-ded181ab57c2';

INSERT INTO public.lands (name, region, capacity_seeds, filled_seeds, reserved_seeds, status, is_public, is_corporate, lat, lng)
VALUES
  ('Çanakkale Demo Sahası', 'Çanakkale', 10000, 0, 0, 'open', true, true, 40.1553, 26.4142),
  ('Bursa Demo Sahası',     'Bursa',     10000, 0, 0, 'open', true, true, 40.1828, 29.0670);
