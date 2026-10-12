import {
  GA_MEASUREMENT_ID, CONSENT_STORAGE_KEY, CONSENT_MAX_AGE_MS, ANALYTICS_EXCLUDED_PATH_RE, ANALYTICS_EXCLUDED_SEGMENT_RE, LOCALE_PREFIX_RE,
} from "./analytics";

/**
 * GA başlangıç betiği. İzin kaydını lib/analytics.ts `parseStoredConsent` ile aynı kurala göre yeniden doğrular (6 ay ömür).
 * Geçmiş koruması: GA4'ün gelişmiş ölçümü tarayıcı geçmişi değişince (istemci tarafı gezinme) adresin TAMAMIYLA page_view
 * gönderebilir; Next adres çubuğunu React efektlerinden ÖNCE değiştirdiği için GoogleAnalytics'in efekti (stopAnalytics)
 * yetişemez. Bu yüzden history.pushState/replaceState ve popstate, gtag.js'ten önce sarılır: yeni adres ölçüm dışı bir yolsa
 * ya da sorgu/parça taşıyorsa GA aynı anda (zaman uyumlu) devre dışı kalır; ölçüm dışı yolda efekt ayrıca sayfayı yeniler.
 */
export const GA_INIT_SCRIPT = `(function(){
  var KEY=${JSON.stringify(CONSENT_STORAGE_KEY)}, MAX=${CONSENT_MAX_AGE_MS}, ID=${JSON.stringify(GA_MEASUREMENT_ID)};
  var ok=false;
  try { var v=JSON.parse(window.localStorage.getItem(KEY)); var n=Date.now();
    ok=!!v && v.c==='granted' && typeof v.t==='number' && n-v.t<MAX && v.t<=n+60000; } catch(e) { ok=false; }
  if(!ok) return;
  var EX=new RegExp(${JSON.stringify(ANALYTICS_EXCLUDED_PATH_RE.source)}), SEG=new RegExp(${JSON.stringify(ANALYTICS_EXCLUDED_SEGMENT_RE.source)}),
      LOC=new RegExp(${JSON.stringify(LOCALE_PREFIX_RE.source)});
  function allowed(){ var c=window.location.pathname.replace(LOC,''); return !EX.test(c) && !SEG.test(c); }
  function guard(){ var off=!allowed() || !!window.location.search || !!window.location.hash; window['ga-disable-'+ID]=off; }
  ['pushState','replaceState'].forEach(function(m){ var o=history[m]; history[m]=function(){ var r=o.apply(this,arguments); guard(); return r; }; });
  window.addEventListener('popstate', guard);
  window.skytechAnalyticsLoaded = true;
  window['ga-disable-'+ID] = false;
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  gtag('js', new Date());
  var loc = window.location.origin + window.location.pathname;
  gtag('config', ID, { allow_google_signals: false, allow_ad_personalization_signals: false, page_location: loc, page_referrer: '', send_page_view: false });
  gtag('event', 'page_view', { page_location: loc, page_referrer: '' });
})();`;
