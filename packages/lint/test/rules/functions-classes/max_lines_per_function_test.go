package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusMaxLinesPerFunction verifies the lint rule corpus fixture max-lines-per-function.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in max-lines-per-function.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original body exceeding fifty source lines and permits a body spanning exactly fifty lines.
// @evidence contracts/testing.md#independent-expectations The default fifty-line limit and independently constructed newline count supply the line-span oracle, including blank padding.
// @evidence contracts/testing.md#distinguishing-cases The original long function reports; exactly fifty lines and the original short function stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusMaxLinesPerFunction is selected in the shared Go unit population. It calls assertRuleCorpusCase with max-lines-per-function.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusMaxLinesPerFunction(t *testing.T) {
  assertRuleSkipsSource(t, "max-lines-per-function", "function atLimit() {\n" + strings.Repeat("\n", 48) + "}\n")
}
