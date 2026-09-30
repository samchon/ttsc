package linthost

import "testing"

// TestRuleCorpusNoEmptyObjectType verifies the lint rule corpus fixture no-empty-object-type.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-empty-object-type.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification An empty object type must report.
// @evidence contracts/testing.md#independent-expectations The original authored expect marker fixes exactly one typescript/no-empty-object-type error at line 2; assertRuleCorpusCase compares complete rule/severity/line triples, while the independently authored counterpart requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases An object type with a member remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoEmptyObjectType invokes the AST Engine through assertRuleCorpusCase and the registered rule through assertRuleSkipsSource in one Go unit process; no installation, child compiler or native plugin build executes.
func TestRuleCorpusNoEmptyObjectType(t *testing.T) {
  assertRuleCorpusCase(t, "no-empty-object-type.ts", "// expect: typescript/no-empty-object-type error\ntype T = {};\nconst v: T = {};\nJSON.stringify(v);\n")
  assertRuleSkipsSource(t, "typescript/no-empty-object-type", "type T = { value: string };\n")
}
