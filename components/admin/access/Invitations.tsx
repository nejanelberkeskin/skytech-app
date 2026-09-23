"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { useAdmin } from "@/lib/admin-context";
import type { Scope } from "@/lib/admin/dto";
import { accessRequest } from "./transport";
import { AccessPage, Feedback, LoadError, useAccessCommand } from "./shared";
import { hasFullPermission } from "./policy";
import { permissionLabel, scopeLabel, toExpiry } from "./labels";
import { istanbulDate } from "../operations/client";
import ScopeFields from "./ScopeFields";
import type { InvitationView, PageDto, RoleView } from "./types";
export default function Invitations() {
  const { me } = useAdmin();
  const command = useAccessCommand();
  const canInvite = hasFullPermission(me, "staff.invite");
  const [list, setList] = useState<InvitationView[] | null>(null);
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [roleKey, setRole] = useState("");
  const [scope, setScope] = useState<Scope>({ kind: "all" });
  const [endsAt, setEndsAt] = useState("");
  const [days, setDays] = useState("7");
  const [confirm, setConfirm] = useState<
    | {
        kind: "create";
        body: {
          email: string;
          roleKey: string;
          scope: Scope;
          accessEndsAt: string | null;
          expiresInDays: number;
        };
      }
    | {
        kind: "resend" | "revoke";
        invitation: InvitationView;
      }
    | null
  >(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (confirm) confirmationHeading.current?.focus(); }, [confirm]);
  const generation = useRef({ value: 0 });
  const load = useCallback(async () => {
    const current = ++generation.current.value;
    try {
      const [page, roleList] = await Promise.all([
        accessRequest<PageDto<InvitationView>>(
          `/api/admin/invitations?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        ),
        canInvite
          ? accessRequest<{
              roles: RoleView[];
            }>("/api/admin/roles")
          : Promise.resolve({ data: { roles: [] } }),
      ]);
      if (current !== generation.current.value) return false;
      setList(page.data.items);
      setNext(page.data.nextCursor);
      setRoles(roleList.data.roles);
      setError(null);
      return true;
    } catch (e) {
      if (current !== generation.current.value) return false;
      setList(null);
      setNext(null);
      setRoles([]);
      setConfirm(null);
      setError(e instanceof Error ? e.message : "Davetler alınamadı.");
      return false;
    }
  }, [cursor, canInvite]);
  useEffect(() => {
    const token = generation.current;
    void load();
    return () => {
      token.value++;
    };
  }, [load]);
  const review = () => {
    try {
      if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()))
        throw new Error("Geçerli bir e-posta adresi girin.");
      if (!roles.some((r) => r.key === roleKey)) throw new Error("Rol seçin.");
      if (scope.kind === "sites" && !scope.siteIds.length)
        throw new Error("En az bir saha seçin.");
      const expiresInDays = Number(days);
      if (
        !Number.isInteger(expiresInDays) ||
        expiresInDays < 1 ||
        expiresInDays > 30
      )
        throw new Error("Davet süresi 1–30 gün olmalı.");
      setConfirm({
        kind: "create",
        body: {
          email: email.trim().toLowerCase(),
          roleKey,
          scope,
          accessEndsAt: toExpiry(endsAt),
          expiresInDays,
        },
      });
      command.setError(null);
    } catch (e) {
      command.setError(
        e instanceof Error ? e : new Error("Alanları kontrol edin."),
      );
    }
  };
  const submit = async () => {
    if (!confirm || !canInvite || command.busy || command.uncertain) return;
    const selected = confirm;
    const result = await command.run<unknown>(
      selected.kind === "create"
        ? "/api/admin/invitations"
        : `/api/admin/invitations/${selected.invitation.id}/${selected.kind}`,
      "POST",
      selected.kind === "create"
        ? selected.body
        : selected.kind === "resend"
          ? { expiresInDays: 7 }
          : {},
    );
    setConfirm(null);
    if (result !== undefined) {
      command.setResult(
        selected.kind === "revoke"
          ? "Davet iptal edildi."
          : "Davet kaydı güncellendi. E-posta gönderim sonucunu aşağıdaki uyarılardan kontrol edin.",
      );
      if (selected.kind === "create") {
        setEmail("");
        setRole("");
        setScope({ kind: "all" });
        setEndsAt("");
      }
      await load();
    }
  };
  const update = () => setConfirm(null);
  return (
    <AccessPage
      title="Personel davetleri"
      description="Kişi kendi hesabıyla tek kullanımlık daveti kabul eder. Davet oluşturmak ve yeniden göndermek e-posta gönderir."
    >
      <Button
        variant="secondary"
        disabled={command.busy}
        onClick={async () => {
          setConfirm(null);
          if (await load()) command.reset();
        }}
      >
        Davetleri yenile
      </Button>
      <Feedback command={command} />
      {canInvite && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            review();
          }}
          className="rounded-2xl border border-white/10 p-5 space-y-4"
        >
          <h2 className="text-lg font-semibold text-white">
            Yeni personel daveti
          </h2>
          <fieldset
            disabled={command.busy || command.uncertain || !roles.length}
            className="space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Personelin e-posta adresi"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  update();
                }}
                maxLength={254}
              />
              <Select
                label="Davet edilecek rol"
                value={roleKey}
                onChange={(e) => {
                  setRole(e.target.value);
                  update();
                }}
              >
                <option value="">Rol seçin</option>
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            {roleKey && (
              <details>
                <summary className="min-h-11 cursor-pointer text-emerald-200 text-sm">
                  Bu rol hangi izinleri içeriyor?
                </summary>
                <ul className="text-slate-300 text-sm space-y-1">
                  {roles
                    .find((r) => r.key === roleKey)
                    ?.permissions.map((p) => (
                      <li key={p}>{permissionLabel(p)}</li>
                    ))}
                </ul>
              </details>
            )}
            <ScopeFields
              scope={scope}
              onChange={(v) => {
                setScope(v);
                update();
              }}
              endsAt={endsAt}
              onEndChange={(v) => {
                setEndsAt(v);
                update();
              }}
            />
            <Input
              type="number"
              label="Davet bağlantısının geçerliliği (gün)"
              min={1}
              max={30}
              value={days}
              onChange={(e) => {
                setDays(e.target.value);
                update();
              }}
            />
            <Button type="submit">Daveti incele</Button>
          </fieldset>
        </form>
      )}
      {confirm && (
        <section
          className="rounded-xl border border-amber-300/40 p-5 space-y-3"
          aria-label="Davet işlemi onayı"
        >
          <h2 ref={confirmationHeading} tabIndex={-1} className="text-white font-semibold">
            {confirm.kind === "create"
              ? "Davet gönderilsin mi?"
              : confirm.kind === "resend"
                ? "Davet yeniden gönderilsin mi?"
                : "Davet iptal edilsin mi?"}
          </h2>
          <p className="text-slate-200 break-all">
            {confirm.kind === "create"
              ? confirm.body.email
              : confirm.invitation.email}
          </p>
          {confirm.kind === "create" ? (
            <p className="text-sm text-slate-300">
              {roles.find((r) => r.key === confirm.body.roleKey)?.label} ·{" "}
              {scopeLabel(confirm.body.scope)} · Erişim:{" "}
              {confirm.body.accessEndsAt
                ? istanbulDate(confirm.body.accessEndsAt)
                : "Süresiz"}{" "}
              · Bağlantı: {confirm.body.expiresInDays} gün
            </p>
          ) : (
            <p className="text-sm text-slate-300">
              {confirm.kind === "resend"
                ? "Eski bağlantı geçersiz olacak. Yeni bağlantı 7 gün geçerli olacak ve bu adrese e-posta gönderilecek."
                : "Bekleyen bağlantı kullanılamayacak. Kabul edilmiş personel erişimi bu işlemle kaldırılmaz."}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              loading={command.busy}
              disabled={command.uncertain}
              onClick={() => void submit()}
            >
              {confirm.kind === "revoke"
                ? "Onayla ve daveti iptal et"
                : "Onayla ve e-posta gönder"}
            </Button>
            <Button
              variant="ghost"
              disabled={command.busy}
              onClick={() => setConfirm(null)}
            >
              Vazgeç
            </Button>
          </div>
        </section>
      )}
      {error ? (
        <LoadError error={error} retry={() => void load()} />
      ) : !list ? (
        <p role="status" className="text-slate-300">
          Davetler yükleniyor…
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((inv) => {
            const expired =
              inv.status === "pending" &&
              Date.parse(inv.expiresAt) <= Date.now();
            const label = expired
              ? "Süresi doldu"
              : ({
                  pending: "Kabul bekliyor",
                  accepted: "Kabul edildi",
                  revoked: "İptal edildi",
                  expired: "Süresi doldu",
                }[inv.status] ?? inv.status);
            return (
              <li
                key={inv.id}
                className="rounded-2xl border border-white/10 p-5 space-y-2"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <p className="font-medium text-white break-all">
                    {inv.email}
                  </p>
                  <span className="text-sm text-slate-300">{label}</span>
                </div>
                <p className="text-sm text-slate-300 break-words">
                  {inv.roleLabel} · {scopeLabel(inv.scope)}
                </p>
                <p className="text-xs text-slate-400">
                  Bağlantı bitişi: {istanbulDate(inv.expiresAt)} · Erişim
                  bitişi:{" "}
                  {inv.accessEndsAt
                    ? istanbulDate(inv.accessEndsAt)
                    : "Süresiz"}
                </p>
                {canInvite && inv.status === "pending" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={command.busy || command.uncertain}
                      onClick={() =>
                        setConfirm({ kind: "resend", invitation: inv })
                      }
                    >
                      Yeniden gönder
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={command.busy || command.uncertain}
                      onClick={() =>
                        setConfirm({ kind: "revoke", invitation: inv })
                      }
                    >
                      Daveti iptal et
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {list?.length === 0 && (
        <p className="text-slate-300">Davet bulunmuyor.</p>
      )}
      <div className="flex gap-3">
        {cursor && (
          <Button
            disabled={command.busy}
            onClick={() => {
              setList(null);
              setCursor(null);
            }}
          >
            İlk sayfa
          </Button>
        )}
        {next && (
          <Button
            disabled={command.busy}
            onClick={() => {
              setList(null);
              setCursor(next);
            }}
          >
            Sonraki 50 davet
          </Button>
        )}
      </div>
    </AccessPage>
  );
}
