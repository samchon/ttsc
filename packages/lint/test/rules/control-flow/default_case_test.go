package linthost

import "testing"

// TestRuleCorpusDefaultCase verifies the lint rule corpus fixture default-case.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in default-case.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusDefaultCase(t *testing.T) {
  assertRuleCorpusCase(t, "default-case.ts", "// Positive: a `switch` without a `default` clause silently lets unhandled\n// discriminants fall through with no value — the rule wants every switch\n// to spell out the catch-all path.\nfunction classify(kind: string): string {\n  // expect: default-case error\n  switch (kind) {\n    case \"a\":\n      return \"letter-a\";\n    case \"b\":\n      return \"letter-b\";\n  }\n  return \"unknown\";\n}\n\n// Negative: a `switch` that already carries a `default` clause is fine.\nfunction describe(kind: string): string {\n  switch (kind) {\n    case \"a\":\n      return \"letter-a\";\n    default:\n      return \"unknown\";\n  }\n}\n\nJSON.stringify({ classify: classify(\"a\"), describe: describe(\"b\") });\n")
}
