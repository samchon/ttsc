package linthost

import "testing"

// TestBanTsCommentBlockCommentIgnoresDirectiveBeforeLastLine verifies
// typescript/ban-ts-comment skips block-comment directives above the final line.
//
// These are the negative twins of the last-line matches: the compiler
// ignores `@ts-expect-error`/`@ts-ignore` on earlier block-comment lines,
// so even with both directives configured to report the rule must stay
// silent. An over-match here would ban harmless prose in doc comments.
//
//  1. Lint block comments whose directive sits before the last line.
//  2. Assert zero findings with `ts-expect-error: true` (ignore already
//     defaults to true).
//
// @evidence contracts/testing.md#behavioral-verification ban-ts-comment ignores suppression text before a block comment's final line.
// @evidence contracts/testing.md#independent-expectations TypeScript suppression directives are recognized on the final block-comment line; all five authored earlier-line forms are literal zero controls.
// @evidence contracts/testing.md#distinguishing-cases Ordinary/JSDoc, expect-error/ignore and blank closing-line variants contrast with TestBanTsCommentBlockCommentReportsDirectiveOnLastLine.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSourceWithOptions runs each of the five sources under the explicit expect-error ban; this Test owns each zero result. No consumer install or native product-host build/launch is used.
func TestBanTsCommentBlockCommentIgnoresDirectiveBeforeLastLine(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  for _, source := range []string{
    "/* @ts-expect-error not on the last line\n */\nconst a = 1;\nJSON.stringify(a);\n",
    "/**\n * @ts-expect-error not on the last line\n */\nconst a = 1;\nJSON.stringify(a);\n",
    "/* @ts-expect-error\n * not on the last line */\nconst a = 1;\nJSON.stringify(a);\n",
    "/* @ts-ignore\n * not on the last line */\nconst a = 1;\nJSON.stringify(a);\n",
    "/*\n @ts-ignore\n*/\nconst a = 1;\nJSON.stringify(a);\n",
  } {
    assertRuleSkipsSourceWithOptions(t, ruleName, source, `{"ts-expect-error": true}`)
  }
}
