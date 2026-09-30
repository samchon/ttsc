package linthost

import "testing"

// TestRuleCorpusNoSelfCompare verifies the lint rule corpus fixture no-self-compare.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-self-compare.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original a === a comparison while permitting comparison of distinct operands.
// @evidence contracts/testing.md#independent-expectations The policy rejects comparing the same expression to itself, and the authored annotation fixes that expression rather than calculating findings from AST output.
// @evidence contracts/testing.md#distinguishing-cases The self comparison reports; x === y remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoSelfCompare owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes parsed-source Engine operations and direct edit application, with disposable fixture files where needed; no installed consumer, native build or product host runs.
func TestRuleCorpusNoSelfCompare(t *testing.T) {
  assertRuleCorpusCase(t, "no-self-compare.ts", "function f(a: number) {\n  // expect: no-self-compare error\n  return a === a;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-self-compare", "const x = 1; const y = 2; console.log(x === y);\n")
}
