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
