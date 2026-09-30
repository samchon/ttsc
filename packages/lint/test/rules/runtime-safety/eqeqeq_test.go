package linthost

import "testing"

// TestRuleCorpusEqeqeq verifies the lint rule corpus fixture eqeqeq.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in eqeqeq.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original loose equality and permits strict equality, retaining its complete diagnostic triple.
// @evidence contracts/testing.md#independent-expectations The strict-equality policy independently supplies the annotated a == b diagnostic; no expectation is generated from findings.
// @evidence contracts/testing.md#distinguishing-cases Loose == reports; === and !== remain clean. The suggestion companion owns coercion-sensitive rewrite safety.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusEqeqeq is selected in the shared Go unit population. It passes the authored eqeqeq.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusEqeqeq(t *testing.T) {
  assertRuleCorpusCase(t, "eqeqeq.ts", "function f(a: any, b: any) {\n  // expect: eqeqeq error\n  return a == b;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "eqeqeq", "function f(a: any, b: any) { return [a === b, a !== b]; }\n")
}
