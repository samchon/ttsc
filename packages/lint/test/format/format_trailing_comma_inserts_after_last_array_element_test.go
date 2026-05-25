package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastArrayElement verifies the happy path:
// a multi-line array literal gains a trailing comma after its last element.
//
// Prettier's `trailingComma: "all"` adds commas to every multi-line list, and
// arrays are the simplest container shape — no method bodies, no parameter
// modifiers, no rest-pattern hazard. Pinning this case keeps the simplest
// branch regression-free.
//
// 1. Parse a source file with one multi-line array literal.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma.
func TestFormatTrailingCommaInsertsAfterLastArrayElement(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "const xs = [\n  1,\n  2,\n  3\n];\n",
    "const xs = [\n  1,\n  2,\n  3,\n];\n",
  )
}
