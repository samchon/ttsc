package linthost

import "testing"

// TestFormatSortImportsKeepsIdenticalCommentedImportsUnmerged verifies two
// byte-identical comment-bearing imports are re-emitted verbatim rather than
// merged into a comment-less declaration.
//
// Like namespace imports, comment-bearing declarations get a per-declaration
// merge key that embeds the original text, so byte-identical duplicates (a
// duplicate-binding error TypeScript reports later, which the parse-level
// formatter still sees) collide into one bucket. Without the guard in
// `renderMergedDecl` the rebuilt statement would join bare specifier texts
// and silently drop the comment bytes.
//
//  1. Parse two identical named imports carrying a specifier comment plus a
//     later-sorting third-party import.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert both commented declarations survive verbatim, sorted first.
func TestFormatSortImportsKeepsIdenticalCommentedImportsUnmerged(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import { a /* keep */ } from \"m\";\n" +
    "import { a /* keep */ } from \"m\";\n" +
    "z;\n"
  expected := "import { a /* keep */ } from \"m\";\n" +
    "import { a /* keep */ } from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "z;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
