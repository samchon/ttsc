package linthost

import "testing"

// TestRuleCorpusNoUselessCall verifies the lint rule corpus fixture no-useless-call.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-useless-call.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original call(undefined, 1) and permits a receiver-changing call.
// @evidence contracts/testing.md#independent-expectations Explicit undefined contributes no receiver unlike an authored nonempty object; the call policy supplies the independent contrast.
// @evidence contracts/testing.md#distinguishing-cases The undefined receiver reports; passing { value: 1 } stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUselessCall is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-useless-call.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoUselessCall(t *testing.T) {
  assertRuleCorpusCase(t, "no-useless-call.ts", "function f() {}\n// expect: no-useless-call error\nf.call(undefined, 1);\n")
  assertRuleSkipsSource(t, "no-useless-call", "function f() {} f.call({ value: 1 }, 1);\n")
}
