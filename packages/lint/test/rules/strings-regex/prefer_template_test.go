package linthost

import "testing"

// TestRuleCorpusPreferTemplate verifies the lint rule corpus fixture prefer-template.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in prefer-template.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports the authored greeting/name/suffix concatenation as a template candidate.
// @evidence contracts/testing.md#independent-expectations The independently annotated expression combines literal segments and a dynamic name, matching supported template migration policy.
// @evidence contracts/testing.md#distinguishing-cases Positive detection is paired with all-literal and numeric-only negative entries and exact fixer cases.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase executes the embedded annotation fixture through the rule engine. This Test owns every literal expected diagnostic and every unmarked source control. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRuleCorpusPreferTemplate(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-template.ts", "const name = \"world\";\n// expect: prefer-template error\nconst s = \"hi \" + name + \"!\";\nJSON.stringify(s);\n")
}
