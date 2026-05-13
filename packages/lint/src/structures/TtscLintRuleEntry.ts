import type { TtscLintSeverity } from "./TtscLintSeverity";

/**
 * One rule's severity. Either a bare severity literal or an `[severity,
 * options]` tuple.
 *
 * Options are typed as `unknown` at this layer; plugin authors who want
 * option-shape checking should expose dedicated types on their plugin object (a
 * future revision can wire those into the second tuple slot per-rule).
 */
export type TtscLintRuleEntry =
  | TtscLintSeverity
  | readonly [TtscLintSeverity, unknown]
  | readonly [TtscLintSeverity, ...unknown[]];
