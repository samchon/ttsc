package linthost

import "testing"

// TestRuleCorpusNoBitwise verifies the lint rule corpus fixture no-bitwise.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-bitwise.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original bitwise ampersand without rejecting logical or arithmetic operators.
// @evidence contracts/testing.md#independent-expectations The bitwise-operator policy distinguishes integer bit operations from boolean conjunction and addition; the annotated site is authored independently.
// @evidence contracts/testing.md#distinguishing-cases a & b reports; a && b and a + b stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoBitwise is selected in the shared Go unit population. It passes the authored no-bitwise.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoBitwise(t *testing.T) {
  assertRuleCorpusCase(t, "no-bitwise.ts", "function f(a: number, b: number) {\n  // expect: no-bitwise error\n  return a & b;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-bitwise", "function f(a: number, b: number) { return [a && b, a + b]; }\n")
}
