package linthost

import "testing"

// TestRuleCorpusNoLoneBlocks verifies the lint rule corpus fixture no-lone-blocks.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-lone-blocks.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the standalone block and permits a block serving an if statement body.
// @evidence contracts/testing.md#independent-expectations An if-owned block has a control-flow role independently absent from a loose top-level block.
// @evidence contracts/testing.md#distinguishing-cases Original standalone block reports; braced if body stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoLoneBlocks is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-lone-blocks.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoLoneBlocks(t *testing.T) {
  assertRuleCorpusCase(t, "no-lone-blocks.ts", "// expect: no-lone-blocks error\n{\n  console.log(\"hi\");\n}\n")
  assertRuleSkipsSource(t, "no-lone-blocks", "if (enabled) { work(); }\n")
}
