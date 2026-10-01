package linthost

import "testing"

// TestBanTsCommentRespectsInlineDisableNextLine verifies the rule's
// findings flow through the inline-disable filter like any other rule.
//
// ban-ts-comment fires from the SourceFile pre-walk dispatch, a path that
// once bypassed directive filtering for statement-free files; pinning the
// interplay guards the seam between comment-anchored findings and
// line-keyed `eslint-disable-next-line` suppression.
//
//  1. Place `// eslint-disable-next-line typescript/ban-ts-comment`
//     directly above a `// @ts-ignore` comment.
//  2. Run the rule with defaults.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification An eslint-disable-next-line directive suppresses the otherwise forbidden next-line ts-ignore finding.
// @evidence contracts/testing.md#independent-expectations The independently authored disable comment names precisely the enabled rule, requiring zero reports without changing the source input.
// @evidence contracts/testing.md#distinguishing-cases Disabled positive shape complements the default ignore-reporting test, distinguishing engine suppression from missing scanner coverage.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource calls the engine with the embedded disable directive; this Test owns the suppression result in the Go process. No consumer install or native product-host build/launch is used.
func TestBanTsCommentRespectsInlineDisableNextLine(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/ban-ts-comment",
    "// eslint-disable-next-line typescript/ban-ts-comment\n// @ts-ignore\nconst a: number = 1;\nJSON.stringify(a);\n",
  )
}
