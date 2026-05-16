import type { TtscLintFormatConfig } from "./TtscLintFormatConfig";
import type { TtscLintPlugins } from "./TtscLintPlugins";
import type { TtscLintRuleMap } from "./TtscLintRuleMap";

/**
 * One flat-config entry. ESLint-style `files` / `ignores` glob scoping, a
 * `plugins` namespace map of contributor plugin objects, an `extends` list of
 * child entries to fold in first, and a severity-keyed `rules` map applied
 * after the extends chain.
 *
 * Prettier-style formatting opts in through a sibling `format` block — see
 * `TtscLintFormatConfig`. The block can scope per-entry (e.g. wider
 * `printWidth` for `legacy/**`) just like `rules` does.
 */
export interface TtscLintConfigEntry<
  P extends TtscLintPlugins = Record<string, never>,
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

  /**
   * Prettier-style flat configuration for the `format/*` rules. Presence
   * (even an empty `format: {}`) enables format-class rules at Prettier
   * defaults; absence keeps them all off. Per-rule overrides go through
   * the `rules` map — the `rules` entry wins on conflict.
   */
  format?: TtscLintFormatConfig;
}
