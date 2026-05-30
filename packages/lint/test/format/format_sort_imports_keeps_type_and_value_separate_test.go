package linthost

import "testing"

// TestFormatSortImportsKeepsTypeAndValueSeparate verifies that without
// combineTypeAndValue a value import and a type-only import of the same module
// stay distinct declarations.
//
// The two have different merge keys by default, so they are grouped and sorted
// but never folded together.
//
//  1. Parse a value import and a type-only import of the same module plus a
//     later-sorting third-party import.
//  2. Apply the rule with default options.
//  3. Assert the value and type-only imports remain separate.
func TestFormatSortImportsKeepsTypeAndValueSeparate(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import { foo } from \"m\";\n" +
    "import type { Bar } from \"m\";\n" +
    "foo;\n"
  expected := "import { foo } from \"m\";\n" +
    "import type { Bar } from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "foo;\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
}
