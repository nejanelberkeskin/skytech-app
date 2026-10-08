import { z } from "zod";
import type { OrderPreview } from "@/lib/orders/client";
import { DOCUMENT_KINDS } from "@/lib/orders/types";

const text = z.string().refine((value) => value.trim().length > 0);
const money = z.number().int().nonnegative();
const previewResponse = z.object({
  version: text,
  documents: z.array(z.object({
    kind: z.enum(DOCUMENT_KINDS),
    title: text,
    html: text,
  })).length(DOCUMENT_KINDS.length).refine(
    (documents) => new Set(documents.map((document) => document.kind)).size === DOCUMENT_KINDS.length,
  ),
  totals: z.object({
    quantity: z.number().int().positive(),
    unitPriceKurus: money,
    totalKurus: money,
    vatKurus: money,
    vatRate: z.number().min(0).max(100),
  }),
  schedule: z.object({
    season: z.object({
      label: text,
      startsOn: z.iso.date(),
      endsOn: z.iso.date(),
    }),
    withdrawalDeadline: z.iso.datetime({ offset: true }),
    earliestReleaseOn: z.iso.date(),
    performanceDeadline: z.iso.date(),
    rolledToNextSeason: z.boolean(),
  }),
});

/** Validate the server response before rendering it; never calculate or repair a quote here. */
export function readPreviewResponse(value: unknown, quantity: number): OrderPreview | null {
  const parsed = previewResponse.safeParse(value);
  if (!parsed.success || parsed.data.totals.quantity !== quantity) return null;
  return parsed.data;
}
