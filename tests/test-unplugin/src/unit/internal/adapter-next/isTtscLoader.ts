import { LOADER_IDENTITIES } from "./LOADER_IDENTITIES";

/** Whether an entry names this package's Turbopack loader. */
export function isTtscLoader(entry: unknown): boolean {
  const identity =
    typeof entry === "string"
      ? entry
      : typeof entry === "object" && entry !== null
        ? (entry as { loader?: unknown }).loader
        : undefined;
  return typeof identity === "string" && LOADER_IDENTITIES.includes(identity);
}
