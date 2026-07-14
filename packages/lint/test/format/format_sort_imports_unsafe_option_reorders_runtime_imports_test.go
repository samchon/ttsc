package linthost

import "testing"

// TestFormatSortImportsUnsafeOptionReordersRuntimeImports verifies the explicit
// unsafe option restores declaration-level sorting for runtime dependencies.
//
// The option is deliberately named for its semantic cost. This positive twin
// proves it controls the runtime guard rather than becoming a documented flag
// that the implementation silently ignores.
//
//  1. Parse two bare runtime imports in reverse lexical order.
//  2. Enable unsafeSortRuntimeImports.
//  3. Assert the declarations reorder alphabetically.
func TestFormatSortImportsUnsafeOptionReordersRuntimeImports(t *testing.T) {
  source := "import \"./z\";\n" +
    "import \"./a\";\n"
  expected := "import \"./a\";\n" +
    "import \"./z\";\n"
  assertFixSnapshotWithOptions(
    t,
    "format/sort-imports",
    source,
    `{"unsafeSortRuntimeImports":true}`,
    expected,
  )
}
