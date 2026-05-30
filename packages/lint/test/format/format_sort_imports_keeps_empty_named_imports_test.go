package linthost

import "testing"

// TestFormatSortImportsKeepsEmptyNamedImports verifies two empty named imports
// of the same module are not collapsed into a malformed declaration.
//
// A merge that would yield neither a default binding nor any specifier is
// rejected; the originals are kept so `import {} from "m"` never degrades to
// `import  from "m"`.
//
//  1. Parse two `import {}` declarations from the same module plus a
//     later-sorting third-party import.
//  2. Apply the rule with default options.
//  3. Assert the empty imports survive as separate declarations.
func TestFormatSortImportsKeepsEmptyNamedImports(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import {} from \"m\";\n" +
    "import {} from \"m\";\n" +
    "z;\n"
  expected := "import {} from \"m\";\n" +
    "import {} from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "z;\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
}
