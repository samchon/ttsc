package linthost

import "testing"

// TestFormatSortImportsMergesTypeNamedBinding pins the AST-flag classification in
// collectMergedSpecs against a binding literally named `type`.
//
// `import type { type as bar }` imports the export named `type` (aliased `bar`),
// type-only. The specifier carries NO inline `type` modifier (TS forbids one inside
// `import type { … }`), so its own AST flag is false; the type-only-ness comes from
// the declaration. A `"type "` string-prefix check would see the specifier text
// `type as bar`, conclude it is already an inline type specifier, and skip adding
// the modifier when folding into a mixed value import, silently demoting `bar` to a
// value import. Classifying by the AST flag keeps the modifier, so the merged form
// stays type-only for that binding: `type type as bar` (inline `type`, name `type`,
// alias `bar`).
//
// 1. Parse value foo plus a type-only export literally named type and aliased bar.
// 2. Enable both combining and unsafe runtime sorting.
// 3. Assert the complete output preserves foo as value and bar as inline type.
//
// @evidence contracts/testing.md#behavioral-verification Merging must keep foo a value and bar type-only as type type as bar, retaining its imported export name type and local alias bar.
// @evidence contracts/testing.md#independent-expectations TypeScript inline-type syntax separates the modifier from an export literally named type. The authored exact output independently preserves both roles and foo use under the documented combine policy.
// @evidence contracts/testing.md#distinguishing-cases The imported name starts with type but has no inline modifier in its type-only declaration. The ordinary Bar combine peer distinguishes this contextual-keyword spelling.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsMergesTypeNamedBinding owns the literal contextual-keyword alias transformation with both supported options in the selected public Go unit population. The owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsMergesTypeNamedBinding(t *testing.T) {
  source := "import { foo } from \"m\";\n" +
    "import type { type as bar } from \"m\";\n" +
    "foo;\n"
  expected := "import { foo, type type as bar } from \"m\";\n" +
    "foo;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"combineTypeAndValue":true,"unsafeSortRuntimeImports":true}`, expected)
}
