package linthost

import "testing"

// TestRuleCorpusNoConfusingNonNullAssertion verifies the lint rule corpus fixture no-confusing-non-null-assertion.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-confusing-non-null-assertion.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification A non-null assertion next to strict equality must report confusing syntax.
// @evidence contracts/testing.md#independent-expectations The independently authored fixture markers require exactly typescript/no-confusing-non-null-assertion error findings at lines 3; complete rule/severity/line comparison rejects missing, extra or misidentified reports.
// @evidence contracts/testing.md#distinguishing-cases The equality expression without a non-null assertion remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoConfusingNonNullAssertion executes the AST Engine through assertRuleCorpusCase and an independently authored zero-finding counterpart through assertRuleSkipsSource in the same Go unit process; no native build, installation or compiler child runs.
func TestRuleCorpusNoConfusingNonNullAssertion(t *testing.T) {
  assertRuleCorpusCase(t, "no-confusing-non-null-assertion.ts", "function f(x: number | null, y: number) {\n  // expect: typescript/no-confusing-non-null-assertion error\n  return x! === y;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "typescript/no-confusing-non-null-assertion", "function f(x: number | null, y: number) { return x === y; }\n")
}
