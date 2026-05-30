package linthost

import "testing"

// TestFormatSortImportsKeepsTypeDefaultSeparateWhenCombining verifies a
// type-only default import is not folded into a value import even with
// combineTypeAndValue on.
//
// `import type D, { value }` would retype `value`, so the merge is refused and
// the declarations stay separate while still grouped and sorted.
//
//  1. Parse a type-only default import and a value import of the same module
//     plus a later-sorting third-party import.
//  2. Apply the rule with combineTypeAndValue enabled.
//  3. Assert the type-only default import stays its own declaration.
func TestFormatSortImportsKeepsTypeDefaultSeparateWhenCombining(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import type D from \"m\";\n" +
    "import { x } from \"m\";\n" +
    "x;\n"
  expected := "import type D from \"m\";\n" +
    "import { x } from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "x;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"combineTypeAndValue":true}`, expected)
}
