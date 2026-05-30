package linthost

import "testing"

// TestFormatSortImportsGroupsExternalBeforeRelative verifies the canonical
// group order: third-party modules sit above relative-path imports.
//
// The group split is the rule's load-bearing contract; without it the
// formatter is just an alphabetizer that ignores the most useful axis. This
// scenario pins the default group order and the alphabetical sort within each
// group. The default order carries no "" separator, so the groups are adjacent
// (blank lines are opt-in by position).
//
//  1. Parse a source file with mixed third-party and relative imports in
//     intentionally shuffled order.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file matches the canonical layout.
func TestFormatSortImportsGroupsExternalBeforeRelative(t *testing.T) {
  source := "import { reduce } from \"./local-b\";\n" +
    "import zebra from \"zebra\";\n" +
    "import { x } from \"./local-a\";\n" +
    "import alpha from \"alpha\";\n" +
    "JSON.stringify({ reduce, zebra, x, alpha });\n"
  expected := "import alpha from \"alpha\";\n" +
    "import zebra from \"zebra\";\n" +
    "import { x } from \"./local-a\";\n" +
    "import { reduce } from \"./local-b\";\n" +
    "JSON.stringify({ reduce, zebra, x, alpha });\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
}
