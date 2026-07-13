package linthost

import "testing"

// TestBanTsCommentOptionTsNocheckFalseAllowsDirective verifies the
// `ts-nocheck: false` option allows the pragma unconditionally.
//
// `false` opts a project out of the default ban, so an effective
// top-of-file `@ts-nocheck` must produce no finding. This is the negative
// twin of the default-report case.
//
// 1. Configure `{"ts-nocheck": false}`.
// 2. Lint a file opening with the pragma above real statements.
// 3. Assert zero findings.
func TestBanTsCommentOptionTsNocheckFalseAllowsDirective(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "typescript/ban-ts-comment",
    "// @ts-nocheck\nconst a: number = 1;\nJSON.stringify(a);\n",
    `{"ts-nocheck": false}`,
  )
}
