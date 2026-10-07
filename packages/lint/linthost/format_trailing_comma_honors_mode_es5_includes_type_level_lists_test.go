package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5IncludesTypeLevelLists verifies that
// Prettier's `es5` level includes tuple types and type parameters.
//
// TypeScript lists are governed by the formatter option, not a strict claim that their entire surrounding syntax existed in ES5. Both tuple and generic lists share the es5 comma level.
//
// 1. Parse a multi-line tuple and type-parameter declaration.
// 2. Apply format/trailing-comma with mode `es5`.
// 3. Assert both type-level lists gain a trailing comma.
//
// @evidence contracts/testing.md#behavioral-verification The tuple and generic declaration must both gain final commas under es5 without changing type names or the function body. Complete output detects losing either type-space list.
// @evidence contracts/testing.md#independent-expectations Official Prettier options include TypeScript type parameters under es5. The independently authored First/Second tuple and generic outputs preserve both complete type lists and specify their final commas; this entry uses those literal oracles without executing a reference formatter.
// @evidence contracts/testing.md#distinguishing-cases The same source exercises tuple elements and declaration type parameters, distinct from runtime function parameters excluded by the ES5Option host.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaHonorsModeEs5IncludesTypeLevelLists owns each literal source, option and expected output in the public Go unit population. The syntax-only owning rule and edit/no-finding harness run in one process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaHonorsModeEs5IncludesTypeLevelLists(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/trailing-comma",
    "type Pair = [\n  First,\n  Second\n];\nfunction pair<\n  First,\n  Second\n>() {}\n",
    `{"mode":"es5"}`,
    "type Pair = [\n  First,\n  Second,\n];\nfunction pair<\n  First,\n  Second,\n>() {}\n",
  )
}
