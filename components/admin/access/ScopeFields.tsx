"use client";
import { Input, Select } from "@/components/ui";
import type { Scope } from "@/lib/admin/permission-keys";
import SitePicker from "./SitePicker";
import { scopeLabel } from "./labels";
export default function ScopeFields({
  scope,
  onChange,
  endsAt,
  onEndChange,
  disabled = false,
  fullScopeOnly = false,
}: {
  scope: Scope;
  onChange: (s: Scope) => void;
  endsAt: string;
  onEndChange: (s: string) => void;
  disabled?: boolean;
  fullScopeOnly?: boolean;
}) {
  return (
    <div className="space-y-4">
      <Select
        label="Erişim kapsamı"
        value={scope.kind}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            e.target.value === "sites"
              ? { kind: "sites", siteIds: [] }
              : e.target.value === "assigned"
                ? { kind: "assigned" }
                : { kind: "all" },
          )
        }
      >
        <option value="all">Tüm kayıtlar</option>
        <option value="sites" disabled={fullScopeOnly}>
          Belirli sahalar
        </option>
        <option value="assigned" disabled={fullScopeOnly}>
          Kişiye atanmış işler
        </option>
      </Select>
      {fullScopeOnly && (
        <p
          className="text-sm text-amber-200"
          role={scope.kind !== "all" ? "alert" : undefined}
        >
          Bu rol personel veya rol yönetimi izni içerdiği için yalnız “Tüm
          kayıtlar” kapsamında kullanılabilir.
          {scope.kind !== "all" &&
            " Mevcut seçiminiz korunuyor. Devam etmek için kapsamı açıkça değiştirin veya başka bir rol seçin."}
        </p>
      )}
      {scope.kind === "sites" && !fullScopeOnly && (
        <SitePicker
          ids={scope.siteIds}
          onChange={(siteIds) => onChange({ kind: "sites", siteIds })}
          disabled={disabled}
        />
      )}
      {scope.kind !== "all" && (
        <p className="text-sm text-amber-200">
          Saha veya görev kapsamını henüz desteklemeyen ekranlara bu atamayla
          erişilemez.
        </p>
      )}
      <Input
        type="datetime-local"
        step={1}
        label="Erişim bitişi (Türkiye saati, isteğe bağlı)"
        value={endsAt}
        onChange={(e) => onEndChange(e.target.value)}
        disabled={disabled}
        helperText="Boş bırakılırsa süresiz. Davet bağlantısının geçerlilik süresinden farklıdır."
      />
      <p className="text-xs text-slate-400 break-words">
        Seçilen kapsam:{" "}
        {scope.kind === "sites"
          ? `${scope.siteIds.length} saha seçili`
          : scopeLabel(scope)}
      </p>
    </div>
  );
}
