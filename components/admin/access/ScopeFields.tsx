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
}: {
  scope: Scope;
  onChange: (s: Scope) => void;
  endsAt: string;
  onEndChange: (s: string) => void;
  disabled?: boolean;
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
        <option value="sites">Belirli sahalar</option>
        <option value="assigned">Kişiye atanmış işler</option>
      </Select>
      {scope.kind === "sites" && (
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
