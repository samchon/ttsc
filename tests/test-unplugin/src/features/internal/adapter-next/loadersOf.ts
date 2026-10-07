/** The loader entries a rule carries, in either shape Turbopack accepts. */
export function loadersOf(rule: unknown): unknown[] {
  if (Array.isArray(rule)) return rule;
  if (typeof rule === "object" && rule !== null) {
    const loaders = (rule as { loaders?: unknown }).loaders;
    if (Array.isArray(loaders)) return loaders;
  }
  return [];
}
