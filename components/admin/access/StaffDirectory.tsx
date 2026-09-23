"use client";
import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { accessRequest } from "./transport";
import { AccessPage, LoadError } from "./shared";
import { scopeLabel } from "./labels";
import { activeAssignment } from "./policy";
import { istanbulDate } from "../operations/client";
import type { StaffView } from "./types";
export default function StaffDirectory() {
  const [staff, setStaff] = useState<StaffView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    let alive = true;
    accessRequest<{
      items: StaffView[];
      nextCursor: string | null;
    }>(
      `/api/admin/staff?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    )
      .then((r) => {
        if (alive) {
          setStaff(r.data.items);
          setNext(r.data.nextCursor ?? null);
          setError(null);
        }
      })
      .catch((e) => {
        if (alive) {
          setStaff(null);
          setNext(null);
          setError(e.message);
        }
      });
    return () => {
      alive = false;
    };
  }, [revision, cursor]);
  const matches = staff?.filter(s => `${s.fullName} ${s.email}`.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr"))) ?? [];
  return (
    <AccessPage
      title="Personel yönetimi"
      description="Ekip üyelerini, rollerini ve erişim sürelerini yönetin. Yeni kişiler kendi hesaplarıyla daveti kabul eder; yönetici şifre oluşturmaz."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <Input
            label="Bu sayfada ad veya e-posta ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setStaff(null);
            setRevision((n) => n + 1);
          }}
        >
          Listeyi yenile
        </Button>
        <Link
          href="/admin/davetler"
          className="inline-flex min-h-11 items-center px-4 rounded-xl bg-emerald-600 text-white text-sm"
        >
          Davetleri yönet
        </Link>
      </div>
      {error ? (
        <LoadError error={error} retry={() => setRevision((n) => n + 1)} />
      ) : !staff ? (
        <p role="status" className="text-slate-300">
          Personel yükleniyor…
        </p>
      ) : (
        <ul className="space-y-3">
          {matches            .map((person) => (
              <li
                key={person.id}
                className="rounded-2xl border border-white/10 p-5 space-y-3"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <Link
                      className="text-white font-semibold underline underline-offset-4"
                      href={`/admin/kullanicilar/${person.id}`}
                    >
                      {person.fullName}
                    </Link>
                    <p className="text-sm text-slate-400 break-all">
                      {person.email}
                    </p>
                  </div>
                  <span
                    className={
                      person.isActive ? "text-emerald-200" : "text-slate-400"
                    }
                  >
                    {person.isActive ? "Aktif" : "Pasif"}
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-slate-300">
                  {person.assignments.map((a) => (
                    <li key={a.id} className="break-words">
                      {a.roleLabel} · {scopeLabel(a.scope)} ·{" "}
                      {a.endsAt
                        ? `Bitiş: ${istanbulDate(a.endsAt)}`
                        : "Süresiz"}
                      {!activeAssignment(a) && " · Şu anda geçerli değil"}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-400">
                  Ek doğrulama:{" "}
                  {person.mfa === null
                    ? "Durum alınamadı"
                    : person.mfa.enrolled
                      ? "Uygulama kayıtlı"
                      : "Kurulmamış"}
                </p>
                <Link
                  href={`/admin/kullanicilar/${person.id}`}
                  className="inline-flex min-h-11 items-center text-sm text-emerald-200 underline"
                >
                  Yetkileri incele →
                </Link>
              </li>
            ))}
        </ul>
      )}
      {staff && matches.length === 0 && (
        <p className="text-slate-300">{search ? "Bu sayfada aramanıza uygun personel yok." : "Personel kaydı bulunmuyor."}</p>
      )}
      <div className="flex gap-3">
        {cursor && (
          <Button
            onClick={() => {
              setStaff(null);
              setCursor(null);
            }}
          >
            İlk sayfa
          </Button>
        )}
        {next && (
          <Button
            onClick={() => {
              setStaff(null);
              setCursor(next);
            }}
          >
            Sonraki 50 kişi
          </Button>
        )}
      </div>
    </AccessPage>
  );
}
