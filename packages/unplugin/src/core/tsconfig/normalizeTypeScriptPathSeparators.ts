/** Match TypeScript's platform-independent treatment of config separators. */
export function normalizeTypeScriptPathSeparators(target: string): string {
  return target.replace(/\\/g, "/");
}
