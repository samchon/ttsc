package linthost

import "testing"

// TestRuleCorpusNoEmptyPattern verifies the lint rule corpus fixture no-empty-pattern.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-empty-pattern.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification An empty object binding pattern must report.
// @evidence contracts/testing.md#independent-expectations The independently authored fixture markers require exactly no-empty-pattern error findings at lines 2; complete rule/severity/line comparison rejects missing, extra or misidentified reports.
// @evidence contracts/testing.md#distinguishing-cases Selecting an actual property from the same parameter type remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoEmptyPattern executes the AST Engine through assertRuleCorpusCase and an independently authored zero-finding counterpart through assertRuleSkipsSource in the same Go unit process; no native build, installation or compiler child runs.
func TestRuleCorpusNoEmptyPattern(t *testing.T) {
  assertRuleCorpusCase(t, "no-empty-pattern.ts", "// expect: no-empty-pattern error\nfunction f({}: { a?: number }): void {}\nf({ a: 1 });\n")
  assertRuleSkipsSource(t, "no-empty-pattern", "function f({ a }: { a?: number }): void { void a; }\n")
}
