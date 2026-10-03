package linthost

import "testing"

// TestFormatSortImportsMergesDuplicateTypeOnlyImports verifies two `import type`
// declarations of the same module merge into one, staying type-only.
//
// When every merged declaration is type-only, the merged result keeps the
// clause-level `type` keyword rather than marking each specifier inline.
//
//  1. Parse a file with two `import type` declarations from the same module.
//  2. Apply the rule with default options.
//  3. Assert one merged `import type` declaration.
//
// @evidence contracts/testing.md#behavioral-verification The B and A declarations must merge into one clause-level type import with A,B, preserving their type-only classification.
// @evidence contracts/testing.md#independent-expectations Type-only imports are erased under the official TypeScript module contract. A literal clause-level type declaration independently preserves both type names without adding runtime dependencies.
// @evidence contracts/testing.md#distinguishing-cases All declarations are type-only and default options suffice. The mixed value/type host requires explicit runtime permission and inline type markers instead.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsMergesDuplicateTypeOnlyImports owns the authored default-options erased-type merge snapshot in the selected public Go unit population. The owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsMergesDuplicateTypeOnlyImports(t *testing.T) {
  source := "import type { B } from \"m\";\n" +
    "import type { A } from \"m\";\n"
  expected := "import type { A, B } from \"m\";\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
}
