package linthost

import "testing"

// TestFormatIndentNormalizesOverIndentedBlockStatement verifies
// formatIndent re-indents a block statement to its depth-1 indent.
//
// A statement six spaces deep inside a single block should sit at two
// spaces (depth 1, tabWidth 2). This pins that the rule computes the
// target column from nesting depth and rewrites the over-indented run.
//
//  1. Parse a function whose body statement is indented six spaces.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the statement is re-indented to two spaces.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must reduce a six-space function-body const statement to two spaces. Complete source detects preserving an incorrect run or computing the wrong block column while retaining the assignment.
// @evidence contracts/testing.md#independent-expectations The supported default two-space indentation places an ordinary function-body statement one level inside its braces. Literal expected bytes derive from that policy independently of the depth walk.
// @evidence contracts/testing.md#distinguishing-cases This positive reduces excessive indentation rather than merely inserting missing whitespace. The top-level host removes indentation to zero and the canonical nested-block host supplies a no-finding case.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentNormalizesOverIndentedBlockStatement owns its source/output fixture in the public Go unit population. The syntax-only owning rule/edit harness runs in process without consumer installation, native artifact production or starting a real product host.
func TestFormatIndentNormalizesOverIndentedBlockStatement(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "function f() {\n      const x = 1;\n}\n",
    "function f() {\n  const x = 1;\n}\n",
  )
}
