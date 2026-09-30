package linthost

import "testing"

// TestRuleCorpusNoNonNullAssertion verifies the lint rule corpus fixture no-non-null-assertion.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-non-null-assertion.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification Postfix non-null assertion syntax must report.
// @evidence contracts/testing.md#independent-expectations The independently authored fixture markers require exactly typescript/no-non-null-assertion error findings at lines 3; complete rule/severity/line comparison rejects missing, extra or misidentified reports.
// @evidence contracts/testing.md#distinguishing-cases Nullish coalescing returns a number without asserting away null.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoNonNullAssertion executes the AST Engine through assertRuleCorpusCase and an independently authored zero-finding counterpart through assertRuleSkipsSource in the same Go unit process; no native build, installation or compiler child runs.
func TestRuleCorpusNoNonNullAssertion(t *testing.T) {
  assertRuleCorpusCase(t, "no-non-null-assertion.ts", "function f(x: number | null): number {\n  // expect: typescript/no-non-null-assertion error\n  return x!;\n}\nf(1);\n")
  assertRuleSkipsSource(t, "typescript/no-non-null-assertion", "function f(x: number | null): number { return x ?? 0; }\n")
}
