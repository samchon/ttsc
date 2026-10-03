/**
 * The compiler options that decide the emit format of a file, as declared by
 * the project that emitted it. Both fields matter: tsgo derives the module kind
 * from `target` whenever `module` is absent, so carrying only `module` cannot
 * reproduce its decision.
 *
 * @evidence contracts/common.md#principled-implementation Optional module and target preserve declaration absence because tsgo derives module kind from target when module is missing; defaulting either member here would lose the owning project's semantics.
 * @evidence contracts/common.md#clear-and-simple-design The two emit-format inputs exclude unrelated compiler configuration and travel together through checked-build metadata.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The type carries actual owning-project options rather than assigning a consumer-specific CommonJS or ESM guess.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains why both fields and their absence matter, and separated member comments define the declared-value meaning without property tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Optional module and target strings describe compiler emit-format policy, not native paths, processes or filesystem capabilities; the consuming format classifier separately owns native filename and package-scope observations.
 */
export interface OwningModuleOptions {
  /** The project's `module` option as written; absent when not declared. */
  module?: string;

  /** The project's `target` option as written; absent when not declared. */
  target?: string;
}
