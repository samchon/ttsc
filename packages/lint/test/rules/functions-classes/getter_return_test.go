package linthost

import "testing"

// TestRuleCorpusGetterReturn verifies the lint rule corpus fixture
// getter-return.ts.
//
// The rule checks the last statement of a getter body for a value-
// returning return or throw. Conditional getters whose else branch
// falls through also fire.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusGetterReturn(t *testing.T) {
	assertRuleCorpusCase(t, "getter-return.ts", "class Foo {\n  // expect: getter-return error\n  get value(): number {\n    JSON.stringify({});\n  }\n}\nJSON.stringify(Foo);\n")
}
