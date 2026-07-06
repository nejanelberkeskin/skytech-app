-- Kullanıcı revizesi: Meşe ve Kayın katalogdan kalkar (deactivate — order
-- geçmişi bozulmasın diye silinmez), Karaçam eklenir, Ardıç latin adı
-- yalnızca cins adı (Juniperus) olarak sadeleşir.

UPDATE public.seed_catalog SET is_active = false WHERE slug IN ('mese', 'kayin');
UPDATE public.seed_catalog SET latin_name = 'Juniperus' WHERE slug = 'ardic';

INSERT INTO public.seed_catalog
  (slug, name, latin_name, emoji, color, description, price, stock, max_order_qty, is_active, sort_order)
VALUES (
  'karacam', 'Karaçam', 'Pinus nigra', '🌲', 'from-slate-600 to-emerald-900',
  'Anadolu''nun yüksek kesimlerine dayanıklı, kuraklığa ve soğuğa toleranslı yerli çam türü. Erozyon kontrolü ve yüksek rakım ormanlaştırmasında öncü türdür.',
  14, 500, 500, true, 3
)
ON CONFLICT (slug) DO NOTHING;
