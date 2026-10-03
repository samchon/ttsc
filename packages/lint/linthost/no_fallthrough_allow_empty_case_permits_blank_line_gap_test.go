package linthost

import "testing"

// TestNoFallthroughAllowEmptyCasePermitsBlankLineGap verifies allowEmptyCase through the owning Engine's JSON options decoding.
//
// The same blank-line-separated empty case that reports under the defaults
// must pass when `allowEmptyCase: true` arrives via the rule's options blob.
// Locks both the option's semantics and its JSON decoding.
//
// 1. Reuse the blank-line empty-case source that reports by default.
// 2. Run the engine with options {"allowEmptyCase":true}.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings when allowEmptyCase true accepts the authored blank-gap empty label.
// @evidence contracts/testing.md#independent-expectations The explicit option changes the no-consequent exemption rather than treating all statements as empty.
// @evidence contracts/testing.md#distinguishing-cases RejectsEmptyCaseFollowedByBlankLine owns the default twin; RejectsEmptyStatementCaseDespiteAllowEmptyCase retains a real semicolon statement.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAllowEmptyCasePermitsBlankLineGap is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAllowEmptyCasePermitsBlankLineGap(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:

  case 1:
    console.log(1);
    break;
}
`, `{"allowEmptyCase":true}`)
}
