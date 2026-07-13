/**
 * Options shapes for the configurable rules in {@link ITtscLintCoreRules}.
 *
 * Currently only `no-duplicate-imports` accepts options.
 *
 * @reference https://eslint.org/docs/latest/rules/
 */

/** `no-duplicate-imports` rule options. */
export interface ITtscLintCoreNoDuplicateImportsRuleOptions {
  /**
   * Keep clause-level `import type` declarations out of the duplicate
   * comparison with value-bearing declarations of the same module, so one
   * runtime import plus one type-only import may coexist. Inline type
   * specifiers such as `import { type Foo }` stay on the value side because the
   * whole import clause is not type-only.
   *
   * @default false
   */
  allowSeparateTypeImports?: boolean;

  /**
   * Also treat `export … from` declarations of an already imported (or
   * re-exported) module as duplicates when the declarations could be merged.
   *
   * @default false
   */
  includeExports?: boolean;
}
