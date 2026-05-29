package linthost

import "testing"

// TestRuleCorpusNoThisBeforeSuper verifies the lint rule corpus fixture
// no-this-before-super.ts.
//
// The rule visits each constructor; if its class declaration extends
// another class, it walks the body for the first reachable `super()`
// call and reports any `this` or `super.x` reference whose position
// precedes it (or any such reference at all when no `super()` call is
// found). Nested function-like scopes are skipped.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusNoThisBeforeSuper(t *testing.T) {
  assertRuleCorpusCase(t, "no-this-before-super.ts", "class Base {\n  protected value: number = 0;\n  constructor(initial: number) {\n    this.value = initial;\n  }\n}\nclass Child extends Base {\n  constructor() {\n    // expect: no-this-before-super error\n    this.value = 1;\n    super(0);\n  }\n}\nJSON.stringify({ Base, Child });\n")
}
