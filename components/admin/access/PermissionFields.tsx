"use client";
import { useState } from "react";
import { Input } from "@/components/ui";
import { useAdmin } from "@/lib/admin-context";
import {
  PERMISSIONS,
  MFA_PERMISSIONS,
  type Permission,
} from "@/lib/admin/permission-keys";
import { hasFullPermission } from "./policy";
import { permissionLabel } from "./labels";
const groups: Record<string, string> = {
  orders: "Siparişler",
  customers: "Müşteri bilgileri",
  refunds: "İadeler",
  invoices: "Faturalar",
  finance: "Finans",
  sites: "Sahalar",
  batches: "Bırakma çalışmaları",
  monitoring: "İzleme",
  certificates: "Sertifikalar",
  requests: "Talepler",
  messages: "İletişim",
  content: "İçerik",
  media: "Medya",
  legal: "Hukuki metinler",
  staff: "Personel",
  roles: "Roller",
  audit: "İşlem geçmişi",
  sales: "Satış",
  system: "Sistem",
};
export const globalOnly = new Set<string>([
  "staff.invite",
  "staff.manage",
  "roles.manage",
]);
export default function PermissionFields({
  value,
  onChange,
  disabled,
}: {
  value: Permission[];
  onChange: (v: Permission[]) => void;
  disabled: boolean;
}) {
  const { me } = useAdmin();
  const [search, setSearch] = useState("");
  const matches = PERMISSIONS.filter((p) =>
    `${groups[p.split(".")[0]]} ${permissionLabel(p)}`
      .toLocaleLowerCase("tr")
      .includes(search.toLocaleLowerCase("tr")),
  );
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-white">
        İzinler · {value.length} seçili
      </h2>
      <p className="text-sm text-slate-300">
        Yalnız tüm kayıtlar kapsamında ve süresiz sahip olduğunuz izinleri
        ekleyebilirsiniz. Rol oluşturmak kişilere erişim vermez; ayrıca atama
        gerekir.
      </p>
      <p className="text-sm text-amber-200">
        Ek doğrulama işaretli izinler hassas işlemleri kapsar. Yeniden
        doğrulama, sunucuda MFA zorunluluğu etkin olduğunda uygulanır. Personel
        ve rol yönetimi izinleri yalnız tüm kayıtlar kapsamında atanabilir.
      </p>
      <Input
        label="İzin ara"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {!matches.length && (
        <p className="text-slate-300">
          Aramanıza uygun izin bulunmuyor. Mevcut seçimler korunur.
        </p>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {Object.entries(groups).map(([group, label]) => {
          const items = matches.filter((p) => p.split(".")[0] === group);
          return items.length ? (
            <fieldset
              key={group}
              disabled={disabled}
              className="border border-white/15 rounded-xl p-4 min-w-0"
            >
              <legend className="px-2 text-emerald-200">{label}</legend>
              {items.map((p) => (
                <label
                  key={p}
                  className="flex gap-3 py-3 min-h-11 items-start text-sm text-slate-200"
                >
                  <input
                    className="mt-1 shrink-0"
                    type="checkbox"
                    checked={value.includes(p)}
                    disabled={!value.includes(p) && !hasFullPermission(me, p)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...value, p]
                          : value.filter((v) => v !== p),
                      )
                    }
                  />
                  <span>
                    {permissionLabel(p)}
                    {MFA_PERMISSIONS.has(p) && (
                      <span className="block text-xs text-amber-200">
                        Ek doğrulama kapsamı
                      </span>
                    )}
                    {globalOnly.has(p) && (
                      <span className="block text-xs text-amber-200">
                        Yalnız tüm kayıtlar
                      </span>
                    )}
                    {!hasFullPermission(me, p) && (
                      <span className="block text-xs text-slate-400">
                        Bu izni ekleme yetkiniz yok.
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null;
        })}
      </div>
    </section>
  );
}
