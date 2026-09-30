package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterArraySpreadInValueLiteral is the
// over-suppression twin of the array rest-target skip: a real array VALUE
// literal ending in a spread (`[a, ...rest]`) legally takes a trailing comma.
//
// A spread in a value array can legally be followed by a trailing comma. The syntax restriction belongs to assignment rest, so a spread-only test must not suppress this insertion.
//
// 1. Parse a multi-line array value literal whose last element is a spread.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the trailing comma lands after the spread.
//
// @evidence contracts/testing.md#behavioral-verification The value array must gain a comma after its spread while preserving aa and rest. Full output detects incorrectly applying assignment-rest exclusion to all spread elements.
// @evidence contracts/testing.md#independent-expectations ECMAScript array value spread legally accepts a following comma, and installed Prettier 3.8.3 adds it in a broken value list. The authored expected array preserves element order and spread meaning.
// @evidence contracts/testing.md#distinguishing-cases The value-position spread is positive, contrasting SkipsArrayRestAssignmentTarget and its nested/loop negatives. NonRestArrayAssignmentTarget separately establishes legal target insertion.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterArraySpreadInValueLiteral owns every authored source, no-finding or complete-output assertion in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaInsertsAfterArraySpreadInValueLiteral(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const combined = [\n  aa,\n  ...rest\n];\n",
    "const combined = [\n  aa,\n  ...rest,\n];\n",
  )
}
