package linthost

import "testing"

// TestFormatSortImportsGroupsBuiltinsFirst verifies the <BUILTIN_MODULES> group
// hoists Node built-in imports above third-party and relative imports.
//
// The default order leads with <BUILTIN_MODULES>; a `node:`-prefixed or bare
// built-in specifier must land there ahead of everything else.
//
//  1. Parse a file mixing a built-in, a third-party, and a relative import.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert the built-in import sits first.
//
// @evidence contracts/testing.md#behavioral-verification Unsafe default grouping must put node:fs before express and local, preserving the imported bindings and their object use.
// @evidence contracts/testing.md#independent-expectations The public default order puts Node built-ins before third-party and relative imports. The literal output independently identifies fs as built-in and preserves every binding/use.
// @evidence contracts/testing.md#distinguishing-cases The tested built-in spelling is node:fs; third-party express and relative local supply distinct group members. External-before-relative and custom-order hosts supply other group boundaries.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsGroupsBuiltinsFirst owns the literal three-group node:fs transformation and unsafe option in the selected public Go unit population. Owning syntax rule and fixture edits execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsGroupsBuiltinsFirst(t *testing.T) {
  source := "import { x } from \"./local\";\n" +
    "import express from \"express\";\n" +
    "import { readFile } from \"node:fs\";\n" +
    "JSON.stringify({ x, express, readFile });\n"
  expected := "import { readFile } from \"node:fs\";\n" +
    "import express from \"express\";\n" +
    "import { x } from \"./local\";\n" +
    "JSON.stringify({ x, express, readFile });\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
