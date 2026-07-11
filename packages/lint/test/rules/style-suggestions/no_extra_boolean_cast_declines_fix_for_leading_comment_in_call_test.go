package linthost

import "testing"

// TestNoExtraBooleanCastDeclinesFixForLeadingCommentInCall verifies that
// `!Boolean(/* why */ ok)` still reports but offers no autofix — the
// comment bail-out for a comment between `Boolean(` and the argument.
//
// The fix keeps only the argument's own text, so a comment ahead of it
// inside the call would be silently deleted (#362). Upstream ESLint's fixer
// bails out on comment loss; the port declines the same way and leaves the
// finding report-only.
//
// 1. Snapshot `const z = !Boolean(/* why */ ok);` source.
// 2. Run `no-extra-boolean-cast` through the fix applier.
// 3. Assert a finding is reported but zero edits are applied.
func TestNoExtraBooleanCastDeclinesFixForLeadingCommentInCall(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(ok: any) {\n  const z = !Boolean(/* why */ ok);\n  return z;\n}\nJSON.stringify(f);\n",
  )
}
