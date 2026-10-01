package linthost

import "testing"

// TestFormatSortImportsKeepsDefaultGapCommentUnmerged verifies protected declaration bytes
// survive when runtime merging is otherwise permitted.
//
// Comments between a default binding and its named list must survive. The unsafe negative distinguishes this prefix protection from the default runtime-order barrier.
//
// 1. Assert the original default-mode input produces no finding.
// 2. Assert the same input stays silent with unsafe runtime sorting enabled.
// 3. Remove only the protected comment and assert the full merged output.
//
// @evidence contracts/testing.md#behavioral-verification The default D plus named a declaration must retain its gap comment and remain separate from b even with unsafe runtime sorting enabled.
// @evidence contracts/testing.md#independent-expectations Literal original declaration bytes preserve D, a, b and the keep comment; the independent comment-free output legally combines one default and two named bindings.
// @evidence contracts/testing.md#distinguishing-cases A comment sits between default D and the comma, outside the named braces. Its removed-comment twin merges, contrasting the named-list and default-only gap peers.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsDefaultGapCommentUnmerged owns its literal default/unsafe negatives and comment-free full-output positive in the selected public Go unit population. The syntax-only rule and fixture edit application execute in one Go process without native builds, consumer installation or product-host children.
func TestFormatSortImportsKeepsDefaultGapCommentUnmerged(t *testing.T) {
  assertRuleSkipsSource(t, "format/sort-imports", `import D /* keep */, { a } from "m";
import { b } from "m";
`)
  assertRuleSkipsSourceWithOptions(t, "format/sort-imports", "import D /* keep */, { a } from \"m\";\nimport { b } from \"m\";\n", `{"unsafeSortRuntimeImports":true}`)
  assertFixSnapshotWithOptions(t, "format/sort-imports", "import D, { a } from \"m\";\nimport { b } from \"m\";\n", `{"unsafeSortRuntimeImports":true}`, "import D, { a, b } from \"m\";\n")
}
