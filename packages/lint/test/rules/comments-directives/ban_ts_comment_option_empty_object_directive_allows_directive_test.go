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
//
// @evidence contracts/testing.md#behavioral-verification An empty directive option object or empty descriptionFormat string allows bare ignore.
// @evidence contracts/testing.md#independent-expectations Without a truthy format the supported object arm is allowance, not an implicit ban or default description requirement.
// @evidence contracts/testing.md#distinguishing-cases Empty object and empty string contrast with usable-format gate tests.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSourceWithOptions executes the same bare fixture under both authored object forms; this entry owns both zero results. No consumer install or native product-host build/launch is used.
func TestBanTsCommentOptionEmptyObjectDirectiveAllowsDirective(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  source := "// @ts-ignore\nconst a: number = 1;\nJSON.stringify(a);\n"
  assertRuleSkipsSourceWithOptions(t, ruleName, source, `{"ts-ignore": {}}`)
  assertRuleSkipsSourceWithOptions(t, ruleName, source, `{"ts-ignore": {"descriptionFormat": ""}}`)
}
