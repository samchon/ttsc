package linthost

import "testing"

// TestRuleCorpusNoDupeArgs verifies the lint rule corpus fixture no-dupe-args.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-dupe-args.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the duplicate a parameter in the original signature while permitting distinct parameter names.
// @evidence contracts/testing.md#independent-expectations Parameters in one signature must not repeat binding names; the authored duplicate annotation provides the independent oracle.
// @evidence contracts/testing.md#distinguishing-cases Repeated a reports; a and b in a two-parameter function stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoDupeArgs is selected in the shared Go unit population. It passes the authored no-dupe-args.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoDupeArgs(t *testing.T) {
  assertRuleCorpusCase(t, "no-dupe-args.ts", "// expect: no-dupe-args error\nfunction f(a: number, b: number, a: number) {\n  return a + b;\n}\nf(1, 2, 3);\n")
  assertRuleSkipsSource(t, "no-dupe-args", "function f(a: number, b: number) { return a + b; }\n")
}
