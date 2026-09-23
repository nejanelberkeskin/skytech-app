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
interface AdminContextType {
  admin: AdminUser | null;
  me: AdminMe | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
export const AdminContext = createContext<AdminContextType>({
  admin: null,
  me: null,
  loading: true,
  error: null,
  refresh: async () => {},
});
export function useAdmin() {
  return useContext(AdminContext);
}
export function AdminProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef({ value: 0 });
  const refresh = useCallback(async () => {
    const generation = ++latest.current.value;
    try {
      const response = await accessRequest<AdminMe>("/api/admin/me");
      if (generation !== latest.current.value) return;
      setMe(response.data.admin.isActive ? response.data : null);
      setError(null);
    } catch (e) {
      if (generation !== latest.current.value) return;
      setMe(null);
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
    <AdminContext.Provider value={{ admin, me, loading, error, refresh }}>
      {children}
    </AdminContext.Provider>
  );
}
