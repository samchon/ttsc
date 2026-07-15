package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterArraySpreadInValueLiteral is the
// over-suppression twin of the array rest-target skip: a real array VALUE
// literal ending in a spread (`[a, ...rest]`) legally takes a trailing comma.
//
// Mirrors the object value-spread twin for arrays. The suppression must key
// on assignment-target position, not on a trailing SpreadElement, so this
// value-position spread still gains its comma.
//
// 1. Parse a multi-line array value literal whose last element is a spread.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the trailing comma lands after the spread.
func TestFormatTrailingCommaInsertsAfterArraySpreadInValueLiteral(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const combined = [\n  aa,\n  ...rest\n];\n",
    "const combined = [\n  aa,\n  ...rest,\n];\n",
  )
}
