import type {
  TtscLintRuleOptionsSetting,
  TtscLintRuleSetting,
} from "../TtscLintRuleSetting";
import type {
  ITtscLintBoundariesDependenciesRuleOptions,
  ITtscLintBoundariesElementTypesRuleOptions,
  ITtscLintBoundariesEntryPointRuleOptions,
  ITtscLintBoundariesExternalRuleOptions,
  ITtscLintBoundariesNoPrivateRuleOptions,
  ITtscLintBoundariesNoUnknownRuleOptions,
} from "./ITtscLintBoundariesRuleOptions";

/**
 * Architecture-boundary rules that enforce import direction and module
 * visibility between configured source-path _elements_ (layers, features, apps
 * in a monorepo).
 *
 * Every rule operates on the _resolved source file_ of an import — relative
 * imports are followed to the real `.ts`/`.tsx`/`.d.ts` file before
 * classification.
 *
 * @reference https://github.com/javierbrea/eslint-plugin-boundaries
 *
 * @evidence contracts/common.md#principled-implementation Each optional boundaries identifier pairs its severity with the policy object for that operation; omission leaves that rule unspecified rather than prescribing an import policy.
 * @evidence contracts/common.md#clear-and-simple-design Six named entries keep dependency, visibility and external-package policies separate while sharing the severity-plus-options tuple representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The keys name public boundary rules and the values use their declared option interfaces, with no consumer-specific escape type.
 * @evidence contracts/common.md#meaningful-documentation Family prose explains source-file classification and member comments describe each policy's purpose; paragraphs, member spacing and acknowledgment separation follow the documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintBoundariesRules is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintBoundariesRules is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintBoundariesRules is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintBoundariesRules is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintBoundariesRules {
  /**
   * Enforce allowed dependency directions between configured source-path
   * element types.
   *
   * Each `element` entry declares a name, a matching glob, and the other
   * element types it is allowed to import.
   *
   * Imports that fall outside the allow-list are reported.
   *
   * @reference https://github.com/javierbrea/eslint-plugin-boundaries/blob/master/docs/rules/element-types.md
   */
  "boundaries/element-types"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesElementTypesRuleOptions>;

  /**
   * Require imports that cross element boundaries to target the importee
   * element's configured public entry files (typically `index.ts`), so the
   * public surface of each element is explicit.
   *
   * @reference https://github.com/javierbrea/eslint-plugin-boundaries/blob/master/docs/rules/entry-point.md
   */
  "boundaries/entry-point"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesEntryPointRuleOptions>;

  /**
   * Restrict external package imports by package or specifier pattern.
   *
   * Useful for forbidding direct imports of an underlying library when a
   * project-local facade exists.
   *
   * @reference https://github.com/javierbrea/eslint-plugin-boundaries/blob/master/docs/rules/external.md
   */
  "boundaries/external"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesExternalRuleOptions>;

  /**
   * Reject imports of files declared _private_ by a parent element from outside
   * that element.
   *
   * Combines with `element-types` to keep implementation details hidden.
   *
   * @reference https://github.com/javierbrea/eslint-plugin-boundaries/blob/master/docs/rules/no-private.md
   */
  "boundaries/no-private"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesNoPrivateRuleOptions>;

  /**
   * Reject relative imports whose resolved source file falls under no
   * configured element.
   *
   * Catches stray files that escape the project's boundary map.
   *
   * @reference https://github.com/javierbrea/eslint-plugin-boundaries/blob/master/docs/rules/no-unknown.md
   */
  "boundaries/no-unknown"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesNoUnknownRuleOptions>;

  /**
   * Enforce unified, direction-aware dependency policies.
   *
   * Policies can select the importing and imported element, dependency origin,
   * resolved path, entry/private/unknown state, import kind, syntax kind, and
   * imported names. TypeScript path aliases are classified by their resolved
   * source file rather than by the written specifier.
   *
   * @reference https://github.com/javierbrea/eslint-plugin-boundaries/blob/master/packages/website/docs/rules/dependencies.md
   */
  "boundaries/dependencies"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesDependenciesRuleOptions>;
}
