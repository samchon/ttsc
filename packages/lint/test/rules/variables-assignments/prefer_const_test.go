package main

import "testing"

// TestRuleCorpusPreferConst verifies the lint rule corpus fixture prefer-const.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in prefer-const.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusPreferConst(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-const.ts", "// expect: prefer-const error\nlet stable = 1;\nlet changing = 1;\nchanging = 2;\n\nfor (let i = 0; i < 2; i++) {\n  JSON.stringify(i);\n}\n\n// expect: prefer-const error\nfor (let item of [1, 2]) {\n  JSON.stringify(item);\n}\n\nJSON.stringify([stable, changing]);\n")
}
