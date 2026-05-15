import type { PluginRuleNames } from "./PluginRuleNames";
import type { TtscLintPlugins } from "./TtscLintPlugins";
import type { TtscLintRule } from "./TtscLintRule";
import type { TtscLintRuleOptionsMap } from "./TtscLintRuleOptions";
import type { TtscLintSeverity } from "./TtscLintSeverity";

/**
 * Rule-name → severity or severity-tuple map.
 *
 * Built from two independent mapped types intersected together:
 *
 *  - Rules listed in `TtscLintRuleOptionsMap` accept `severity`,
 *    `[severity]`, or `[severity, options]`, with the options type
 *    picked per rule key.
 *  - Every other built-in rule plus any contributor plugin rule accepts
 *    `severity` or `[severity]`.
 *
 * Splitting the two halves (instead of folding them into one mapped type
 * with a conditional value) keeps TypeScript's contextual typing intact
 * inside the options object literal: typing
 *
 * ```ts
 * rules: {
 *   "format/sort-imports": ["warning", { importOrder: [...] }],
 *   "no-var":              "error",
 * }
 * ```
 *
 * yields exact autocomplete on `importOrder`, `importOrderSeparation`,
 * etc., while `no-var` rejects any tuple beyond a bare severity.
 *
 * The `(string & {})` widener is intentionally absent: typos in rule
 * names produce type errors.
 */
export type TtscLintRuleMap<
  P extends TtscLintPlugins = Record<string, never>,
> = {
  [K in keyof TtscLintRuleOptionsMap]?:
    | TtscLintSeverity
    | readonly [TtscLintSeverity]
    | readonly [TtscLintSeverity, TtscLintRuleOptionsMap[K]];
} & {
  [K in
    | Exclude<TtscLintRule, keyof TtscLintRuleOptionsMap>
    | PluginRuleNames<P>]?: TtscLintSeverity | readonly [TtscLintSeverity];
};
