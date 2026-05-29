package linthost

import "testing"

// TestRuleCorpusDefaultCaseLast verifies the lint rule corpus fixture default-case-last.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in default-case-last.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusDefaultCaseLast(t *testing.T) {
  assertRuleCorpusCase(t, "default-case-last.ts", "// Positive: the `default` clause appears before the explicit `case`\n// labels, so a fall-through from `default` lands in `case \"b\"` — almost\n// always a misordering rather than the intent.\nfunction classify(kind: string): string {\n  switch (kind) {\n    // expect: default-case-last error\n    default:\n      return \"unknown\";\n    case \"a\":\n      return \"letter-a\";\n    case \"b\":\n      return \"letter-b\";\n  }\n}\n\n// Negative: the `default` clause already trails every `case` label, which\n// is the conventional ordering and what the rule wants to enforce.\nfunction describe(kind: string): string {\n  switch (kind) {\n    case \"a\":\n      return \"letter-a\";\n    case \"b\":\n      return \"letter-b\";\n    default:\n      return \"unknown\";\n  }\n}\n\nJSON.stringify({ classify: classify(\"a\"), describe: describe(\"b\") });\n")
}
