package linthost

import "testing"

// TestRuleCorpusUnicornBetterRegex verifies unicorn/better-regex reports the
// corpus fixture's optimizable literal through the native engine.
//
// Mirrors tests/test-lint/src/cases/unicorn-better-regex.ts so the Go rule
// corpus and the end-to-end TS corpus stay in lockstep; `[0-9]` is the
// canonical character-class-to-shorthand case (`\d`), the rule's headline
// transformation.
//
//  1. Enable unicorn/better-regex via an expect annotation.
//  2. Declare a const initialized to `/[0-9]/`.
//  3. Assert the literal is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase requires the [0-9] regex literal diagnostic at its annotated source line.
// @evidence contracts/testing.md#independent-expectations The literal annotation states the upstream digit-shorthand optimization policy, independent of the rule result.
// @evidence contracts/testing.md#distinguishing-cases This entry pins diagnostic presence, rule and severity; TestUnicornBetterRegexReportsExactRangeAndMessage owns exact edit boundaries and TestUnicornBetterRegexLeavesOptimalLiterals owns canonical negatives.
// @evidence contracts/testing.md#execution-ownership This named Go unit entry runs the virtual AST through Engine.Run; the shared Go process runs owning operations without installing a consumer, building a native artifact or launching a product host.
func TestRuleCorpusUnicornBetterRegex(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/better-regex.ts", "// expect: unicorn/better-regex error\nconst digits = /[0-9]/;\n")
}
