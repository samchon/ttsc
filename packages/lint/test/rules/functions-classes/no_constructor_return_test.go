package linthost

import "testing"

// TestRuleCorpusNoConstructorReturn verifies the lint rule corpus
// fixture no-constructor-return.ts.
//
// The rule visits constructor declarations, walks the body (skipping
// nested function-like scopes), and reports any `return X;` statement
// where X is non-empty. Bare `return;` is allowed because it just
// short-circuits the constructor; only the value-returning form is
// the misunderstanding the rule targets.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusNoConstructorReturn(t *testing.T) {
	assertRuleCorpusCase(t, "no-constructor-return.ts", "class Foo {\n  value: number;\n  constructor(initial: number) {\n    this.value = initial;\n    // expect: no-constructor-return error\n    return { handled: true } as unknown as Foo;\n  }\n}\nJSON.stringify(Foo);\n")
}
