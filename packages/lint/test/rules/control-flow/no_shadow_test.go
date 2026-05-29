package linthost

import "testing"

// TestRuleCorpusNoShadow verifies the lint rule corpus fixture no-shadow.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-shadow.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoShadow(t *testing.T) {
  assertRuleCorpusCase(t, "no-shadow.ts", "// Positive: an inner `let` shadows the outer-scope binding of the same name.\nlet outer: number = 1;\nfunction f(): number {\n  // expect: no-shadow error\n  let outer: number = 2;\n  return outer;\n}\n\n// Negative: a sibling block introduces its own binding with a distinct name.\nfunction g(): number {\n  let inner: number = 3;\n  return inner;\n}\n\nvoid [outer, f, g];\n")
}
