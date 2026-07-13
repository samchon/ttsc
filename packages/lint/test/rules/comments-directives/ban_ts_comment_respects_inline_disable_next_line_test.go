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
func TestBanTsCommentRespectsInlineDisableNextLine(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/ban-ts-comment",
    "// eslint-disable-next-line typescript/ban-ts-comment\n// @ts-ignore\nconst a: number = 1;\nJSON.stringify(a);\n",
  )
}
