package linthost

import (
  "testing"
)

const preferSimpleConditionFirstRule = "unicorn/prefer-simple-condition-first"

// TestRuleCorpusUnicornPreferSimpleConditionFirst verifies the boolean-context corpus keeps the simple operand first.
//
// The supported boolean-context ordering preference independently establishes the annotated error and the clean reversed form.
//
// 1. Execute the retained logical source variants through the owning Go rule.
// 2. Compare the diagnostic/edit or unchanged result at each stated boundary.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run checks the annotated complex-first conjunction while retaining its already-simple-first counterpart.
// @evidence contracts/testing.md#independent-expectations The supported boolean-context ordering preference independently establishes the annotated error and the clean reversed form.
// @evidence contracts/testing.md#distinguishing-cases Complex-first reports and simple-first is clean for the same operands.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferSimpleConditionFirst owns the literal logical-expression variants as a discoverable Go unit entry; actual parser/engine/fix operations run in the shared process without a consumer installation, native producer or product child host.
func TestRuleCorpusUnicornPreferSimpleConditionFirst(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-simple-condition-first.ts", `declare const ready: boolean;
declare function check(): boolean;

if (
  check() &&
  // expect: unicorn/prefer-simple-condition-first error
  ready
) {
  void 0;
}

if (ready && check()) {
  void 0;
}
`)
}








