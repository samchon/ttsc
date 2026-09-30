package linthost

import "testing"

// TestRuleCorpusUseIsnan verifies the lint rule corpus fixture use-isnan.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in use-isnan.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports comparison against NaN while permitting Number.isNaN as a direct test.
// @evidence contracts/testing.md#independent-expectations NaN does not compare equal to itself under ordinary equality; the authored comparison annotation follows the independent Number predicate contract.
// @evidence contracts/testing.md#distinguishing-cases x === NaN reports; Number.isNaN(x) stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUseIsnan is selected in the shared Go unit population. It passes the authored use-isnan.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusUseIsnan(t *testing.T) {
  assertRuleCorpusCase(t, "use-isnan.ts", "function f(x: number) {\n  // expect: use-isnan error\n  return x === NaN;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "use-isnan", "function f(x: number) { return Number.isNaN(x); }\n")
}
