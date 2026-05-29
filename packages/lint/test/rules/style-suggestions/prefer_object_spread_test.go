package linthost

import "testing"

// TestRuleCorpusPreferObjectSpread verifies the lint rule corpus fixture
// prefer-object-spread.ts.
//
// The rule fires on `Object.assign({}, …)` calls whose first argument
// is an empty object literal. Mutating `Object.assign(target, …)` calls
// are intentionally left alone — the spread form does not preserve
// their observable behavior.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusPreferObjectSpread(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-object-spread.ts", "declare const source: { x: number };\n// expect: prefer-object-spread error\nconst merged = Object.assign({}, source);\nJSON.stringify(merged);\n")
}
