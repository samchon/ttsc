package linthost

import "testing"

// TestRuleCorpusNoNegatedCondition verifies the lint rule corpus fixture no-negated-condition.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-negated-condition.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original negated if/else predicate and permits a positive predicate with the same branch structure.
// @evidence contracts/testing.md#independent-expectations The policy requires expressing the affirmative condition when both branches exist; the authored a versus !a distinction supplies the oracle.
// @evidence contracts/testing.md#distinguishing-cases Negated condition reports; positive a stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoNegatedCondition is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-negated-condition.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoNegatedCondition(t *testing.T) {
  assertRuleCorpusCase(t, "no-negated-condition.ts", "function f(a: any) {\n  // expect: no-negated-condition error\n  if (!a) {\n    return 1;\n  } else {\n    return 2;\n  }\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-negated-condition", "function f(a: unknown) { if (a) return 1; else return 2; }\n")
}
