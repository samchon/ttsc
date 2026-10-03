package linthost

import "testing"

// TestFormatTrailingCommaPlacesCommaBeforeTrailingLineComment verifies
// the rule inserts the trailing comma BEFORE a trailing `//` line comment
// on the last element of a multi-line list, not after it.
//
// Final-item trivia is not part of the comma location. Insertion and removal must preserve the trailing line comment rather than moving punctuation into or past it.
//
//  1. Parse a source file with one multi-line array whose last element carries
//     a trailing `// trailing` comment.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Require the comma before the comment, canonical abstention, and none-mode removal.
//
// @evidence contracts/testing.md#behavioral-verification The final array comma must be inserted before the trailing line comment, preserving its text and newline. Already comma-terminated input must be canonical, and none mode must remove only that comma.
// @evidence contracts/testing.md#independent-expectations Prettier places the terminal comma immediately after the final item before trailing comment trivia. Literal complete outputs prescribe both all-mode insertion and none-mode removal while retaining the comment.
// @evidence contracts/testing.md#distinguishing-cases The original missing-comma line-comment positive remains. Its terminated fixed point and none-mode removal counterpart distinguish comment-aware insertion, abstention and reverse normalization.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaPlacesCommaBeforeTrailingLineComment owns the insertion/removal full-output fixtures and canonical no-finding input in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native builds or product-host children.
func TestFormatTrailingCommaPlacesCommaBeforeTrailingLineComment(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const xs = [\n  1,\n  2 // trailing\n];\n",
    "const xs = [\n  1,\n  2, // trailing\n];\n",
  )
  assertRuleSkipsSource(t, "format/trailing-comma", "const xs = [\n  1,\n  2, // trailing\n];\n")
  assertFixSnapshotWithOptions(t, "format/trailing-comma",
    "const xs = [\n  1,\n  2, // trailing\n];\n", `{"mode":"none"}`,
    "const xs = [\n  1,\n  2 // trailing\n];\n")
}
