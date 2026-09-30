"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/browser";
import type { AdminUser, UserRole } from "@/lib/rbac";
import type { AdminMe } from "@/components/admin/access/types";
import { accessRequest } from "@/components/admin/access/transport";
/** Yetki değişince yeniden kurulan ekranın son ret açıklaması (yalnız bellekte; oturum sahibine bağlı). */
export interface AccessDenial {
  scope: string;
  message: string;
  userId: string;
}
export interface DenialReport {
  /** Açıklamanın gösterileceği ekran (sayfa yolu). */
  scope: string;
  message: string;
  /** Ekranın yeniden kurulma anahtarı: yenilemeden sonra değiştiyse ekran sıfırlanmıştır, açıklama sayfada kalır. */
  keyOf: (me: AdminMe | null) => string;
}
interface AdminContextType {
  admin: AdminUser | null;
  me: AdminMe | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  denial: AccessDenial | null;
  reportDenial: (report: DenialReport) => void;
  clearDenial: (scope?: string) => void;
}
export const AdminContext = createContext<AdminContextType>({
  admin: null,
  me: null,
  loading: true,
  error: null,
  refresh: async () => {},
  denial: null,
  reportDenial: () => {},
  clearDenial: () => {},
});
export function useAdmin() {
  return useContext(AdminContext);
}
export function AdminProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denial, setDenial] = useState<AccessDenial | null>(null);
  const latest = useRef({ value: 0 });
  // Son okunan yetki ve henüz karara bağlanmamış ret açıklaması (render dışında, yalnız olay akışında okunur).
  const current = useRef<AdminMe | null>(null);
  const pending = useRef<(DenialReport & { userId: string; key: string; after: number }) | null>(null);
  const reportDenial = useCallback((report: DenialReport) => {
    const snapshot = current.current;
    if (!snapshot) return;
    pending.current = { ...report, userId: snapshot.admin.userId, key: report.keyOf(snapshot), after: latest.current.value };
  }, []);
  const clearDenial = useCallback((scope?: string) => {
    setDenial((previous) => (!previous || (scope && previous.scope !== scope) ? previous : null));
  }, []);
  const refresh = useCallback(async () => {
    const generation = ++latest.current.value;
    try {
      const response = await accessRequest<AdminMe>("/api/admin/me");
      if (generation !== latest.current.value) return;
      const next = response.data.admin.isActive ? response.data : null;
      // Ret açıklaması yalnız bildirimden SONRA başlayan ilk yenilemede karara bağlanır: erişim gerçekten
      // değiştiyse ekran yeniden kurulup eski veri temizlenir, açıklama sayfada kalır. Değişmediyse ekran
      // kendi iletisini korur; açıklama iki kez gösterilmez. Başka kullanıcıya hiçbir zaman taşınmaz.
      const report = pending.current && generation > pending.current.after ? pending.current : null;
      if (report) pending.current = null;
      current.current = next;
      setMe(next);
      setError(null);
      setDenial((previous) => {
        if (!next) return null;
        if (report && report.userId === next.admin.userId && report.keyOf(next) !== report.key) {
          return { scope: report.scope, message: report.message, userId: report.userId };
        }
        return previous && previous.userId === next.admin.userId ? previous : null;
      });
    } catch (e) {
      if (generation !== latest.current.value) return;
      current.current = null;
      pending.current = null;
      setMe(null);
      setDenial(null);
      setError(e instanceof Error ? e.message : "Yetkiler okunamadı.");
    } finally {
      if (generation === latest.current.value) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const token = latest.current;
    let alive = true;
    void refresh();
    const focus = () => {
      void refresh();
    };
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = supabase.auth.onAuthStateChange(() => {
        setTimeout(() => {
          if (alive) void refresh();
        }, 0);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      /* API hatası kullanıcıya gösterilir. */
    }
    return () => {
      alive = false;
      token.value++;
      unsubscribe?.();
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  const admin: AdminUser | null = me
    ? {
        id: me.admin.id,
        user_id: me.admin.userId,
        full_name: me.admin.fullName,
        email: me.admin.email,
        is_active: me.admin.isActive,
        role: (["SUPER_ADMIN", "FINANCE", "OPERATIONS", "ENGINEER"].includes(
          me.admin.legacyRole,
        )
          ? me.admin.legacyRole
          : "NONE") as UserRole,
        created_at: "",
      }
    : null;
  return (
    <AdminContext.Provider value={{ admin, me, loading, error, refresh, denial, reportDenial, clearDenial }}>
      {children}
    </AdminContext.Provider>
  );
}
