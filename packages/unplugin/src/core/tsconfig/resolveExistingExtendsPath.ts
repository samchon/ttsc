import { isFile } from "./isFile";

/**
 * Try an on-disk `extends` location as-is and, unless it already ends in
 * `.json`, with that extension appended. A directory is never a config file and
 * cannot be expanded to `tsconfig.json` or a double `.json` suffix. The
 * location keeps the spelling it was reached by, as TypeScript keeps it
 * (samchon/ttsc#1455).
 */
export function resolveExistingExtendsPath(location: string): string | null {
  const candidates = location.endsWith(".json")
    ? [location]
    : [location, `${location}.json`];
  for (const candidate of candidates) {
    if (isFile(candidate)) {
      return candidate;
    }
  }
  return null;
}
