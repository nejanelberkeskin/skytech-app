"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/browser";
import type { AdminUser } from "@/lib/rbac";

interface AdminContextType {
  admin: AdminUser | null;
  loading: boolean;
}

const AdminContext = createContext<AdminContextType>({ admin: null, loading: true });

export function useAdmin() {
  return useContext(AdminContext);
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let generation = 0;
    let alive = true;
    const load = async () => {
      const current = ++generation;
      const { data: session } = await supabase.auth.getSession();
      if (!alive || current !== generation) return;
      if (!session.session) {
        setAdmin(null);
        setLoading(false);
        return;
      }

      const userId = session.session.user.id;

      // Fetch admin record
      const { data } = await supabase
        .from("admin_users")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .single();

      if (!alive || current !== generation) return;
      setAdmin(data ? data as AdminUser : null);
      setLoading(false);
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      // Avoid awaiting Supabase calls inside its auth lock.
      setTimeout(() => { if (alive) void load(); }, 0);
    });

    return () => { alive = false; generation++; listener.subscription.unsubscribe(); };
  }, []);

  return (
    <AdminContext.Provider value={{ admin, loading }}>
      {children}
    </AdminContext.Provider>
  );
}
