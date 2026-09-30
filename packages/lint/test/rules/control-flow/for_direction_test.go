package linthost

import "testing"

// TestRuleCorpusForDirection verifies the lint rule corpus fixture for-direction.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in for-direction.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports decrement toward an upper-bound termination test and permits matching increment or a lower-bound decrement.
// @evidence contracts/testing.md#independent-expectations An index beginning below ten cannot approach ten by decrementing; independently authored opposite update/test pairs approach their boundary.
// @evidence contracts/testing.md#distinguishing-cases The original i < 10 with i-- reports; increasing toward an upper bound and decreasing toward a lower bound stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusForDirection is selected in the shared Go unit population. It calls assertRuleCorpusCase with for-direction.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusForDirection(t *testing.T) {
  assertRuleCorpusCase(t, "for-direction.ts", "// expect: for-direction error\nfor (let i = 0; i < 10; i--) {}\n")
  assertRuleSkipsSource(t, "for-direction", "for (let i = 0; i < 10; i++) {} for (let i = 10; i > 0; i--) {}\n")
}
