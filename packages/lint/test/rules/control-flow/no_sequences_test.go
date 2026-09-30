package linthost

import "testing"

// TestRuleCorpusNoSequences verifies the lint rule corpus fixture no-sequences.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-sequences.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original comma return expression and permits separate update and return statements.
// @evidence contracts/testing.md#independent-expectations The independently authored comma operator combines expressions into one sequence; splitting into statements removes that forbidden syntax.
// @evidence contracts/testing.md#distinguishing-cases Original return a++, b reports; a++ followed by return b stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoSequences is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-sequences.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoSequences(t *testing.T) {
  assertRuleCorpusCase(t, "no-sequences.ts", "function f(a: any, b: any) {\n  // expect: no-sequences error\n  return a++, b;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-sequences", "function f(a: number, b: number) { a++; return b; }\n")
}
