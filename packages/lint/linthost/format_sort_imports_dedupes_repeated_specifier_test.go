package linthost

import "testing"

// TestFormatSortImportsDedupesRepeatedSpecifier verifies merging duplicate
// modules collapses a specifier imported twice into a single entry.
//
// The merge step de-duplicates named specifiers by their local binding name, so two
// declarations each importing `{ a }` yield one `{ a }`.
//
//  1. Parse two imports of `{ a }` from the same module.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert the merged declaration lists `a` once.
//  4. Assert distinct aliases of the same export both survive the merged output.
//
// @evidence contracts/testing.md#behavioral-verification Duplicate a imports must collapse to one a binding while preserving its use; two imports of the same export with distinct left/right aliases must retain both local bindings.
// @evidence contracts/testing.md#independent-expectations The literal outputs follow the supported unsafe same-module merge contract and TypeScript local binding identity. Distinct aliases denote two accessible names even when they read the same exported value.
// @evidence contracts/testing.md#distinguishing-cases Repeated local a is the normalization positive, while same export a with different local aliases must survive as two specifiers. Default-mode runtime preservation and conflicting-default hosts supply separate safety boundaries.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsDedupesRepeatedSpecifier owns the original duplicate-binding parse input and its full-output oracle plus the distinct-alias transformation in the public Go unit population. Owning syntax rule and fixture fixer run in one Go process without installation, native builds or real product-host children.
func TestFormatSortImportsDedupesRepeatedSpecifier(t *testing.T) {
  source := "import { a } from \"m\";\n" +
    "import { a } from \"m\";\n" +
    "a;\n"
  expected := "import { a } from \"m\";\n" +
    "a;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
  assertFixSnapshotWithOptions(t, "format/sort-imports", "import { a as right } from \"m\";\nimport { a as left } from \"m\";\nconsole.log(left, right);\n", `{"unsafeSortRuntimeImports":true}`, "import { a as left, a as right } from \"m\";\nconsole.log(left, right);\n")
}
