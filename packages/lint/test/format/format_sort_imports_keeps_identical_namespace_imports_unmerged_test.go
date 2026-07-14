package linthost

import "testing"

// TestFormatSortImportsKeepsIdenticalNamespaceImportsUnmerged verifies two
// byte-identical `default, * as ns` imports are re-emitted verbatim rather
// than merged into a namespace-less declaration.
//
// mergeKey isolates namespace imports by embedding the original text in the
// key, so two byte-identical declarations (a duplicate-binding error
// TypeScript reports later, which the parse-level formatter still sees)
// collide into one bucket. Without the namespace guard in `renderMergedDecl`
// the rebuilt statement would keep only the default binding and silently
// drop `* as N`.
//
//  1. Parse two identical `import D, * as N` declarations plus a
//     later-sorting third-party import.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert both namespace declarations survive verbatim, sorted first.
func TestFormatSortImportsKeepsIdenticalNamespaceImportsUnmerged(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import D, * as N from \"m\";\n" +
    "import D, * as N from \"m\";\n" +
    "z;\n"
  expected := "import D, * as N from \"m\";\n" +
    "import D, * as N from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "z;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
