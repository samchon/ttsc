package linthost

import "testing"

// TestRuleCorpusPreferDestructuring verifies the lint rule corpus fixture
// prefer-destructuring.ts.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares original matching-property and index-zero diagnostics while preserving renames, existing destructuring and computed string access.
// @evidence contracts/testing.md#independent-expectations Authored matching property names and the first array item correspond to direct destructuring; renamed and deliberately computed accesses are the supported exclusions.
// @evidence contracts/testing.md#distinguishing-cases obj.a assigned to a and arr[0] report; renamed obj.b, existing { b } and obj["a"] stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPreferDestructuring is selected in the shared Go unit population. It calls assertRuleCorpusCase with prefer-destructuring.ts through the owning Engine. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusPreferDestructuring(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-destructuring.ts", "declare const obj: { a: number; b: number };\ndeclare const arr: readonly number[];\n\n// Positive: `const a = obj.a;` is just the longhand object-destructuring form.\n// expect: prefer-destructuring error\nconst a = obj.a;\n\n// Positive: `const first = arr[0];` is just the longhand array form.\n// expect: prefer-destructuring error\nconst first = arr[0];\n\n// Negative: the variable name does not match the property — the\n// destructuring form would need a rename, which is a different code style.\nconst renamed = obj.b;\n\n// Negative: destructuring already in use.\nconst { b } = obj;\n\n// Negative: computed string-literal access is usually deliberate.\nconst c = obj[\"a\"];\n\nJSON.stringify({ a, first, renamed, b, c });\n")
}
