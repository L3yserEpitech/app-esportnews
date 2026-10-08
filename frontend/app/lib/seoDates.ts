// Backend timestamps carry microseconds ("2026-10-08T12:16:53.614776Z").
// Schema.org and Open Graph both want ISO 8601 and are happy with seconds;
// fractional digits only add noise and trip some validators.
export function toIsoSeconds(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || d.getTime() <= 0) return undefined;
  return d.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

// `updated_at` is backfilled from `created_at` and may be missing on cached
// payloads written before the column existed; never advertise a modification
// date older than the publication.
export function modifiedDate(createdAt: string, updatedAt?: string | null): string {
  const created = new Date(createdAt).getTime();
  const updated = updatedAt ? new Date(updatedAt).getTime() : NaN;
  if (Number.isNaN(updated) || updated <= 0 || updated < created) return createdAt;
  return updatedAt as string;
}
