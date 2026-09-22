/** Avoid silently truncating totals at PostgREST's configured row limit. Stable ordering is required. */
export async function readPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const all: T[] = [];
  const size = 500;
  for (let from = 0; ; ) {
    const { data, error } = await page(from, from + size - 1);
    if (error || !data) throw new Error("report_unavailable");
    all.push(...data);
    if (data.length === 0) return all;
    from += data.length; // Also works when the server caps responses below 500.
  }
}
