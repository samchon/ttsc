import { FLAG_SCHEMA } from "./FLAG_SCHEMA";
import { normalizeFlagToken } from "./normalizeFlagToken";

/**
 * Allow-list map for the Go layer named `layer` (`"host"` or `"lint"`):
 * flag-name (no leading dashes) → whether the flag takes a value token. The
 * generator emits a literal Go map with the same shape, but this function is
 * the runtime equivalent — used in tests to verify the generated Go matches the
 * schema.
 */
export function buildGoAllowList(layer: "host" | "lint"): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const flag of FLAG_SCHEMA) {
    if (!flag.consumedBy.includes(layer)) continue;
    const takesValue = flag.kind === "value" || flag.kind === "valueOptional";
    for (const name of [flag.name, ...(flag.aliases ?? [])]) {
      // Keyed by the one normalization the runtime token lookup uses, so the
      // generated allow-lists and `resolveFlagSpec` cannot recognise different
      // spellings. The Go consumers apply the same normalization before the
      // lookup (`strings.ToLower` on the dash-stripped name).
      const key = normalizeFlagToken(name);
      // If two flags collide on the normalized key (e.g. `-p` vs `--project`),
      // use the value-taking shape.
      const existing = out.get(key);
      if (existing !== undefined && existing !== takesValue) {
        throw new Error(
          `ttsc flag schema: conflicting Go allow-list entry for ${JSON.stringify(key)} on layer ${layer}`,
        );
      }
      out.set(key, takesValue);
    }
  }
  return out;
}
