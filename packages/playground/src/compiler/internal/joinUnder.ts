/**
 * Join a relative path under a base directory, ignoring base when `rel` is
 * absolute.
 */
export function joinUnder(base: string, rel: string): string {
  if (rel.startsWith("/")) return rel;
  return `${base}/${rel}`;
}
