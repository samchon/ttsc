package linthost

import "testing"

// TestBanTsCommentFixRewritesBlockCommentIgnore verifies the
// ignore-to-expect-error autofix inside a block comment.
//
// Upstream's suggestion rebuilds `/*` + rewritten value + `*/`; the edit
// here must be equivalent — replace only the directive token and keep the
// block delimiters and spacing byte-identical.
//
//  1. Materialize a file led by `/* @ts-ignore */`.
//  2. Run the real fix applier over the rule's findings.
//  3. Assert the rewritten source is `/* @ts-expect-error */` plus the
//     untouched remainder.
func TestBanTsCommentFixRewritesBlockCommentIgnore(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/ban-ts-comment",
    "/* @ts-ignore */\nconst a: number = 1;\nJSON.stringify(a);\n",
    "/* @ts-expect-error */\nconst a: number = 1;\nJSON.stringify(a);\n",
  )
}
