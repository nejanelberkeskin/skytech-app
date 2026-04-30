/**
 * Uygulama (auth-aware) route group'u runtime'da render edilir.
 * Tüm uygulama sayfaları (admin, hesabim, kurumsal/panel, bireysel/...,
 * checkout, auth) Supabase session / cookie / RLS gerektirir; bunlar
 * build-time prerender ile uyumsuzdur. force-dynamic flag'i Next.js'in
 * bu sayfaları statik üretmeye çalışmasını engeller.
 *
 * Vitrin (pazarlama) sayfaları (vitrin)/ route group'unda kalır ve SSG'dir.
 */
export const dynamic = "force-dynamic";

export default function UygulamaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
