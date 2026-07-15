package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterObjectSpreadInValueLiteral is the
// over-suppression twin of the object rest-target skip: a real object VALUE
// literal ending in a spread (`{ a, ...o }`) legally takes a trailing comma.
//
// The rest-target suppression keys on assignment-target position, not on the
// mere presence of a trailing spread. A value-position spread is not a
// destructuring target, so the rule must still add the comma; a guard that
// suppressed on "last element is a spread" alone would silently regress this.
//
// 1. Parse a multi-line object value literal whose last member is a spread.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the trailing comma lands after the spread.
func TestFormatTrailingCommaInsertsAfterObjectSpreadInValueLiteral(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const merged = {\n  a,\n  ...o\n};\n",
    "const merged = {\n  a,\n  ...o,\n};\n",
  )
}
