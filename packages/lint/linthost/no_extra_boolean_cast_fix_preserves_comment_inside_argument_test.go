package linthost

import "testing"

// TestFixNoExtraBooleanCastPreservesCommentInsideArgument verifies the
// `!Boolean(a && /* mid */ b)` → `!(a && /* mid */ b)` rewrite — the
// positive twin of the comment bail-out.
//
// A comment INSIDE the argument's own span survives the splice verbatim, so
// declining there would be an over-match that withholds a perfectly safe
// automatic edit. This pins that the #362 bail-out scans only the discarded
// gaps of the replaced span, not the kept text.
//
// 1. Snapshot `const y = !Boolean(a && /* mid */ b);` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the fix applies and the comment survives inside the parens.
//
// @evidence contracts/testing.md#behavioral-verification Removes the Boolean wrapper while retaining an interior conjunction comment.
// @evidence contracts/testing.md#independent-expectations The literal !(a && /* mid */ b) keeps both conjunction semantics and the comment, unlike wrapper-seam comments which would be discarded.
// @evidence contracts/testing.md#distinguishing-cases Interior comment is fixable, contrasting leading/trailing seam refusals and preventing a blanket comment-based no-fix gate.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastPreservesCommentInsideArgument(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(a: any, b: any) {\n  const y = !Boolean(a && /* mid */ b);\n  return y;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  const y = !(a && /* mid */ b);\n  return y;\n}\nJSON.stringify(f);\n",
  )
}
