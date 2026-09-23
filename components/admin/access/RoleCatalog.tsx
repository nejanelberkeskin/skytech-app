"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui";
import { MFA_PERMISSIONS } from "@/lib/admin/permission-keys";
import { accessRequest } from "./transport";
import { AccessPage, LoadError } from "./shared";
import { permissionLabel } from "./labels";
import type { RoleView } from "./types";
export default function RoleCatalog() {
  const [roles, setRoles] = useState<RoleView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  useEffect(() => {
    let alive = true;
    accessRequest<{
      roles: RoleView[];
    }>("/api/admin/roles")
      .then((r) => {
        if (alive) {
          setRoles(r.data.roles);
          setError(null);
        }
      })
      .catch((e) => {
        if (alive) {
          setRoles(null);
          setError(e.message);
        }
      });
    return () => {
      alive = false;
    };
  }, [revision]);
  const matches =
    roles?.filter((r) =>
      [r.label, r.description, ...r.permissions.map((p) => permissionLabel(p))]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(search.toLocaleLowerCase("tr")),
    ) ?? [];
  return (
    <AccessPage
      title="Roller ve izinler"
      description="Bir rolün neleri yapabildiğini inceleyin. Gerçek erişim, kişiye atanan kapsam ve süreyle birlikte belirlenir."
    >
      <Input
        label="Rol veya izin ara"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error ? (
        <LoadError error={error} retry={() => setRevision((n) => n + 1)} />
      ) : !roles ? (
        <p role="status" className="text-slate-300">
          Roller yükleniyor…
        </p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {matches.map((role) => (
            <article
              key={role.key}
              className="rounded-2xl border border-white/10 p-5 space-y-3"
            >
              <h2 className="text-lg font-semibold text-white">{role.label}</h2>
              <p className="text-sm text-slate-300">{role.description}</p>
              <p className="text-xs text-slate-400">
                {role.isSystem ? "Sistem rolü · değiştirilemez" : "Özel rol"} ·{" "}
                {role.permissions.length} izin
              </p>
              <details>
                <summary className="min-h-11 cursor-pointer text-emerald-200">
                  İzinleri incele
                </summary>
                <ul className="space-y-2 text-sm text-slate-300">
                  {role.permissions.map((p) => (
                    <li key={p}>
                      {permissionLabel(p)}
                      {(MFA_PERMISSIONS as ReadonlySet<string>).has(p) && (
                        <span className="text-amber-200">
                          {" "}
                          · Ek doğrulama kapsamı
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
      )}
      {roles && !error && matches.length === 0 && (
        <p className="text-slate-300">Aramanıza uygun rol bulunmuyor.</p>
      )}
      <p className="text-sm text-slate-400">
        Bu sürümde hazır roller atanabilir; özel rol oluşturma ve izin düzenleme
        henüz kullanılamıyor.
      </p>
    </AccessPage>
  );
}
