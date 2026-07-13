package linthost

import "testing"

// TestBanTsCommentPragmaIgnoresBlockComments verifies
// typescript/ban-ts-comment never treats block comments as check/nocheck pragmas.
//
// The compiler only activates `@ts-check`/`@ts-nocheck` from `//` line
// comments, so upstream keeps every block-comment spelling — plain,
// JSDoc, single-line, and multi-line — as a valid negative control even
// with both directives configured to report.
//
//  1. Lint block-comment nocheck/check spellings with `ts-check: true`
//     (nocheck already defaults to true).
//  2. Assert zero findings for every spelling.
func TestBanTsCommentPragmaIgnoresBlockComments(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  for _, source := range []string{
    "/* @ts-nocheck */\nconst a = 1;\nJSON.stringify(a);\n",
    "/** @ts-nocheck */\nconst a = 1;\nJSON.stringify(a);\n",
    "/*\n @ts-nocheck\n*/\nconst a = 1;\nJSON.stringify(a);\n",
    "/* @ts-check */\nconst a = 1;\nJSON.stringify(a);\n",
    "/** @ts-check */\nconst a = 1;\nJSON.stringify(a);\n",
    "/*\n @ts-check\n*/\nconst a = 1;\nJSON.stringify(a);\n",
  } {
    assertRuleSkipsSourceWithOptions(t, ruleName, source, `{"ts-check": true}`)
  }
}
