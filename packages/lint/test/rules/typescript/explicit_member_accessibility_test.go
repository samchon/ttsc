package linthost

import "testing"

// TestRuleCorpusTypescriptExplicitMemberAccessibility verifies the lint
// rule corpus fixture typescript-explicit-member-accessibility.ts.
//
// The rule fires on class members lacking an explicit `public` /
// `private` / `protected` modifier; private-hash members are exempt.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusTypescriptExplicitMemberAccessibility(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-explicit-member-accessibility.ts", "class Foo {\n  // expect: typescript/explicit-member-accessibility error\n  value: number = 0;\n}\nJSON.stringify(Foo);\n")
}
