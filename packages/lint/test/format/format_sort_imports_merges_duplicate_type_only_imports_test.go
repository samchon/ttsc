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
func TestFormatSortImportsMergesDuplicateTypeOnlyImports(t *testing.T) {
  source := "import type { B } from \"m\";\n" +
    "import type { A } from \"m\";\n"
  expected := "import type { A, B } from \"m\";\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
}
