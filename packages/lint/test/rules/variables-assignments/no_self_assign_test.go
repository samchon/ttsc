package linthost

import "testing"

// TestRuleCorpusNoSelfAssign verifies the lint rule corpus fixture no-self-assign.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-self-assign.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original x = x while permitting assignment from a distinct binding.
// @evidence contracts/testing.md#independent-expectations The self-assignment policy identifies an unchanged binding-to-itself write; the literal annotated site is independent of tested output.
// @evidence contracts/testing.md#distinguishing-cases The equal binding original reports; assigning y to x stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoSelfAssign owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes parsed-source Engine operations and direct edit application, with disposable fixture files where needed; no installed consumer, native build or product host runs.
func TestRuleCorpusNoSelfAssign(t *testing.T) {
  assertRuleCorpusCase(t, "no-self-assign.ts", "let x = 1;\nconsole.log(x);\n// expect: no-self-assign error\nx = x;\nconsole.log(x);\n")
  assertRuleSkipsSource(t, "no-self-assign", "let x = 1; let y = 2; x = y;\n")
}
