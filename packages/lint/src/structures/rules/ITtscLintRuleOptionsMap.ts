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
 * Contributor plugins extend the map by augmenting it from their own package:
 *
 * ```ts
 * declare module "@ttsc/lint" {
 *   interface ITtscLintRuleOptionsMap {
 *     "demo/no-marker-comment": { markers?: readonly string[] };
 *   }
 * }
 * ```
 *
 * {@link TtscLintRuleOptionsOverlay} maps every entry to its strongly typed
 * severity tuple. {@link ITtscLintRules} intersects that overlay with the
 * built-in families and the open contributor fallback, so importing a plugin's
 * augmentation tightens its registered rule while unknown contributor names
 * retain the backward-compatible `unknown` options slot.
 *
 * `format/*` is **not** listed: formatter behavior is configured through the
 * top-level `format` block ({@link ITtscLintFormat}), not through the `rules`
 * surface.
 */
export interface ITtscLintRuleOptionsMap {
  "default-case": ITtscLintCoreDefaultCaseRuleOptions;
  "unicorn/template-indent": ITtscLintUnicornTemplateIndentRuleOptions;
  "typescript/no-floating-promises": ITtscLintTypeScriptNoFloatingPromisesRuleOptions;
  "no-duplicate-imports": ITtscLintCoreNoDuplicateImportsRuleOptions;
  "no-else-return": ITtscLintCoreNoElseReturnRuleOptions;
  "no-empty": ITtscLintCoreNoEmptyRuleOptions;
  "no-empty-function": ITtscLintCoreNoEmptyFunctionRuleOptions;
  "no-extend-native": ITtscLintCoreNoExtendNativeRuleOptions;
  "no-mixed-operators": ITtscLintCoreNoMixedOperatorsRuleOptions;
  "no-param-reassign": ITtscLintCoreNoParamReassignRuleOptions;
  "no-promise-executor-return": ITtscLintCoreNoPromiseExecutorReturnRuleOptions;
  "no-unused-expressions": ITtscLintCoreNoUnusedExpressionsRuleOptions;
  "no-fallthrough": ITtscLintNoFallthroughRuleOptions;
  "prefer-const": ITtscLintCorePreferConstRuleOptions;
  "testing-library/consistent-data-testid": ITtscLintTestingLibraryConsistentDataTestIdRuleOptions;
  "functional/functional-parameters": ITtscLintFunctionalParametersRuleOptions;
  "functional/immutable-data": ITtscLintFunctionalImmutableDataRuleOptions;
  "functional/no-class-inheritance": ITtscLintFunctionalEmptyRuleOptions;
  "functional/no-classes": ITtscLintFunctionalEmptyRuleOptions;
  "functional/no-conditional-statements": ITtscLintFunctionalNoConditionalStatementsRuleOptions;
  "functional/no-expression-statements": ITtscLintFunctionalEmptyRuleOptions;
  "functional/no-let": ITtscLintFunctionalNoLetRuleOptions;
  "functional/no-loop-statements": ITtscLintFunctionalEmptyRuleOptions;
  "functional/no-mixed-types": ITtscLintFunctionalNoMixedTypesRuleOptions;
  "functional/no-promise-reject": ITtscLintFunctionalEmptyRuleOptions;
  "functional/no-return-void": ITtscLintFunctionalNoReturnVoidRuleOptions;
  "functional/no-this-expressions": ITtscLintFunctionalEmptyRuleOptions;
  "functional/no-throw-statements": ITtscLintFunctionalNoThrowStatementsRuleOptions;
  "functional/no-try-statements": ITtscLintFunctionalNoTryStatementsRuleOptions;
  "functional/prefer-immutable-types": ITtscLintFunctionalPreferImmutableTypesRuleOptions;
  "functional/prefer-property-signatures": ITtscLintFunctionalEmptyRuleOptions;
  "functional/prefer-readonly-type": ITtscLintFunctionalPreferReadonlyTypeRuleOptions;
  "functional/prefer-tacit": ITtscLintFunctionalPreferTacitRuleOptions;
  "functional/readonly-type": ITtscLintFunctionalReadonlyTypeRuleOptions;
  "functional/type-declaration-immutability": ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions;
  "cypress/unsafe-to-chain-command": ITtscLintCypressUnsafeToChainCommandRuleOptions;
  "boundaries/dependencies": ITtscLintBoundariesDependenciesRuleOptions;
  "boundaries/element-types": ITtscLintBoundariesElementTypesRuleOptions;
  "boundaries/entry-point": ITtscLintBoundariesEntryPointRuleOptions;
  "boundaries/external": ITtscLintBoundariesExternalRuleOptions;
  "boundaries/no-private": ITtscLintBoundariesNoPrivateRuleOptions;
  "boundaries/no-unknown": ITtscLintBoundariesNoUnknownRuleOptions;
  "react-perf/jsx-no-new-array-as-prop": ITtscLintReactPerfRuleOptions;
  "react-perf/jsx-no-new-function-as-prop": ITtscLintReactPerfRuleOptions;
  "react-perf/jsx-no-new-object-as-prop": ITtscLintReactPerfRuleOptions;
  "react-perf/jsx-no-jsx-as-prop": ITtscLintReactPerfRuleOptions;
  "storybook/no-uninstalled-addons": ITtscLintStorybookNoUninstalledAddonsRuleOptions;
  "react/only-export-components": ITtscLintReactOnlyExportComponentsRuleOptions;
  "typescript/ban-ts-comment": ITtscLintTypeScriptBanTsCommentRuleOptions;
  "typescript/no-misused-promises": ITtscLintTypeScriptNoMisusedPromisesRuleOptions;
  "typescript/no-restricted-types": ITtscLintTypeScriptNoRestrictedTypesRuleOptions;
  "typescript/switch-exhaustiveness-check": ITtscLintTypeScriptSwitchExhaustivenessCheckRuleOptions;
  "unicorn/consistent-function-scoping": ITtscLintUnicornConsistentFunctionScopingRuleOptions;
  "unicorn/better-regex": ITtscLintUnicornBetterRegexRuleOptions;
  "unicorn/prevent-abbreviations": ITtscLintUnicornPreventAbbreviationsRuleOptions;
  "unicorn/import-style": ITtscLintUnicornImportStyleRuleOptions;
  "unicorn/filename-case": ITtscLintUnicornFilenameCaseRuleOptions;
  "unicorn/string-content": ITtscLintUnicornStringContentRuleOptions;
  "unicorn/isolated-functions": ITtscLintUnicornIsolatedFunctionsRuleOptions;
  "unicorn/no-typeof-undefined": ITtscLintUnicornNoTypeofUndefinedRuleOptions;
  "unicorn/no-unnecessary-polyfills": ITtscLintUnicornNoUnnecessaryPolyfillsRuleOptions;
  "unicorn/prefer-number-properties": ITtscLintUnicornPreferNumberPropertiesRuleOptions;
  "unicorn/text-encoding-identifier-case": ITtscLintUnicornTextEncodingIdentifierCaseRuleOptions;
}

/**
 * Strongly typed rule settings derived from the augmentable options map.
 *
 * This mapped overlay is consumed by {@link ITtscLintRules}; keeping the
 * derivation here makes module augmentation immediately affect the public
 * configuration type without a second per-plugin rule-name declaration.
 */
export type TtscLintRuleOptionsOverlay = {
  [TRuleName in keyof ITtscLintRuleOptionsMap]?: TtscLintRuleOptionsSetting<
    ITtscLintRuleOptionsMap[TRuleName]
  >;
};
