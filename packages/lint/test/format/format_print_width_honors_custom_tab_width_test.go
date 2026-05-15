package main

import "testing"

// TestFormatPrintWidthHonorsCustomTabWidth verifies `tabWidth: 4`
// changes the per-indent column step.
//
// Prettier's default is 2; some teams use 4. The case asserts the
// per-indent step uses the configured value rather than a hardcoded 2.
//
//  1. Configure printWidth=20, tabWidth=4.
//  2. Feed `const x = { aa: 1, bb: 2, cc: 3 };`.
//  3. Assert the broken form indents children by 4 spaces.
func TestFormatPrintWidthHonorsCustomTabWidth(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const x = { aa: 1, bb: 2, cc: 3 };\n",
    `{"printWidth": 20, "tabWidth": 4}`,
    "const x = {\n    aa: 1,\n    bb: 2,\n    cc: 3,\n};\n",
  )
}
