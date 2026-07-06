"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/browser";
import type { UserRole, AdminUser } from "@/lib/rbac";

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
    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
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

      if (data) {
        setAdmin(data as AdminUser);
      }
      setLoading(false);
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AdminContext.Provider value={{ admin, loading }}>
      {children}
    </AdminContext.Provider>
  );
}
