import type { TtscLintRuleOptionsSetting } from "../TtscLintRuleSetting";
import type {
  ITtscLintBoundariesDependenciesRuleOptions,
  ITtscLintBoundariesElementTypesRuleOptions,
  ITtscLintBoundariesEntryPointRuleOptions,
  ITtscLintBoundariesExternalRuleOptions,
  ITtscLintBoundariesNoPrivateRuleOptions,
  ITtscLintBoundariesNoUnknownRuleOptions,
} from "./ITtscLintBoundariesRuleOptions";
import type {
  ITtscLintCoreDefaultCaseRuleOptions,
  ITtscLintCoreNoDuplicateImportsRuleOptions,
  ITtscLintCoreNoElseReturnRuleOptions,
  ITtscLintCoreNoEmptyFunctionRuleOptions,
  ITtscLintCoreNoEmptyRuleOptions,
  ITtscLintCoreNoExtendNativeRuleOptions,
  ITtscLintCoreNoMixedOperatorsRuleOptions,
  ITtscLintCoreNoParamReassignRuleOptions,
  ITtscLintCoreNoPromiseExecutorReturnRuleOptions,
  ITtscLintCoreNoUnusedExpressionsRuleOptions,
  ITtscLintCorePreferConstRuleOptions,
  ITtscLintNoFallthroughRuleOptions,
} from "./ITtscLintCoreRuleOptions";
import type { ITtscLintCypressUnsafeToChainCommandRuleOptions } from "./ITtscLintCypressRuleOptions";
import type {
  ITtscLintFunctionalEmptyRuleOptions,
  ITtscLintFunctionalImmutableDataRuleOptions,
  ITtscLintFunctionalNoConditionalStatementsRuleOptions,
  ITtscLintFunctionalNoLetRuleOptions,
  ITtscLintFunctionalNoMixedTypesRuleOptions,
  ITtscLintFunctionalNoReturnVoidRuleOptions,
  ITtscLintFunctionalNoThrowStatementsRuleOptions,
  ITtscLintFunctionalNoTryStatementsRuleOptions,
  ITtscLintFunctionalParametersRuleOptions,
  ITtscLintFunctionalPreferImmutableTypesRuleOptions,
  ITtscLintFunctionalPreferReadonlyTypeRuleOptions,
  ITtscLintFunctionalPreferTacitRuleOptions,
  ITtscLintFunctionalReadonlyTypeRuleOptions,
  ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions,
} from "./ITtscLintFunctionalRuleOptions";
import type { ITtscLintReactPerfRuleOptions } from "./ITtscLintReactPerfRuleOptions";
import type { ITtscLintReactOnlyExportComponentsRuleOptions } from "./ITtscLintReactRuleOptions";
import type { ITtscLintStorybookNoUninstalledAddonsRuleOptions } from "./ITtscLintStorybookRuleOptions";
import type { ITtscLintTestingLibraryConsistentDataTestIdRuleOptions } from "./ITtscLintTestingLibraryRuleOptions";
import type {
  ITtscLintTypeScriptBanTsCommentRuleOptions,
  ITtscLintTypeScriptNoFloatingPromisesRuleOptions,
  ITtscLintTypeScriptNoMisusedPromisesRuleOptions,
  ITtscLintTypeScriptNoRestrictedTypesRuleOptions,
  ITtscLintTypeScriptSwitchExhaustivenessCheckRuleOptions,
} from "./ITtscLintTypeScriptRuleOptions";
import type {
  ITtscLintUnicornBetterRegexRuleOptions,
  ITtscLintUnicornConsistentFunctionScopingRuleOptions,
  ITtscLintUnicornFilenameCaseRuleOptions,
  ITtscLintUnicornImportStyleRuleOptions,
  ITtscLintUnicornIsolatedFunctionsRuleOptions,
  ITtscLintUnicornNoTypeofUndefinedRuleOptions,
  ITtscLintUnicornNoUnnecessaryPolyfillsRuleOptions,
  ITtscLintUnicornPreferNumberPropertiesRuleOptions,
  ITtscLintUnicornPreventAbbreviationsRuleOptions,
  ITtscLintUnicornStringContentRuleOptions,
  ITtscLintUnicornTemplateIndentRuleOptions,
  ITtscLintUnicornTextEncodingIdentifierCaseRuleOptions,
} from "./ITtscLintUnicornRuleOptions";

/**
 * Index from typed rule name to its single options-object slot.
 *
 * Built-in rule families with one object option are listed here. Rules with
 * canonical positional lists expose dedicated setting types instead.
 * Contributor plugins do not extend this map; they publish their own exported
 * interface and the user passes it to `ITtscLintConfig` as its generic
 * argument (see {@link TtscLintContributorOverlay}). Augmenting this interface
 * from a contributor package still type-checks for existing packages.
 *
 * {@link TtscLintRuleOptionsOverlay} maps every entry to its strongly typed
 * severity tuple. {@link ITtscLintRules} intersects that overlay with the
 * built-in families and the open contributor fallback, so unknown contributor
 * names retain the backward-compatible `unknown` options slot.
 *
 * `format/*` is **not** listed: formatter behavior is configured through the
 * top-level `format` block ({@link ITtscLintFormat}), not through the `rules`
 * surface.
 *
 * @evidence contracts/common.md#principled-implementation Each rule-name property selects its options object, and TypeScript declaration merging adds contributor entries to the same key space; positional settings remain outside this object-slot map.
 * @evidence contracts/common.md#clear-and-simple-design One index supplies the mapped settings overlay, so each built-in rule defines its options shape once and the public intersection derives its severity tuple.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Contributors extend rule typing through their own exported interface and the config generic, not by editing this map; explicit built-in mappings do not substitute an unknown payload for the declared options schema.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains object slots, positional exclusion, the contributor generic and formatter ownership; each member documents its policy role and blank paragraphs, member spacing and tag separation follow documentation guidance.
 */
export interface ITtscLintRuleOptionsMap {
  /** Exceptions to requiring a switch default clause. */
  "default-case": ITtscLintCoreDefaultCaseRuleOptions;

  /** Template selection and indentation normalization policy. */
  "unicorn/template-indent": ITtscLintUnicornTemplateIndentRuleOptions;

  /** Accepted Promise handlers and intentional-discard forms. */
  "typescript/no-floating-promises": ITtscLintTypeScriptNoFloatingPromisesRuleOptions;

  /** Type-import separation and re-export participation. */
  "no-duplicate-imports": ITtscLintCoreNoDuplicateImportsRuleOptions;

  /** Whether returning chains may retain else-if branches. */
  "no-else-return": ITtscLintCoreNoElseReturnRuleOptions;

  /** Whether an empty catch body is permitted. */
  "no-empty": ITtscLintCoreNoEmptyRuleOptions;

  /** Function categories allowed to have an empty body. */
  "no-empty-function": ITtscLintCoreNoEmptyFunctionRuleOptions;

  /** Built-in prototypes exempt from the extension prohibition. */
  "no-extend-native": ITtscLintCoreNoExtendNativeRuleOptions;

  /** Operator groups and equal-precedence mixing policy. */
  "no-mixed-operators": ITtscLintCoreNoMixedOperatorsRuleOptions;

  /** Parameter-property mutation policy and ignored parameter names. */
  "no-param-reassign": ITtscLintCoreNoParamReassignRuleOptions;

  /** Whether a Promise executor may explicitly discard its return value. */
  "no-promise-executor-return": ITtscLintCoreNoPromiseExecutorReturnRuleOptions;

  /** Expression forms accepted as intentional effects. */
  "no-unused-expressions": ITtscLintCoreNoUnusedExpressionsRuleOptions;

  /** Intentional fallthrough comments and empty-case policy. */
  "no-fallthrough": ITtscLintNoFallthroughRuleOptions;

  /** Destructuring and reads before initialization for const suggestions. */
  "prefer-const": ITtscLintCorePreferConstRuleOptions;

  /** Attribute and pattern used to validate JSX test identifiers. */
  "testing-library/consistent-data-testid": ITtscLintTestingLibraryConsistentDataTestIdRuleOptions;

  /** Accepted parameter syntax and parameter-count policy. */
  "functional/functional-parameters": ITtscLintFunctionalParametersRuleOptions;

  /** Identifier/code exemptions and Map/Set mutation allowance. */
  "functional/immutable-data": ITtscLintFunctionalImmutableDataRuleOptions;

  /** Empty object slot; this inheritance policy has no configurable fields. */
  "functional/no-class-inheritance": ITtscLintFunctionalEmptyRuleOptions;

  /** Empty object slot; this class policy has no configurable fields. */
  "functional/no-classes": ITtscLintFunctionalEmptyRuleOptions;

  /**
   * Upstream compatibility field; native conditional rejection is
   * unconditional.
   */
  "functional/no-conditional-statements": ITtscLintFunctionalNoConditionalStatementsRuleOptions;

  /** Empty object slot; this expression policy has no configurable fields. */
  "functional/no-expression-statements": ITtscLintFunctionalEmptyRuleOptions;

  /** Identifier exceptions to requiring const declarations. */
  "functional/no-let": ITtscLintFunctionalNoLetRuleOptions;

  /** Empty object slot; this loop policy has no configurable fields. */
  "functional/no-loop-statements": ITtscLintFunctionalEmptyRuleOptions;

  /** Member-kind combinations permitted in a type declaration. */
  "functional/no-mixed-types": ITtscLintFunctionalNoMixedTypesRuleOptions;

  /** Empty object slot; this rejection policy has no configurable fields. */
  "functional/no-promise-reject": ITtscLintFunctionalEmptyRuleOptions;

  /** Exceptions to requiring non-void function results. */
  "functional/no-return-void": ITtscLintFunctionalNoReturnVoidRuleOptions;

  /** Empty object slot; this receiver policy has no configurable fields. */
  "functional/no-this-expressions": ITtscLintFunctionalEmptyRuleOptions;

  /** Upstream compatibility field; native throw rejection is unconditional. */
  "functional/no-throw-statements": ITtscLintFunctionalNoThrowStatementsRuleOptions;

  /** Exceptions to prohibiting try statements. */
  "functional/no-try-statements": ITtscLintFunctionalNoTryStatementsRuleOptions;

  /** Ignore patterns and compatibility levels for the native readonly subset. */
  "functional/prefer-immutable-types": ITtscLintFunctionalPreferImmutableTypesRuleOptions;

  /** Empty object slot; this signature policy has no configurable fields. */
  "functional/prefer-property-signatures": ITtscLintFunctionalEmptyRuleOptions;

  /** Exceptions to requiring readonly type representations. */
  "functional/prefer-readonly-type": ITtscLintFunctionalPreferReadonlyTypeRuleOptions;

  /** Whether member-expression forwarding arrows are checked. */
  "functional/prefer-tacit": ITtscLintFunctionalPreferTacitRuleOptions;

  /** Preferred spelling of readonly arrays and tuples. */
  "functional/readonly-type": ITtscLintFunctionalReadonlyTypeRuleOptions;

  /**
   * Declaration selectors for readonly checks; level comparisons are
   * unsupported.
   */
  "functional/type-declaration-immutability": ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions;

  /** Cypress commands after which subject-dependent chaining is unsafe. */
  "cypress/unsafe-to-chain-command": ITtscLintCypressUnsafeToChainCommandRuleOptions;

  /** Direction-aware dependency policies between source elements. */
  "boundaries/dependencies": ITtscLintBoundariesDependenciesRuleOptions;

  /** Allowed import directions between classified element types. */
  "boundaries/element-types": ITtscLintBoundariesElementTypesRuleOptions;

  /** Public entry paths permitted when crossing an element boundary. */
  "boundaries/entry-point": ITtscLintBoundariesEntryPointRuleOptions;

  /** External package restrictions selected by importing element. */
  "boundaries/external": ITtscLintBoundariesExternalRuleOptions;

  /** Source elements and paths treated as private implementations. */
  "boundaries/no-private": ITtscLintBoundariesNoPrivateRuleOptions;

  /** Source elements used to classify otherwise unknown imports. */
  "boundaries/no-unknown": ITtscLintBoundariesNoUnknownRuleOptions;

  /** Intrinsic-prop exemptions for freshly allocated array values. */
  "react-perf/jsx-no-new-array-as-prop": ITtscLintReactPerfRuleOptions;

  /** Intrinsic-prop exemptions for freshly allocated function values. */
  "react-perf/jsx-no-new-function-as-prop": ITtscLintReactPerfRuleOptions;

  /** Intrinsic-prop exemptions for freshly allocated object values. */
  "react-perf/jsx-no-new-object-as-prop": ITtscLintReactPerfRuleOptions;

  /** Intrinsic-prop exemptions for freshly allocated JSX element values. */
  "react-perf/jsx-no-jsx-as-prop": ITtscLintReactPerfRuleOptions;

  /** Package availability exceptions when validating Storybook addons. */
  "storybook/no-uninstalled-addons": ITtscLintStorybookNoUninstalledAddonsRuleOptions;

  /** Export forms allowed alongside Fast Refresh components. */
  "react/only-export-components": ITtscLintReactOnlyExportComponentsRuleOptions;

  /** TypeScript directive bans and required description policy. */
  "typescript/ban-ts-comment": ITtscLintTypeScriptBanTsCommentRuleOptions;

  /** Contexts in which Promise values must be reported. */
  "typescript/no-misused-promises": ITtscLintTypeScriptNoMisusedPromisesRuleOptions;

  /** Restricted type spellings, messages and replacement actions. */
  "typescript/no-restricted-types": ITtscLintTypeScriptNoRestrictedTypesRuleOptions;

  /** Default-clause treatment in finite discriminant coverage. */
  "typescript/switch-exhaustiveness-check": ITtscLintTypeScriptSwitchExhaustivenessCheckRuleOptions;

  /** Arrow-function participation in function-hoisting suggestions. */
  "unicorn/consistent-function-scoping": ITtscLintUnicornConsistentFunctionScopingRuleOptions;

  /** Whether regex character-class ranges are sorted and merged. */
  "unicorn/better-regex": ITtscLintUnicornBetterRegexRuleOptions;

  /** Name replacement policy and contexts exempt from replacement. */
  "unicorn/prevent-abbreviations": ITtscLintUnicornPreventAbbreviationsRuleOptions;

  /** Import forms permitted for selected module specifiers. */
  "unicorn/import-style": ITtscLintUnicornImportStyleRuleOptions;

  /** Allowed filename case styles and ignored paths. */
  "unicorn/filename-case": ITtscLintUnicornFilenameCaseRuleOptions;

  /** Source string patterns and their configured replacements. */
  "unicorn/string-content": ITtscLintUnicornStringContentRuleOptions;

  /** Callbacks that must not capture their defining environment. */
  "unicorn/isolated-functions": ITtscLintUnicornIsolatedFunctionsRuleOptions;

  /** Whether comparisons against globals may retain typeof. */
  "unicorn/no-typeof-undefined": ITtscLintUnicornNoTypeofUndefinedRuleOptions;

  /** Runtime targets and exemptions used to assess polyfill imports. */
  "unicorn/no-unnecessary-polyfills": ITtscLintUnicornNoUnnecessaryPolyfillsRuleOptions;

  /** Global numeric helpers exempt from the Number-property preference. */
  "unicorn/prefer-number-properties": ITtscLintUnicornPreferNumberPropertiesRuleOptions;

  /** Preferred dashed or undashed encoding identifier spelling. */
  "unicorn/text-encoding-identifier-case": ITtscLintUnicornTextEncodingIdentifierCaseRuleOptions;
}

/**
 * Strongly typed rule settings derived from the options map.
 *
 * This mapped overlay is consumed by {@link ITtscLintRules}; keeping the
 * derivation here gives each rule listed in the map its typed setting
 * without a second rule-name declaration.
 *
 * @evidence contracts/common.md#principled-implementation Mapping keyof the merged options interface preserves each rule's own options type, and optional mapped properties retain the ability to leave a rule unspecified.
 * @evidence contracts/common.md#clear-and-simple-design A single mapped alias derives severity-plus-options settings for every map entry, avoiding a second manually synchronized rule-name list.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The overlay uses TypeScript's supported keyof and indexed-access semantics rather than casts or a widened unknown slot for known options.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the overlay's public consumer and which built-in rules it types; description and acknowledgments are separated following documentation guidance.
 */
export type TtscLintRuleOptionsOverlay = {
  [TRuleName in keyof ITtscLintRuleOptionsMap]?: TtscLintRuleOptionsSetting<
    ITtscLintRuleOptionsMap[TRuleName]
  >;
};
