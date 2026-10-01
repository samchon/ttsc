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
//
// @evidence contracts/testing.md#behavioral-verification Enabling combineTypeAndValue alone must emit no findings for value plus type-only imports of m, preserving the value use.
// @evidence contracts/testing.md#independent-expectations The public option contract requires explicit unsafeSortRuntimeImports before mixed runtime declarations may be rewritten. Zero findings independently enforces that permission boundary.
// @evidence contracts/testing.md#distinguishing-cases Same-module value/type imports are merge-compatible but lack runtime opt-in; the combines-type-and-value host supplies the adjacent both-options positive.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsCombineRequiresUnsafeRuntimeOptIn owns the literal mixed-block no-finding input and explicit combine-only options in the selected public Go unit population. The owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
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
