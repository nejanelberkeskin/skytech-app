"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { useAdmin } from "@/lib/admin-context";
import type { RoleDetailDto, RoleImpactPreview } from "@/lib/admin/dto";
import type { Permission } from "@/lib/admin/permission-keys";
import { AdminApiError } from "../operations/client";
import { accessRequest } from "./transport";
import { Feedback, LoadError, useAccessCommand } from "./shared";
import { hasFullPermission } from "./policy";
import { permissionLabel } from "./labels";
import PermissionFields from "./PermissionFields";
type Draft = {
  key: string;
  label: string;
  description: string;
  permissions: Permission[];
  reason: string;
};
export default function RoleEditor({
  source,
  edit,
  onClose,
  onSaved,
}: {
  source?: string;
  edit: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { me, refresh } = useAdmin();
  const command = useAccessCommand();
  const [detail, setDetail] = useState<RoleDetailDto | null>(null);
  const [loaded, setLoaded] = useState(!source);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    key: "",
    label: "",
    description: "",
    permissions: [],
    reason: "",
  });
  const [review, setReview] = useState<{
    draft: Draft;
    impact: RoleImpactPreview | null;
  } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const previewLock = useRef(false);
  const initialized = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);
  useEffect(() => {
    if (!source) return;
    let alive = true;
    accessRequest<RoleDetailDto>(
      `/api/admin/roles/${encodeURIComponent(source)}`,
    )
      .then(({ data }) => {
        if (!alive) return;
        setDetail(data);
        setLoaded(true);
        setLoadError(null);
        if (!initialized.current) {
          initialized.current = true;
          setDraft({
            key: edit ? data.key : "",
            label: edit ? data.label : `${data.label} kopyası`,
            description: data.description,
            permissions: data.permissions,
            reason: "",
          });
        }
      })
      .catch((e) => {
        if (alive) {
          setLoaded(false);
          setLoadError(e.message);
        }
      });
    return () => {
      alive = false;
    };
  }, [source, edit, revision]);
  const canManage = hasFullPermission(me, "roles.manage");
  const ownRole = edit && me?.roles.some((r) => r.key === source);
  const immutable = edit && detail?.isSystem;
  const locked =
    command.busy ||
    command.uncertain ||
    previewBusy ||
    !!review ||
    !canManage ||
    !!ownRole ||
    !!immutable;
  function change(next: Partial<Draft>) {
    setDraft((v) => ({ ...v, ...next }));
    setReview(null);
  }
  async function prepare(e: React.FormEvent) {
    e.preventDefault();
    if (locked || previewLock.current) return;
    command.setError(null);
    command.setResult(null);
    const snapshot = structuredClone({
      ...draft,
      key: draft.key.trim(),
      label: draft.label.trim(),
      description: draft.description.trim(),
      reason: draft.reason.trim(),
    });
    if (
      !snapshot.permissions.length ||
      snapshot.label.length < 2 ||
      snapshot.label.length > 80 ||
      (!edit && !/^[a-z][a-z0-9_]{2,40}$/.test(snapshot.key)) ||
      (edit && snapshot.reason.length < 10)
    ) {
      command.setError(
        new Error(
          "Rol adı, geçerli anahtar ve en az bir izin gerekir. Düzenlemede gerekçe en az 10 karakter olmalıdır.",
        ),
      );
      return;
    }
    if (!edit) {
      setReview({ draft: snapshot, impact: null });
      return;
    }
    previewLock.current = true;
    setPreviewBusy(true);
    try {
      const { data } = await accessRequest<RoleImpactPreview>(
        `/api/admin/roles/${encodeURIComponent(source!)}/impact-preview`,
        "POST",
        {
          label: snapshot.label,
          description: snapshot.description,
          permissions: snapshot.permissions,
        },
      );
      setReview({ draft: snapshot, impact: data });
    } catch (e) {
      command.setError(
        e instanceof AdminApiError && e.status !== 0
          ? e
          : new Error(
              "Etki önizlemesi alınamadı. Hiçbir değişiklik kaydedilmedi; yeniden deneyebilirsiniz.",
            ),
      );
      if (
        e instanceof AdminApiError &&
        (e.status === 401 || (e.status === 403 && e.code !== "mfa_required"))
      )
        void refresh();
    } finally {
      previewLock.current = false;
      setPreviewBusy(false);
    }
  }
  async function save() {
    if (
      previewLock.current ||
      !review ||
      !canManage ||
      ownRole ||
      immutable ||
      review.impact?.blocked
    )
      return;
    const snapshot = review;
    const body = edit
      ? {
          label: snapshot.draft.label,
          description: snapshot.draft.description,
          permissions: snapshot.draft.permissions,
          reason: snapshot.draft.reason,
          expectedVersion: snapshot.impact!.role.version,
          expectedUsage: snapshot.impact!.usage,
        }
      : {
          key: snapshot.draft.key,
          label: snapshot.draft.label,
          description: snapshot.draft.description,
          permissions: snapshot.draft.permissions,
          ...(source ? { copyFrom: source } : {}),
        };
    const saved = await command.run<RoleDetailDto>(
      edit
        ? `/api/admin/roles/${encodeURIComponent(source!)}`
        : "/api/admin/roles",
      edit ? "PATCH" : "POST",
      body,
      (e) => {
        setReview(null);
        if (
          e instanceof AdminApiError &&
          ["version_changed", "usage_changed"].includes(e.code)
        ) {
          setLoaded(false);
          setRevision((n) => n + 1);
        }
      },
    );
    if (saved) {
      setReview(null);
      setDetail(saved);
      command.setResult("Rol kaydedildi.");
      onSaved("Rol kaydedildi.");
    }
  }
  async function reconcile() {
    if (previewLock.current || command.busy) return;
    setReview(null);
    previewLock.current = true;
    setPreviewBusy(true);
    try {
      const { data } = await accessRequest<RoleDetailDto>(
        `/api/admin/roles/${encodeURIComponent(edit ? source! : draft.key.trim())}`,
      );
      setDetail(data);
      setReview(null);
      setLoaded(true);
      setLoadError(null);
      command.reset();
      if (!edit) {
        command.setResult(
          "Bu anahtarla bir rol mevcut. Güncel rolü listeden inceleyin; oluşturma tekrar gönderilmedi.",
        );
        onSaved(
          "Bu anahtarla rol mevcut. Güncel kaydı listeden inceleyin; oluşturma tekrar gönderilmedi.",
        );
      } else
        command.setResult(
          "Güncel rol alındı. Taslağınız korundu; kaydetmek için etkiyi yeniden inceleyin.",
        );
    } catch (e) {
      if (!edit && e instanceof AdminApiError && e.status === 404) {
        command.reset();
        command.setResult(
          "Bu anahtarla rol bulunamadı. Bilgileri inceleyip yeniden onaylayabilirsiniz.",
        );
      } else
        command.setError(
          e instanceof Error ? e : new Error("Güncel rol alınamadı."),
        );
    } finally {
      previewLock.current = false;
      setPreviewBusy(false);
    }
  }
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-xl font-semibold text-white"
        >
          {edit ? "Rolü düzenle" : source ? "Rolü kopyala" : "Özel rol oluştur"}
        </h2>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={command.busy || previewBusy || command.uncertain}
        >
          Rol listesine dön
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={reconcile}
          disabled={command.busy || previewBusy || (!edit && !draft.key)}
        >
          Güncel rolü yenile
        </Button>
      </div>
      <Feedback command={command} />
      {loadError ? (
        <LoadError error={loadError} retry={() => setRevision((n) => n + 1)} />
      ) : !loaded ? (
        <p role="status">Rol yükleniyor…</p>
      ) : (
        <>
          {immutable && (
            <p role="alert" className="text-amber-200">
              Sistem rolleri değiştirilemez. Rol listesinde kopyalayarak ayrı
              bir özel rol oluşturabilirsiniz.
            </p>
          )}
          {ownRole && (
            <p role="alert" className="text-amber-200">
              Kendi erişiminizi dolaylı değiştirmemek için taşıdığınız rolü
              düzenleyemezsiniz. Başka bir yetkili yönetici işlem yapmalıdır.
            </p>
          )}
          {detail && edit && (
            <p className="text-sm text-slate-300">
              Mevcut kullanım: {detail.usage.staffCount} kişi,{" "}
              {detail.usage.activeAssignments} etkin,{" "}
              {detail.usage.scheduledAssignments} ileri tarihli atama,{" "}
              {detail.usage.pendingInvitations} bekleyen davet.
            </p>
          )}
          <form hidden={!!review} onSubmit={prepare} className="space-y-5">
            <fieldset disabled={locked} className="space-y-4 min-w-0">
              {!edit && (
                <Input
                  label="Rol anahtarı"
                  value={draft.key}
                  required
                  pattern="[a-z][a-z0-9_]{2,40}"
                  maxLength={41}
                  helperText="3–41 karakter: küçük Latin harfiyle başlayın; harf, rakam ve alt çizgi kullanın. Oluşturulduktan sonra değişmez."
                  onChange={(e) => change({ key: e.target.value })}
                />
              )}
              <Input
                label="Rol adı"
                value={draft.label}
                required
                minLength={2}
                maxLength={80}
                onChange={(e) => change({ label: e.target.value })}
              />
              <Textarea
                label="Rol açıklaması"
                value={draft.description}
                maxLength={500}
                onChange={(e) => change({ description: e.target.value })}
              />
              <PermissionFields
                value={draft.permissions}
                onChange={(permissions) => change({ permissions })}
                disabled={locked}
              />
              {edit && (
                <Textarea
                  label="Değişiklik gerekçesi"
                  value={draft.reason}
                  required
                  minLength={10}
                  maxLength={500}
                  helperText="10–500 karakter. Gerekçe işlem geçmişine kaydedilir."
                  onChange={(e) => change({ reason: e.target.value })}
                />
              )}
            </fieldset>
            {!review && (
              <Button
                type="submit"
                disabled={locked || !draft.permissions.length}
              >
                {previewBusy
                  ? "Etki hesaplanıyor…"
                  : edit
                    ? "Değişikliğin etkisini incele"
                    : "Oluşturulacak rolü incele"}
              </Button>
            )}
          </form>
          {review && (
            <section
              aria-labelledby="role-review-title"
              className="rounded-2xl border border-emerald-400/30 p-5 space-y-4"
            >
              <h3
                id="role-review-title"
                ref={reviewHeading}
                tabIndex={-1}
                className="text-lg text-white font-semibold"
              >
                {edit ? "Değişiklik onayı" : "Yeni rol onayı"} ·{" "}
                {review.draft.label}
              </h3>
              <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">
                {review.draft.description}
              </p>
              {review.impact ? (
                <>
                  <p className="text-amber-200">
                    Bu değişiklik {review.impact.usage.staffCount} kişinin{" "}
                    {review.impact.usage.activeAssignments} etkin,{" "}
                    {review.impact.usage.scheduledAssignments} ileri tarihli
                    atamasını ve {review.impact.usage.pendingInvitations}{" "}
                    bekleyen daveti etkiler.
                  </p>
                  <PermissionList
                    title="Eklenecek izinler"
                    permissions={review.impact.added}
                  />
                  <PermissionList
                    title="Kaldırılacak izinler"
                    permissions={review.impact.removed}
                  />
                  <p className="text-sm text-slate-300">
                    {review.impact.unchanged} izin aynı kalacak. Kişilere
                    atanmış kapsam ve süre değişmez.
                  </p>
                  <p className="text-sm text-slate-300 break-words">
                    Gerekçe: {review.draft.reason}
                  </p>
                  <details>
                    <summary className="min-h-11 cursor-pointer text-emerald-200">
                      Etkilenen kayıt örnekleri (en çok 20 kişi ve 20 davet)
                    </summary>
                    <ul className="space-y-2 text-sm text-slate-300 break-words">
                      {review.impact.affectedStaff.map((s) => (
                        <li key={s.id}>
                          {s.fullName} · {s.activeAssignments} etkin,{" "}
                          {s.scheduledAssignments} ileri tarihli atama
                        </li>
                      ))}
                      {review.impact.affectedInvitations.map((i) => (
                        <li key={i.id}>{i.email} · Bekleyen davet</li>
                      ))}
                    </ul>
                  </details>
                  {review.impact.blocked && (
                    <p role="alert" className="text-red-200">
                      {review.impact.blocked.message}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-300 break-all">
                    Anahtar: {review.draft.key}
                  </p>
                  <PermissionList
                    title="Yeni rolün izinleri"
                    permissions={review.draft.permissions}
                  />
                  <p className="text-amber-200 text-sm">
                    Rol oluşturulacak. Hiç kimseye otomatik atanmayacak.
                  </p>
                </>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={save}
                  disabled={
                    command.busy ||
                    command.uncertain ||
                    !canManage ||
                    !!review.impact?.blocked
                  }
                >
                  {command.busy
                    ? "Kaydediliyor…"
                    : edit
                      ? "Değişikliği onayla ve kaydet"
                      : "Rolü oluştur"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={command.busy}
                  onClick={() => setReview(null)}
                >
                  Düzenlemeye dön
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
function PermissionList({
  title,
  permissions,
}: {
  title: string;
  permissions: Permission[];
}) {
  return (
    <div>
      <h4 className="text-white font-medium">{title}</h4>
      {permissions.length ? (
        <ul className="list-disc pl-5 text-sm text-slate-300">
          {permissions.map((p) => (
            <li key={p}>{permissionLabel(p)}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">Yok.</p>
      )}
    </div>
  );
}
