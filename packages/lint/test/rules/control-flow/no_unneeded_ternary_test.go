package linthost

import "testing"

// TestRuleCorpusNoUnneededTernary verifies the lint rule corpus fixture no-unneeded-ternary.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-unneeded-ternary.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original boolean branch pair and permits a value-selecting ternary.
// @evidence contracts/testing.md#independent-expectations Selecting true/false only re-expresses boolean conversion; independently distinct numeric results make a ternary necessary.
// @evidence contracts/testing.md#distinguishing-cases Original true/false pair reports; x ? 1 : 2 stays clean. The three fixer cases own both branch orders and precedence.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnneededTernary is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-unneeded-ternary.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoUnneededTernary(t *testing.T) {
  assertRuleCorpusCase(t, "no-unneeded-ternary.ts", "function f(x: any) {\n  // expect: no-unneeded-ternary error\n  return x ? true : false;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-unneeded-ternary", "function f(x: unknown) { return x ? 1 : 2; }\n")
}
