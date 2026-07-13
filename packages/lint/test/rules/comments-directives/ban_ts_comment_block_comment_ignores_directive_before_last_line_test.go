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
