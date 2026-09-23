"use client";
import { useEffect, useState } from "react";
import { Input, Select, Button } from "@/components/ui";
import type { Scope } from "@/lib/admin/permission-keys";
import { scopeLabel } from "./labels";
export default function ScopeFields({
  scope,
  onChange,
  endsAt,
  onEndChange,
  disabled = false,
}: {
  scope: Scope;
  onChange: (s: Scope) => void;
  endsAt: string;
  onEndChange: (s: string) => void;
  disabled?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [sites, setSites] = useState<
    {
      id: string;
      name: string;
    }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (scope.kind !== "sites") return;
    let alive = true;
    fetch("/api/admin/lands", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "Saha seçenekleri alınamadı. Yetkinizi kontrol edip tekrar deneyin.",
          );
        const data = await r.json();
        if (!Array.isArray(data))
          throw new Error("Saha seçenekleri doğrulanamadı.");
        if (alive) {
          setSites(data.map((s) => ({ id: s.id, name: s.name })));
          setError(null);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [scope.kind, revision]);
  return (
    <div className="space-y-4">
      <Select
        label="Erişim kapsamı"
        value={scope.kind}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            e.target.value === "sites"
              ? { kind: "sites", siteIds: [] }
              : e.target.value === "assigned"
                ? { kind: "assigned" }
                : { kind: "all" },
          )
        }
      >
        <option value="all">Tüm kayıtlar</option>
        <option value="sites">Belirli sahalar</option>
        <option value="assigned">Kişiye atanmış işler</option>
      </Select>
      {scope.kind === "sites" && (
        <fieldset
          className="border border-white/15 rounded-xl p-4 space-y-2"
          disabled={disabled}
        >
          <legend className="text-sm text-slate-300 px-2">Sahalar</legend>
          {error ? (
            <>
              <p role="alert" className="text-red-200 text-sm">
                {error}
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRevision((n) => n + 1)}
              >
                Seçenekleri yenile
              </Button>
            </>
          ) : sites.length ? (
            sites.map((site) => (
              <label
                key={site.id}
                className="min-h-11 flex gap-3 items-center text-sm text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={scope.siteIds.includes(site.id)}
                  onChange={(e) =>
                    onChange({
                      kind: "sites",
                      siteIds: e.target.checked
                        ? [...scope.siteIds, site.id]
                        : scope.siteIds.filter((id) => id !== site.id),
                    })
                  }
                />
                {site.name}
              </label>
            ))
          ) : (
            <p className="text-sm text-slate-400">
              {loaded ? "Saha bulunmuyor." : "Sahalar yükleniyor…"}
            </p>
          )}
          {scope.siteIds
            .filter((id) => !sites.some((s) => s.id === id))
            .map((id) => (
              <label
                key={id}
                className="min-h-11 flex items-center gap-3 text-amber-200 text-xs break-all"
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() =>
                    onChange({
                      kind: "sites",
                      siteIds: scope.siteIds.filter((value) => value !== id),
                    })
                  }
                />
                Mevcut seçim: {id} (saha adı alınamadı)
              </label>
            ))}
        </fieldset>
      )}
      {scope.kind !== "all" && (
        <p className="text-sm text-amber-200">
          Saha veya görev kapsamını henüz desteklemeyen ekranlara bu atamayla
          erişilemez.
        </p>
      )}
      <Input
        type="datetime-local"
        step={1}
        label="Erişim bitişi (Türkiye saati, isteğe bağlı)"
        value={endsAt}
        onChange={(e) => onEndChange(e.target.value)}
        disabled={disabled}
        helperText="Boş bırakılırsa süresiz. Davet bağlantısının geçerlilik süresinden farklıdır."
      />
      <p className="text-xs text-slate-400 break-words">
        Seçilen kapsam: {scopeLabel(scope, sites)}
      </p>
    </div>
  );
}
