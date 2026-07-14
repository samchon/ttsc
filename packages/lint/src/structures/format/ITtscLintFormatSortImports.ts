/**
 * Object form of {@link ITtscLintFormat.sortImports}.
 *
 * The declarative {@link order} array expresses group order, blank-line
 * separation, and special groups all by position. By default, declaration-level
 * sorting and merging are limited to erased `import type` blocks. Runtime
 * imports retain source order unless {@link unsafeSortRuntimeImports} is set.
 */
export interface ITtscLintFormatSortImports {
  /**
   * Group order. Each entry is a regular expression matched against a
   * declaration's module specifier, or one of these placeholders:
   *
   * - `<BUILTIN_MODULES>` — Node built-in modules (`fs`, `node:path`, ...).
   * - `<THIRD_PARTY_MODULES>` — catch-all for specifiers that match no other
   *   group. Injected implicitly at the front when omitted.
   * - `<TYPES>` — `import type` declarations. Combine with a regex to scope it,
   *   e.g. `<TYPES>^[.]` groups type-only relative imports.
   * - `""` (empty string) — emit one blank line at this position. An array with
   *   no `""` entry produces no blank lines between groups.
   *
   * Named specifiers inside each declaration are always sorted. Omit for the
   * default grouping. Example:
   *
   * ```ts
   * order: [
   *   "<BUILTIN_MODULES>",
   *   "",
   *   "<THIRD_PARTY_MODULES>",
   *   "",
   *   "<TYPES>^[.]",
   *   "^[.]",
   * ];
   * ```
   */
  order?: readonly (
    | "<BUILTIN_MODULES>"
    | "<THIRD_PARTY_MODULES>"
    | "<TYPES>"
    | ""
    | (string & {})
  )[];

  /**
   * Case-sensitive comparison. `false` (the default) sorts case-insensitively,
   * so `React` and `react` order together; `true` uses raw ASCII order
   * (uppercase before lowercase).
   *
   * @default false
   */
  caseSensitive?: boolean;

  /**
   * Merge a value import and a type-only import of the same module into one
   * declaration with inline `type` specifiers: `import { foo } from "m"` plus
   * `import type { Bar } from "m"` collapse to `import { foo, type Bar } from
   * "m"`. Mixed type/value blocks are left unchanged unless
   * {@link unsafeSortRuntimeImports} is also enabled.
   *
   * @default false
   */
  combineTypeAndValue?: boolean;

  /**
   * Permit declaration-level sorting and merging of runtime-bearing imports.
   *
   * Every default, namespace, named, and bare import can evaluate its module.
   * Reordering those declarations can therefore change program behavior. Keep
   * this disabled unless every imported module in the block is order-independent.
   * Named specifiers inside a declaration and erased `import type` blocks are
   * still sorted when this option is disabled.
   *
   * {@link combineTypeAndValue} only affects mixed type/value blocks when this
   * option is enabled.
   *
   * @default false
   */
  unsafeSortRuntimeImports?: boolean;
}
