package linthost

import "testing"

// TestRuleCorpusConsistentTypeAssertions verifies the lint rule corpus fixture consistent-type-assertions.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in consistent-type-assertions.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification Angle-bracket assertions must report under the default as-style policy.
// @evidence contracts/testing.md#independent-expectations The original authored expect marker fixes exactly one typescript/consistent-type-assertions error at line 4; assertRuleCorpusCase compares complete rule/severity/line triples, while the independently authored counterpart requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases The same unknown input asserted with as syntax remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusConsistentTypeAssertions invokes the AST Engine through assertRuleCorpusCase and the registered rule through assertRuleSkipsSource in one Go unit process; no installation, child compiler or native plugin build executes.
func TestRuleCorpusConsistentTypeAssertions(t *testing.T) {
  assertRuleCorpusCase(t, "consistent-type-assertions.ts", "declare const input: unknown;\n\n// expect: typescript/consistent-type-assertions error\nconst value = <string>input;\nJSON.stringify(value);\n")
  assertRuleSkipsSource(t, "typescript/consistent-type-assertions", "declare const input: unknown;\nconst value = input as string;\n")
}
