import type { TtscLintPlugins } from "./TtscLintPlugins";
import type { TtscLintRuleMap } from "./TtscLintRuleMap";

/**
 * One flat-config entry. ESLint-style `files` / `ignores` glob scoping, a
 * `plugins` namespace map of contributor plugin objects, and a severity-keyed
 * `rules` map.
 */
export interface TtscLintConfigEntry<
  P extends TtscLintPlugins = TtscLintPlugins,
> {
  /** Globs that select the files this entry applies to. */
  files?: string | readonly string[];
  /** Globs that exclude files this entry would otherwise match. */
  ignores?: string | readonly string[];
  /**
   * Contributor plugin objects keyed by namespace. Each value is the default
   * export of a `@ttsc/lint` contributor package (an `ITtscLintPlugin`).
   */
  plugins?: P;
  /** Rule-name → severity map. Supports severity tuples with options. */
  rules?: TtscLintRuleMap<P>;
}
