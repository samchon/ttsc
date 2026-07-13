package linthost

import "testing"

// TestBanTsCommentOptionExpectErrorFalseAllowsDirective verifies the
// `ts-expect-error: false` option allows the directive unconditionally.
//
// `false` is the full-allowance arm of the DirectiveConfig union: no ban
// and no description requirement, so even a bare directive must stay
// silent. This is the negative twin of the `true` and
// `allow-with-description` arms.
//
// 1. Configure `{"ts-expect-error": false}`.
// 2. Lint a bare `// @ts-expect-error` comment.
// 3. Assert zero findings.
func TestBanTsCommentOptionExpectErrorFalseAllowsDirective(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "typescript/ban-ts-comment",
    "// @ts-expect-error\nconst a: number = 1;\nJSON.stringify(a);\n",
    `{"ts-expect-error": false}`,
  )
}
