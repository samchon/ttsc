package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterNonRestObjectAssignmentTarget is the
// over-suppression twin on the target axis: a destructuring assignment
// target WITHOUT a trailing rest (`({ a, b } = obj)`) legally takes a
// trailing comma (Node `--check` exits 0 on `({ a, b, } = obj)`).
//
// The suppression must fire only when the target ends in a rest; an
// assignment target alone is not enough. This pins that a plain
// `{ a, b } = obj` still gains its comma so the fix does not over-reach and
// disable the rule on every destructuring target.
//
// 1. Parse a multi-line object assignment target whose last member is not a rest.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the trailing comma lands after the last member.
func TestFormatTrailingCommaInsertsAfterNonRestObjectAssignmentTarget(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "({\n  a,\n  b\n} = obj);\n",
    "({\n  a,\n  b,\n} = obj);\n",
  )
}
