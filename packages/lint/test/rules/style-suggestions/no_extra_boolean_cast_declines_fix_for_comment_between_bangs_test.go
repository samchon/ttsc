package linthost

import "testing"

// TestNoExtraBooleanCastDeclinesFixForCommentBetweenBangs verifies that
// `if (!/* c */!x)` still reports but offers no autofix — the comment
// bail-out on the double-bang branch of the rule.
//
// Both fixer branches share the same raw-splice construction, so the
// double-bang rewrite deletes an in-operator comment exactly like the
// Boolean-call one (#362). This pins the shared bail-out on the second
// branch rather than only the call branch.
//
// 1. Snapshot `if (!/* c */!x)` source.
// 2. Run `no-extra-boolean-cast` through the fix applier.
// 3. Assert a finding is reported but zero edits are applied.
func TestNoExtraBooleanCastDeclinesFixForCommentBetweenBangs(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  if (!/* c */!x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
  )
}
