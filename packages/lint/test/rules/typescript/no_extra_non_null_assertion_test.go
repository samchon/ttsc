package linthost

import "testing"

// TestRuleCorpusNoExtraNonNullAssertion verifies the lint rule corpus fixture no-extra-non-null-assertion.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-extra-non-null-assertion.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification Repeated non-null assertion syntax must report the redundant assertion.
// @evidence contracts/testing.md#independent-expectations The original authored expect marker fixes exactly one typescript/no-extra-non-null-assertion error at line 3; assertRuleCorpusCase compares complete rule/severity/line triples, while the independently authored counterpart requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases A single non-null assertion remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoExtraNonNullAssertion invokes the AST Engine through assertRuleCorpusCase and the registered rule through assertRuleSkipsSource in one Go unit process; no installation, child compiler or native plugin build executes.
func TestRuleCorpusNoExtraNonNullAssertion(t *testing.T) {
  assertRuleCorpusCase(t, "no-extra-non-null-assertion.ts", "function f(x: number | null) {\n  // expect: typescript/no-extra-non-null-assertion error\n  return x!!;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "typescript/no-extra-non-null-assertion", "function f(x: number | null) { return x!; }\n")
}
