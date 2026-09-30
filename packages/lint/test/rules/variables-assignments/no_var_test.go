package linthost

import "testing"

// TestRuleCorpusNoVar verifies the lint rule corpus fixture no-var.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-var.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original runtime var declaration while permitting let and const.
// @evidence contracts/testing.md#independent-expectations The authored annotation identifies function-scoped var under the no-var policy independently of visitor output.
// @evidence contracts/testing.md#distinguishing-cases Runtime var reports; let and const stay clean, with ambient and all loop-header variants owned by their named companion tests.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoVar owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes parsed-source Engine operations and direct edit application, with disposable fixture files where needed; no installed consumer, native build or product host runs.
func TestRuleCorpusNoVar(t *testing.T) {
  assertRuleCorpusCase(t, "no-var.ts", "// expect: no-var error\nvar legacy = 1;\nJSON.stringify(legacy);\n")
  assertRuleSkipsSource(t, "no-var", "let modern = 1; const fixed = 2;\n")
}
