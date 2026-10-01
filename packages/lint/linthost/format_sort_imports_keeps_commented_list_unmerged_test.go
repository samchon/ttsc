package linthost

import "testing"

// TestFormatSortImportsKeepsCommentedListUnmerged verifies protected declaration bytes
// survive when runtime merging is otherwise permitted.
//
// A comment after the named binding must retain its declaration attachment. The unsafe negative exercises this protection, while removing only the comment permits merging.
//
// 1. Assert the original default-mode input produces no finding.
// 2. Assert the same input stays silent with unsafe runtime sorting enabled.
// 3. Remove only the protected comment and assert the full merged output.
//
// @evidence contracts/testing.md#behavioral-verification The a declaration must retain its interior keep comment and stay separate from b under default and unsafe modes.
// @evidence contracts/testing.md#independent-expectations The authored comment and binding bytes are user input; literal zero-finding and comment-free complete-output expectations follow the documented comment-preservation and same-module merge policy.
// @evidence contracts/testing.md#distinguishing-cases The comment occurs after the only named specifier. Removing only that comment supplies a merge positive; unsafe opt-in ensures the negative reaches merge eligibility.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsCommentedListUnmerged owns its literal default/unsafe negatives and comment-free full-output positive in the selected public Go unit population. The syntax-only rule and fixture edit application execute in one Go process without native builds, consumer installation or product-host children.
func TestFormatSortImportsKeepsCommentedListUnmerged(t *testing.T) {
  source := "import { a /* keep */ } from \"m\";\n" +
    "import { b } from \"m\";\n" +
    "a;\n" +
    "b;\n"
  assertRuleSkipsSource(t, "format/sort-imports", source)
  assertRuleSkipsSourceWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`)
  assertFixSnapshotWithOptions(t, "format/sort-imports", "import { a } from \"m\";\nimport { b } from \"m\";\na;\nb;\n", `{"unsafeSortRuntimeImports":true}`, "import { a, b } from \"m\";\na;\nb;\n")
}
