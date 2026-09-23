"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { accessRequest } from "./transport";
import { AccessPage, LoadError } from "./shared";
import { istanbulDate } from "../operations/client";
import type { AuditEntry } from "./types";
export default function AuditHistory() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState({
    entity: "",
    action: "",
    from: "",
    to: "",
  });
  const [filter, setFilter] = useState("");
  const generation = useRef({ value: 0 });
  useEffect(() => {
    const token = generation.current;
    const current = ++token.value;
    const query = new URLSearchParams(filter);
    query.set("limit", "50");
    if (cursor) query.set("cursor", cursor);
    accessRequest<{
      items: AuditEntry[];
      nextCursor: string | null;
    }>(`/api/admin/audit?${query}`)
      .then((r) => {
        if (current === token.value) {
          setEntries(r.data.items);
          setNext(r.data.nextCursor);
          setError(null);
        }
      })
      .catch((e) => {
        if (current === token.value) {
          setEntries([]);
          setNext(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (current === token.value) setBusy(false);
      });
    return () => {
      token.value++;
    };
  }, [filter, cursor, revision]);
  const apply = () => {
    if (fields.from && fields.to && fields.from > fields.to) {
      setError("Başlangıç tarihi bitişten sonra olamaz.");
      return;
    }
    const q = new URLSearchParams();
    if (fields.entity.trim()) q.set("entity", fields.entity.trim());
    if (fields.action) q.set("action", fields.action);
    if (fields.from)
      q.set("from", new Date(`${fields.from}T00:00:00+03:00`).toISOString());
    if (fields.to)
      q.set("to", new Date(`${fields.to}T23:59:59.999+03:00`).toISOString());
    setBusy(true);
    setCursor(null);
    setFilter(q.toString());
    setRevision((n) => n + 1);
  };
  return (
    <AccessPage
      title="İşlem geçmişi"
      description="Kim, ne zaman, hangi kaydı değiştirdi? Kayıtlar salt okunurdur; hassas alanlar sunucuda maskelenir."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <Input
          label="Kayıt türü"
          placeholder="Örn. admin_assignment"
          value={fields.entity}
          onChange={(e) => setFields({ ...fields, entity: e.target.value })}
        />
        <Select
          label="İşlem"
          value={fields.action}
          onChange={(e) => setFields({ ...fields, action: e.target.value })}
        >
          <option value="">Tümü</option>
          {["CREATE", "UPDATE", "DELETE"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </Select>
        <Input
          label="Başlangıç (Türkiye)"
          type="date"
          value={fields.from}
          onChange={(e) => setFields({ ...fields, from: e.target.value })}
        />
        <Input
          label="Bitiş (Türkiye)"
          type="date"
          value={fields.to}
          onChange={(e) => setFields({ ...fields, to: e.target.value })}
        />
        <Button type="submit" disabled={busy}>
          Filtrele
        </Button>
      </form>
      {error ? (
        <LoadError
          error={error}
          retry={() => {
            setBusy(true);
            setRevision((n) => n + 1);
          }}
        />
      ) : busy ? (
        <p role="status" className="text-slate-300">
          İşlem geçmişi yükleniyor…
        </p>
      ) : entries.length ? (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-white/10 p-4 space-y-2"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium text-white">
                  {entry.action} · {entry.entity}
                </p>
                <time className="text-sm text-slate-400">
                  {istanbulDate(entry.at)}
                </time>
              </div>
              <p className="text-sm text-slate-300 break-all">
                {entry.actor.label || "Sistem"} · {entry.entityId}
              </p>
              <details>
                <summary className="min-h-11 text-emerald-200 text-sm cursor-pointer">
                  Kayıt ayrıntıları
                </summary>
                <pre className="whitespace-pre-wrap break-all text-xs text-slate-300">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-slate-300">Bu filtrelerde işlem kaydı yok.</p>
      )}
      <div className="flex flex-wrap gap-3">
        {cursor && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setCursor(null);
            }}
          >
            İlk sayfa
          </Button>
        )}
        {next && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setCursor(next);
            }}
          >
            Sonraki 50 kayıt
          </Button>
        )}
      </div>
    </AccessPage>
  );
}
