import type { TtscLintSeverity } from "./TtscLintSeverity";

/**
 * Per-rule severity setting used by every rule entry in
 * `ITtscLintConfig.rules`.
 *
 * A rule may be configured either as a bare severity string (`"error"`,
 * `"warning"`, `"off"`) or as a single-element tuple containing the same
 * severity. Both forms are equivalent at runtime; the tuple form exists so that
 * severity-only rules and options-bearing rules look uniform when read
 * top-to-bottom in a `lint.config.ts` file.
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
 *
 * @evidence contracts/common.md#principled-implementation The union accepts a severity directly or a readonly one-item tuple, matching optionless runtime settings.
 * @evidence contracts/common.md#clear-and-simple-design One reusable alias centralizes severity-only settings rather than repeating tuple alternatives in every rule map.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The alias encodes supported severity forms without rule-name or fixture-specific widening.
 * @evidence contracts/common.md#meaningful-documentation The preceding native documentation explains equivalent forms, options separation and an example; prose and tags are separated under documentation guidance.
 */
export type TtscLintRuleSetting =
  | TtscLintSeverity
  | readonly [TtscLintSeverity];

/**
 * Per-rule severity-plus-options setting for rules that accept one typed
 * options object. Rules with canonical positional option lists expose a
 * dedicated setting type instead.
 *
 * The `[severity, options]` tuple keeps the options strongly typed through
 * the rule's dedicated interface beside its family under `structures/rules`.
 * The bare {@link TtscLintRuleSetting} forms remain
 * accepted; omitting the options object means "use the rule's default
 * options".
 *
 * @example
 *   const config: ITtscLintConfig = {
 *     rules: {
 *       "boundaries/element-types": ["error", { default: "disallow" }],
 *     },
 *   };
 *
 * @typeParam TOptions - The rule's options shape. Each rule supplies its own
 *   interface from its family's `*RuleOptions.ts` file (for example
 *   `ITtscLintBoundariesElementTypesRuleOptions`).
 *
 * @evidence contracts/common.md#principled-implementation The generic tuple preserves the rule's options type while accepting severity-only forms for default options.
 * @evidence contracts/common.md#clear-and-simple-design The alias composes the severity setting and one options slot, leaving positional rule variants to dedicated aliases.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Typed options remain tied to their rule rather than an untyped payload added to satisfy particular callers.
 * @evidence contracts/common.md#meaningful-documentation Native documentation distinguishes omitted options from explicit options and describes the type parameter; examples and tag boundaries follow documentation guidance.
 */
export type TtscLintRuleOptionsSetting<TOptions> =
  | TtscLintRuleSetting
  | readonly [TtscLintSeverity, TOptions];
