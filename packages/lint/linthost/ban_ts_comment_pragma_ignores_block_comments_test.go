package linthost

import "testing"

// TestBanTsCommentPragmaIgnoresBlockComments verifies
// typescript/ban-ts-comment never treats block comments as check/nocheck pragmas.
//
// The compiler only activates `@ts-check`/`@ts-nocheck` from `//` line
// comments, so upstream keeps each authored block spelling (plain,
// JSDoc and multiline) as a valid negative control even
// with both directives configured to report.
//
//  1. Lint block-comment nocheck/check spellings with `ts-check: true`
//     (nocheck already defaults to true).
//  2. Assert zero findings for every spelling.
//
// @evidence contracts/testing.md#behavioral-verification Checking pragmas in block comments are ignored even when check is explicitly banned.
// @evidence contracts/testing.md#independent-expectations TypeScript check/nocheck pragmas require line-comment syntax; six authored ordinary/JSDoc/multiline block forms independently remain clean.
// @evidence contracts/testing.md#distinguishing-cases Both checking directives and three block layouts distinguish pragma semantics from the suppression final-line rules.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSourceWithOptions executes each authored block-comment source in this Test loop. No consumer install or native product-host build/launch is used.
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
