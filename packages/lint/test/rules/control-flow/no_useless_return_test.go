package linthost

import "testing"

// TestRuleCorpusNoUselessReturn verifies the lint rule corpus fixture no-useless-return.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-useless-return.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the final bare return while preserving a value return and a guard return before later work.
// @evidence contracts/testing.md#independent-expectations A bare trailing return has the same completion as falling off the body; an early guard and value-bearing return independently change behavior.
// @evidence contracts/testing.md#distinguishing-cases Trailing bare return reports; return 1 and the guarded early return stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUselessReturn is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-useless-return.ts through the owning Engine. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoUselessReturn(t *testing.T) {
  assertRuleCorpusCase(t, "no-useless-return.ts", "function trailing(): void {\n  console.log(\"work\");\n  // expect: no-useless-return error\n  return;\n}\n\n// Negative: `return X;` is never useless — it carries a value.\nfunction withValue(): number {\n  return 1;\n}\n\n// Negative: an early `return;` guards the statements that follow.\nfunction guarded(flag: boolean): void {\n  if (flag) {\n    return;\n  }\n  console.log(\"after\");\n}\n\ntrailing();\nJSON.stringify({ withValue: withValue(), guarded });\n")
}
