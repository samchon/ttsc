package linthost

import "testing"

// TestRuleCorpusNoUnsafeDeclarationMerging verifies the lint rule corpus fixture no-unsafe-declaration-merging.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-unsafe-declaration-merging.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification Class/interface merging with the same name must report.
// @evidence contracts/testing.md#independent-expectations The independently authored fixture markers require exactly typescript/no-unsafe-declaration-merging error findings at lines 6; complete rule/severity/line comparison rejects missing, extra or misidentified reports.
// @evidence contracts/testing.md#distinguishing-cases Distinct class and interface names remove the unsupported merge boundary.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnsafeDeclarationMerging executes the AST Engine through assertRuleCorpusCase and an independently authored zero-finding counterpart through assertRuleSkipsSource in the same Go unit process; no native build, installation or compiler child runs.
func TestRuleCorpusNoUnsafeDeclarationMerging(t *testing.T) {
  assertRuleCorpusCase(t, "no-unsafe-declaration-merging.ts", "class Merged {\n  value = 1;\n}\n\n// expect: typescript/no-unsafe-declaration-merging error\ninterface Merged {\n  other: string;\n}\n")
  assertRuleSkipsSource(t, "typescript/no-unsafe-declaration-merging", "class SeparateClass { value = 1; }\ninterface SeparateInterface { other: string; }\n")
}
