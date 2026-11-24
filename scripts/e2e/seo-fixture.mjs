// Read-only local PostgREST substitute. No credentials, persistent writes or external calls.
import http from 'node:http';
import fs from 'node:fs';
const port = Number(process.env.FIXTURE_PORT || 4828);
const sites = [
  ['Bursa', 'bursa', 'Gürsu (Dışkaya)', 92.8, 'coated_seed'],
  ['Çanakkale', 'canakkale', 'Merkez (Saraycık)', 95, 'seed_ball'],
  ['İzmir', 'izmir', 'Aliağa', 93.8, 'coated_seed'],
].map(([name, slug, district, area, product], index) => ({
  id: `00000000-0000-4000-8000-00000000000${index + 1}`,
  name: `${name} Proje Uygulama Sahası`, slug: `${slug}-proje-uygulama-sahasi`,
  name_i18n: {}, summary_i18n: null, province: name, region: name, district,
  area_hectares: area, product_type: product, is_fire_affected: true, fire_year: 2025,
  work_type: 'ormanlastirma_genclestirme', species_slugs: index ? ['kizilcam'] : [],
  cover_image: null, gallery: [], video_url: null, media_links: [],
  status: 'open', is_public: true, lat: 40.16, lng: 28.4, sort_order: index,
}));
const settings = {
  id: true, unit_price_kurus: 1000, seed_ball_unit_price_kurus: 5000,
  min_quantity: 20, max_quantity: 100000, quantity_presets: [20, 50, 100],
  vat_rate: 20, invoice_timing: 'on_performance', prep_days: 15,
  payment_ttl_minutes: 45, orders_paused: false, updated_at: '2026-11-18T00:00:00Z', updated_by: null,
};
http.createServer((req, res) => {
  if (process.env.FIXTURE_LOG) fs.appendFileSync(process.env.FIXTURE_LOG, JSON.stringify({ method: req.method, url: req.url }) + '\n');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end('{}'); return; }
  const url = new URL(req.url, 'http://localhost');
  let result;
  if (url.pathname === '/rest/v1/lands') {
    const id = url.searchParams.get('id');
    result = id?.startsWith('eq.') ? sites.filter(site => site.id === id.slice(3)) : sites;
  }
  else if (url.pathname === '/rest/v1/sales_settings') result = settings;
  else if (url.pathname === '/rest/v1/seed_catalog') result = [{ slug: 'kizilcam', name: 'Kızılçam', latin_name: 'Pinus brutia' }];
  else if (url.pathname === '/rest/v1/release_batches') result = [];
  else if (url.pathname.startsWith('/auth/')) { res.writeHead(401); result = { message: 'No fixture session' }; }
  else { res.writeHead(404); result = { message: 'No fixture for this read' }; }
  res.end(JSON.stringify(result));
}).listen(port, '127.0.0.1', () => console.log(`Read-only SEO fixture listening on ${port}`));
