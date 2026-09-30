package linthost

import "testing"

// TestRuleCorpusNoEmpty verifies the lint rule corpus fixture no-empty.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-empty.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports the empty if body inside a nonempty function.
// @evidence contracts/testing.md#independent-expectations The independently authored marker concerns the control-flow block, not its function container.
// @evidence contracts/testing.md#distinguishing-cases Nested empty-if positive complements the complete semantics unit for all body shapes, comments and catch gating.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's independently annotated fixture through the Go engine and compares rule/severity/line triples. This Test owns all marked violations and unmarked controls. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestRuleCorpusNoEmpty(t *testing.T) {
  assertRuleCorpusCase(t, "no-empty.ts", "function f(x: number) {\n  // expect: no-empty error\n  if (x === 0) {\n  }\n}\nJSON.stringify(f);\n")
}
