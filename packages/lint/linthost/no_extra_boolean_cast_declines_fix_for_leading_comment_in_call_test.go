package linthost

import "testing"

// TestNoExtraBooleanCastDeclinesFixForLeadingCommentInCall verifies that
// `!Boolean(/* why */ ok)` still reports but offers no autofix — the
// comment bail-out for a comment between `Boolean(` and the argument.
//
// The fix keeps only the argument's own text, so a comment ahead of it
// inside the call would be silently deleted (#362). Upstream ESLint's fixer
// bails out on comment loss; the port declines the same way and offers the
// splice as an opt-in suggestion instead, pinned by
// `TestNoExtraBooleanCastOffersWithheldSpliceAsSuggestion`.
//
// 1. Snapshot `const z = !Boolean(/* why */ ok);` source.
// 2. Run `no-extra-boolean-cast` through the fix applier.
// 3. Assert a finding is reported but zero edits are applied.
//
// @evidence contracts/testing.md#behavioral-verification Withholds a Boolean-call splice when the argument has a leading seam comment.
// @evidence contracts/testing.md#independent-expectations The literal unchanged source independently protects the explanation before ok from automatic deletion.
// @evidence contracts/testing.md#distinguishing-cases Leading call-seam comment contrasts with a preserved comment inside an argument and the trailing-seam refusal sibling.
// @evidence contracts/testing.md#execution-ownership assertNoFixSnapshot calls runFixSnapshot, requiring zero applied automatic edits and the complete authored input to remain unchanged. This Test owns that precise comment-bearing source. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoExtraBooleanCastDeclinesFixForLeadingCommentInCall(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(ok: any) {\n  const z = !Boolean(/* why */ ok);\n  return z;\n}\nJSON.stringify(f);\n",
  )
}
