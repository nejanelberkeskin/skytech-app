"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase/browser";
import { ACCOUNTS_ENABLED } from "@/lib/site-config";
import { Button, Input } from "@/components/ui";
import { accessRequest } from "./transport";
import { AdminApiError } from "../operations/client";
/** Token yalnız açık sayfanın belleğinde ve açık onayla kabul isteğinde kullanılır. */
export default function AcceptInvitation({ token }: { token: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const generation = useRef({ value: 0 });
  const refresh = useCallback(async () => {
    const current = ++generation.current.value;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (current !== generation.current.value) return;
      if (error && data.user) throw error;
      setEmail(data.user?.email ?? null);
      setError(null);
    } catch (e) {
      if (current === generation.current.value) {
        setEmail(null);
        setError(e instanceof Error ? e.message : "Oturum okunamadı.");
      }
    } finally {
      if (current === generation.current.value) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const guard = generation.current;
    void refresh();
    return () => {
      guard.value++;
    };
  }, [refresh]);
  const accept = async () => {
    if (lock.current || !email || done || uncertain) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await accessRequest("/api/public/davet/kabul", "POST", {
        token,
        fullName: name.trim(),
      });
      setDone(true);
    } catch (e) {
      const failure =
        e instanceof Error ? e : new Error("Davet kabul edilemedi.");
      setError(failure.message);
      if (
        !(failure instanceof AdminApiError) ||
        failure.status === 0 ||
        failure.status >= 500
      )
        setUncertain(true);
      if (failure instanceof AdminApiError && failure.status === 401)
        setEmail(null);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen bg-[#020817] px-4 py-12 text-slate-200">
      <section className="max-w-lg mx-auto border border-white/15 rounded-2xl p-5 sm:p-8 space-y-5">
        <h1 className="text-2xl font-bold text-white">
          Skytech Green personel daveti
        </h1>
        <p className="text-sm">
          Bu davet yönetim paneline erişim içindir. Yalnız davetin gönderildiği
          e-posta adresine ait kendi hesabınızla kabul edin.
        </p>
        {error && (
          <p role="alert" className="text-red-200">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Oturum kontrol ediliyor…</p>
        ) : done ? (
          <>
            <p role="status" className="text-emerald-200">
              Davet kabul edildi. Erişiminizi ve güvenlik ayarlarınızı panelden
              inceleyebilirsiniz.
            </p>
            <Link
              href="/admin/guvenlik"
              referrerPolicy="no-referrer"
              className="min-h-11 inline-flex items-center underline"
            >
              Güvenlik ayarlarını aç
            </Link>
          </>
        ) : uncertain ? (
          <>
            <p className="text-amber-200">
              Yanıt alınamadı; davet kabul edilmiş olabilir. Bu sayfa isteği
              tekrarlamayacak. Panelde erişiminizi kontrol edin; erişim
              görünmüyorsa sizi davet eden kişiye başvurun.
            </p>
            <Link
              href="/admin/guvenlik"
              referrerPolicy="no-referrer"
              className="min-h-11 inline-flex items-center underline"
            >
              Panelde erişimi kontrol et
            </Link>
          </>
        ) : email ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void accept();
            }}
            className="space-y-4"
          >
            <p className="break-all">
              Açık hesap: <strong>{email}</strong>
            </p>
            <Input
              label="Adınız ve soyadınız"
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" loading={busy}>
              Personel davetini kabul et
            </Button>
            <p className="text-xs text-slate-400">
              Hesap davet adresiyle eşleşmezse erişim verilmez. Başka bir hesap
              kullanacaksanız giriş sayfasında oturum değiştirip buraya dönün.
            </p>
          </form>
        ) : (
          <p className="text-amber-200">
            Önce kendi hesabınızla giriş yapın; ardından bu sekmeye dönüp
            oturumu yenileyin. Giriş yapmak daveti kendiliğinden kabul etmez.
          </p>
        )}
        {!done && !uncertain && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4">
              <Link
                href={ACCOUNTS_ENABLED ? "/auth/login" : "/admin/giris"}
                target="_blank"
                rel="noopener noreferrer"
                prefetch={false}
                className="min-h-11 inline-flex items-center underline"
              >
                Giriş sayfası (yeni sekme)
              </Link>
              {ACCOUNTS_ENABLED && (
                <Link
                  href="/auth/register"
                  target="_blank"
                  rel="noopener noreferrer"
                  prefetch={false}
                  className="min-h-11 inline-flex items-center underline"
                >
                  Hesap oluştur (yeni sekme)
                </Link>
              )}
            </div>
            {!ACCOUNTS_ENABLED && (
              <p className="text-sm">
                Yeni hesap kaydı şu anda kapalı. Hesabınız yoksa sizi davet eden
                kişiyle iletişim kurun.
              </p>
            )}
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Oturumu yenile
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
