package linthost

import "testing"

// TestFormatSortImportsKeepsAttributeBearingImportsUnmerged verifies protected declaration bytes
// survive when runtime merging is otherwise permitted.
//
// Import attributes belong to their declaration. Explicit permission to reorder runtime imports must not allow a merge that deletes those bytes.
//
// 1. Assert the original default-mode input produces no finding.
// 2. Assert the same input stays silent with unsafe runtime sorting enabled.
// 3. Remove only the protected attributes and assert the full merged output.
//
// @evidence contracts/testing.md#behavioral-verification Both with-type-json clauses must remain separate with zero findings under default and explicit unsafe runtime modes.
// @evidence contracts/testing.md#independent-expectations Literal import-attribute bytes belong to each dependency declaration. Removing them is a meaning-changing merge even when runtime reordering is permitted.
// @evidence contracts/testing.md#distinguishing-cases Two same-module named imports carry attributes; the attribute-free twin must merge to import { a, b }, distinguishing attribute protection from the default runtime barrier.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsAttributeBearingImportsUnmerged owns its literal default/unsafe negatives and attribute-free full-output positive in the selected public Go unit population. The syntax-only rule and fixture edit application execute in one Go process without native builds, consumer installation or product-host children.
func TestFormatSortImportsKeepsAttributeBearingImportsUnmerged(t *testing.T) {
  assertRuleSkipsSource(t, "format/sort-imports", `import { a } from "x" with { type: "json" };
import { b } from "x" with { type: "json" };
`)
  assertRuleSkipsSourceWithOptions(t, "format/sort-imports", "import { a } from \"x\" with { type: \"json\" };\nimport { b } from \"x\" with { type: \"json\" };\n", `{"unsafeSortRuntimeImports":true}`)
  assertFixSnapshotWithOptions(t, "format/sort-imports", "import { a } from \"x\";\nimport { b } from \"x\";\n", `{"unsafeSortRuntimeImports":true}`, "import { a, b } from \"x\";\n")
}
