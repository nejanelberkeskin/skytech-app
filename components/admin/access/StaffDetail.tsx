"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Select, Textarea } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { useAdmin } from "@/lib/admin-context";
import type { Scope } from "@/lib/admin/dto";
import { accessRequest } from "./transport";
import { AccessPage, Feedback, LoadError, useAccessCommand } from "./shared";
import { activeAssignment, hasFullPermission } from "./policy";
import { expiryInput, permissionLabel, scopeLabel, toExpiry } from "./labels";
import { AdminApiError, istanbulDate } from "../operations/client";
import ScopeFields from "./ScopeFields";
import type {
  AccessPreview,
  PreviewChange,
  RoleView,
  StaffAssignmentView,
  StaffView,
} from "./types";
type Draft = {
  kind: "assign" | "update" | "revoke";
  assignmentId?: string;
  roleKey: string;
  scope: Scope;
  endsAt: string;
  reason: string;
};
const empty: Draft = {
  kind: "assign",
  roleKey: "",
  scope: { kind: "all" },
  endsAt: "",
  reason: "",
};
export default function StaffDetail({ id }: { id: string }) {
  const { me, refresh } = useAdmin();
  const command = useAccessCommand();
  const [person, setPerson] = useState<StaffView | null>(null);
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<{
    data: AccessPreview;
    version: string | null;
    change: PreviewChange;
    reason: string;
  } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const previewLock = useRef(false);
  const [activeConfirm, setActiveConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const confirmation = useRef<HTMLHeadingElement>(null);
  const generation = useRef({ value: 0 });
  const canManage = hasFullPermission(me, "roles.manage");
  const canStaff = hasFullPermission(me, "staff.manage");
  const load = useCallback(async () => {
    const current = ++generation.current.value;
    setLoading(true);
    try {
      const [detail, roleList] = await Promise.all([
        accessRequest<StaffView>(`/api/admin/staff/${encodeURIComponent(id)}`),
        canManage
          ? accessRequest<{
              roles: RoleView[];
            }>("/api/admin/roles")
          : Promise.resolve({ data: { roles: [] } }),
      ]);
      if (current === generation.current.value) {
        setPerson(detail.data);
        setRoles(roleList.data.roles);
        setError(null);
        return true;
      }
    } catch (e) {
      if (current === generation.current.value) {
        setPerson(null);
        setError(e instanceof Error ? e.message : "Personel alınamadı.");
      }
      return false;
    } finally {
      if (current === generation.current.value) setLoading(false);
    }
  }, [id, canManage]);
  useEffect(() => {
    const token = generation.current;
    void load();
    return () => {
      token.value++;
    };
  }, [load]);
  const formKey = draft ? `${draft.kind}:${draft.assignmentId ?? "new"}` : null;
  useEffect(() => {
    if (formKey) formHeading.current?.focus();
  }, [formKey]);
  useEffect(() => {
    if (preview) confirmation.current?.focus();
  }, [preview]);
  const own = person?.userId === me?.admin.userId;
  const busy = command.busy || previewBusy || loading;
  const edit = (kind: "update" | "revoke", a: StaffAssignmentView) => {
    setDraft({
      kind,
      assignmentId: a.id,
      roleKey: a.roleKey,
      scope: a.scope,
      endsAt: expiryInput(a.endsAt),
      reason: "",
    });
    setPreview(null);
    setActiveConfirm(false);
    setResetConfirm(false);
  };
  const change = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setPreview(null);
  };
  const inspect = async () => {
    if (!draft || own || !canManage || previewLock.current || command.uncertain)
      return;
    try {
      if (!draft.roleKey) throw new Error("Rol seçin.");
      if (!draft.reason.trim())
        throw new Error("Değişiklik gerekçesini yazın.");
      if (
        draft.scope.kind === "sites" &&
        !draft.scope.siteIds.length &&
        draft.kind !== "revoke"
      )
        throw new Error("En az bir saha seçin.");
      const change: PreviewChange =
        draft.kind === "assign"
          ? {
              kind: "assign",
              roleKey: draft.roleKey,
              scope: draft.scope,
              endsAt: toExpiry(draft.endsAt),
            }
          : draft.kind === "update"
            ? {
                kind: "update",
                assignmentId: draft.assignmentId!,
                scope: draft.scope,
                endsAt: toExpiry(draft.endsAt),
              }
            : { kind: "revoke", assignmentId: draft.assignmentId! };
      previewLock.current = true;
      setPreviewBusy(true);
      setPreview(null);
      command.setError(null);
      const version =
        person?.assignments.find((a) => a.id === draft.assignmentId)
          ?.updatedAt ?? null;
      const response = await accessRequest<AccessPreview>(
        `/api/admin/staff/${id}/access-preview`,
        "POST",
        change,
      );
      setPreview({
        data: response.data,
        change,
        version,
        reason: draft.reason.trim(),
      });
    } catch (e) {
      command.setError(
        e instanceof Error ? e : new Error("Önizleme alınamadı."),
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
  };
  const save = async () => {
    if (
      !preview ||
      preview.data.blocked ||
      own ||
      !canManage ||
      busy ||
      command.uncertain
    )
      return;
    const { change, version } = preview;
    let url = `/api/admin/staff/${id}/assignments`;
    let method = "POST";
    let body: object;
    if (change.kind === "assign")
      body = {
        roleKey: change.roleKey,
        scope: change.scope,
        endsAt: change.endsAt,
        reason: preview.reason,
      };
    else {
      url += `/${change.assignmentId}`;
      method = change.kind === "update" ? "PATCH" : "DELETE";
      if (change.kind === "update" && !version) {
        command.setError(new Error("Atama sürümü alınamadı. Kaydı yenileyin."));
        return;
      }
      body =
        change.kind === "update"
          ? {
              scope: change.scope,
              endsAt: change.endsAt,
              expectedVersion: version,
              reason: preview.reason,
            }
          : { reason: preview.reason };
    }
    const result = await command.run<StaffView>(url, method, body, (err) => {
      setPreview(null);
      if (err instanceof AdminApiError && err.status === 409) {
        setNotice(
          "Kayıt değişmiş veya bu işlem yapılamıyor. Gerekçeniz korundu; güncel kaydı inceleyip yeniden önizleyin.",
        );
        void load();
      }
    });
    if (result) {
      setPerson(result);
      setPreview(null);
      setDraft(null);
      setNotice(null);
      command.setResult("Erişim değişikliği kaydedildi.");
    }
  };
  const resetMfa = async () => {
    if (!resetConfirm || own || !canStaff) return;
    const result = await command.run<{
      removedFactors: number;
    }>(`/api/admin/staff/${id}/mfa-reset`, "POST", {});
    setResetConfirm(false);
    if (result) {
      command.setResult(
        `Doğrulama uygulamaları sıfırlandı (${result.removedFactors} aygıt). Kişi yeniden kurulum yapmalı.`,
      );
      await load();
    }
  };
  const setActive = async () => {
    if (!person || own || !canStaff || !activeConfirm) return;
    const result = await command.run<StaffView>(
      `/api/admin/staff/${id}`,
      "PATCH",
      { isActive: !person.isActive, reason: reason.trim() },
    );
    setActiveConfirm(false);
    if (result) {
      setPerson(result);
      setReason("");
      command.setResult("Personel durumu güncellendi.");
    }
  };
  return (
    <AccessPage
      title={person?.fullName ?? "Personel ayrıntısı"}
      description="Rolleri, kayıt kapsamını ve erişim süresini birlikte inceleyin. Değişiklik önce sunucuda önizlenir; kaydetmek ayrı onay ister."
    >
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/kullanicilar"
          className="min-h-11 inline-flex items-center text-emerald-200 underline"
        >
          ← Personel listesi
        </Link>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setPreview(null);
            setActiveConfirm(false);
            void load().then((ok) => {
              if (ok) command.reset();
            });
          }}
        >
          Kaydı yenile
        </Button>
      </div>
      <Feedback command={command} />
      {notice && (
        <p role="status" className="text-amber-200">
          {notice}
        </p>
      )}
      {error ? (
        <LoadError error={error} retry={() => void load()} />
      ) : loading ? (
        <p role="status" className="text-slate-300">
          Personel yükleniyor…
        </p>
      ) : (
        person && (
          <>
            <section className="rounded-2xl border border-white/10 p-5 space-y-3">
              <p className="text-slate-300 break-all">
                {person.email} · {person.isActive ? "Aktif" : "Pasif"}
              </p>
              <p className="text-sm text-slate-400">
                Doğrulama uygulaması:{" "}
                {person.mfa === null
                  ? "Durumu alınamadı"
                  : person.mfa.enrolled
                    ? "Kayıtlı"
                    : "Kurulmamış"}
              </p>
              {own && (
                <p className="text-amber-200 text-sm">
                  Bu sizin hesabınız. Kendi erişiminizi değiştiremezsiniz.
                </p>
              )}
              <h2 className="text-lg text-white font-semibold">
                Atamalar ve yapabilecekleri
              </h2>
              <ul className="space-y-4">
                {person.assignments.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-xl bg-white/[.03] p-4 space-y-2"
                  >
                    <h3 className="font-medium text-white">{a.roleLabel}</h3>
                    <p className="text-sm text-slate-300 break-words">
                      {scopeLabel(a.scope)} ·{" "}
                      {a.endsAt
                        ? `Bitiş: ${istanbulDate(a.endsAt)}`
                        : "Süresiz"}{" "}
                      ·{" "}
                      {!person.isActive
                        ? "Hesap pasif"
                        : activeAssignment(a)
                          ? "Geçerli"
                          : "Şu anda geçerli değil"}
                    </p>
                    <details>
                      <summary className="text-sm min-h-11 cursor-pointer text-emerald-200">
                        Bu atamayla neler yapılabilir?
                      </summary>
                      <ul className="text-sm text-slate-300 space-y-1">
                        {roles
                          .find((r) => r.key === a.roleKey)
                          ?.permissions.map((p) => (
                            <li key={p}>
                              {permissionLabel(p)} · {scopeLabel(a.scope)}
                            </li>
                          )) ?? (
                          <li>
                            İzin dökümünü görmek için rol sözlüğüne erişim
                            gerekir.
                          </li>
                        )}
                      </ul>
                    </details>
                    {canManage && !own && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={busy || command.uncertain}
                          onClick={() => edit("update", a)}
                        >
                          Kapsam / süre
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy || command.uncertain}
                          onClick={() => edit("revoke", a)}
                        >
                          Atamayı kaldır
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {canManage && !own && (
                <Button
                  disabled={busy || command.uncertain}
                  onClick={() => {
                    setDraft({ ...empty });
                    setPreview(null);
                    setActiveConfirm(false);
                    setResetConfirm(false);
                  }}
                >
                  Rol ekle
                </Button>
              )}
            </section>
            {draft && canManage && !own && (
              <section className="border border-emerald-400/30 rounded-2xl p-5 space-y-4">
                <h2
                  ref={formHeading}
                  tabIndex={-1}
                  className="text-lg font-semibold text-white"
                >
                  {draft.kind === "assign"
                    ? "Rol ataması"
                    : draft.kind === "update"
                      ? "Kapsam ve süre değişikliği"
                      : "Rol atamasını kaldırma"}
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void inspect();
                  }}
                  className="space-y-4"
                >
                  <fieldset
                    disabled={busy || command.uncertain}
                    className="space-y-4"
                  >
                    {draft.kind === "assign" ? (
                      <Select
                        label="Atanacak rol"
                        value={draft.roleKey}
                        onChange={(e) => change({ roleKey: e.target.value })}
                      >
                        <option value="">Rol seçin</option>
                        {roles.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <p className="text-slate-200">
                        {
                          person.assignments.find(
                            (a) => a.id === draft.assignmentId,
                          )?.roleLabel
                        }
                      </p>
                    )}
                    {draft.kind !== "revoke" && (
                      <ScopeFields
                        scope={draft.scope}
                        onChange={(scope) => change({ scope })}
                        endsAt={draft.endsAt}
                        onEndChange={(endsAt) => change({ endsAt })}
                      />
                    )}
                    <Textarea
                      label="Değişiklik gerekçesi"
                      required
                      maxLength={1000}
                      value={draft.reason}
                      onChange={(e) => change({ reason: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" loading={previewBusy}>
                        Değişikliği önizle
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setDraft(null);
                          setPreview(null);
                        }}
                      >
                        Vazgeç
                      </Button>
                    </div>
                  </fieldset>
                </form>
                {preview && (
                  <div className="rounded-xl border border-amber-300/40 p-4 space-y-3">
                    <h3
                      ref={confirmation}
                      tabIndex={-1}
                      className="text-white font-semibold"
                    >
                      Kaydetmeden önce kontrol edin
                    </h3>
                    <p className="text-slate-300 text-sm">
                      {person.fullName} · {person.email} ·{" "}
                      {roles.find((r) => r.key === draft.roleKey)?.label}
                    </p>
                    <p className="text-sm text-slate-300">
                      {draft.kind === "revoke"
                        ? "Atama kaldırılacak."
                        : `${scopeLabel(draft.scope)} · ${draft.endsAt ? `Bitiş (Türkiye): ${draft.endsAt.replace("T", " ")}` : "Süresiz"}`}
                    </p>
                    <div className="text-sm space-y-2">
                      <p className="text-emerald-200">
                        Eklenecek:{" "}
                        {preview.data.added
                          .map(
                            (p) =>
                              `${permissionLabel(p.key)} (${p.scopes.map((s) => scopeLabel(s)).join(" / ")})`,
                          )
                          .join(", ") || "Yok"}
                      </p>
                      <p className="text-rose-200">
                        Kalkacak:{" "}
                        {preview.data.removed.map(permissionLabel).join(", ") ||
                          "Yok"}
                      </p>
                      {preview.data.scopeChanges.map((p) => (
                        <p className="text-amber-200 break-words" key={p.key}>
                          {permissionLabel(p.key)}:{" "}
                          {p.from.map((s) => scopeLabel(s)).join(" / ")} →{" "}
                          {p.to.map((s) => scopeLabel(s)).join(" / ")}
                        </p>
                      ))}
                    </div>
                    {preview.data.legacyRoleChange?.to === "NONE" && (
                      <p className="text-amber-200 text-sm">
                        Bu değişiklikten sonra kapsam geçişi tamamlanmamış eski
                        ekranlar kapanacak.
                      </p>
                    )}
                    {preview.data.blocked ? (
                      <p role="alert" className="text-red-200">
                        {preview.data.blocked.message}
                      </p>
                    ) : (
                      <Button
                        loading={command.busy}
                        disabled={command.uncertain}
                        onClick={() => void save()}
                      >
                        Onayla ve erişimi kaydet
                      </Button>
                    )}
                  </div>
                )}
              </section>
            )}
            {canStaff && !own && (
              <section className="rounded-2xl border border-white/10 p-5 space-y-3">
                <h2 className="text-lg text-white font-semibold">
                  Personel durumu
                </h2>
                <p className="text-sm text-slate-300">
                  Pasifleştirmek yönetim erişimini kapatır. Müşteri hesabı ve
                  geçmiş kayıtlar silinmez.
                </p>
                <Textarea
                  label="Durum değişikliği gerekçesi"
                  value={reason}
                  maxLength={1000}
                  disabled={busy}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setActiveConfirm(false);
                  }}
                />
                {activeConfirm ? (
                  <div className="space-y-3">
                    <p className="text-amber-200">
                      {person.fullName} için yönetim erişimi{" "}
                      {person.isActive ? "kapatılacak" : "yeniden açılacak"}.
                      Onaylıyor musunuz?
                    </p>
                    <Button
                      loading={command.busy}
                      disabled={command.uncertain}
                      onClick={() => void setActive()}
                    >
                      Onayla ve durumu değiştir
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setActiveConfirm(false)}
                    >
                      Vazgeç
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={busy || command.uncertain || !reason.trim()}
                    onClick={() => {
                      setResetConfirm(false);
                      setActiveConfirm(true);
                      setDraft(null);
                      setPreview(null);
                    }}
                  >
                    {person.isActive
                      ? "Personeli pasifleştir"
                      : "Personeli etkinleştir"}
                  </Button>
                )}
              </section>
            )}
            {canStaff && !own && person.mfa?.enrolled && (
              <section className="rounded-2xl border border-white/10 p-5 space-y-3">
                <h2 className="text-lg font-semibold text-white">
                  Doğrulama uygulamasına erişim kaybı
                </h2>
                <p className="text-sm text-slate-300">
                  Kişinin kimliğini kurum içinde doğruladıktan sonra kullanın.
                  Sıfırlamak mevcut doğrulama aygıtlarını kaldırır; kişinin
                  uygulamayı yeniden kurması gerekir.
                </p>
                {resetConfirm ? (
                  <>
                    <p className="text-amber-200">
                      {person.fullName} ({person.email}) için tüm doğrulama
                      aygıtları kaldırılsın mı?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        loading={command.busy}
                        disabled={command.uncertain}
                        onClick={() => void resetMfa()}
                      >
                        Onayla ve doğrulamayı sıfırla
                      </Button>
                      <Button
                        disabled={busy}
                        variant="ghost"
                        onClick={() => setResetConfirm(false)}
                      >
                        Vazgeç
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={busy || command.uncertain}
                    onClick={() => {
                      setDraft(null);
                      setPreview(null);
                      setActiveConfirm(false);
                      setResetConfirm(true);
                    }}
                  >
                    Doğrulama uygulamasını sıfırla
                  </Button>
                )}
              </section>
            )}
          </>
        )
      )}
    </AccessPage>
  );
}
