package linthost

import "testing"

// TestFormatSortImportsGroupsExternalBeforeRelative verifies the canonical
// group order: external modules sit above relative-path imports separated
// by a single blank line.
//
// The two-group split is the rule's load-bearing contract; without it the
// formatter is just an alphabetizer that ignores the most useful axis. This
// scenario pins the group order, the alphabetical sort within each group,
// and the blank-line separator between groups in one shot.
//
//  1. Parse a source file with mixed external and relative imports in
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
    "\n" +
    "import { x } from \"./local-a\";\n" +
    "import { reduce } from \"./local-b\";\n" +
    "JSON.stringify({ reduce, zebra, x, alpha });\n"
  assertFixSnapshot(t, "formatSortImports", source, expected)
}
