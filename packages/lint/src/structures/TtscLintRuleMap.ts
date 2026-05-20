import type { TtscLintRule } from "./TtscLintRule";
import type { ITtscLintRuleOptionsMap } from "./TtscLintRuleOptions";
import type { TtscLintSeverity } from "./TtscLintSeverity";

/**
 * Rule-name → severity or severity-tuple map.
 *
 * Built from two independent mapped types intersected together:
 *
 * - Rules listed in `ITtscLintRuleOptionsMap` accept `severity`, `[severity]`, or
 *   `[severity, options]`, with the options type picked per rule key.
 * - Every other built-in rule accepts `severity` or `[severity]`.
 * - Namespaced contributor plugin rules accept `severity`, `[severity]`, or
 *   `[severity, unknownOptions]` because the host type surface no longer knows
 *   contributor rule schemas.
 *
 * Splitting the two halves (instead of folding them into one mapped type with a
 * conditional value) keeps TypeScript's contextual typing intact inside the
 * options object literal: typing
 *
 * ```ts
 * rules: {
 *   "format/sort-imports": ["warning", { importOrder: [...] }],
 *   "no-var":              "error",
 * }
 * ```
 *
 * Yields exact autocomplete on `importOrder`, `importOrderSeparation`, etc.,
 * while `no-var` rejects any tuple beyond a bare severity.
 *
 * The `(string & {})` widener is intentionally absent: typos in rule names
 * produce a `TS2353` excess-property error when the literal is checked in
 * isolation (e.g. one negative-case-per-const). When the literal also carries
 * other shape-incompatible entries — e.g. `prefre` typo on `format/quotes` next
 * to the rule-name typo — TS sometimes elides the rule-name error after
 * reporting the option-key error first. The test at
 * `tests/test-lint/.../test_lib_index_d_ts_rule_options_autocomplete_per_rule.ts`
 * splits each negative case into its own const to keep every branch
 * load-bearing.
 */
export type TtscLintRuleMap = {
  [K in keyof ITtscLintRuleOptionsMap]?:
    | TtscLintSeverity
    | readonly [TtscLintSeverity]
    | readonly [TtscLintSeverity, ITtscLintRuleOptionsMap[K]];
} & {
  [K in Exclude<TtscLintRule, keyof ITtscLintRuleOptionsMap>]?:
    | TtscLintSeverity
    | readonly [TtscLintSeverity];
} & {
  [K in `${string}/${string}`]?:
    | TtscLintSeverity
    | readonly [TtscLintSeverity]
    | readonly [TtscLintSeverity, unknown];
};
