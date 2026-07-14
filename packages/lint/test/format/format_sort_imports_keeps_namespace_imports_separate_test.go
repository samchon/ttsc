package linthost

import "testing"

// TestFormatSortImportsKeepsNamespaceImportsSeparate verifies a namespace
// import is never folded into a named import of the same module.
//
// `import * as ns` cannot share a declaration with `{ named }`, so the rule
// keeps namespace declarations standalone while still sorting the block.
//
//  1. Parse a file with a namespace and a named import of the same module plus
//     a later-sorting third-party import.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert the namespace import stays its own declaration.
func TestFormatSortImportsKeepsNamespaceImportsSeparate(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import * as ns from \"m\";\n" +
    "import { a } from \"m\";\n" +
    "z;\n" +
    "ns;\n" +
    "a;\n"
  expected := "import * as ns from \"m\";\n" +
    "import { a } from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "z;\n" +
    "ns;\n" +
    "a;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
