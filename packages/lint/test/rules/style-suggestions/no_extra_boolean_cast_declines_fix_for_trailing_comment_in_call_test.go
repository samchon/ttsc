package linthost

import "testing"

// TestNoExtraBooleanCastDeclinesFixForTrailingCommentInCall verifies that a
// line comment between the argument and the closing paren still reports but
// offers no autofix — the comment bail-out for the trailing gap of the call.
//
// The argument's node span ends before its trailing trivia, so a comment
// after it inside the call sits in the discarded region of the splice and
// would be deleted (#362). This pins the trailing-gap scan (and the `//`
// opener) separately from the leading-gap `/* */` case.
//
// 1. Snapshot `!Boolean(ok // why` with the `)` on the next line.
// 2. Run `no-extra-boolean-cast` through the fix applier.
// 3. Assert a finding is reported but zero edits are applied.
//
// @evidence contracts/testing.md#behavioral-verification Withholds a Boolean-call splice that would discard a trailing line comment before the closing paren.
// @evidence contracts/testing.md#independent-expectations The independently supplied source bytes retain the comment and its newline; removing wrapper text must not erase explanation.
// @evidence contracts/testing.md#distinguishing-cases Trailing line-comment seam differs from leading seam and interior argument comment cases.
// @evidence contracts/testing.md#execution-ownership assertNoFixSnapshot calls runFixSnapshot, requiring zero applied automatic edits and the complete authored input to remain unchanged. This Test owns that precise comment-bearing source. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoExtraBooleanCastDeclinesFixForTrailingCommentInCall(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(ok: any) {\n  const z = !Boolean(ok // why\n  );\n  return z;\n}\nJSON.stringify(f);\n",
  )
}
