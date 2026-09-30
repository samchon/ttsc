package linthost

import "testing"

// TestRuleCorpusNoNewFunc verifies the lint rule corpus fixture no-new-func.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-new-func.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the Function constructor and permits an ordinary declared function.
// @evidence contracts/testing.md#independent-expectations The dynamic-code construction policy forbids Function, not conventional function declarations with equivalent bodies.
// @evidence contracts/testing.md#distinguishing-cases new Function reports; a static f returning its argument stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoNewFunc is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-new-func.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoNewFunc(t *testing.T) {
  assertRuleCorpusCase(t, "no-new-func.ts", "// expect: no-new-func error\nconst f = new Function(\"a\", \"return a\");\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-new-func", "function f(a: string) { return a; }\n")
}
