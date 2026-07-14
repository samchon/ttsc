package linthost

import "testing"

// TestFormatSortImportsCombineRequiresUnsafeRuntimeOptIn verifies
// combineTypeAndValue alone cannot rewrite a runtime-bearing import block.
//
// Combining declarations uses the same whole-block rebuilder as grouping and
// sorting. Letting the apparently narrow option bypass the runtime guard would
// reintroduce declaration reordering through a less obvious configuration path.
//
//  1. Parse same-module value and type-only declarations.
//  2. Enable combineTypeAndValue without unsafeSortRuntimeImports.
//  3. Assert the mixed block remains byte-for-byte unchanged.
func TestFormatSortImportsCombineRequiresUnsafeRuntimeOptIn(t *testing.T) {
  source := "import { value } from \"m\";\n" +
    "import type { Value } from \"m\";\n" +
    "value;\n"
  assertRuleSkipsSourceWithOptions(
    t,
    "format/sort-imports",
    source,
    `{"combineTypeAndValue":true}`,
  )
}
