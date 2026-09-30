package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterNonRestObjectAssignmentTarget is the
// over-suppression twin on the target axis: a destructuring assignment
// target WITHOUT a trailing rest (`({ a, b } = obj)`) legally takes a
// trailing comma (Node `--check` exits 0 on `({ a, b, } = obj)`).
//
// An ordinary property at the end of an object assignment target permits a trailing comma. Target ownership alone must not disable the rule.
//
// 1. Parse a multi-line object assignment target whose last member is not a rest.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the trailing comma lands after the last member.
//
// @evidence contracts/testing.md#behavioral-verification The destructuring object target without rest must gain a comma after b while retaining its parentheses, both assigned names and right-hand obj.
// @evidence contracts/testing.md#independent-expectations ECMAScript object-assignment grammar permits a final comma after an ordinary property. The authored literal output preserves binding meaning and defines legal punctuation independently of the target classifier.
// @evidence contracts/testing.md#distinguishing-cases The target ends in an ordinary property, contrasting the final-rest object negative and value-spread positive. Keeping target ownership while changing final-member kind distinguishes over-suppression.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterNonRestObjectAssignmentTarget owns every authored source, no-finding or complete-output assertion in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaInsertsAfterNonRestObjectAssignmentTarget(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "({\n  a,\n  b\n} = obj);\n",
    "({\n  a,\n  b,\n} = obj);\n",
  )
}
