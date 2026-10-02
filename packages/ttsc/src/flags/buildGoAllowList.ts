import { FLAG_SCHEMA } from "./FLAG_SCHEMA";
import { normalizeFlagToken } from "./normalizeFlagToken";

/**
 * Allow-list map for the Go layer named `layer` (`"host"` or `"lint"`):
 * flag-name (no leading dashes) → whether the flag takes a value token. The
 * generator calls this adapter to emit literal native maps. The generated-file
 * drift check re-runs that generator and compares the checked-out artifacts;
 * agreement with the schema is distinct from validating native flag behavior.
 *
 * @evidence contracts/common.md#principled-implementation Consumer membership chooses the native lane, normalized canonical names and aliases form its keys, and value/valueOptional arity becomes the Go map's value-token boolean. Conflicting arity for one identity throws rather than choosing a declaration order.
 * @evidence contracts/common.md#clear-and-simple-design This adapter derives the native representation from the shared schema and normalization function, keeping native allow-list ownership aligned with JavaScript flag identity.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The returned caller-owned map reflects declared host/lint CLI contracts; conflicting normalized entries remain explicit errors instead of silent consumer-specific overrides.
 * @evidence contracts/common.md#meaningful-documentation The comment describes key grammar, value meaning and the relationship with generated native maps, following the documentation skill's representation and ownership guidance.
 * @evidence contracts/performance.md#efficient-algorithms One schema traversal checks each row's finite consumer list and normalizes accepted canonical names and aliases. Work includes their text bytes, with expected constant-time indexed collision checks instead of pairwise comparison; returned key strings/entries grow with selected spellings, and each row's temporary spelling array grows with its aliases.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The adapter creates an independently mutable map for its caller and coordinates no completed or in-flight cross-request result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The map's normalized key strings and boolean arity values transfer to its caller on return; the function keeps no historical entries or handles.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The lane selects maintained schema data for text normalization; this operation opens no file, builds no native path and calls no platform or process API.
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
      // A normalized identity must have one arity on the selected native lane.
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
