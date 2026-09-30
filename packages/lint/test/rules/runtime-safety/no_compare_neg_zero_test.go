package linthost

import "testing"

// TestRuleCorpusNoCompareNegZero verifies the lint rule corpus fixture no-compare-neg-zero.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-compare-neg-zero.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports comparing against -0 and permits positive zero or Object.is for signed-zero identity.
// @evidence contracts/testing.md#independent-expectations IEEE-754 signed zero is not distinguished by ordinary equality; the authored -0 annotation follows the policy favoring Object.is.
// @evidence contracts/testing.md#distinguishing-cases The negative-zero comparison reports; x === 0 and Object.is(x, -0) stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoCompareNegZero is selected in the shared Go unit population. It passes the authored no-compare-neg-zero.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoCompareNegZero(t *testing.T) {
  assertRuleCorpusCase(t, "no-compare-neg-zero.ts", "function f(x: number) {\n  // expect: no-compare-neg-zero error\n  return x === -0;\n}\n")
  assertRuleSkipsSource(t, "no-compare-neg-zero", "function f(x: number) { return [x === 0, Object.is(x, -0)]; }\n")
}
