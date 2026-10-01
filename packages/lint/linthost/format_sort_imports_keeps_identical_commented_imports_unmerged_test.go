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
//
// @evidence contracts/testing.md#behavioral-verification Both identical comment-bearing a imports must remain verbatim and separate before z; each keep comment and z use must survive.
// @evidence contracts/testing.md#independent-expectations The parser-visible duplicate declarations are deliberately malformed bindings, yet formatting must not delete their comments. Literal full output independently retains both payload copies under permitted sorting.
// @evidence contracts/testing.md#distinguishing-cases Byte-identical comments share spelling but still require two declaration copies. Different commented siblings and identical namespace declarations provide complementary protection paths.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsIdenticalCommentedImportsUnmerged owns its duplicate commented parse input and exact two-copy output under unsafe sorting in the selected public Go unit population. Parsing, owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
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
