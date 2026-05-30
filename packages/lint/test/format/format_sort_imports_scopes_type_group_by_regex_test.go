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
//  2. Apply the rule with order ["<TYPES>^[.]", "<THIRD_PARTY_MODULES>", "^[.]"].
//  3. Assert only the type-only relative import is hoisted.
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
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"order":["<TYPES>^[.]","<THIRD_PARTY_MODULES>","^[.]"]}`, expected)
}
