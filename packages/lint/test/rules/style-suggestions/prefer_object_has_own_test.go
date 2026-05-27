package linthost

import "testing"

// TestRuleCorpusPreferObjectHasOwn verifies the lint rule corpus
// fixture prefer-object-has-own.ts.
//
// The rule fires on `Object.prototype.hasOwnProperty.call(...)` calls
// and suggests the ES2022 `Object.hasOwn(obj, key)` shorthand.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusPreferObjectHasOwn(t *testing.T) {
	assertRuleCorpusCase(t, "prefer-object-has-own.ts", "declare const target: { x: number };\n// expect: prefer-object-has-own error\nconst a = Object.prototype.hasOwnProperty.call(target, \"x\");\nJSON.stringify(a);\n")
}
