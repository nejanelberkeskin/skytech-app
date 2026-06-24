-- Ardıç (Juniperus oxycedrus) — yerli tür katalog eklemesi.
INSERT INTO public.seed_catalog
  (slug, name, latin_name, emoji, color, description, price, stock, max_order_qty, is_active, sort_order)
VALUES (
  'ardic',
  'Ardıç',
  'Juniperus oxycedrus',
  '🌿',
  'from-emerald-600 to-emerald-800',
  'Anadolu''nun sarp ve kurak yamaçlarına uyum sağlayan dayanıklı tür. Eteklerden zirvelere kadar erozyon kontrolünde kritik rol oynar; meyveleri kuş ve yaban hayatını destekler.',
  16, 500, 500, true, 5
)
ON CONFLICT (slug) DO NOTHING;
