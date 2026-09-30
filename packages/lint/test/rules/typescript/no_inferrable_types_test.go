package linthost

import "testing"

// TestRuleCorpusNoInferrableTypes verifies the lint rule corpus fixture no-inferrable-types.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-inferrable-types.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification A literal initializer with redundant number annotation must report.
// @evidence contracts/testing.md#independent-expectations The independently authored fixture markers require exactly typescript/no-inferrable-types error findings at lines 2; complete rule/severity/line comparison rejects missing, extra or misidentified reports.
// @evidence contracts/testing.md#distinguishing-cases The same literal without an explicit annotation remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoInferrableTypes executes the AST Engine through assertRuleCorpusCase and an independently authored zero-finding counterpart through assertRuleSkipsSource in the same Go unit process; no native build, installation or compiler child runs.
func TestRuleCorpusNoInferrableTypes(t *testing.T) {
  assertRuleCorpusCase(t, "no-inferrable-types.ts", "// expect: typescript/no-inferrable-types error\nconst a: number = 5;\nJSON.stringify(a);\n")
  assertRuleSkipsSource(t, "typescript/no-inferrable-types", "const a = 5;\n")
}
