package linthost

import "testing"

// TestFormatIndentIdempotentOnCorrectNestedBlock verifies the rule emits
// no finding when nested block statements are already correctly indented.
//
// A statement at the right column compares equal to its desired indent
// and must produce nothing. This pins that a canonically-indented file is
// a fixed point of `format/indent`, including a two-deep block nest.
//
//  1. Parse a function holding an if-block, all at canonical indent.
//  2. Run the rule.
//  3. Assert it emits no finding.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must emit no findings for the function containing a correctly indented if block, including its nested return and closing braces. This catches changing a valid nested-block fixed point.
// @evidence contracts/testing.md#independent-expectations The supported ordinary block layout uses two spaces for the if and four for its return. The literal canonical input independently establishes those columns and the required absence of edits.
// @evidence contracts/testing.md#distinguishing-cases This negative has two nested block levels with each owned line already correct. NormalizesOverIndentedBlockStatement supplies an incorrect ordinary body positive; class and decorated-member fixed-point hosts cover other frames.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentIdempotentOnCorrectNestedBlock owns its full parsed source and no-finding assertion in the public Go unit population. The direct syntax-only rule executes in process without a consumer install, native artifact build or real product host.
func TestFormatIndentIdempotentOnCorrectNestedBlock(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/indent",
    "function f() {\n  if (x) {\n    return 1;\n  }\n}\n",
  )
}
