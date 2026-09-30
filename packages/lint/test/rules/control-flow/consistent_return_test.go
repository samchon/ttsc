package linthost

import "testing"

// TestRuleCorpusConsistentReturn verifies the lint rule corpus fixture consistent-return.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in consistent-return.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports value-versus-bare return inconsistency and preserves the original all-value function.
// @evidence contracts/testing.md#independent-expectations An independently authored branch returning 1 differs in value presence from bare return; two value returns satisfy the contract.
// @evidence contracts/testing.md#distinguishing-cases The mixed function reports; both original value-bearing returns stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusConsistentReturn is selected in the shared Go unit population. It calls assertRuleCorpusCase with consistent-return.ts through the owning Engine. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusConsistentReturn(t *testing.T) {
  assertRuleCorpusCase(t, "consistent-return.ts", "// Positive: one branch returns a value, the other returns bare.\n// expect: consistent-return error\nfunction mixed(flag: boolean): number | undefined {\n  if (flag) {\n    return 1;\n  }\n  return;\n}\n\n// Negative: every `return` carries a value.\nfunction always(flag: boolean): number {\n  if (flag) {\n    return 1;\n  }\n  return 2;\n}\n\nvoid [mixed, always];\n")
}
