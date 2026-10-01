package linthost

import "testing"

// TestFormatSortImportsScopesTypeGroupByRegex verifies a <TYPES> group with a
// trailing regex only claims type-only imports whose specifier matches.
//
// `<TYPES>^[.]` groups type-only relative imports; a type-only third-party
// import falls through to a later group, exercising both the match and the
// no-match arm of the type-group test.
//
//  1. Parse value + type-only imports across relative and third-party modules.
//  2. Apply that order with unsafe runtime sorting enabled.
//  3. Assert only the type-only relative import is hoisted.
//
// @evidence contracts/testing.md#behavioral-verification Only relative type T must enter the first TYPES regex group, followed by react value/type imports and local value, retaining v use.
// @evidence contracts/testing.md#independent-expectations The supported TYPES regex requires both clause-level type-only status and matching relative module text. Literal output independently preserves phases and the configured group sequence.
// @evidence contracts/testing.md#distinguishing-cases Relative type T matches, third-party type R does not, and relative value local does not. The unscoped TYPES host supplies its broader placeholder counterpart.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsScopesTypeGroupByRegex owns the authored matched/unmatched type and value fixture with custom order and unsafe option in the selected public Go unit population. Owning syntax rule and fixture edits execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsScopesTypeGroupByRegex(t *testing.T) {
  source := "import { v } from \"react\";\n" +
    "import type { R } from \"react\";\n" +
    "import type { T } from \"./types\";\n" +
    "import { local } from \"./local\";\n" +
    "v;\n"
  expected := "import type { T } from \"./types\";\n" +
    "import { v } from \"react\";\n" +
    "import type { R } from \"react\";\n" +
    "import { local } from \"./local\";\n" +
    "v;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"order":["<TYPES>^[.]","<THIRD_PARTY_MODULES>","^[.]"],"unsafeSortRuntimeImports":true}`, expected)
}
