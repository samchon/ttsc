package linthost

import "testing"

// TestBanTsCommentDefaultAllowsTsCheck verifies typescript/ban-ts-comment
// leaves `@ts-check` alone under the recommended defaults.
//
// `@ts-check` enables checking rather than suppressing it, so the upstream
// default is `false` (never report). A rule that banned it would punish
// users for turning the checker on.
//
// 1. Lint a file opening with `// @ts-check`.
// 2. Run with severity-only configuration (defaults).
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Default ban-ts-comment leaves ts-check enabled rather than treating every TS directive as forbidden.
// @evidence contracts/testing.md#independent-expectations Default ts-check policy permits enabling checking; the literal directive has no description requirement.
// @evidence contracts/testing.md#distinguishing-cases This default allowance contrasts with TestBanTsCommentOptionTsCheckTrueReportsPragmaAnywhere.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes the authored ts-check source and this Test owns the zero result. No consumer install or native product-host build/launch is used.
func TestBanTsCommentDefaultAllowsTsCheck(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/ban-ts-comment",
    "// @ts-check\nconst a = 1;\nJSON.stringify(a);\n",
  )
}
