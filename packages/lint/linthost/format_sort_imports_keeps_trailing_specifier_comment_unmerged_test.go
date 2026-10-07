package linthost

import "testing"

// TestFormatSortImportsKeepsTrailingSpecifierCommentUnmerged verifies protected declaration bytes
// survive when runtime merging is otherwise permitted.
//
// A comment after the module string belongs to that declaration. Its position outside the import prefix must not allow a merge to discard it.
//
// 1. Assert the original default-mode input produces no finding.
// 2. Assert the same input stays silent with unsafe runtime sorting enabled.
// 3. Remove only the protected comment and assert the full merged output.
//
// @evidence contracts/testing.md#behavioral-verification The comment after module m must survive with both declarations separate even when runtime sorting is explicitly allowed.
// @evidence contracts/testing.md#independent-expectations The authored module-tail comment belongs to the original declaration. The independent comment-free output imports a and b from the same module without deleting user payload.
// @evidence contracts/testing.md#distinguishing-cases The comment follows the module string and precedes the semicolon, unlike prefix or between-import comments. Removing it supplies the eligible merge positive.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsTrailingSpecifierCommentUnmerged owns its literal default/unsafe negatives and comment-free full-output positive in the selected public Go unit population. The syntax-only rule and fixture edit application execute in one Go process without native builds, consumer installation or product-host children.
func TestFormatSortImportsKeepsTrailingSpecifierCommentUnmerged(t *testing.T) {
  assertRuleSkipsSource(t, "format/sort-imports", `import { a } from "m" /* keep */;
import { b } from "m";
`)
  assertRuleSkipsSourceWithOptions(t, "format/sort-imports", "import { a } from \"m\" /* keep */;\nimport { b } from \"m\";\n", `{"unsafeSortRuntimeImports":true}`)
  assertFixSnapshotWithOptions(t, "format/sort-imports", "import { a } from \"m\";\nimport { b } from \"m\";\n", `{"unsafeSortRuntimeImports":true}`, "import { a, b } from \"m\";\n")
}
