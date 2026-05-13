import type { TtscLintConfig } from "./structures/TtscLintConfig";
import type { TtscLintPlugins } from "./structures/TtscLintPlugins";

/**
 * Authoring helper that preserves the literal type of a lint config.
 *
 * ESLint's flat-config experience relies on `defineConfig` to capture the
 * const-narrowed type of the configuration array, which is what makes plugin
 * rule names autocomplete across entries. `@ttsc/lint` follows the same
 * pattern: pass your config through this helper and the contributor plugin
 * objects in `plugins` propagate their `rules` tuples into the rule-name
 * union.
 *
 * ```ts
 * import { defineConfig } from "@ttsc/lint";
 * import importPlugin from "@ttsc/lint-plugin-import";
 *
 * export default defineConfig([
 *   {
 *     plugins: { import: importPlugin },
 *     rules: {
 *       "no-var": "error",
 *       "import/no-cycle": ["error", { maxDepth: 1 }],
 *     },
 *   },
 * ]);
 * ```
 *
 * The function is a pure pass-through at runtime. The generic gymnastics below
 * gather every `plugins` map across the array of config entries into one
 * intersected `TtscLintPlugins` shape that gets threaded back into the
 * `TtscLintConfig<P>` constraint. Without this, the default `P =
 * Record<string, ITtscLintPlugin>` widens `PluginRuleNames<P>` to
 * `${string}/${string}` and `{ "no-varXXX": "error" }`-style typos pass
 * through unchecked.
 */
export function defineConfig<
  const T extends TtscLintConfig<GatherPlugins<T>>,
>(config: T): T {
  return config;
}

/**
 * Walks the input type to collect every plugin map declared across entries.
 * Single entries yield the entry's `plugins`; arrays intersect every entry's
 * `plugins` so each entry's rule-name union remains valid for the whole
 * array. The intersection (vs. union) is load-bearing — TypeScript's
 * `keyof (A | B)` collapses to `never`, which would reject every namespaced
 * rule name.
 */
type GatherPlugins<T> = T extends { plugins?: infer P }
  ? P extends TtscLintPlugins
    ? P
    : {}
  : T extends readonly (infer Item)[]
    ? UnionToIntersection<Item extends unknown ? GatherPlugins<Item> : never>
    : {};

type UnionToIntersection<U> = (
  U extends unknown ? (x: U) => void : never
) extends (x: infer I) => void
  ? I
  : never;
