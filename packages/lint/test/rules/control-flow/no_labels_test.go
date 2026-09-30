package linthost

import "testing"

// TestRuleCorpusNoLabels verifies the lint rule corpus fixture no-labels.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-labels.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original outer loop label and permits an unlabeled loop break.
// @evidence contracts/testing.md#independent-expectations The default label prohibition independently concerns label syntax, not terminating a loop with an ordinary break.
// @evidence contracts/testing.md#distinguishing-cases Labeled outer loop reports; the unlabeled loop containing break remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoLabels is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-labels.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoLabels(t *testing.T) {
  assertRuleCorpusCase(t, "no-labels.ts", "// expect: no-labels error\nouter: for (let i = 0; i < 3; i++) {\n  break outer;\n}\n")
  assertRuleSkipsSource(t, "no-labels", "for (let i = 0; i < 3; i++) { if (i) break; }\n")
}
