package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterNonRestArrayAssignmentTarget is the
// array twin of the non-rest target over-suppression check: a destructuring
// array assignment target without a trailing rest (`[a, b] = arr`) legally
// takes a trailing comma (`[a, b,] = arr` parses).
//
// Guards the array branch of the same target-position mechanism: suppression
// keys on the last element being a SpreadElement, so a non-rest array target
// must still gain its comma.
//
// 1. Parse a multi-line array assignment target whose last element is not a rest.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the trailing comma lands after the last element.
func TestFormatTrailingCommaInsertsAfterNonRestArrayAssignmentTarget(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "[\n  a,\n  b\n] = arr;\n",
    "[\n  a,\n  b,\n] = arr;\n",
  )
}
