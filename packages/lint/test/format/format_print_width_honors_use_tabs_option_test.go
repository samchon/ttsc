package linthost

import "testing"

// TestFormatPrintWidthHonorsUseTabsOption verifies the `useTabs: true`
// option swaps space indentation for tab characters.
//
// Some projects (Linux kernel, parts of the Node.js core) require tab
// indentation. The case pins the option-honoring path so a project
// that sets `useTabs: true` does not silently get space indentation on
// `ttsc format`.
//
//  1. Configure printWidth=20, useTabs=true.
//  2. Feed `const x = { aa: 1, bb: 2 };`.
//  3. Assert the broken form uses one tab per child indent.
func TestFormatPrintWidthHonorsUseTabsOption(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const x = { aa: 1, bb: 2, cc: 3 };\n",
    `{"printWidth": 20, "useTabs": true}`,
    "const x = {\n\taa: 1,\n\tbb: 2,\n\tcc: 3,\n};\n",
  )
}
