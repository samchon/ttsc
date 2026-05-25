package linthost

import "testing"

// TestRuleCorpusNoWrapperObjectTypes verifies the lint rule corpus fixture no-wrapper-object-types.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-wrapper-object-types.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoWrapperObjectTypes(t *testing.T) {
  assertRuleCorpusCase(t, "no-wrapper-object-types.ts", "// expect: noWrapperObjectTypes error\ntype Name = String;\n\nJSON.stringify({} as Name);\n")
}
