package linthost

import "testing"

// TestRuleCorpusNoNestedTernary verifies the lint rule corpus fixture no-nested-ternary.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-nested-ternary.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original ternary nested in an alternative and permits a single ternary.
// @evidence contracts/testing.md#independent-expectations The independent syntax-policy boundary is another conditional expression inside a branch, not a conditional expression itself.
// @evidence contracts/testing.md#distinguishing-cases Original nested alternate reports; a ? b : c stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoNestedTernary is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-nested-ternary.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoNestedTernary(t *testing.T) {
  assertRuleCorpusCase(t, "no-nested-ternary.ts", "function f(a: any, b: any, c: any, d: any, e: any) {\n  // expect: no-nested-ternary error\n  return a ? b : c ? d : e;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-nested-ternary", "const value = a ? b : c;\n")
}
