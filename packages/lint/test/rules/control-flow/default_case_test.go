package linthost

import "testing"

// TestRuleCorpusDefaultCase verifies the lint rule corpus fixture default-case.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This fixture is the end-to-end regression shield for issue #601: the missing-default switch
// is the sole finding, while the default-carrying, empty, and `// no default`-marked switches
// must stay silent. Before the fix the empty and marked switches also reported, so the count
// mismatch pins the bug.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusDefaultCase(t *testing.T) {
  assertRuleCorpusCase(t, "default-case.ts", "// Positive: a `switch` without a `default` clause and without a marker\n// silently lets unhandled discriminants fall through with no value -- the\n// rule reports.\nfunction classify(kind: string): string {\n  // expect: default-case error\n  switch (kind) {\n    case \"a\":\n      return \"letter-a\";\n    case \"b\":\n      return \"letter-b\";\n  }\n  return \"unknown\";\n}\n\n// Negative: a `switch` that already carries a `default` clause is fine.\nfunction describe(kind: string): string {\n  switch (kind) {\n    case \"a\":\n      return \"letter-a\";\n    default:\n      return \"unknown\";\n  }\n}\n\n// Negative: an empty `switch` has no clause to attach a marker to, so the\n// rule skips it (upstream `if (!node.cases.length) return;`).\nfunction ignoreEmpty(kind: string): void {\n  switch (kind) {\n  }\n}\n\n// Negative: a trailing `// no default` marker declares the omission\n// intentional, so the rule stays silent.\nfunction marked(kind: string): string {\n  switch (kind) {\n    case \"a\":\n      return \"letter-a\";\n    // no default\n  }\n  return \"unknown\";\n}\n\nJSON.stringify({\n  classify: classify(\"a\"),\n  describe: describe(\"b\"),\n  marked: marked(\"a\"),\n});\n")
}
