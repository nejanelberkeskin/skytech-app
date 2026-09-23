"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Input } from "@/components/ui";
import type { SiteOptionDto } from "@/lib/admin/dto";
import { accessRequest } from "./transport";
type Page = { items: SiteOptionDto[]; nextCursor: string | null };
export default function SitePicker({
  ids,
  onChange,
  disabled,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<Page | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const paging = useRef(false);
  const selectedKey = JSON.stringify([...ids].sort());
  useEffect(() => {
    let alive = true;
    const selected: string[] = JSON.parse(selectedKey);
    if (!selected.length) return;
    accessRequest<Page>(
      `/api/admin/sites/options?ids=${encodeURIComponent(selected.join(","))}`,
    )
      .then(({ data }) => {
        if (!alive) return;
        setNames((prev) => ({
          ...prev,
          ...Object.fromEntries(data.items.map((s) => [s.id, s.name])),
        }));
        setMissing(
          selected.filter((id) => !data.items.some((s) => s.id === id)),
        );
        setLabelError(null);
      })
      .catch((e) => {
        if (alive) setLabelError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [selectedKey, revision]);
  useEffect(() => {
    const current = ++generation.current;
    const timer = setTimeout(() => {
      setBusy(true);
      setPage(null);
      setError(null);
      accessRequest<Page>(
        `/api/admin/sites/options?limit=25&q=${encodeURIComponent(query.trim())}`,
      )
        .then(({ data }) => {
          if (generation.current !== current) return;
          setPage(data);
          setNames((prev) => ({
            ...prev,
            ...Object.fromEntries(data.items.map((s) => [s.id, s.name])),
          }));
        })
        .catch((e) => {
          if (generation.current === current) setError(e.message);
        })
        .finally(() => {
          if (generation.current === current) setBusy(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      generation.current = current + 1;
    };
  }, [query, revision]);
  async function more() {
    if (!page?.nextCursor || busy || paging.current) return;
    const current = generation.current;
    paging.current = true;
    setBusy(true);
    setError(null);
    try {
      const { data } = await accessRequest<Page>(
        `/api/admin/sites/options?limit=25&q=${encodeURIComponent(query.trim())}&cursor=${encodeURIComponent(page.nextCursor)}`,
      );
      if (current !== generation.current) return;
      setPage((prev) => ({
        items: [
          ...(prev?.items ?? []),
          ...data.items.filter((s) => !prev?.items.some((p) => p.id === s.id)),
        ],
        nextCursor: data.nextCursor,
      }));
      setNames((prev) => ({
        ...prev,
        ...Object.fromEntries(data.items.map((s) => [s.id, s.name])),
      }));
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : "Sahalar alınamadı.");
    } finally {
      paging.current = false;
      if (current === generation.current) setBusy(false);
    }
  }
  function toggle(id: string, checked: boolean) {
    onChange(
      checked ? [...new Set([...ids, id])] : ids.filter((s) => s !== id),
    );
  }
  return (
    <fieldset
      disabled={disabled}
      className="border border-white/15 rounded-xl p-4 space-y-4 min-w-0"
    >
      <legend className="text-sm text-slate-300 px-2">
        Sahalar · {ids.length} seçili
      </legend>
      {!!ids.length && (
        <div className="space-y-2">
          <h3 className="text-sm text-white">Seçilen sahalar</h3>
          <p className="text-xs text-slate-400">
            Arama veya sayfa değiştirmek seçimleri kaldırmaz.
          </p>
          {ids.map((id) => (
            <label
              key={id}
              className="min-h-11 flex gap-3 items-center text-sm text-slate-200 break-all"
            >
              <input
                type="checkbox"
                checked
                onChange={() => toggle(id, false)}
              />
              {missing.includes(id)
                ? `Bulunamayan saha: ${id} (seçimden kaldırın)`
                : (names[id] ??
                  `${labelError ? "Saha adı alınamadı" : "Saha adı alınıyor"}: ${id}`)}
            </label>
          ))}
        </div>
      )}
      {labelError && (
        <p role="alert" className="text-amber-200 text-sm">
          Seçili saha adları alınamadı. Seçimler korunuyor. {labelError}
        </p>
      )}
      <Input
        label="Saha adı veya kısa adres ara"
        value={query}
        onChange={(e) => {
          generation.current++;
          setPage(null);
          setBusy(true);
          setQuery(e.target.value);
        }}
      />
      {page?.items.map((site) => (
        <label
          key={site.id}
          className="min-h-11 flex gap-3 items-center text-sm text-slate-200"
        >
          <input
            type="checkbox"
            aria-label={`${site.name} seçimi`}
            checked={ids.includes(site.id)}
            disabled={!ids.includes(site.id) && ids.length >= 200}
            onChange={(e) => toggle(site.id, e.target.checked)}
          />
          <span>
            {site.name}
            <span className="block text-xs text-slate-400 break-all">
              {site.slug} · {site.isPublic ? "Yayında" : "Yayında değil"}
            </span>
          </span>
        </label>
      ))}
      {!busy && page?.items.length === 0 && (
        <p className="text-sm text-slate-300">
          Aramanıza uygun saha bulunamadı.
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm text-slate-300">
          Sahalar yükleniyor…
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-200 text-sm">
          {error}
        </p>
      )}
      {(error || labelError) && (
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => setRevision((n) => n + 1)}
        >
          Saha listesini yenile
        </Button>
      )}
      {page?.nextCursor && (
        <Button
          type="button"
          variant="secondary"
          onClick={more}
          disabled={busy}
        >
          Daha fazla saha göster
        </Button>
      )}
      {ids.length >= 200 && (
        <p className="text-amber-200 text-sm">En fazla 200 saha seçilebilir.</p>
      )}
    </fieldset>
  );
}
