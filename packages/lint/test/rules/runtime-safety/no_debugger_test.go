package linthost

import "testing"

// TestRuleCorpusNoDebugger verifies the lint rule corpus fixture no-debugger.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-debugger.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original debugger statement while permitting an ordinary function body.
// @evidence contracts/testing.md#independent-expectations The debugger-statement prohibition supplies the authored diagnostic independently of parser output or repository source text.
// @evidence contracts/testing.md#distinguishing-cases The debugger keyword statement reports; a function that merely calls work stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoDebugger is selected in the shared Go unit population. It passes the authored no-debugger.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoDebugger(t *testing.T) {
  assertRuleCorpusCase(t, "no-debugger.ts", "function f(): void {\n  // expect: no-debugger error\n  debugger;\n}\nf();\n")
  assertRuleSkipsSource(t, "no-debugger", "function f() { work(); }\n")
}
