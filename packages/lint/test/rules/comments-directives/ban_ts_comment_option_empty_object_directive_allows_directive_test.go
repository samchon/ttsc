package linthost

import "testing"

// TestBanTsCommentOptionEmptyObjectDirectiveAllowsDirective verifies the
// object arm without a usable format is plain allowance.
//
// Upstream only activates the description gates when `descriptionFormat`
// is a truthy string: `{}` and `{ descriptionFormat: "" }` neither ban nor
// demand a description. Treating them as a ban (or as
// allow-with-description) would diverge from the schema's documented
// semantics.
//
// 1. Configure `ts-ignore: {}` and assert a bare `@ts-ignore` is silent.
// 2. Configure `ts-ignore: { descriptionFormat: "" }` and assert the same.
func TestBanTsCommentOptionEmptyObjectDirectiveAllowsDirective(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  source := "// @ts-ignore\nconst a: number = 1;\nJSON.stringify(a);\n"
  assertRuleSkipsSourceWithOptions(t, ruleName, source, `{"ts-ignore": {}}`)
  assertRuleSkipsSourceWithOptions(t, ruleName, source, `{"ts-ignore": {"descriptionFormat": ""}}`)
}
