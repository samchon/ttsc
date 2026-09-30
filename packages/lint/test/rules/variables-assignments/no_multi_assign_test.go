package linthost

import "testing"

// TestRuleCorpusNoMultiAssign verifies the lint rule corpus fixture no-multi-assign.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-multi-assign.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original a = b = 1 assignment chain while permitting separate assignments.
// @evidence contracts/testing.md#independent-expectations The no-chain assignment policy identifies the nested assignment expression; the authored diagnostic line is fixed independently of traversal.
// @evidence contracts/testing.md#distinguishing-cases The chained original reports; separate a and b assignments stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoMultiAssign owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes parsed-source Engine operations and direct edit application, with disposable fixture files where needed; no installed consumer, native build or product host runs.
func TestRuleCorpusNoMultiAssign(t *testing.T) {
  assertRuleCorpusCase(t, "no-multi-assign.ts", "let a: any, b: any;\n// expect: no-multi-assign error\na = b = 1;\nvoid a;\nvoid b;\n")
  assertRuleSkipsSource(t, "no-multi-assign", "let a: any, b: any; a = 1; b = 1;\n")
}
