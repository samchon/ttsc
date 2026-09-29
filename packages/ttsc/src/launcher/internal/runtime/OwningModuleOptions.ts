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
 */
export interface OwningModuleOptions {
  /** The project's `module` option as written; absent when not declared. */
  module?: string;

  /** The project's `target` option as written; absent when not declared. */
  target?: string;
}
