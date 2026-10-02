import type {
  TtscLintRuleOptionsSetting,
  TtscLintRuleSetting,
} from "../TtscLintRuleSetting";

/**
 * Strongly typed settings for the rules of one or more contributor packages.
 *
 * A contributor publishes an ordinary exported interface that maps each of its
 * rule names to the options object the rule accepts, or to `void` when the rule
 * takes severity only. The user passes that interface, or an intersection of
 * several, as the generic argument of `ITtscLintConfig`:
 *
 * ```ts
 * export interface IDemoLintRules {
 *   "demo/no-marker-comment": { markers?: readonly string[] };
 *   "demo/capitalize-exports": void;
 * }
 *
 * export default {
 *   rules: { "demo/no-marker-comment": ["error", { markers: ["TODO"] }] },
 * } satisfies ITtscLintConfig<IDemoLintRules>;
 * ```
 *
 * Each listed rule is optional and receives exact severity-plus-options
 * checking; a name that no passed interface lists keeps the open
 * `"<namespace>/<rule>"` fallback of `ITtscLintContributorRules`.
 *
 * @typeParam TMap - Rule name to options object, or to `void` for a
 *   severity-only rule.
 *
 * @evidence contracts/common.md#principled-implementation Mapping keyof the contributor interface keeps each rule's own options type, and the void check selects the severity-only form for rules that take no options.
 * @evidence contracts/common.md#clear-and-simple-design One mapped alias derives the typed settings from a plain exported interface, so a contributor declares each rule once and no module augmentation is needed.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The overlay uses TypeScript's supported keyof and conditional-type semantics and an ordinary generic argument rather than casts, ambient module declarations or a widened unknown slot for listed rules.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the published interface, the generic argument and the open fallback for unlisted names; the example separates the contributor and user sides.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscLintContributorOverlay is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscLintContributorOverlay is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscLintContributorOverlay is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscLintContributorOverlay is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type TtscLintContributorOverlay<TMap extends object> = {
  [TRuleName in keyof TMap]?: [TMap[TRuleName]] extends [void]
    ? TtscLintRuleSetting
    : TtscLintRuleOptionsSetting<TMap[TRuleName]>;
};
