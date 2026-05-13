import type { TtscLintPlugins } from "./TtscLintPlugins";
import type { TtscLintRuleMap } from "./TtscLintRuleMap";

/**
 * One flat-config entry. ESLint-style `files` / `ignores` glob scoping, a
 * `plugins` namespace map of contributor plugin objects, an `extends` list of
 * child entries to fold in first, and a severity-keyed `rules` map applied
 * after the extends chain.
 */
export interface TtscLintConfigEntry<
  P extends TtscLintPlugins = TtscLintPlugins,
> {
  /** Globs that select the files this entry applies to. */
  files?: string | readonly string[];

  /** Globs that exclude files this entry would otherwise match. */
  ignores?: string | readonly string[];

  /**
   * Nested entries (or arrays of entries) folded in before this entry's own
   * rules apply. Mirrors ESLint flat config's `extends`: each child's rules
   * layer first, with `this.rules` taking precedence on key collisions.
   */
  extends?:
    | TtscLintConfigEntry<P>
    | readonly TtscLintConfigEntry<P>[]
    | readonly (TtscLintConfigEntry<P> | readonly TtscLintConfigEntry<P>[])[];

  /**
   * Contributor plugin objects keyed by namespace. Each value is the default
   * export of a `@ttsc/lint` contributor package (an `ITtscLintPlugin`).
   */
  plugins?: P;

  /** Rule-name → severity map. Supports severity tuples with options. */
  rules?: TtscLintRuleMap<P>;
}
