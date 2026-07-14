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
func TestFormatSortImportsMergesTypeNamedBinding(t *testing.T) {
  source := "import { foo } from \"m\";\n" +
    "import type { type as bar } from \"m\";\n" +
    "foo;\n"
  expected := "import { foo, type type as bar } from \"m\";\n" +
    "foo;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"combineTypeAndValue":true,"unsafeSortRuntimeImports":true}`, expected)
}
