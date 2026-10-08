"use client";
import { useAdmin } from "@/lib/admin-context";
import { Link } from "@/i18n/navigation";
import { canVisit } from "@/components/admin/access/policy";
export default function RoleGuard({
  children,
  path,
}: {
  children: React.ReactNode;
  path?: string;
  moduleId?: string;
}) {
  const { me, loading, error, refresh } = useAdmin();
  if (loading)
    return (
      <p role="status" className="p-8 text-slate-300">
        Yetkiler kontrol ediliyor…
      </p>
    );
  if (!me)
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-xl text-white">Yönetim erişimi doğrulanamadı</h1>
        <p role="alert" className="text-slate-300">
          {error ?? "Lütfen yönetici hesabınızla giriş yapın."}
        </p>
        <button
          className="min-h-11 px-4 text-white"
          onClick={() => void refresh()}
        >
          Yeniden dene
        </button>
        <Link href="/admin/giris" className="text-emerald-300 underline">
          Giriş yap
        </Link>
      </div>
    );
  if (path && !canVisit(me, path))
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-xl text-white">Bu sayfaya erişiminiz yok</h1>
        <p role="alert" className="text-slate-300">
          Atanan izin veya kapsam bu ekranı açmaya uygun değil.
        </p>
        <Link href="/admin/guvenlik" className="text-emerald-300 underline">
          Hesap güvenliğine git
        </Link>
      </div>
    );
  return <>{children}</>;
}
