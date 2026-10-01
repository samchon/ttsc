package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterNonRestArrayAssignmentTarget is the
// array twin of the non-rest target over-suppression check: a destructuring
// array assignment target without a trailing rest (`[a, b] = arr`) legally
// takes a trailing comma (`[a, b,] = arr` parses).
//
// Assignment-target position alone does not forbid trailing commas. A target with ordinary final element must still normalize under the permissive comma policy.
//
// 1. Parse a multi-line array assignment target whose last element is not a rest.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the trailing comma lands after the last element.
//
// @evidence contracts/testing.md#behavioral-verification A destructuring array target without final rest must gain its legal comma after b. Exact output preserves both assigned bindings and the right-hand arr expression.
// @evidence contracts/testing.md#independent-expectations ECMAScript array-assignment grammar accepts a terminal comma after an ordinary element. The literal expected target independently fixes that legal punctuation without relying on the ancestor walk.
// @evidence contracts/testing.md#distinguishing-cases This target has two ordinary elements and no rest, contrasting SkipsArrayRestAssignmentTarget. ArraySpreadInValueLiteral distinguishes a legal spread outside target ownership.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterNonRestArrayAssignmentTarget owns every authored source, no-finding or complete-output assertion in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaInsertsAfterNonRestArrayAssignmentTarget(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "[\n  a,\n  b\n] = arr;\n",
    "[\n  a,\n  b,\n] = arr;\n",
  )
}
