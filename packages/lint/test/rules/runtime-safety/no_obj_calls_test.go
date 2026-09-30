package linthost

import "testing"

// TestRuleCorpusNoObjCalls verifies the lint rule corpus fixture no-obj-calls.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-obj-calls.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original Math invocation while permitting an ordinary method call on Math.
// @evidence contracts/testing.md#independent-expectations Math is a namespace object rather than a callable object; the annotated site is the independent language-contract counterexample.
// @evidence contracts/testing.md#distinguishing-cases Math() reports; Math.abs(1) remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoObjCalls is selected in the shared Go unit population. It passes the authored no-obj-calls.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoObjCalls(t *testing.T) {
  assertRuleCorpusCase(t, "no-obj-calls.ts", "// @ts-expect-error Math is not callable; we exercise the lint rule\n// expect: no-obj-calls error\nMath();\n")
  assertRuleSkipsSource(t, "no-obj-calls", "const value = Math.abs(1);\n")
}
