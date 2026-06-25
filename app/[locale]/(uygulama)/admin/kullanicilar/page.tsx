"use client";

import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/RoleGuard";
import { Button, Input, Select, CardStat } from "@/components/ui";
import { ROLE_META } from "@/lib/rbac";
import type { UserRole, AdminUser } from "@/lib/rbac";

// ── Rol rozeti ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: UserRole }) {
  const meta = ROLE_META[role] ?? { label: role, icon: "👤", color: "text-slate-400 bg-slate-400/10" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${meta.color}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
      Aktif
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
      Pasif
    </span>
  );
}

// ── Yeni Personel Modal ───────────────────────────────────────────────────────
function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ full_name: "", email: "", role: "OPERATIONS" as UserRole });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    if (data.temp_password) setCreatedPassword(data.temp_password);
    else { onSuccess(); onClose(); }
  };

  if (createdPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-[var(--bg-elevated)] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in">
          <div className="text-center mb-6">
            <span className="text-4xl block mb-3">✅</span>
            <h2 className="text-lg font-bold text-white">Personel Eklendi!</h2>
            <p className="text-sm text-slate-400 mt-1">Geçici şifreyi not alın — bir daha gösterilmeyecek.</p>
          </div>
          <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-4 text-center">
            <p className="text-xs text-amber-400/70 mb-2 uppercase tracking-wider">Geçici Şifre</p>
            <p className="text-lg font-mono font-bold text-amber-300 select-all">{createdPassword}</p>
          </div>
          <p className="text-xs text-slate-500 text-center mt-3">
            Personel ilk girişte bu şifreyi değiştirmelidir.
          </p>
          <Button variant="primary" onClick={() => { onSuccess(); onClose(); }} className="w-full mt-5">
            Tamam, Anladım
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-elevated)] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in">
        <h2 className="text-lg font-bold text-white mb-1">Yeni Personel Ekle</h2>
        <p className="text-sm text-slate-400 mb-6">
          Yeni bir yönetici hesabı oluşturulacak ve geçici şifre gösterilecek.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Ad Soyad <span className="text-red-400">*</span>
            </label>
            <Input placeholder="Ali Yıldız" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              E-posta <span className="text-red-400">*</span>
            </label>
            <Input type="email" placeholder="ali@skytechgreen.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Rol <span className="text-red-400">*</span>
            </label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              {(Object.entries(ROLE_META) as [UserRole, (typeof ROLE_META)[UserRole]][]).map(([key, meta]) => (
                <option key={key} value={key}>{meta.icon} {meta.label}</option>
              ))}
            </Select>
            <p className="text-xs text-slate-500 mt-1.5">{ROLE_META[form.role]?.desc}</p>
          </div>
        </div>
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>
        )}
        <div className="flex gap-3 mt-6">
          <Button variant="ghost" onClick={onClose} className="flex-1">İptal</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !form.full_name || !form.email} className="flex-1">
            {saving ? "Oluşturuluyor…" : "Personel Ekle"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Inline Rol Değiştir ───────────────────────────────────────────────────────
function RoleSelect({ user, onUpdate }: { user: AdminUser; onUpdate: () => void }) {
  const [value, setValue] = useState<UserRole>(user.role);
  const [saving, setSaving] = useState(false);

  const handleChange = async (newRole: UserRole) => {
    if (newRole === value) return;
    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, role: newRole }),
    });
    setSaving(false);
    if (res.ok) { setValue(newRole); onUpdate(); }
  };

  return (
    <div className="relative w-48">
      <Select value={value} onChange={(e) => handleChange(e.target.value as UserRole)} disabled={saving}>
        {(Object.entries(ROLE_META) as [UserRole, (typeof ROLE_META)[UserRole]][]).map(([key, meta]) => (
          <option key={key} value={key}>{meta.icon} {meta.label}</option>
        ))}
      </Select>
      {saving && <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-emerald-400 animate-pulse">●</span>}
    </div>
  );
}

// ── Ana İçerik ────────────────────────────────────────────────────────────────
function KullanicilarContent() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data as AdminUser[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (u: AdminUser) => {
    setActionError(null);
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, is_active: !u.is_active }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error);
    }
    await load();
  };

  const deleteUser = async (u: AdminUser) => {
    if (!window.confirm(`"${u.full_name}" adlı personeli sistemden kaldırmak istediğinize emin misiniz?`)) return;
    setActionError(null);
    setDeletingId(u.id);
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error);
    }
    setDeletingId(null);
    await load();
  };

  const activeCount = users.filter((u) => u.is_active).length;
  const superAdmins = users.filter((u) => u.role === "SUPER_ADMIN").length;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Personel & Yetki Yönetimi</h1>
          <p className="text-sm text-slate-400 mt-1">
            Yönetici hesaplarını ve rol atamalarını buradan yönetin.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowInvite(true)}>
          + Yeni Personel
        </Button>
      </div>

      {/* Metrikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CardStat icon="👥" label="Toplam Personel" value={users.length.toString()} sub={`${activeCount} aktif`} />
        <CardStat icon="👑" label="Super Admin" value={superAdmins.toString()} sub="tam yetki" />
        <CardStat icon="🚁" label="Operasyon" value={users.filter(u => u.role === "OPERATIONS").length.toString()} sub="operatör" />
        <CardStat icon="🌲" label="Mühendis" value={users.filter(u => u.role === "ENGINEER").length.toString()} sub="orman müh." />
      </div>

      {actionError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          ⚠️ {actionError}
        </div>
      )}

      {/* Tablo */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-white/[0.08] border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">Tüm Personel</h2>
            <span className="text-xs text-slate-500">{users.length} kişi</span>
          </div>

          {users.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-4xl block mb-3">👤</span>
              <p className="text-slate-400 mb-4">Henüz personel eklenmemiş.</p>
              <Button variant="primary" onClick={() => setShowInvite(true)}>İlk Personeli Ekle</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Personel", "E-posta", "Mevcut Rol", "Rol Değiştir", "Durum", "İşlemler"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400 uppercase shrink-0">
                            {u.full_name.charAt(0)}
                          </div>
                          <p className="text-white font-medium whitespace-nowrap">{u.full_name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{u.email}</td>
                      <td className="px-5 py-3 whitespace-nowrap"><RoleBadge role={u.role} /></td>
                      <td className="px-5 py-3"><RoleSelect user={u} onUpdate={load} /></td>
                      <td className="px-5 py-3 whitespace-nowrap"><StatusBadge active={u.is_active} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleActive(u)}
                            className={`text-xs transition-colors px-2.5 py-1 rounded-lg whitespace-nowrap ${
                              u.is_active
                                ? "text-orange-400 hover:bg-orange-500/10"
                                : "text-emerald-400 hover:bg-emerald-500/10"
                            }`}
                          >
                            {u.is_active ? "Pasife Al" : "Aktifleştir"}
                          </button>
                          <button
                            onClick={() => deleteUser(u)}
                            disabled={deletingId === u.id}
                            className="text-xs text-red-400/70 hover:text-red-400 transition-colors px-2.5 py-1 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {deletingId === u.id ? "…" : "Kaldır"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rol Açıklamaları */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-4">Rol Açıklamaları</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {(Object.entries(ROLE_META) as [UserRole, (typeof ROLE_META)[UserRole]][]).map(([key, meta]) => (
            <div key={key} className="flex items-start gap-3 p-4 bg-[var(--bg-surface)] border border-white/[0.06] rounded-xl">
              <span className="text-xl shrink-0">{meta.icon}</span>
              <div>
                <p className={`text-sm font-semibold ${meta.color.split(" ")[0]}`}>{meta.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{meta.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onSuccess={load} />}
    </div>
  );
}

export default function KullanicilarPage() {
  return (
    <RoleGuard path="/admin/kullanicilar">
      <KullanicilarContent />
    </RoleGuard>
  );
}
