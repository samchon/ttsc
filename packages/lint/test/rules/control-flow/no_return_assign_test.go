package linthost

import "testing"

// TestRuleCorpusNoReturnAssign verifies the lint rule corpus fixture no-return-assign.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-return-assign.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original bare return assignment and permits returning an ordinary identifier.
// @evidence contracts/testing.md#independent-expectations The assignment-return policy independently selects the assignment expression, not every value-bearing return.
// @evidence contracts/testing.md#distinguishing-cases Bare return a = 1 reports; return a stays clean. The six-row option table owns intentional parentheses and always mode.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoReturnAssign is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-return-assign.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoReturnAssign(t *testing.T) {
  assertRuleCorpusCase(t, "no-return-assign.ts", "function f(a: any) {\n  // expect: no-return-assign error\n  return a = 1;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-return-assign", "function f(a: number) { return a; }\n")
}
