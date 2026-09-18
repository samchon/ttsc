/**
 * The compiler options that decide the emit format of a file, as declared by
 * the project that emitted it. Both fields matter: tsgo derives the module kind
 * from `target` whenever `module` is absent, so carrying only `module` cannot
 * reproduce its decision.
 */
export interface OwningModuleOptions {
  /** The project's `module` option as written; absent when not declared. */
  module?: string;
  /** The project's `target` option as written; absent when not declared. */
  target?: string;
}
