import type { TtscLintSeverity } from "./TtscLintSeverity";

/**
 * Per-rule severity setting used by every rule entry in
 * `ITtscLintConfig.rules`.
 *
 * A rule may be configured either as a bare severity string (`"error"`,
 * `"warning"`, `"off"`) or as a single-element tuple containing the same
 * severity. Both forms are equivalent at runtime; the tuple form exists so that
 * severity-only rules and options-bearing rules look uniform when read
 * top-to-bottom in a `ttsc.lint.config.ts` file.
 *
 * Use {@link TtscLintRuleOptionsSetting} when the rule accepts a typed options
 * object.
 *
 * @example
 *   const config: ITtscLintConfig = {
 *     rules: {
 *       eqeqeq: "error",
 *       "no-console": ["warning"],
 *       "no-debugger": "off",
 *     },
 *   };
 */
export type TtscLintRuleSetting =
  | TtscLintSeverity
  | readonly [TtscLintSeverity];

/**
 * Per-rule severity-plus-options setting for rules that accept one typed
 * options object. Rules with canonical positional option lists expose a
 * dedicated setting type instead.
 *
 * This is the tuple form ESLint users know — `[severity, options]` — kept
 * strongly typed by way of the rule's dedicated options interface (see
 * `TtscLintRuleOptions.ts`). The bare {@link TtscLintRuleSetting} forms remain
 * accepted; omitting the options object means "use the rule's default
 * options".
 *
 * @example
 *   const config: ITtscLintConfig = {
 *   rules: {
 *   "boundaries/element-types": [
 *   "error",
 *   { default: "disallow", rules: [...] },
 *   ],
 *   },
 *   };
 *
 * @typeParam TOptions - The rule's options shape. Each rule supplies its own
 *   interface from `TtscLintRuleOptions.ts` (for example
 *   `ITtscLintBoundariesElementTypesRuleOptions`).
 */
export type TtscLintRuleOptionsSetting<TOptions> =
  | TtscLintRuleSetting
  | readonly [TtscLintSeverity, TOptions];
