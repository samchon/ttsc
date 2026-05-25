package linthost

import "testing"

// TestFormatPrintWidthBreaksLongNamedExports verifies `export { … };`
// re-exports reflow when the clause overflows the budget.
//
// NamedExports shares listShape with NamedImports, but the surrounding
// declaration is different (no `from` clause when re-exporting from
// the local scope). The case keeps NamedExports honest by exercising
// the standalone form, since a regression specific to NamedExports
// wouldn't surface through the import-side tests.
//
//  1. Configure printWidth=20.
//  2. Feed `export { alpha, bravo, charlie };`.
//  3. Assert the rewrite breaks the specifier clause across lines.
func TestFormatPrintWidthBreaksLongNamedExports(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "export { alpha, bravo, charlie };\n",
    `{"printWidth": 20}`,
    "export {\n  alpha,\n  bravo,\n  charlie,\n};\n",
  )
}
