package linthost

import "testing"

// TestRuleCorpusDefaultParamLast keeps the TypeScript corpus case in the Go rule audit.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports a defaulted parameter before a required parameter and permits a trailing default.
// @evidence contracts/testing.md#independent-expectations Required positional arguments precede defaults under this rule, independently establishing the original a location.
// @evidence contracts/testing.md#distinguishing-cases The original default-before-required pair reports; required-before-default and a zero-parameter function stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusDefaultParamLast is selected in the shared Go unit population. It calls assertRuleCorpusCase with default-param-last.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusDefaultParamLast(t *testing.T) {
  assertRuleCorpusCase(t, "default-param-last.ts", `function bad(
  // expect: default-param-last error
  a = 1,
  b: number,
): number {
  return a + b;
}
JSON.stringify(bad(undefined, 2));
`)
  assertRuleSkipsSource(t, "default-param-last", "function good(a: number, b = 1) { return a + b; } function empty() {}\n")
}
