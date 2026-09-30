package linthost

import "testing"

// TestRuleCorpusRadix verifies the lint rule corpus fixture radix.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in radix.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original parseInt call without a radix and permits a valid explicit decimal radix.
// @evidence contracts/testing.md#independent-expectations The explicit-radix call policy supplies the authored missing-argument diagnostic independently of implementation output.
// @evidence contracts/testing.md#distinguishing-cases One-argument parseInt reports; parseInt("42", 10) stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusRadix is selected in the shared Go unit population. It passes the authored radix.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusRadix(t *testing.T) {
  assertRuleCorpusCase(t, "radix.ts", "// expect: radix error\nconst n = parseInt(\"42\");\nJSON.stringify(n);\n")
  assertRuleSkipsSource(t, "radix", "const value = parseInt(\"42\", 10);\n")
}
