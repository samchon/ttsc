package linthost

import "testing"

// TestRuleCorpusNoEmptyStaticBlock verifies the lint rule corpus fixture no-empty-static-block.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-empty-static-block.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports the authored empty class static initializer.
// @evidence contracts/testing.md#independent-expectations The literal annotation identifies a body containing no statements or explanatory comments, independently of findings.
// @evidence contracts/testing.md#distinguishing-cases Basic empty static positive complements TestNoEmptyStaticBlockCommentBoundaries for every comment/nonempty control.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's independently annotated fixture through the Go engine and compares rule/severity/line triples. This Test owns all marked violations and unmarked controls. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestRuleCorpusNoEmptyStaticBlock(t *testing.T) {
  assertRuleCorpusCase(t, "no-empty-static-block.ts", "class Holder {\n  // expect: no-empty-static-block error\n  static {}\n}\n")
}
