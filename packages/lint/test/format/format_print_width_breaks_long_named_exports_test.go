package linthost

import "testing"

// TestFormatPrintWidthBreaksLongNamedExports verifies `export { … };`
// local exports reflow when the clause overflows the budget.
//
// NamedExports shares listShape with NamedImports, but the surrounding
// declaration is different (no `from` clause when exporting from
// the local scope). The case keeps NamedExports honest by exercising
// the standalone form, since a regression specific to NamedExports
// wouldn't surface through the import-side tests.
//
//  1. Configure printWidth=20.
//  2. Feed `export { alpha, bravo, charlie };`.
//  3. Assert the rewrite breaks the specifier clause across lines.
// @evidence contracts/testing.md#behavioral-verification The print-width rule must break a local named export at width 20 without losing any export name, its order or its terminator. The complete output also detects accidentally adding an import-like from clause.
// @evidence contracts/testing.md#independent-expectations Installed Prettier 3.8.3 independently produces the authored local-export output at width 20. The literal retains the original local bindings and no module source, following the fixture syntax rather than the owning renderer.
// @evidence contracts/testing.md#distinguishing-cases This host owns the overflowing local named-export form, distinct from named imports that carry a module suffix. Short and already formatted targets are covered by the exact-fit and fixed-point hosts; this case is a required transformation.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthBreaksLongNamedExports is a selected public Go unit invoking the owning registered rule and full applied-output helper in one process. Its local export need not resolve actual exported values for syntax-layout verification.
func TestFormatPrintWidthBreaksLongNamedExports(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "export { alpha, bravo, charlie };\n",
    `{"printWidth": 20}`,
    "export {\n  alpha,\n  bravo,\n  charlie,\n};\n",
  )
}
