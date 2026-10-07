package linthost

import "testing"

// TestFormatSortImportsMergesDefaultAndNamed verifies a default import and a
// named import of the same module merge into one declaration.
//
// The default binding survives alongside the union of named specifiers.
//
//  1. Parse a file importing `{ b }` and a default from the same module.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert one merged `default, { named }` declaration.
//
// @evidence contracts/testing.md#behavioral-verification Unsafe same-module merging must produce default a plus named b in one declaration while retaining both subsequent uses.
// @evidence contracts/testing.md#independent-expectations TypeScript import grammar permits one default binding followed by named bindings. Literal complete output independently keeps each local name and dependency module.
// @evidence contracts/testing.md#distinguishing-cases One value default and one named import are compatible, unlike distinct conflicting defaults and type-only default/named peers. Runtime opt-in is explicit.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsMergesDefaultAndNamed owns the literal default-plus-named value merge snapshot and unsafe options in the selected public Go unit population. The owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsMergesDefaultAndNamed(t *testing.T) {
  source := "import { b } from \"m\";\n" +
    "import a from \"m\";\n" +
    "a;\n" +
    "b;\n"
  expected := "import a, { b } from \"m\";\n" +
    "a;\n" +
    "b;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
