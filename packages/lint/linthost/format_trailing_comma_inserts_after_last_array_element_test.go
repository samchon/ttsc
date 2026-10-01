package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastArrayElement verifies the happy path:
// a multi-line array literal gains a trailing comma after its last element.
//
// Arrays are the basic runtime list shape. A final comma must follow the final value rather than adding an empty element or changing an interior separator.
//
// 1. Parse a source file with one multi-line array literal.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma.
//
// @evidence contracts/testing.md#behavioral-verification The array must gain only its final comma after 3 while retaining 1,2 and the existing separators.
// @evidence contracts/testing.md#independent-expectations Official Prettier all-mode policy adds a terminal comma to a broken array. Literal expected source fixes its position and preserves every element independently of the list traversal.
// @evidence contracts/testing.md#distinguishing-cases This three-element broken array is positive. Inline, empty, already-terminated and none-removal hosts supply nearby boundaries and reverse normalization.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastArrayElement owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastArrayElement(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const xs = [\n  1,\n  2,\n  3\n];\n",
    "const xs = [\n  1,\n  2,\n  3,\n];\n",
  )
}
