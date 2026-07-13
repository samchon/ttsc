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
func TestBanTsCommentDefaultAllowsTsCheck(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/ban-ts-comment",
    "// @ts-check\nconst a = 1;\nJSON.stringify(a);\n",
  )
}
