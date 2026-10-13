/** Fatura bilgisi (ödemede dur kaydı) → yönetim ekranı ve ekip e-postası için okunur satırlar. Bağımlılıksız. */
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Fatura bilgisini yönetim ekranı için okunur satırlara çevirir; bozuk/eksik alan atlanır. */
export function invoiceRowsOf(value: unknown): { label: string; value: string }[] {
  const inv = obj(value);
  if (inv.type !== "individual" && inv.type !== "corporate") return [];
  const addr = obj(inv.address);
  const address = [str(addr.line), str(addr.district), str(addr.province), str(addr.postalCode)].filter(Boolean).join(", ");
  const rows: [string, string | null][] =
    inv.type === "corporate"
      ? [
          ["Fatura türü", "Kurumsal"],
          ["Unvan", str(inv.companyTitle)],
          ["VKN / TCKN", str(inv.taxId)],
          ["Vergi dairesi", str(inv.taxOffice)],
          ["Yetkili", str(inv.authorizedPerson)],
          ["e-Fatura mükellefi", inv.eInvoiceUser === true ? "Evet" : "Hayır"],
          ["MERSİS", str(inv.mersis)],
          ["KEP", str(inv.kep)],
          ["Sipariş/PO no", str(inv.poNumber)],
          ["Fatura adresi", address || null],
        ]
      : [
          ["Fatura türü", "Bireysel"],
          ["TCKN", str(inv.tckn)],
          ["Fatura adresi", address || null],
        ];
  return rows.filter((r): r is [string, string] => !!r[1]).map(([label, v]) => ({ label, value: v }));
}
