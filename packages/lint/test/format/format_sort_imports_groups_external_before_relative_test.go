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
//
// @evidence contracts/testing.md#behavioral-verification Unsafe default ordering must produce alpha,zebra,local-a,local-b without blank separators and with the complete use unchanged.
// @evidence contracts/testing.md#independent-expectations The documented default third-party-before-relative order and alphabetical ordering yield the authored literal sequence. No empty-string order entry means no group blank line.
// @evidence contracts/testing.md#distinguishing-cases Two populated groups each contain two shuffled imports, unlike the builtin-first three-group host and explicit-separator hosts. Default safe runtime preservation belongs to separate hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsGroupsExternalBeforeRelative owns the authored four-import complete-output fixture and explicit unsafe permission in the selected public Go unit population. Owning syntax rule and fixture edits execute in one Go process without native builds, consumer installation or real product-host children.
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
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
