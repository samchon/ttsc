package linthost

import "testing"

// TestFormatBraceContinuationLeavesAnIfWithoutAnElseAlone verifies a following ordinary
// statement is not mistaken for a continuation when the if has no else.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must report no finding for an if block with no else, even when another statement follows its closing brace.
// @evidence contracts/testing.md#independent-expectations The fixed literal contains no continuation keyword, so the supported operation has no eligible gap; zero findings preserves the if body and following run call.
// @evidence contracts/testing.md#distinguishing-cases This missing-continuation negative distinguishes a following ordinary statement from an else; pull-else positive supplies the adjacent real continuation case.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationLeavesAnIfWithoutAnElseAlone is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its parsed literal sources and no-finding assertions; the shared syntax-only harness runs the owning rule in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationLeavesAnIfWithoutAnElseAlone(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/brace-continuation",
    "if (a) {\n  x();\n}\nrun();\n",
    `{"tabWidth":2}`,
  )
}
