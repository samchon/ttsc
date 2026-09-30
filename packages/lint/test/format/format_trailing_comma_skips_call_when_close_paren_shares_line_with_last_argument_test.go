package linthost

import "testing"

// TestFormatTrailingCommaSkipsCallWhenCloseParenSharesLineWithLastArgument
// verifies the rule leaves the trailing comma off when a multi-line argument
// shares its closing line with the call's `)`.
//
// A multiline argument alone does not require a call trailing comma. The final argument and call closer must be on different lines; an adjacent newline-close twin tests that boundary.
//
//  1. Parse a source file with one multi-line call whose sole argument is a
//     multi-line object literal whose closing `}` shares a line with `)`.
//  2. Run the engine with formatTrailingComma enabled.
//  3. Require silence, then move the call closer to a new line and require
//     only the call argument comma to be inserted.
//
// @evidence contracts/testing.md#behavioral-verification A call whose object argument ends beside the call closer must receive no findings, despite the object interior being multiline. Moving only the call closer to a new line must add its final argument comma.
// @evidence contracts/testing.md#independent-expectations The local supported policy charges the gap after the final argument, matching Prettier broken-call punctuation. Literal paired outputs preserve the already comma-terminated object and differ only in the eligible call boundary.
// @evidence contracts/testing.md#distinguishing-cases The original same-line object-end/call-close case stays negative. Its newline-close twin is positive, distinguishing argument-internal newlines from the gap that actually governs the comma.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaSkipsCallWhenCloseParenSharesLineWithLastArgument owns the same-line no-finding fixture and newline-close complete insertion output in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native builds or product-host children.
func TestFormatTrailingCommaSkipsCallWhenCloseParenSharesLineWithLastArgument(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/trailing-comma",
    "JSON.stringify({\n  a: 1,\n  b: 2,\n});\n",
  )
  assertFixSnapshot(t, "format/trailing-comma",
    "JSON.stringify({\n  a: 1,\n  b: 2,\n}\n);\n",
    "JSON.stringify({\n  a: 1,\n  b: 2,\n},\n);\n")
}
