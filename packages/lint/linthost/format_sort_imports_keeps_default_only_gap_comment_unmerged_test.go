package linthost

import "testing"

// TestFormatSortImportsKeepsDefaultOnlyGapCommentUnmerged verifies protected declaration bytes
// survive when runtime merging is otherwise permitted.
//
// A default-only declaration can contain a prefix comment despite having no named list. Its comment must remain attached when runtime rewriting is permitted.
//
// 1. Assert the original default-mode input produces no finding.
// 2. Assert the same input stays silent with unsafe runtime sorting enabled.
// 3. Remove only the protected comment and assert the full merged output.
//
// @evidence contracts/testing.md#behavioral-verification The default-only a declaration must preserve its keep comment and stay separate from b under both runtime permission modes.
// @evidence contracts/testing.md#independent-expectations The literal input keeps comment attachment, module and binding identity. The comment-free positive uses supported default-plus-named import grammar rather than copying merge internals.
// @evidence contracts/testing.md#distinguishing-cases The commented declaration has no named-import list. A comment-free a plus b twin must merge, proving the prefix guard applies before that shape can return early.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsDefaultOnlyGapCommentUnmerged owns its literal default/unsafe negatives and comment-free full-output positive in the selected public Go unit population. The syntax-only rule and fixture edit application execute in one Go process without native builds, consumer installation or product-host children.
func TestFormatSortImportsKeepsDefaultOnlyGapCommentUnmerged(t *testing.T) {
  assertRuleSkipsSource(t, "format/sort-imports", `import a /* keep */ from "m";
import { b } from "m";
`)
  assertRuleSkipsSourceWithOptions(t, "format/sort-imports", "import a /* keep */ from \"m\";\nimport { b } from \"m\";\n", `{"unsafeSortRuntimeImports":true}`)
  assertFixSnapshotWithOptions(t, "format/sort-imports", "import a from \"m\";\nimport { b } from \"m\";\n", `{"unsafeSortRuntimeImports":true}`, "import a, { b } from \"m\";\n")
}
