package linthost

import "testing"

// TestRuleCorpusNoNonNullAssertedOptionalChain verifies the lint rule corpus fixture no-non-null-asserted-optional-chain.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-non-null-asserted-optional-chain.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification A non-null assertion on an optional-chain result must report.
// @evidence contracts/testing.md#independent-expectations The independently authored fixture markers require exactly typescript/no-non-null-asserted-optional-chain error findings at lines 3; complete rule/severity/line comparison rejects missing, extra or misidentified reports.
// @evidence contracts/testing.md#distinguishing-cases The same optional property access without assertion remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoNonNullAssertedOptionalChain executes the AST Engine through assertRuleCorpusCase and an independently authored zero-finding counterpart through assertRuleSkipsSource in the same Go unit process; no native build, installation or compiler child runs.
func TestRuleCorpusNoNonNullAssertedOptionalChain(t *testing.T) {
  assertRuleCorpusCase(t, "no-non-null-asserted-optional-chain.ts", "const o: { a?: { b: number } } = {} as any;\n// expect: typescript/no-non-null-asserted-optional-chain error\nconst x = o?.a!;\nJSON.stringify(x);\n")
  assertRuleSkipsSource(t, "typescript/no-non-null-asserted-optional-chain", "declare const o: { a?: { b: number } };\nconst x = o?.a;\n")
}
