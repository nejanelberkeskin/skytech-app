/**
 * Kararlı (keyset) sayfalama — web-brifler/19 §6.
 *
 * Yalnız tarihe bakan imleç, aynı saniyede yazılmış kayıtları atlar ya da tekrarlar.
 * İmleç her zaman (zaman, kimlik) çiftidir: "TARIH|KIMLIK". Sıralama da aynı iki alana göredir.
 */
export interface Cursor {
  at: string;
  id: string;
}

export const encodeCursor = (at: string | Date, id: string): string => `${new Date(at).toISOString()}|${id}`;

export function parseCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  const [at, id] = raw.split("|");
  if (!at || !id || Number.isNaN(Date.parse(at)) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { at: new Date(at).toISOString(), id };
}

/** PostgREST `or` süzgeci: sıradaki sayfa (artan ya da azalan). */
export function keysetFilter(cursor: Cursor, ascending: boolean, column = "created_at"): string {
  const op = ascending ? "gt" : "lt";
  return `${column}.${op}.${cursor.at},and(${column}.eq.${cursor.at},id.${op}.${cursor.id})`;
}

export const LIMIT_DEFAULT = 50;
export const LIMIT_MAX = 200;

export const readLimit = (value: string | null): number =>
  Math.min(Math.max(Number.parseInt(value ?? String(LIMIT_DEFAULT), 10) || LIMIT_DEFAULT, 1), LIMIT_MAX);

/** Son sayfada null döner; UI "devamı var mı" sorusunu buna bakarak yanıtlar. */
export const nextCursor = <T extends { at?: string; createdAt?: string; id: string }>(items: T[], limit: number): string | null =>
  items.length === limit ? encodeCursor((items[items.length - 1].at ?? items[items.length - 1].createdAt) as string, items[items.length - 1].id) : null;
