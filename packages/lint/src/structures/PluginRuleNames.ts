import type { TtscLintPlugins } from "./TtscLintPlugins";

/**
 * Builds the union of `${namespace}/${rule}` strings from a plugins map.
 *
 * Each plugin's `rules` tuple is read literally: an `as const` tuple
 * (`["no-cycle", "order"] as const`) provides exact autocomplete, while a plain
 * `string[]` collapses to `${namespace}/${string}` and disables rule-level typo
 * detection for that namespace.
 */
export type PluginRuleNames<P extends TtscLintPlugins> = {
  [Ns in keyof P]: P[Ns] extends { rules?: infer R }
    ? R extends readonly (infer N)[]
      ? N extends string
        ? `${Ns & string}/${N}`
        : never
      : never
    : never;
}[keyof P];
