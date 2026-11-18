import type { SupabaseClient } from "@supabase/supabase-js";
import { createParasutClient, parasutConfig } from "./parasut";
import { runParasutInvoices } from "./issue";

/** Zamanlanmış iş: bekleyen satış faturalarını Paraşüt'te keser. Paraşüt yapılandırılmamışsa hiçbir şey yapmaz. */
export async function runInvoiceJob(db: SupabaseClient, siteUrl: string) {
  const cfg = parasutConfig();
  const client = cfg ? createParasutClient(cfg) : null;
  return runParasutInvoices(db, client, {
    siteUrl,
    pollJob: { tries: 4, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) },
  });
}
