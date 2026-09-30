package linthost

import "testing"

// TestRuleCorpusYoda verifies the lint rule corpus fixture yoda.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in yoda.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports literal-left equality and permits identifier-left equality.
// @evidence contracts/testing.md#independent-expectations The configured conventional operand-order policy independently selects 1 === x rather than the logically equivalent x === 1.
// @evidence contracts/testing.md#distinguishing-cases Original literal-left equality reports; its reversed operand order stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusYoda is selected in the shared Go unit population. It calls assertRuleCorpusCase with yoda.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusYoda(t *testing.T) {
  assertRuleCorpusCase(t, "yoda.ts", "function f(x: number) {\n  // expect: yoda error\n  return 1 === x;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "yoda", "function f(x: number) { return x === 1; }\n")
}
