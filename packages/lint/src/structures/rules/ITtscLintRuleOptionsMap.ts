import type {
  ITtscLintBoundariesDependenciesRuleOptions,
  ITtscLintBoundariesElementTypesRuleOptions,
  ITtscLintBoundariesEntryPointRuleOptions,
  ITtscLintBoundariesExternalRuleOptions,
  ITtscLintBoundariesNoPrivateRuleOptions,
  ITtscLintBoundariesNoUnknownRuleOptions,
} from "./ITtscLintBoundariesRuleOptions";
import type {
  ITtscLintCoreNoDuplicateImportsRuleOptions,
  ITtscLintCoreNoEmptyFunctionRuleOptions,
  ITtscLintCoreNoEmptyRuleOptions,
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
import type { ITtscLintUnicornPreventAbbreviationsRuleOptions } from "./ITtscLintUnicornRuleOptions";

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
 *     "demo/no-marker-comment": { marker: string };
 *   }
 * }
 * ```
 *
 * After augmentation, `{@link TtscLintRuleOptionsSetting}` tuples and the
 * `defineConfig`-style helpers in plugin packages can type-check the options
 * object against the contributor's declared shape.
 *
 * `format/*` is **not** listed: formatter behavior is configured through the
 * top-level `format` block ({@link ITtscLintFormat}), not through the `rules`
 * surface.
 */
export interface ITtscLintRuleOptionsMap {
  "typescript/no-floating-promises": ITtscLintTypeScriptNoFloatingPromisesRuleOptions;
  "no-duplicate-imports": ITtscLintCoreNoDuplicateImportsRuleOptions;
  "no-empty": ITtscLintCoreNoEmptyRuleOptions;
  "no-empty-function": ITtscLintCoreNoEmptyFunctionRuleOptions;
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
  "unicorn/prevent-abbreviations": ITtscLintUnicornPreventAbbreviationsRuleOptions;
}
