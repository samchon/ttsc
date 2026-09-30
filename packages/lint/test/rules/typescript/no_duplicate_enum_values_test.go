package linthost

import "testing"

// TestRuleCorpusNoDuplicateEnumValues verifies the lint rule corpus fixture no-duplicate-enum-values.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-duplicate-enum-values.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification Duplicate literal enum values must report the repeated member.
// @evidence contracts/testing.md#independent-expectations The original authored expect marker fixes exactly one typescript/no-duplicate-enum-values error at line 5; assertRuleCorpusCase compares complete rule/severity/line triples, while the independently authored counterpart requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases Distinct numeric literals remain clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoDuplicateEnumValues invokes the AST Engine through assertRuleCorpusCase and the registered rule through assertRuleSkipsSource in one Go unit process; no installation, child compiler or native plugin build executes.
func TestRuleCorpusNoDuplicateEnumValues(t *testing.T) {
  assertRuleCorpusCase(t, "no-duplicate-enum-values.ts", "enum E {\n  A = 1,\n  B = 2,\n  // expect: typescript/no-duplicate-enum-values error\n  C = 1,\n}\nJSON.stringify(E.A);\n")
  assertRuleSkipsSource(t, "typescript/no-duplicate-enum-values", "enum E { A = 1, B = 2, C = 3 }\n")
}
