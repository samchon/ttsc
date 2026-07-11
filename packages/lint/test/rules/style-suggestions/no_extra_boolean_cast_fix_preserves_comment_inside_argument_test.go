package linthost

import "testing"

// TestFixNoExtraBooleanCastPreservesCommentInsideArgument verifies the
// `!Boolean(a && /* mid */ b)` → `!(a && /* mid */ b)` rewrite — the
// positive twin of the comment bail-out.
//
// A comment INSIDE the argument's own span survives the splice verbatim, so
// declining there would be an over-match that turns a perfectly safe fix
// report-only. This pins that the #362 bail-out scans only the discarded
// gaps of the replaced span, not the kept text.
//
// 1. Snapshot `const y = !Boolean(a && /* mid */ b);` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the fix applies and the comment survives inside the parens.
func TestFixNoExtraBooleanCastPreservesCommentInsideArgument(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(a: any, b: any) {\n  const y = !Boolean(a && /* mid */ b);\n  return y;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  const y = !(a && /* mid */ b);\n  return y;\n}\nJSON.stringify(f);\n",
  )
}
