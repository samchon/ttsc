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
//
// @evidence contracts/testing.md#behavioral-verification Engine reports a constructor returning an object and permits a bare early return plus a nested value-returning function.
// @evidence contracts/testing.md#independent-expectations The constructor-return policy prohibits an explicit returned value in the constructor scope, not in nested function scopes.
// @evidence contracts/testing.md#distinguishing-cases The original returned object reports; bare return and nested helper return stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoConstructorReturn is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-constructor-return.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoConstructorReturn(t *testing.T) {
  assertRuleCorpusCase(t, "no-constructor-return.ts", "class Foo {\n  value: number;\n  constructor(initial: number) {\n    this.value = initial;\n    // expect: no-constructor-return error\n    return { handled: true } as unknown as Foo;\n  }\n}\nJSON.stringify(Foo);\n")
  assertRuleSkipsSource(t, "no-constructor-return", "class Foo { constructor() { const nested = () => 1; if (nested()) return; } }\n")
}
